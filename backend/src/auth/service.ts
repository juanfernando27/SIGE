import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";
import { pool, one, rows, transaction, type Queryable } from "../config/db.js";
import { env } from "../config/env.js";
import { audit } from "../repositories/audit.js";
import { AppError, assert } from "../utils/errors.js";
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export interface Actor {
  id: number;
  name: string;
  email: string;
  role: string;
  role_id: number;
  permissions: string[];
  sessionId: string;
  csrfHash: string;
}
async function actorFor(
  db: Queryable,
  where: string,
  value: string,
): Promise<Actor | undefined> {
  const user = await one(
    db,
    `SELECT u.id,u.name,u.email,u.role_id,r.name AS role,s.id AS sessionId,s.csrf_hash AS csrfHash FROM sesiones_autenticacion s JOIN usuarios u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE ${where}=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() AND u.status='active'`,
    [value],
  );
  if (!user) return;
  user.permissions = (
    await rows(
      db,
      "SELECT p.name FROM permisos p JOIN roles_permisos rp ON rp.permission_id=p.id WHERE rp.role_id=?",
      [user.role_id],
    )
  ).map((v) => v.name);
  return user;
}
export async function authenticate(access: string) {
  return actorFor(
    pool,
    "s.access_expires_at>UTC_TIMESTAMP() AND s.access_hash",
    hash(access),
  );
}
export async function refreshActor(refresh: string) {
  return actorFor(pool, "s.refresh_hash", hash(refresh));
}
function credentials() {
  return { access: token(), refresh: token(), csrf: token() };
}
const expiry = () => new Date(Date.now() + env.ACCESS_MINUTES * 60000);
export async function login(email: string, password: string) {
  const identity = hash(email.toLowerCase());
  const attempts = await one(
    pool,
    "SELECT COUNT(*) AS n FROM intentos_inicio_sesion WHERE identity_hash=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)",
    [identity],
  );
  assert(
    Number(attempts?.n) < 10,
    429,
    "Demasiados intentos. Intenta de nuevo en 15 minutos.",
  );
  await pool.query(
    "INSERT INTO intentos_inicio_sesion(identity_hash) VALUES(?)",
    [identity],
  );
  const user = await one(pool, "SELECT * FROM usuarios WHERE email=?", [
    email.toLowerCase(),
  ]);
  // A real Argon2 computation also runs for unknown identities.
  const dummy =
    "$argon2id$v=19$m=65536,t=3,p=4$YWJjZGVmZ2hpamtsbW5vcA$PWv2XFRNdlt4aig4S0bVbqz8gCNO2nwJAB8gPwEZQAI";
  const valid = await argon2
    .verify(user?.password_hash || dummy, password)
    .catch(() => false);
  if (!valid || user?.status !== "active") {
    await audit(pool, null, "login", "auth", null, { identity }, "failure");
    throw new AppError(401, "Correo o contraseña incorrectos.");
  }
  const c = credentials(),
    sessionId = randomUUID();
  await transaction(async (db) => {
    await db.query(
      "INSERT INTO sesiones_autenticacion(id,user_id,access_hash,refresh_hash,csrf_hash,access_expires_at,expires_at) VALUES(?,?,?,?,?,?,?)",
      [
        sessionId,
        user.id,
        hash(c.access),
        hash(c.refresh),
        hash(c.csrf),
        expiry(),
        new Date(Date.now() + env.SESSION_DAYS * 86400000),
      ],
    );
    await db.query("DELETE FROM intentos_inicio_sesion WHERE identity_hash=?", [
      identity,
    ]);
    await audit(db, user.id, "login", "auth", sessionId);
  });
  return c;
}
export async function refresh(refresh: string, csrf: string) {
  const result = await transaction(async (db) => {
    const old = await one(
      db,
      "SELECT * FROM sesiones_autenticacion WHERE refresh_hash=? FOR UPDATE",
      [hash(refresh)],
    );
    if (!old) {
      const used = await one(
        db,
        "SELECT session_id FROM tokens_renovacion_usados WHERE token_hash=?",
        [hash(refresh)],
      );
      if (used) {
        await db.query(
          "UPDATE sesiones_autenticacion SET revoked_at=UTC_TIMESTAMP() WHERE id=?",
          [used.session_id],
        );
        await audit(
          db,
          null,
          "refresh_reuse",
          "auth",
          used.session_id,
          {},
          "failure",
        );
      }
      return null;
    }
    if (
      old.revoked_at ||
      new Date(old.expires_at).getTime() <= Date.now() ||
      !equal(hash(csrf), old.csrf_hash)
    )
      return null;
    const user = await one(db, "SELECT status FROM usuarios WHERE id=?", [
      old.user_id,
    ]);
    if (user?.status !== "active") return null;
    const c = credentials();
    await db.query(
      "INSERT INTO tokens_renovacion_usados(token_hash,session_id,expires_at) VALUES(?,?,?)",
      [old.refresh_hash, old.id, old.expires_at],
    );
    await db.query(
      "UPDATE sesiones_autenticacion SET access_hash=?,refresh_hash=?,csrf_hash=?,access_expires_at=? WHERE id=?",
      [hash(c.access), hash(c.refresh), hash(c.csrf), expiry(), old.id],
    );
    return c;
  });
  assert(result, 401, "Sesión expirada. Inicia sesión nuevamente.");
  return result;
}
export async function logout(actor: Actor) {
  await transaction(async (db) => {
    await db.query(
      "UPDATE sesiones_autenticacion SET revoked_at=UTC_TIMESTAMP() WHERE id=?",
      [actor.sessionId],
    );
    await audit(db, actor.id, "logout", "auth", actor.sessionId);
  });
}
export async function changePassword(
  actor: Actor,
  current: string,
  next: string,
) {
  const user = await one(
    pool,
    "SELECT password_hash FROM usuarios WHERE id=?",
    [actor.id],
  );
  assert(
    user && (await argon2.verify(user.password_hash, current)),
    400,
    "La contraseña actual es incorrecta.",
  );
  const encoded = await argon2.hash(next, { type: argon2.argon2id });
  await transaction(async (db) => {
    await db.query("UPDATE usuarios SET password_hash=? WHERE id=?", [
      encoded,
      actor.id,
    ]);
    await db.query(
      "UPDATE sesiones_autenticacion SET revoked_at=UTC_TIMESTAMP() WHERE user_id=?",
      [actor.id],
    );
    await audit(db, actor.id, "password_change", "users", actor.id);
  });
}
