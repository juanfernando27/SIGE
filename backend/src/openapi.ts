import { z } from "zod";
import {
  entities,
  orderInput,
  adjustment,
  cancellation,
} from "./validators/index.js";
const paths: Record<string, any> = {};
const json = (schema: any) => ({ content: { "application/json": { schema } } });
const result = {
  description:
    "Respuesta satisfactoria. Importes monetarios serializados como texto decimal.",
  ...json({
    type: "object",
    properties: { data: {}, meta: { type: "object" } },
  }),
};
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 422, 429, 500, 503].map((c) => [
    c,
    {
      description: `Error HTTP ${c}`,
      ...json({ $ref: "#/components/schemas/Error" }),
    },
  ]),
);
const query = [
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 15 },
  },
  ...["q", "status", "from", "to"].map((name) => ({
    name,
    in: "query",
    schema: {
      type: "string",
      ...(name === "from" || name === "to" ? { format: "date" } : {}),
    },
  })),
];
function route(
  path: string,
  method: string,
  summary: string,
  options: {
    body?: any;
    list?: boolean;
    public?: boolean;
    binary?: string;
    created?: boolean;
  } = {},
) {
  const params = [
    ...(path.includes("{id}")
      ? [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ]
      : []),
    ...(options.list ? query : []),
  ];
  const op: any = {
    summary,
    tags: [path.split("/")[2]],
    security: options.public ? [] : [{ accessCookie: [] }],
    parameters: params,
    responses: {
      [options.created ? 201 : 200]: options.binary
        ? {
            description: "Archivo descargable",
            content: {
              [options.binary]: {
                schema: { type: "string", format: "binary" },
              },
            },
          }
        : result,
      ...errors,
    },
  };
  if (!["get", "head"].includes(method))
    params.push({
      name: "X-CSRF-Token",
      in: "header",
      required: true,
      schema: { type: "string" },
    });
  if (options.body) op.requestBody = { required: true, ...json(options.body) };
  (paths[path] ||= {})[method] = op;
}
const schema = (s: z.ZodType) =>
  z.toJSONSchema(s, { io: "input", unrepresentable: "any" });
route("/api/health", "get", "Liveness sin dependencias", { public: true });
route("/api/ready", "get", "Readiness de MySQL y almacenamiento", {
  public: true,
});
route("/api/auth/csrf", "get", "Obtener token CSRF", { public: true });
route("/api/auth/login", "post", "Iniciar sesión; establece cookies HttpOnly", {
  public: true,
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string" },
    },
  },
});
route("/api/auth/refresh", "post", "Rotar acceso, renovación y CSRF", {
  public: true,
});
route("/api/auth/logout", "post", "Revocar sesión");
route("/api/auth/me", "get", "Perfil y permisos de la sesión");
route("/api/auth/password", "put", "Cambiar contraseña y revocar sesiones", {
  body: {
    type: "object",
    required: ["current", "next"],
    properties: {
      current: { type: "string" },
      next: { type: "string", minLength: 12 },
    },
  },
});
route("/api/dashboard", "get", "Indicadores calculados en MySQL", {
  list: true,
});
route("/api/roles", "get", "Roles disponibles");
for (const [entity, s] of Object.entries(entities)) {
  route(`/api/${entity}`, "get", `Listar ${entity}`, { list: true });
  route(`/api/${entity}`, "post", `Crear ${entity}`, {
    body: schema(s),
    created: true,
  });
  route(`/api/${entity}/{id}`, "get", `Consultar ${entity}`);
  route(`/api/${entity}/{id}`, "put", `Actualizar ${entity}`, {
    body: schema(s),
  });
  route(
    `/api/${entity}/{id}`,
    "delete",
    `Desactivar ${entity}; conserva historial`,
  );
}
route("/api/products/low-stock", "get", "Productos bajo mínimo", {
  list: true,
});
for (const t of ["sales", "purchases"]) {
  route(`/api/${t}`, "get", `Historial de ${t}`, { list: true });
  route(`/api/${t}`, "post", `Crear borrador de ${t}; clave UUID idempotente`, {
    body: schema(orderInput),
    created: true,
  });
  route(`/api/${t}/{id}`, "get", `Detalle de ${t}`);
  route(
    `/api/${t}/{id}/${t === "sales" ? "confirm" : "receive"}`,
    "post",
    "Aplicar inventario de forma atómica e idempotente",
  );
  route(
    `/api/${t}/{id}/cancel`,
    "post",
    "Anular; revierte inventario si fue aplicado",
    { body: schema(cancellation) },
  );
  route(`/api/${t}/{id}/receipt`, "get", "Descargar comprobante interno", {
    binary: "application/pdf",
  });
}
route(
  "/api/customers/{id}/sales",
  "get",
  "Historial paginado de ventas del cliente",
  { list: true },
);
route(
  "/api/suppliers/{id}/purchases",
  "get",
  "Historial paginado de compras al proveedor",
  { list: true },
);
route("/api/inventory", "get", "Existencias", { list: true });
route("/api/inventory/movements", "get", "Kárdex de movimientos", {
  list: true,
});
route(
  "/api/inventory/adjustments",
  "post",
  "Ajustar existencias con motivo obligatorio",
  { body: schema(adjustment), created: true },
);
route("/api/documents", "get", "Documentos permitidos al usuario", {
  list: true,
});
route("/api/documents", "post", "Subir archivo de hasta 5 MB", {
  created: true,
});
paths["/api/documents"].post.requestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required: ["file", "entity_type", "entity_id"],
        properties: {
          file: { type: "string", format: "binary" },
          entity_type: {
            type: "string",
            enum: ["products", "customers", "suppliers", "sales", "purchases"],
          },
          entity_id: { type: "integer" },
        },
      },
    },
  },
};
route("/api/documents/{id}", "get", "Metadatos autorizados");
route("/api/documents/{id}", "delete", "Eliminar documento");
route("/api/documents/{id}/download", "get", "Descargar archivo autorizado", {
  binary: "application/octet-stream",
});
route(
  "/api/documents/{id}/download-url",
  "post",
  "URL S3 prefirmada de lectura; 60 segundos",
);
route(
  "/api/reports/{kind}",
  "get",
  "Reporte JSON, CSV o PDF; máximo 10.000 filas",
  { list: true },
);
paths["/api/reports/{kind}"].get.parameters.push(
  {
    name: "kind",
    in: "path",
    required: true,
    schema: {
      type: "string",
      enum: ["sales", "purchases", "inventory", "low-stock"],
    },
  },
  {
    name: "format",
    in: "query",
    schema: { type: "string", enum: ["json", "csv", "pdf"], default: "json" },
  },
);
route("/api/audit", "get", "Auditoría; solo administrador", { list: true });
route("/api/notifications", "get", "Notificaciones y lecturas individuales", {
  list: true,
});
route("/api/notifications/{id}/read", "post", "Marcar como leída");
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "SIGE REST API",
    version: "1.0.0",
    description:
      "Mismo origen. Antes de login: GET /api/auth/csrf. En cada escritura: Origin configurado y X-CSRF-Token retornado. Conservar cookies (también en Postman). Después de login o refresh usar el nuevo csrfToken.",
  },
  servers: [{ url: "/" }],
  paths,
  components: {
    securitySchemes: {
      accessCookie: {
        type: "apiKey",
        in: "cookie",
        name: "sige_access",
        description:
          "En producción: __Host-sige_access; también refresh y csrf HttpOnly.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
  },
};
