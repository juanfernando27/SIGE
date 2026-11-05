import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool, one, rows } from "./config/db.js";
import { tableNames } from "./models/table-names.js";

const dir = fileURLToPath(
  new URL("../../database/migrations/", import.meta.url),
);
const db = await pool.getConnection();
let locked = false;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
try {
  const lock = await one(db, "SELECT GET_LOCK('sige_migrate',30) AS acquired");
  if (Number(lock?.acquired) !== 1)
    throw new Error("Otra migración está en ejecución.");
  locked = true;
  const tables = () =>
    rows<{ name: string }>(
      db,
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'",
    );
  const known = new Set((await tables()).map((t) => t.name));
  if (known.has("schema_migrations") && known.has("migraciones_esquema"))
    throw new Error(
      "Existen dos historiales de migración. No se modificaron tablas. Revisa el respaldo y los historiales antes de continuar.",
    );
  // Preserve original checksums, including the already applied 001 migration.
  if (known.has("schema_migrations"))
    await db.query("RENAME TABLE schema_migrations TO migraciones_esquema");
  else if (!known.has("migraciones_esquema")) {
    const projectTables = Object.entries(tableNames).flatMap(
      ([old, current]) => [old, current],
    );
    if (projectTables.some((name) => known.has(name)))
      throw new Error(
        "Hay tablas de SIGE pero falta el historial de migraciones. No se modificaron los datos. No importes el esquema encima: revisa cómo se creó esta base.",
      );
    await db.query(
      "CREATE TABLE migraciones_esquema (name VARCHAR(190) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
  }
  for (const name of (await readdir(dir))
    .filter((v) => v.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(dir + name, "utf8"),
      checksum = sha(sql);
    const applied = await one(
      db,
      "SELECT checksum FROM migraciones_esquema WHERE name=?",
      [name],
    );
    if (applied) {
      if (applied.checksum !== checksum)
        throw new Error(
          `Migración modificada: ${name}. Usa el archivo original; no borres el historial.`,
        );
      console.log(`Sin cambios: ${name}`);
      continue;
    }
    if (name === "002_tablas_en_espanol.sql") {
      const current = new Set((await tables()).map((t) => t.name));
      const pairs = Object.entries(tableNames).filter(
        ([old, next]) => old !== next,
      );
      const allRenamed = pairs.every(
        ([old, next]) => !current.has(old) && current.has(next),
      );
      const allOriginal = pairs.every(
        ([old, next]) => current.has(old) && !current.has(next),
      );
      if (!current.has("roles") || (!allRenamed && !allOriginal))
        throw new Error(
          "Las tablas no coinciden con el esquema original ni con el esquema español completo. No se ejecutó el renombrado. Revisa tablas faltantes o nombres ya usados.",
        );
      if (allRenamed) {
        // Recover if RENAME succeeded but the process stopped before recording it.
        await db.query(
          "INSERT INTO migraciones_esquema(name,checksum) VALUES(?,?)",
          [name, checksum],
        );
        console.log(`Historial recuperado: ${name}`);
        continue;
      }
    }
    for (const statement of sql
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean))
      await db.query(statement);
    await db.query(
      "INSERT INTO migraciones_esquema(name,checksum) VALUES(?,?)",
      [name, checksum],
    );
    console.log(`Aplicada ${name}`);
  }
} finally {
  if (locked) await db.query("SELECT RELEASE_LOCK('sige_migrate')");
  db.release();
  await pool.end();
}
