import { type Queryable } from "../config/db.js";
const sensitive = /password|token|hash|secret|cookie/i;
export function redact(value: any): any {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !sensitive.test(k))
        .map(([k, v]) => [k, redact(v)]),
    );
  return value;
}
export async function audit(
  db: Queryable,
  userId: number | null,
  action: string,
  entity: string,
  id: string | number | null,
  changes: any = {},
  result = "success",
) {
  await db.query(
    "INSERT INTO registros_auditoria(user_id,action,entity,entity_id,changes,result) VALUES(?,?,?,?,?,?)",
    [
      userId,
      action,
      entity,
      id === null ? null : String(id),
      JSON.stringify(redact(changes)),
      result,
    ],
  );
}
