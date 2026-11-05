import { tableNames } from "../models/table-names.js";
import { createHash } from "node:crypto";
import { pool, transaction, one, rows, type Queryable } from "../config/db.js";
import { orderInput, paging, cancellation } from "../validators/index.js";
import { lineTotal, sumMoney } from "../utils/money.js";
import { assert } from "../utils/errors.js";
import { audit } from "../repositories/audit.js";
import { move } from "./inventory.js";
import type { Actor } from "../auth/service.js";
export type OrderType = "sales" | "purchases";
const settings = (t: OrderType) =>
  t === "sales"
    ? {
        items: tableNames.sale_items,
        fk: "sale_id",
        party: tableNames.customers,
        partyFk: "customer_id",
        done: "confirmed",
      }
    : {
        items: tableNames.purchase_items,
        fk: "purchase_id",
        party: tableNames.suppliers,
        partyFk: "supplier_id",
        done: "received",
      };
async function detail(db: Queryable, t: OrderType, id: number) {
  const s = settings(t);
  const order = await one(
    db,
    `SELECT o.*,p.name AS party_name,u.name AS user_name FROM ${tableNames[t]} o JOIN ${s.party} p ON p.id=o.${s.partyFk} JOIN usuarios u ON u.id=o.user_id WHERE o.id=?`,
    [id],
  );
  assert(order, 404, "Operación no encontrada.");
  order.items = await rows(
    db,
    `SELECT * FROM ${s.items} WHERE ${s.fk}=? ORDER BY product_id`,
    [id],
  );
  return order;
}
export const get = (t: OrderType, id: number) => detail(pool, t, id);
export async function list(t: OrderType, query: unknown, partyId?: number) {
  const p = paging.parse(query),
    s = settings(t);
  let where = "WHERE p.name LIKE ?";
  const args: any[] = [`%${p.q}%`];
  if (partyId) {
    where += ` AND o.${s.partyFk}=?`;
    args.push(partyId);
  }
  if (p.status) {
    where += " AND o.status=?";
    args.push(p.status);
  }
  if (p.from) {
    where += " AND o.created_at>=?";
    args.push(p.from);
  }
  if (p.to) {
    where += " AND o.created_at<DATE_ADD(?,INTERVAL 1 DAY)";
    args.push(p.to);
  }
  const total = await one(
    pool,
    `SELECT COUNT(*) n FROM ${tableNames[t]} o JOIN ${s.party} p ON p.id=o.${s.partyFk} ${where}`,
    args,
  );
  return {
    data: await rows(
      pool,
      `SELECT o.*,p.name AS party_name FROM ${tableNames[t]} o JOIN ${s.party} p ON p.id=o.${s.partyFk} ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [...args, p.pageSize, (p.page - 1) * p.pageSize],
    ),
    meta: { page: p.page, pageSize: p.pageSize, total: Number(total?.n) },
  };
}
export async function create(actor: Actor, t: OrderType, body: unknown) {
  const input = orderInput.parse(body),
    s = settings(t);
  const digest = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return transaction(async (db) => {
    // A repeat request returns the original draft; it never applies stock again.
    const old = await one(
      db,
      `SELECT id,request_hash,user_id FROM ${tableNames[t]} WHERE request_key=?`,
      [input.request_key],
    );
    if (old) {
      assert(
        old.request_hash === digest && old.user_id === actor.id,
        409,
        "Clave de operación utilizada con otros datos.",
      );
      return detail(db, t, old.id);
    }
    assert(
      await one(
        db,
        `SELECT id FROM ${s.party} WHERE id=? AND status='active' FOR SHARE`,
        [input.party_id],
      ),
      400,
      "Cliente o proveedor inexistente o inactivo.",
    );
    const items = [];
    for (const item of [...input.items].sort(
      (a, b) => a.product_id - b.product_id,
    )) {
      const product = await one(
        db,
        "SELECT * FROM productos WHERE id=? AND status='active' FOR SHARE",
        [item.product_id],
      );
      assert(product, 400, "Un producto no existe o está inactivo.");
      if (t === "purchases")
        assert(
          item.unit_price !== undefined,
          400,
          "Falta el precio de compra.",
        );
      const unit_price = t === "sales" ? product.sale_price : item.unit_price!;
      items.push({
        ...item,
        unit_price,
        product_name: product.name,
        subtotal: lineTotal(unit_price, item.quantity),
      });
    }
    const total = sumMoney(items.map((i) => i.subtotal));
    assert(
      total.length <= 19 && items.every((i) => i.subtotal.length <= 19),
      400,
      "Total fuera del rango permitido.",
    );
    const [r] = await db.query(
      `INSERT INTO ${tableNames[t]}(${s.partyFk},user_id,total,request_key,request_hash) VALUES(?,?,?,?,?)`,
      [input.party_id, actor.id, total, input.request_key, digest],
    );
    for (const i of items)
      await db.query(
        `INSERT INTO ${s.items}(${s.fk},product_id,product_name,quantity,unit_price,subtotal) VALUES(?,?,?,?,?,?)`,
        [
          r.insertId,
          i.product_id,
          i.product_name,
          i.quantity,
          i.unit_price,
          i.subtotal,
        ],
      );
    await audit(db, actor.id, "create", t, r.insertId, { total, items });
    return detail(db, t, r.insertId);
  });
}
export async function transition(
  actor: Actor,
  t: OrderType,
  id: number,
  action: "confirm" | "receive" | "cancel",
  body: unknown = {},
) {
  const s = settings(t);
  const reason = action === "cancel" ? cancellation.parse(body).reason : "";
  return transaction(async (db) => {
    const order = await one(
      db,
      `SELECT * FROM ${tableNames[t]} WHERE id=? FOR UPDATE`,
      [id],
    );
    assert(order, 404, "Operación no encontrada.");
    if (action === "cancel" && order.status === "cancelled")
      return detail(db, t, id);
    if (action !== "cancel" && order.status === s.done)
      return detail(db, t, id);
    assert(order.status !== "cancelled", 409, "La operación ya fue anulada.");
    const items = await rows(
      db,
      `SELECT * FROM ${s.items} WHERE ${s.fk}=? ORDER BY product_id`,
      [id],
    );
    if (action !== "cancel")
      assert(
        await one(
          db,
          `SELECT id FROM ${s.party} WHERE id=? AND status='active' FOR SHARE`,
          [order[s.partyFk]],
        ),
        409,
        "El cliente o proveedor fue desactivado.",
      );
    const effect =
      action === "cancel"
        ? order.status === s.done
          ? t === "sales"
            ? 1
            : -1
          : 0
        : t === "sales"
          ? -1
          : 1;
    for (const i of items) {
      if (action !== "cancel")
        assert(
          await one(
            db,
            "SELECT id FROM productos WHERE id=? AND status='active' FOR UPDATE",
            [i.product_id],
          ),
          409,
          "Un producto fue desactivado. Anula el borrador y revisa el catálogo.",
        );
      if (effect)
        await move(
          db,
          actor,
          i.product_id,
          effect * Number(i.quantity),
          action === "cancel"
            ? "reversal"
            : t === "sales"
              ? "sale"
              : "purchase",
          t,
          id,
          reason ||
            `${t === "sales" ? "Venta confirmada" : "Compra recibida"} #${id}`,
        );
    }
    const status = action === "cancel" ? "cancelled" : s.done;
    await db.query(
      `UPDATE ${tableNames[t]} SET status=?,cancel_reason=? WHERE id=?`,
      [status, reason || null, id],
    );
    await db.query(
      "INSERT INTO notificaciones(title,message,event_key) VALUES(?,?,?)",
      [
        `${t === "sales" ? "Venta" : "Compra"} ${action === "cancel" ? "anulada" : t === "sales" ? "confirmada" : "recibida"}`,
        `Operación #${id}. Total: ${order.total} COP.`,
        `${t}:${id}:${status}`,
      ],
    );
    await audit(db, actor.id, action, t, id, {
      before: order.status,
      status,
      reason,
    });
    return detail(db, t, id);
  });
}
