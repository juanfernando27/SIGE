import { beforeAll, afterAll, describe, it, expect } from "vitest";
import supertest from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../app.js";
import { pool, one, rows } from "../config/db.js";
import { env } from "../config/env.js";
const dbName = new URL(env.DATABASE_URL).pathname;
if (!dbName.endsWith("_test"))
  throw new Error(
    "Las pruebas de integración requieren una base cuyo nombre termine en _test.",
  );
function session() {
  const agent = supertest.agent(app);
  let csrf = "";
  return {
    agent,
    get: (path: string) => agent.get("/api" + path),
    post: (path: string, body?: any) =>
      agent
        .post("/api" + path)
        .set("Origin", env.APP_ORIGIN)
        .set("X-CSRF-Token", csrf)
        .send(body),
    put: (path: string, body: any) =>
      agent
        .put("/api" + path)
        .set("Origin", env.APP_ORIGIN)
        .set("X-CSRF-Token", csrf)
        .send(body),
    async login(email = "admin@sige.local") {
      csrf = (await agent.get("/api/auth/csrf")).body.data.csrfToken;
      const r = await this.post("/auth/login", {
        email,
        password: process.env.SEED_ADMIN_PASSWORD || "SigeDemo!2026",
      });
      expect(r.status).toBe(200);
      csrf = r.body.data.csrfToken;
      return r;
    },
    setCsrf: (v: string) => {
      csrf = v;
    },
    getCsrf: () => csrf,
  };
}
const admin = session();
let lambdaCookies: string[] = [];
let category: number, customer: number, supplier: number;
const suffix = randomUUID().slice(0, 8);
async function product(stock = 0) {
  const r = await admin.post("/products", {
    code: "T-" + randomUUID().slice(0, 15),
    name: "Prueba " + suffix,
    description: "Integración",
    category_id: category,
    supplier_id: supplier,
    purchase_price: "0.10",
    sale_price: "0.30",
    min_stock: 1,
    status: "active",
  });
  expect(r.status).toBe(201);
  if (stock)
    expect(
      (
        await admin.post("/inventory/adjustments", {
          product_id: r.body.data.id,
          quantity: stock,
          reason: "Stock de prueba",
        })
      ).status,
    ).toBe(201);
  return r.body.data.id as number;
}
async function order(type: string, items: any[]) {
  const r = await admin.post("/" + type, {
    party_id: type === "sales" ? customer : supplier,
    request_key: randomUUID(),
    items,
  });
  expect(r.status).toBe(201);
  return r.body.data;
}
beforeAll(async () => {
  const login = await admin.login();
  lambdaCookies = (login.headers["set-cookie"] as unknown as string[]).map(
    (c) => c.split(";")[0],
  );
  category = (await one(pool, "SELECT id FROM categorias LIMIT 1"))!.id;
  customer = (await one(pool, "SELECT id FROM clientes LIMIT 1"))!.id;
  supplier = (await one(pool, "SELECT id FROM proveedores LIMIT 1"))!.id;
}, 30000);
afterAll(async () => {
  await pool.end();
});
describe("API y autorización con MySQL real", () => {
  it("comprueba salud y dependencias", async () => {
    expect((await supertest(app).get("/api/health")).status).toBe(200);
    expect((await supertest(app).get("/api/ready")).status).toBe(200);
  });
  it("protege rutas y operaciones CSRF", async () => {
    expect((await supertest(app).get("/api/products")).status).toBe(401);
    expect((await admin.agent.post("/api/products").send({})).status).toBe(403);
  });
  it("un vendedor no puede acceder al CRUD de usuarios", async () => {
    const seller = session();
    await seller.login("ventas@sige.local");
    expect((await seller.get("/users")).status).toBe(403);
    expect(
      (
        await seller.post("/inventory/adjustments", {
          product_id: 1,
          quantity: 10,
          reason: "Ataque",
        })
      ).status,
    ).toBe(403);
  });
  it("valida datos, unicidad, filtros y paginación", async () => {
    const bad = await admin.post("/categories", { name: "", status: "active" });
    expect(bad.status).toBe(422);
    const name = "Categoría " + suffix;
    expect(
      (await admin.post("/categories", { name, status: "active" })).status,
    ).toBe(201);
    expect(
      (await admin.post("/categories", { name, status: "active" })).status,
    ).toBe(409);
    const r = await admin.get(
      "/categories?pageSize=1&q=" + encodeURIComponent(suffix),
    );
    expect(r.body.data).toHaveLength(1);
    expect(r.body.meta.total).toBe(1);
  });
  it("evita desactivar al administrador de la sesión", async () => {
    const me = (await admin.get("/auth/me")).body.data;
    expect(
      (
        await admin.put("/users/" + me.id, {
          name: me.name,
          email: me.email,
          role_id: 1,
          status: "inactive",
        })
      ).status,
    ).toBe(409);
  });
  it("la renovación rota las cookies y detecta reutilización", async () => {
    const user = session();
    const login = await user.login();
    const oldCookies = login.headers["set-cookie"] as unknown as string[];
    expect(
      oldCookies.every(
        (v) => v.includes("HttpOnly") && v.includes("SameSite=Strict"),
      ),
    ).toBe(true);
    const oldCsrf = user.getCsrf();
    const refreshed = await user.post("/auth/refresh");
    expect(refreshed.status).toBe(200);
    user.setCsrf(refreshed.body.data.csrfToken);
    expect((await user.get("/auth/me")).status).toBe(200);
    const replay = await supertest(app)
      .post("/api/auth/refresh")
      .set(
        "Cookie",
        oldCookies.map((c) => c.split(";")[0]),
      )
      .set("Origin", env.APP_ORIGIN)
      .set("X-CSRF-Token", oldCsrf);
    expect(replay.status).toBe(401);
    expect((await user.get("/auth/me")).status).toBe(401);
  });
});
describe("Transacciones, concurrencia y reversión", () => {
  it("recibe una compra una sola vez aunque se repita en paralelo", async () => {
    const p = await product();
    const purchase = await order("purchases", [
      { product_id: p, quantity: 5, unit_price: "0.10" },
    ]);
    expect(purchase.total).toBe("0.50");
    const r = await Promise.all([
      admin.post(`/purchases/${purchase.id}/receive`),
      admin.post(`/purchases/${purchase.id}/receive`),
    ]);
    expect(r.map((x) => x.status)).toEqual([200, 200]);
    expect(
      (await one(pool, "SELECT stock FROM inventarios WHERE product_id=?", [
        p,
      ]))!.stock,
    ).toBe(5);
    expect(
      Number(
        (await one(
          pool,
          "SELECT COUNT(*) n FROM movimientos_inventario WHERE source_type='purchases' AND source_id=?",
          [purchase.id],
        ))!.n,
      ),
    ).toBe(1);
  });
  it("serializa ventas concurrentes y revierte solo una vez", async () => {
    const p = await product(1);
    const a = await order("sales", [{ product_id: p, quantity: 1 }]),
      b = await order("sales", [{ product_id: p, quantity: 1 }]);
    const r = await Promise.all([
      admin.post(`/sales/${a.id}/confirm`),
      admin.post(`/sales/${b.id}/confirm`),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(
      (await one(pool, "SELECT stock FROM inventarios WHERE product_id=?", [
        p,
      ]))!.stock,
    ).toBe(0);
    const winner = r[0].status === 200 ? a : b;
    expect(
      (
        await admin.post(`/sales/${winner.id}/cancel`, {
          reason: "Reversión de prueba",
        })
      ).status,
    ).toBe(200);
    expect(
      (await admin.post(`/sales/${winner.id}/cancel`, { reason: "Reintento" }))
        .status,
    ).toBe(200);
    expect(
      (await one(pool, "SELECT stock FROM inventarios WHERE product_id=?", [
        p,
      ]))!.stock,
    ).toBe(1);
  });
  it("revierte toda la transacción si falla el segundo producto", async () => {
    const a = await product(3),
      b = await product(0);
    const s = await order("sales", [
      { product_id: a, quantity: 2 },
      { product_id: b, quantity: 1 },
    ]);
    expect((await admin.post(`/sales/${s.id}/confirm`)).status).toBe(409);
    expect(
      (await one(pool, "SELECT stock FROM inventarios WHERE product_id=?", [
        a,
      ]))!.stock,
    ).toBe(3);
    expect(
      (await one(pool, "SELECT status FROM ventas WHERE id=?", [s.id]))!.status,
    ).toBe("draft");
    expect(
      Number(
        (await one(
          pool,
          "SELECT COUNT(*) n FROM movimientos_inventario WHERE source_type='sales' AND source_id=?",
          [s.id],
        ))!.n,
      ),
    ).toBe(0);
  });
  it("impide anular una compra si su mercancía ya salió", async () => {
    const p = await product();
    const buy = await order("purchases", [
      { product_id: p, quantity: 2, unit_price: "0.10" },
    ]);
    await admin.post(`/purchases/${buy.id}/receive`);
    const sell = await order("sales", [{ product_id: p, quantity: 2 }]);
    await admin.post(`/sales/${sell.id}/confirm`);
    expect(
      (await admin.post(`/purchases/${buy.id}/cancel`, { reason: "Prueba" }))
        .status,
    ).toBe(409);
    expect(
      (await one(pool, "SELECT status FROM compras WHERE id=?", [buy.id]))!
        .status,
    ).toBe("received");
  });
  it("reutiliza la clave de creación sin duplicar el borrador", async () => {
    const p = await product(2);
    const input = {
      party_id: customer,
      request_key: randomUUID(),
      items: [{ product_id: p, quantity: 1 }],
    };
    const a = await admin.post("/sales", input),
      b = await admin.post("/sales", input);
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(
      (
        await admin.post("/sales", {
          ...input,
          items: [{ product_id: p, quantity: 2 }],
        })
      ).status,
    ).toBe(409);
  });
});
describe("Documentos, reportes, alertas y auditoría", () => {
  it("sube, descarga y elimina un archivo; rechaza firma falsa", async () => {
    const p = await product();
    const upload = () =>
      admin.agent
        .post("/api/documents")
        .set("Origin", env.APP_ORIGIN)
        .set("X-CSRF-Token", admin.getCsrf())
        .field("entity_type", "products")
        .field("entity_id", p);
    const bad = await upload().attach(
      "file",
      Buffer.from("<script>bad</script>"),
      { filename: "fake.pdf", contentType: "application/pdf" },
    );
    expect(bad.status).toBe(400);
    const r = await upload().attach("file", Buffer.from("%PDF-1.4\n%%EOF"), {
      filename: "test.pdf",
      contentType: "application/pdf",
    });
    expect(r.status).toBe(201);
    expect(
      (await admin.get(`/documents/${r.body.data.id}/download`)).status,
    ).toBe(200);
    expect(
      (
        await admin.agent
          .delete(`/api/documents/${r.body.data.id}`)
          .set("Origin", env.APP_ORIGIN)
          .set("X-CSRF-Token", admin.getCsrf())
      ).status,
    ).toBe(200);
  });
  it("exporta CSV y PDF y genera comprobantes", async () => {
    const csv = await admin.get("/reports/sales?format=csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    const pdf = await admin.get("/reports/inventory?format=pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-");
    const s = await one(pool, "SELECT id FROM ventas LIMIT 1");
    expect((await admin.get(`/sales/${s!.id}/receipt`)).status).toBe(200);
  });
  it("entrega dashboard desde SQL y lecturas por usuario", async () => {
    const dashboard = (await admin.get("/dashboard")).body.data;
    expect(Number(dashboard.counts.products)).toBeGreaterThan(0);
    const n = (await admin.get("/notifications")).body.data[0];
    expect(n).toBeTruthy();
    expect((await admin.post(`/notifications/${n.id}/read`)).status).toBe(200);
    expect(
      await one(
        pool,
        "SELECT * FROM lecturas_notificaciones WHERE notification_id=?",
        [n.id],
      ),
    ).toBeTruthy();
  });
  it("excluye secretos de auditoría y publica OpenAPI", async () => {
    const logs = await rows(pool, "SELECT changes FROM registros_auditoria");
    for (const r of logs)
      expect(JSON.stringify(r.changes)).not.toMatch(
        /password_hash|refresh_hash|access_hash/,
      );
    const doc = await admin.get("/openapi.json");
    expect(doc.body.openapi).toBe("3.1.0");
    expect(doc.body.paths["/api/sales/{id}/confirm"]).toBeTruthy();
  });
});

describe("Respuesta binaria mediante Lambda / HTTP API v2", () => {
  it("devuelve el comprobante PDF como base64 y conserva autorización", async () => {
    const { handler } = await import("../lambda.js");
    const sale = await one(pool, "SELECT id FROM ventas LIMIT 1");
    const path = `/api/sales/${sale!.id}/receipt`;
    const result: any = await handler(
      {
        version: "2.0",
        routeKey: "ANY /{proxy+}",
        rawPath: path,
        rawQueryString: "",
        cookies: lambdaCookies,
        headers: { host: "local.test" },
        requestContext: {
          http: {
            method: "GET",
            path,
            sourceIp: "127.0.0.1",
            protocol: "HTTP/1.1",
          },
          stage: "$default",
          requestId: "binary-integration",
        },
        isBase64Encoded: false,
      },
      {} as any,
      () => {},
    );
    expect(result.statusCode).toBe(200);
    expect(result.isBase64Encoded).toBe(true);
    expect(Buffer.from(result.body, "base64").subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
  });
});

describe("Esquema físico en español", () => {
  it("usa las 22 tablas de negocio y su historial sin nombres antiguos", async () => {
    const { tableNames } = await import("../models/table-names.js");
    const found = await rows(
      pool,
      "SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'",
    );
    expect(found.map((r) => r.name).sort()).toEqual(
      [...Object.values(tableNames), "migraciones_esquema"].sort(),
    );
  });
});
