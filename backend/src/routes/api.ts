import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { pool, one, rows, transaction } from "../config/db.js";
import { env } from "../config/env.js";
import { id, entities, password } from "../validators/index.js";
import { action, collection, ok } from "../controllers/index.js";
import * as auth from "../auth/service.js";
import {
  cookieNames,
  cookieOptions,
  setCredentials,
  clearCredentials,
  requireAuth,
  permit,
} from "../middlewares/security.js";
import * as catalog from "../services/catalog.js";
import * as orders from "../services/orders.js";
import * as inventory from "../services/inventory.js";
import * as documents from "../services/documents.js";
import * as analytics from "../services/analytics.js";
import * as reports from "../services/reports.js";
import { storage } from "../storage/index.js";
import { audit } from "../repositories/audit.js";
import { assert } from "../utils/errors.js";
export const api = Router();
api.get("/health", (_req, res) =>
  ok(res, { status: "ok", service: "sige-api" }),
);
api.get("/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    await storage.ready();
    ok(res, { status: "ready", database: "up", storage: "up" });
  } catch {
    res.status(503).json({
      error: {
        code: "NOT_READY",
        message: "Una dependencia no está disponible.",
      },
    });
  }
});
api.get("/auth/csrf", (req, res) => {
  const csrf = req.cookies[cookieNames.csrf] || auth.token();
  res.cookie(cookieNames.csrf, csrf, {
    ...cookieOptions,
    maxAge: env.SESSION_DAYS * 86400000,
  });
  ok(res, { csrfToken: csrf });
});
api.post("/auth/login", async (req, res) => {
  const v = z
    .object({ email: z.email().max(190), password: z.string().min(1).max(128) })
    .strict()
    .parse(req.body);
  const c = await auth.login(v.email, v.password);
  setCredentials(res, c);
  ok(res, { csrfToken: c.csrf });
});
api.post("/auth/refresh", async (req, res) => {
  const refresh = req.cookies[cookieNames.refresh];
  assert(refresh, 401, "Sesión expirada.");
  const c = await auth.refresh(refresh, req.get("x-csrf-token") || "");
  setCredentials(res, c);
  ok(res, { csrfToken: c.csrf });
});
api.use(requireAuth);
api.get("/auth/me", (req, res) => {
  const { csrfHash, sessionId, ...user } = req.actor;
  ok(res, { ...user, csrfToken: req.cookies[cookieNames.csrf] });
});
api.post("/auth/logout", async (req, res) => {
  await auth.logout(req.actor);
  clearCredentials(res);
  ok(res, { message: "Sesión cerrada." });
});
api.put("/auth/password", async (req, res) => {
  const v = z
    .object({ current: z.string().max(128), next: password })
    .strict()
    .parse(req.body);
  await auth.changePassword(req.actor, v.current, v.next);
  clearCredentials(res);
  ok(res, { message: "Contraseña actualizada. Vuelve a iniciar sesión." });
});
api.get(
  "/roles",
  permit("users.write"),
  action(() => rows(pool, "SELECT * FROM roles ORDER BY id")),
);
api.get(
  "/dashboard",
  permit("dashboard.read"),
  action((r) => analytics.dashboard(r.query)),
);
api.get(
  "/products/low-stock",
  permit("products.read"),
  collection((r) => inventory.list(r.query, true)),
);
for (const entity of Object.keys(entities) as (keyof typeof entities)[]) {
  api.get(
    `/${entity}`,
    permit(`${entity}.read`),
    collection((r) => catalog.list(entity, r.query)),
  );
  api.get(
    `/${entity}/:id`,
    permit(`${entity}.read`),
    action((r) => catalog.get(entity, id.parse(r.params.id))),
  );
  api.post(
    `/${entity}`,
    permit(`${entity}.write`),
    action((r) => catalog.save(r.actor, entity, null, r.body), 201),
  );
  api.put(
    `/${entity}/:id`,
    permit(`${entity}.write`),
    action((r) => catalog.save(r.actor, entity, id.parse(r.params.id), r.body)),
  );
  api.delete(
    `/${entity}/:id`,
    permit(`${entity}.write`),
    action((r) => catalog.deactivate(r.actor, entity, id.parse(r.params.id))),
  );
}
for (const type of ["sales", "purchases"] as const) {
  api.get(
    `/${type}`,
    permit(`${type}.read`),
    collection((r) => orders.list(type, r.query)),
  );
  api.get(
    `/${type}/:id`,
    permit(`${type}.read`),
    action((r) => orders.get(type, id.parse(r.params.id))),
  );
  api.post(
    `/${type}`,
    permit(`${type}.write`),
    action((r) => orders.create(r.actor, type, r.body), 201),
  );
  const transition = type === "sales" ? "confirm" : "receive";
  api.post(
    `/${type}/:id/${transition}`,
    permit(`${type}.write`),
    action((r) =>
      orders.transition(
        r.actor,
        type,
        id.parse(r.params.id),
        transition,
        r.body,
      ),
    ),
  );
  api.post(
    `/${type}/:id/cancel`,
    permit(`${type}.write`),
    action((r) =>
      orders.transition(r.actor, type, id.parse(r.params.id), "cancel", r.body),
    ),
  );
  api.get(`/${type}/:id/receipt`, permit(`${type}.read`), async (req, res) => {
    const docId = id.parse(req.params.id);
    res
      .type("pdf")
      .attachment(`${type}-${docId}.pdf`)
      .send(await reports.receipt(type, docId));
  });
}
api.get(
  "/customers/:id/sales",
  permit("customers.read"),
  permit("sales.read"),
  collection((r) => orders.list("sales", r.query, id.parse(r.params.id))),
);
api.get(
  "/suppliers/:id/purchases",
  permit("suppliers.read"),
  permit("purchases.read"),
  collection((r) => orders.list("purchases", r.query, id.parse(r.params.id))),
);
api.get(
  "/inventory",
  permit("inventory.read"),
  collection((r) => inventory.list(r.query)),
);
api.get(
  "/inventory/movements",
  permit("inventory.read"),
  collection((r) => inventory.movements(r.query)),
);
api.post(
  "/inventory/adjustments",
  permit("inventory.write"),
  action((r) => inventory.adjust(r.actor, r.body), 201),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
});
api.get(
  "/documents",
  collection((r) => documents.list(r.actor, r.query)),
);
api.post(
  "/documents",
  upload.single("file"),
  action((r) => documents.upload(r.actor, r.body, r.file), 201),
);
api.get(
  "/documents/:id",
  action((r) => documents.get(r.actor, id.parse(r.params.id))),
);
api.get("/documents/:id/download", async (req, res) => {
  const d = await documents.get(req.actor, id.parse(req.params.id));
  res.type(d.mime_type);
  if (req.query.inline === "1" && d.mime_type.startsWith("image/"))
    res.set("Content-Disposition", "inline");
  else res.attachment(d.original_name);
  res
    .set("Cache-Control", "private, no-store")
    .send(await storage.get(d.storage_key));
});
api.post(
  "/documents/:id/download-url",
  action(async (r) => {
    const d = await documents.get(r.actor, id.parse(r.params.id));
    assert(
      storage.downloadUrl,
      409,
      "Las URL prefirmadas requieren S3. Usa la descarga local.",
    );
    return {
      url: await storage.downloadUrl(d.storage_key, d.original_name),
      expiresIn: 60,
    };
  }),
);
api.delete(
  "/documents/:id",
  action(async (r) => {
    await documents.remove(r.actor, id.parse(r.params.id));
    return { deleted: true };
  }),
);
api.get("/reports/:kind", permit("reports.read"), async (req, res) => {
  const kind = z
    .enum(["sales", "purchases", "inventory", "low-stock"])
    .parse(req.params.kind);
  const format = z
    .enum(["json", "csv", "pdf"])
    .default("json")
    .parse(req.query.format);
  const data = await reports.report(kind, req.query);
  if (format === "csv")
    res
      .type("text/csv; charset=utf-8")
      .attachment(`${kind}.csv`)
      .send(reports.csv(data));
  else if (format === "pdf")
    res
      .type("pdf")
      .attachment(`${kind}.pdf`)
      .send(await reports.pdf(`Reporte: ${kind}`, data));
  else ok(res, data);
});
api.get(
  "/audit",
  permit("audit.read"),
  collection((r) => analytics.auditLog(r.query)),
);
api.get(
  "/notifications",
  collection((r) => analytics.notifications(r.actor.id, r.query)),
);
api.post(
  "/notifications/:id/read",
  action(async (r) => {
    const docId = id.parse(r.params.id);
    assert(
      await one(pool, "SELECT id FROM notificaciones WHERE id=?", [docId]),
      404,
      "Notificación no encontrada.",
    );
    await transaction(async (db) => {
      await db.query(
        "INSERT IGNORE INTO lecturas_notificaciones(notification_id,user_id) VALUES(?,?)",
        [docId, r.actor.id],
      );
      await audit(db, r.actor.id, "read", "notifications", docId);
    });
    return { read: true };
  }),
);
