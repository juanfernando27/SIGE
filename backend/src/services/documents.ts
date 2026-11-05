import { tableName } from "../models/table-names.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, one, rows, transaction } from "../config/db.js";
import { id, paging } from "../validators/index.js";
import { storage } from "../storage/index.js";
import { assert } from "../utils/errors.js";
import { audit } from "../repositories/audit.js";
import type { Actor } from "../auth/service.js";
const association = z.object({
  entity_type: z.enum([
    "products",
    "customers",
    "suppliers",
    "sales",
    "purchases",
  ]),
  entity_id: id,
});
function authorize(actor: Actor, type: string, write = false) {
  assert(
    actor.permissions.includes(`${type}.${write ? "write" : "read"}`),
    403,
    "No tienes acceso al registro asociado.",
  );
}
export function detectMime(b: Buffer) {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}
export async function upload(
  actor: Actor,
  body: unknown,
  file:
    | { buffer: Buffer; mimetype: string; size: number; originalname: string }
    | undefined,
) {
  const input = association.parse(body);
  authorize(actor, input.entity_type, true);
  assert(file, 400, "Selecciona un archivo.");
  const mime = detectMime(file.buffer);
  assert(
    mime && mime === file.mimetype,
    400,
    "Solo se admiten PNG, JPEG o PDF válidos.",
  );
  assert(file.size <= 5 * 1024 * 1024, 400, "Tamaño máximo: 5 MB.");
  assert(
    await one(
      pool,
      `SELECT id FROM ${tableName(input.entity_type)} WHERE id=?`,
      [input.entity_id],
    ),
    404,
    "Registro asociado inexistente.",
  );
  const key = randomUUID();
  await storage.put(key, file.buffer, mime);
  try {
    return await transaction(async (db) => {
      const [r] = await db.query(
        "INSERT INTO documentos(user_id,entity_type,entity_id,original_name,storage_key,mime_type,size_bytes,provider) VALUES(?,?,?,?,?,?,?,?)",
        [
          actor.id,
          input.entity_type,
          input.entity_id,
          file.originalname.replace(/[\x00-\x1f\\/]/g, "_").slice(0, 200),
          key,
          mime,
          file.size,
          storage.name,
        ],
      );
      if (input.entity_type === "products" && mime.startsWith("image/"))
        await db.query(
          "INSERT INTO imagenes_producto(product_id,document_id) VALUES(?,?)",
          [input.entity_id, r.insertId],
        );
      await audit(db, actor.id, "upload", "documents", r.insertId, {
        ...input,
        size: file.size,
        mime,
      });
      return { id: r.insertId };
    });
  } catch (e) {
    await storage.delete(key);
    throw e;
  }
}
export async function get(actor: Actor, docId: number, write = false) {
  const doc = await one(pool, "SELECT * FROM documentos WHERE id=?", [docId]);
  assert(doc, 404, "Archivo no encontrado.");
  authorize(actor, doc.entity_type, write);
  assert(
    doc.provider === storage.name,
    503,
    "El proveedor de este archivo no está configurado.",
  );
  return doc;
}
export async function list(actor: Actor, query: unknown) {
  const p = paging.parse(query),
    allowed = [
      "products",
      "customers",
      "suppliers",
      "sales",
      "purchases",
    ].filter((t) => actor.permissions.includes(`${t}.read`));
  if (!allowed.length)
    return { data: [], meta: { total: 0, page: p.page, pageSize: p.pageSize } };
  const marks = allowed.map(() => "?").join(",");
  const where = `WHERE entity_type IN (${marks}) AND original_name LIKE ?`;
  const params = [...allowed, `%${p.q}%`];
  const total = await one(
    pool,
    `SELECT COUNT(*) n FROM documentos ${where}`,
    params,
  );
  return {
    data: await rows(
      pool,
      `SELECT id,entity_type,entity_id,original_name,mime_type,size_bytes,created_at FROM documentos ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, p.pageSize, (p.page - 1) * p.pageSize],
    ),
    meta: { total: Number(total?.n), page: p.page, pageSize: p.pageSize },
  };
}
export async function remove(actor: Actor, docId: number) {
  const doc = await get(actor, docId, true);
  assert(
    actor.role === "administrador" || doc.user_id === actor.id,
    403,
    "Solo el autor o un administrador puede eliminar el archivo.",
  );
  // Delete metadata atomically; a failed object deletion leaves an inaccessible orphan for lifecycle cleanup.
  await transaction(async (db) => {
    await db.query("DELETE FROM documentos WHERE id=?", [docId]);
    await audit(db, actor.id, "delete", "documents", docId, {
      key: doc.storage_key,
    });
  });
  await storage.delete(doc.storage_key);
}
