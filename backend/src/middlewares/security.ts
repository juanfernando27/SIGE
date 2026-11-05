import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { authenticate, equal, hash, type Actor } from "../auth/service.js";
import { AppError, assert } from "../utils/errors.js";
declare global {
  namespace Express {
    interface Request {
      actor: Actor;
    }
  }
}
export const cookieNames = {
  access: env.NODE_ENV === "production" ? "__Host-sige_access" : "sige_access",
  refresh:
    env.NODE_ENV === "production" ? "__Host-sige_refresh" : "sige_refresh",
  csrf: env.NODE_ENV === "production" ? "__Host-sige_csrf" : "sige_csrf",
};
export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
export function setCredentials(
  res: Response,
  c: { access: string; refresh: string; csrf: string },
) {
  res.cookie(cookieNames.access, c.access, {
    ...cookieOptions,
    maxAge: env.ACCESS_MINUTES * 60000,
  });
  res.cookie(cookieNames.refresh, c.refresh, {
    ...cookieOptions,
    maxAge: env.SESSION_DAYS * 86400000,
  });
  res.cookie(cookieNames.csrf, c.csrf, {
    ...cookieOptions,
    maxAge: env.SESSION_DAYS * 86400000,
  });
}
export function clearCredentials(res: Response) {
  for (const name of Object.values(cookieNames))
    res.clearCookie(name, cookieOptions);
}
export function originCsrf(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  assert(origin === env.APP_ORIGIN, 403, "Origen de solicitud no autorizado.");
  const header = req.get("x-csrf-token") || "",
    cookie = req.cookies[cookieNames.csrf] || "";
  assert(
    header.length === 64 && equal(header, cookie),
    403,
    "Protección CSRF: vuelve a cargar la página.",
  );
  next();
}
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const access = req.cookies[cookieNames.access];
  const actor = access ? await authenticate(access) : undefined;
  if (!actor) throw new AppError(401, "Debes iniciar sesión.");
  req.actor = actor;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
    assert(
      equal(hash(req.get("x-csrf-token") || ""), actor.csrfHash),
      403,
      "Token CSRF inválido.",
    );
  next();
}
export const permit =
  (permission: string) =>
  (req: Request, _res: Response, next: NextFunction) => {
    assert(
      req.actor.permissions.includes(permission),
      403,
      "No tienes permiso para esta operación.",
    );
    next();
  };
