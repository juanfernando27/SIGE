import { tableNames } from "../models/table-names.js";
import PDFDocument from "pdfkit";
import { pool, rows } from "../config/db.js";
import { paging } from "../validators/index.js";
import { assert } from "../utils/errors.js";
import type { OrderType } from "./orders.js";
import { get } from "./orders.js";
export function csv(data: Record<string, any>[]) {
  if (!data.length) return "\ufeffSin registros\r\n";
  const keys = Object.keys(data[0]);
  const cell = (v: any) => {
    let s = v instanceof Date ? v.toISOString() : String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      keys.map(cell).join(","),
      ...data.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n")
  );
}
export async function report(kind: string, query: unknown) {
  assert(
    ["sales", "purchases", "inventory", "low-stock"].includes(kind),
    404,
    "Reporte desconocido.",
  );
  const p = paging.parse(query);
  if (kind === "inventory" || kind === "low-stock")
    return rows(
      pool,
      `SELECT p.code,p.name,c.name category,i.stock,p.min_stock,p.purchase_price,p.sale_price FROM productos p JOIN inventarios i ON i.product_id=p.id JOIN categorias c ON c.id=p.category_id ${kind === "low-stock" ? "WHERE i.stock<=p.min_stock" : ""} ORDER BY p.name LIMIT 10000`,
    );
  const params: any[] = [];
  let where = "WHERE 1=1";
  if (p.from) {
    where += " AND o.created_at>=?";
    params.push(p.from);
  }
  if (p.to) {
    where += " AND o.created_at<DATE_ADD(?,INTERVAL 1 DAY)";
    params.push(p.to);
  }
  return rows(
    pool,
    `SELECT o.id,p.name party,o.status,o.total,o.created_at FROM ${kind === "sales" ? tableNames.sales : tableNames.purchases} o JOIN ${kind === "sales" ? tableNames.customers : tableNames.suppliers} p ON p.id=o.${kind === "sales" ? "customer_id" : "supplier_id"} ${where} ORDER BY o.id DESC LIMIT 10000`,
    params,
  );
}
export function pdf(title: string, data: Record<string, any>[]) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const buffers: Buffer[] = [];
    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.fontSize(22).fillColor("#122936").text("SIGE");
    doc.fontSize(13).text(title);
    doc
      .fontSize(9)
      .fillColor("#5f6b76")
      .text(`Generado: ${new Date().toISOString()} · COP`);
    doc.moveDown();
    if (!data.length) doc.text("No hay registros para este período.");
    for (const row of data) {
      const text = Object.entries(row)
        .map(
          ([k, v]) =>
            `${k}: ${v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? "")}`,
        )
        .join("  |  ");
      doc.fontSize(9).fillColor("#122936").text(text, { lineGap: 3 });
      doc.moveDown(0.5);
    }
    doc.end();
  });
}
export async function receipt(t: OrderType, id: number) {
  const order = await get(t, id);
  return pdf(
    `Comprobante interno de ${t === "sales" ? "venta" : "compra"} #${id} · ${order.status}`,
    [
      {
        tercero: order.party_name,
        fecha: order.created_at,
        responsable: order.user_name,
      },
      ...order.items.map((i: any) => ({
        producto: i.product_name,
        cantidad: i.quantity,
        precio: i.unit_price,
        subtotal: i.subtotal,
      })),
      {
        total_COP: order.total,
        observacion:
          "Comprobante académico interno; no constituye factura electrónica DIAN.",
      },
    ],
  );
}
