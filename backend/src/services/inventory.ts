import { pool, transaction, one, rows, type Queryable } from "../config/db.js";
import { audit } from "../repositories/audit.js";
import { inventory } from "../repositories/catalog.js";
import { adjustment, paging } from "../validators/index.js";
import { assert } from "../utils/errors.js";
import type { Actor } from "../auth/service.js";
export const list = (query: unknown, low = false) =>
  inventory(pool, query, low);
export async function move(
  db: Queryable,
  actor: Actor,
  productId: number,
  delta: number,
  kind: string,
  sourceType: string,
  sourceId: number | null,
  reason: string,
) {
  const found = await one(
    db,
    "SELECT i.stock,p.name,p.min_stock FROM inventarios i JOIN productos p ON p.id=i.product_id WHERE i.product_id=? FOR UPDATE",
    [productId],
  );
  assert(found, 404, "Producto no encontrado.");
  const balance = Number(found.stock) + delta;
  assert(
    balance >= 0,
    409,
    `Inventario insuficiente para ${found.name}. Disponible: ${found.stock}.`,
  );
  assert(
    balance <= 2147483647,
    409,
    "El inventario excede el límite permitido.",
  );
  await db.query("UPDATE inventarios SET stock=? WHERE product_id=?", [
    balance,
    productId,
  ]);
  const [r] = await db.query(
    "INSERT INTO movimientos_inventario(product_id,user_id,kind,quantity,balance,source_type,source_id,reason) VALUES(?,?,?,?,?,?,?,?)",
    [productId, actor.id, kind, delta, balance, sourceType, sourceId, reason],
  );
  if (balance <= found.min_stock && Number(found.stock) > found.min_stock)
    await db.query(
      "INSERT INTO notificaciones(title,message,event_key) VALUES(?,?,?)",
      [
        "Inventario bajo",
        `${found.name}: quedan ${balance} unidades.`,
        `low-stock:${r.insertId}`,
      ],
    );
  return balance;
}
export async function adjust(actor: Actor, body: unknown) {
  const input = adjustment.parse(body);
  return transaction(async (db) => {
    const stock = await move(
      db,
      actor,
      input.product_id,
      input.quantity,
      "adjustment",
      "adjustment",
      null,
      input.reason,
    );
    await audit(
      db,
      actor.id,
      "adjustment",
      "inventories",
      input.product_id,
      input,
    );
    return { stock };
  });
}
export async function movements(query: unknown) {
  const p = paging.parse(query);
  const args: any[] = [`%${p.q}%`];
  let where = "WHERE p.name LIKE ?";
  if (p.from) {
    where += " AND m.created_at>=?";
    args.push(p.from);
  }
  if (p.to) {
    where += " AND m.created_at<DATE_ADD(?,INTERVAL 1 DAY)";
    args.push(p.to);
  }
  const total = await one(
    pool,
    `SELECT COUNT(*) n FROM movimientos_inventario m JOIN productos p ON p.id=m.product_id ${where}`,
    args,
  );
  return {
    data: await rows(
      pool,
      `SELECT m.*,p.name AS product_name,u.name AS user_name FROM movimientos_inventario m JOIN productos p ON p.id=m.product_id JOIN usuarios u ON u.id=m.user_id ${where} ORDER BY m.id DESC LIMIT ? OFFSET ?`,
      [...args, p.pageSize, (p.page - 1) * p.pageSize],
    ),
    meta: { page: p.page, pageSize: p.pageSize, total: Number(total?.n) },
  };
}
