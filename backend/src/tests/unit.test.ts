import { describe, it, expect } from "vitest";
import { money, lineTotal, sumMoney } from "../utils/money.js";
import { orderInput, price, adjustment } from "../validators/index.js";
import { redact } from "../repositories/audit.js";
import { csv } from "../services/reports.js";
import { detectMime } from "../services/documents.js";
import { LocalStorageProvider } from "../storage/index.js";
describe("Reglas financieras y límites de entrada", () => {
  it("mantiene exactitud decimal con cantidades y sumas", () => {
    expect(lineTotal("0.10", 3)).toBe("0.30");
    expect(sumMoney(["0.10", "0.20", "999999999.99"])).toBe("1000000000.29");
    expect(money("1.005")).toBe("1.01");
  });
  it("rechaza precios negativos, notación exponencial y precisión extra", () => {
    for (const v of ["-1", "1.001", "1e3", "NaN", "01.00"])
      expect(price.safeParse(v).success).toBe(false);
  });
  it("rechaza productos duplicados en una operación", () => {
    expect(
      orderInput.safeParse({
        party_id: 1,
        request_key: "c6c52641-1567-493c-92f0-16077e02502f",
        items: [
          { product_id: 1, quantity: 1 },
          { product_id: 1, quantity: 2 },
        ],
      }).success,
    ).toBe(false);
  });
  it("exige motivo y cantidad no nula para ajustes", () => {
    expect(
      adjustment.safeParse({ product_id: 1, quantity: 0, reason: "Saldo" })
        .success,
    ).toBe(false);
    expect(
      adjustment.safeParse({ product_id: 1, quantity: -1, reason: "" }).success,
    ).toBe(false);
  });
});
describe("Datos sensibles y archivos", () => {
  it("elimina secretos anidados de auditoría", () => {
    expect(
      redact({
        name: "Ana",
        password: "abc",
        after: {
          password_hash: "hash",
          accessToken: "secret",
          status: "active",
        },
      }),
    ).toEqual({ name: "Ana", after: { status: "active" } });
  });
  it("neutraliza fórmulas de hojas de cálculo en CSV", () => {
    const value = csv([{ name: '=HYPERLINK("evil")', phone: "+57300" }]);
    expect(value).toContain("'=HYPERLINK");
    expect(value).toContain("'+57300");
  });
  it("verifica firma y rechaza contenido activo desconocido", () => {
    expect(detectMime(Buffer.from("%PDF-1.4\n"))).toBe("application/pdf");
    expect(detectMime(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
  it("impide acceso a rutas arbitrarias del almacenamiento", async () => {
    await expect(new LocalStorageProvider().get("../.env")).rejects.toThrow();
  });
});

describe("Adaptador Lambda / HTTP API v2 sin infraestructura AWS", () => {
  const event = (path: string) => ({
    version: "2.0",
    routeKey: "ANY /{proxy+}",
    rawPath: path,
    rawQueryString: "",
    headers: { host: "local.test" },
    requestContext: {
      http: {
        method: "GET",
        path,
        sourceIp: "127.0.0.1",
        protocol: "HTTP/1.1",
      },
      stage: "$default",
      requestId: "local-unit",
    },
    isBase64Encoded: false,
  });
  it("reutiliza la aplicación y responde salud", async () => {
    const { handler } = await import("../lambda.js");
    const result: any = await handler(
      event("/api/health"),
      {} as any,
      () => {},
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.service).toBe("sige-api");
  });
  it("serializa cookies HttpOnly en el formato de API Gateway", async () => {
    const { handler } = await import("../lambda.js");
    const result: any = await handler(
      event("/api/auth/csrf"),
      {} as any,
      () => {},
    );
    expect(result.statusCode).toBe(200);
    expect(result.cookies[0]).toContain("HttpOnly");
    expect(JSON.parse(result.body).data.csrfToken).toHaveLength(64);
  });
});

describe("Nombres físicos en español", () => {
  it("resuelve entidades lógicas solo mediante la lista permitida", async () => {
    const { tableName, tableNames } = await import("../models/table-names.js");
    expect(tableName("products")).toBe("productos");
    expect(tableName("sales")).toBe("ventas");
    expect(Object.values(tableNames)).toHaveLength(22);
    expect(() => tableName("__proto__")).toThrow();
    expect(() => tableName("constructor")).toThrow();
    expect(() => tableName("products; DROP TABLE usuarios")).toThrow();
  });
});
