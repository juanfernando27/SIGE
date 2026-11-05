import { tableName } from "../models/table-names.js";
import {
  and,
  eq,
  like,
  or,
  desc,
  count,
  getTableColumns,
  sql,
} from "drizzle-orm";
import { orm, one, rows, type Queryable } from "../config/db.js";
import { models } from "../models/schema.js";
import { paging, type Entity } from "../validators/index.js";
export async function list(entity: Entity, query: unknown) {
  const p = paging.parse(query),
    table: any = models[entity];
  const conditions = [];
  if (p.q)
    conditions.push(
      or(
        like(table.name, `%${p.q}%`),
        like(
          entity === "products"
            ? table.code
            : entity === "users"
              ? table.email
              : entity === "categories"
                ? table.description
                : table.identification,
          `%${p.q}%`,
        ),
      ),
    );
  if (p.status) conditions.push(eq(table.status, p.status));
  const where = and(...conditions);
  const columns: any = { ...getTableColumns(table) };
  delete columns.password_hash;
  let data: any[];
  if (entity === "products")
    data = await orm
      .select({
        ...columns,
        stock: models.inventories.stock,
        category_name: models.categories.name,
        image_document_id: sql`(SELECT MIN(document_id) FROM imagenes_producto WHERE product_id=productos.id)`,
      })
      .from(table)
      .leftJoin(models.inventories, eq(table.id, models.inventories.product_id))
      .leftJoin(models.categories, eq(table.category_id, models.categories.id))
      .where(where)
      .orderBy(desc(table.id))
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize);
  else if (entity === "users")
    data = await orm
      .select({ ...columns, role: models.roles.name })
      .from(table)
      .leftJoin(models.roles, eq(table.role_id, models.roles.id))
      .where(where)
      .orderBy(desc(table.id))
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize);
  else
    data = await orm
      .select(columns)
      .from(table)
      .where(where)
      .orderBy(desc(table.id))
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize);
  const [total] = await orm.select({ value: count() }).from(table).where(where);
  return {
    data,
    meta: { page: p.page, pageSize: p.pageSize, total: total.value },
  };
}
export async function find(
  db: Queryable,
  entity: Entity,
  id: number,
  lock = false,
) {
  const select =
    entity === "users"
      ? "id,name,email,role_id,status,created_at,updated_at"
      : "*";
  return one(
    db,
    `SELECT ${select} FROM ${tableName(entity)} WHERE id=?${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
}
export async function insert(
  db: Queryable,
  entity: Entity,
  values: Record<string, unknown>,
) {
  const keys = Object.keys(values);
  const [r] = await db.query(
    `INSERT INTO ${tableName(entity)} (${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
    Object.values(values),
  );
  return r.insertId as number;
}
export async function update(
  db: Queryable,
  entity: Entity,
  id: number,
  values: Record<string, unknown>,
) {
  const keys = Object.keys(values);
  await db.query(
    `UPDATE ${tableName(entity)} SET ${keys.map((k) => `${k}=?`).join(",")} WHERE id=?`,
    [...Object.values(values), id],
  );
}
export async function inventory(db: Queryable, query: unknown, low = false) {
  const p = paging.parse(query);
  const where = `WHERE p.name LIKE ? ${low ? "AND i.stock<=p.min_stock" : ""}`;
  const params = [`%${p.q}%`];
  const total = await one(
    db,
    `SELECT COUNT(*) n FROM inventarios i JOIN productos p ON p.id=i.product_id ${where}`,
    params,
  );
  const data = await rows(
    db,
    `SELECT p.id AS product_id,p.code,p.name,p.min_stock,p.purchase_price,p.sale_price,p.status,i.stock,i.updated_at FROM inventarios i JOIN productos p ON p.id=i.product_id ${where} ORDER BY i.stock,p.id LIMIT ? OFFSET ?`,
    [...params, p.pageSize, (p.page - 1) * p.pageSize],
  );
  return {
    data,
    meta: { page: p.page, pageSize: p.pageSize, total: Number(total?.n) },
  };
}
