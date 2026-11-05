import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { api } from "./routes/api.js";
import { originCsrf, requireAuth, permit } from "./middlewares/security.js";
import { AppError } from "./utils/errors.js";
import { openapi } from "./openapi.js";
import { audit } from "./repositories/audit.js";
import { pool } from "./config/db.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(originCsrf);
app.get("/api/openapi.json", requireAuth, permit("users.write"), (_req, res) =>
  res.json(openapi),
);
app.use(
  "/api/docs",
  requireAuth,
  permit("users.write"),
  (
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    res.set(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:",
    );
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(openapi),
);
app.use("/api", api);
app.use((_req, _res, next) => next(new AppError(404, "Ruta no encontrada.")));
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (_req.actor && !["GET", "HEAD", "OPTIONS"].includes(_req.method))
      void audit(
        pool,
        _req.actor.id,
        "request_failed",
        _req.path.split("/")[2]?.slice(0, 40) || "api",
        null,
        {
          method: _req.method,
          code:
            error instanceof AppError
              ? error.code
              : error instanceof ZodError
                ? "VALIDATION_ERROR"
                : "REQUEST_ERROR",
        },
        "failure",
      ).catch(() => {});
    if (error instanceof ZodError)
      return res.status(422).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisa los campos del formulario.",
          details: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
      });
    if (error instanceof multer.MulterError)
      return res.status(413).json({
        error: {
          code: "UPLOAD_ERROR",
          message:
            "Archivo demasiado grande o formulario inválido. Máximo 5 MB.",
        },
      });
    if (error?.code === "ER_DUP_ENTRY")
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message:
            "Ya existe un registro con ese código, identificación o correo.",
        },
      });
    if (
      error?.code === "ER_NO_REFERENCED_ROW_2" ||
      error?.code === "ER_ROW_IS_REFERENCED_2"
    )
      return res.status(409).json({
        error: {
          code: "REFERENCE_CONFLICT",
          message:
            "El registro está relacionado con datos existentes o inválidos.",
        },
      });
    if (
      error?.code === "ER_LOCK_DEADLOCK" ||
      error?.code === "ER_LOCK_WAIT_TIMEOUT"
    )
      return res.status(409).json({
        error: {
          code: "CONCURRENT_OPERATION",
          message: "Otra operación modificó estos datos. Intenta de nuevo.",
        },
      });
    const status =
      error instanceof AppError
        ? error.status
        : error?.type === "entity.parse.failed"
          ? 400
          : 500;
    if (status === 500)
      console.error("request_error", {
        code: error?.code,
        message: error?.message,
      });
    return res.status(status).json({
      error: {
        code: error instanceof AppError ? error.code : "SERVER_ERROR",
        message: status === 500 ? "Ocurrió un error interno." : error.message,
      },
    });
  },
);
