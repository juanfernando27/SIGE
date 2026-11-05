import argon2 from "argon2";
import { pool, transaction, one, rows } from "../config/db.js";
import * as repo from "../repositories/catalog.js";
import { audit } from "../repositories/audit.js";
import { entities, type Entity } from "../validators/index.js";
import { assert } from "../utils/errors.js";
import type { Actor } from "../auth/service.js";
export const list = repo.list;
export async function get(entity: Entity, id: number) {
  const found = await repo.find(pool, entity, id);
  assert(found, 404, "Registro no encontrado.");
  if (entity === "customers")
    found.sales = await rows(
      pool,
      "SELECT id,status,total,created_at FROM ventas WHERE customer_id=? ORDER BY id DESC LIMIT 100",
      [id],
    );
  if (entity === "suppliers") {
    found.purchases = await rows(
      pool,
      "SELECT id,status,total,created_at FROM compras WHERE supplier_id=? ORDER BY id DESC LIMIT 100",
      [id],
    );
    found.products = await rows(
      pool,
      "SELECT p.id,p.code,p.name FROM productos p WHERE p.supplier_id=? OR EXISTS(SELECT 1 FROM detalles_compra pi JOIN compras b ON b.id=pi.purchase_id WHERE pi.product_id=p.id AND b.supplier_id=?) ORDER BY p.id DESC LIMIT 100",
      [id, id],
    );
  }
  return found;
}
export async function save(
  actor: Actor,
  entity: Entity,
  id: number | null,
  body: unknown,
) {
  const values: Record<string, any> = entities[entity].parse(body);
  if (entity === "users") {
    assert(id || values.password, 400, "La contraseña es obligatoria.");
    if (values.password) {
      values.password_hash = await argon2.hash(values.password, {
        type: argon2.argon2id,
      });
      delete values.password;
    }
  }
  return transaction(async (db) => {
    let before: any = null;
    if (entity === "users")
      await rows(
        db,
        "SELECT id FROM usuarios WHERE role_id=1 ORDER BY id FOR UPDATE",
      );
    if (id) {
      before = await repo.find(db, entity, id, true);
      assert(before, 404, "Registro no encontrado.");
    }
    if (entity === "users") {
      assert(
        await one(db, "SELECT id FROM roles WHERE id=?", [values.role_id]),
        400,
        "Rol inválido.",
      );
      if (id === actor.id)
        assert(
          values.status === "active" && values.role_id === actor.role_id,
          409,
          "Tu cuenta debe conservar su rol y estado; usa otra cuenta administradora.",
        );
      if (
        before?.role_id === 1 &&
        before.status === "active" &&
        (values.role_id !== 1 || values.status !== "active")
      ) {
        const other = await one(
          db,
          "SELECT id FROM usuarios WHERE role_id=1 AND status='active' AND id<>? LIMIT 1",
          [id],
        );
        assert(other, 409, "Debe existir un administrador activo.");
      }
    }
    if (entity === "products") {
      assert(
        await one(
          db,
          "SELECT id FROM categorias WHERE id=? AND status='active'",
          [values.category_id],
        ),
        400,
        "Categoría inexistente o inactiva.",
      );
      if (values.supplier_id)
        assert(
          await one(
            db,
            "SELECT id FROM proveedores WHERE id=? AND status='active'",
            [values.supplier_id],
          ),
          400,
          "Proveedor inexistente o inactivo.",
        );
    }
    if (id) await repo.update(db, entity, id, values);
    else {
      id = await repo.insert(db, entity, values);
      if (entity === "products")
        await db.query(
          "INSERT INTO inventarios(product_id,stock) VALUES(?,0)",
          [id],
        );
    }
    if (
      entity === "users" &&
      before &&
      (values.status !== "active" ||
        values.role_id !== before.role_id ||
        values.password_hash)
    )
      await db.query(
        "UPDATE sesiones_autenticacion SET revoked_at=UTC_TIMESTAMP() WHERE user_id=?",
        [id],
      );
    await audit(db, actor.id, before ? "update" : "create", entity, id, {
      before,
      after: values,
    });
    return repo.find(db, entity, id!);
  });
}
export async function deactivate(actor: Actor, entity: Entity, id: number) {
  const current = await get(entity, id);
  const keys = Object.keys(entities[entity].shape);
  const input = Object.fromEntries(
    keys.filter((k) => k !== "password").map((k) => [k, current[k]]),
  );
  return save(actor, entity, id, { ...input, status: "inactive" });
}
