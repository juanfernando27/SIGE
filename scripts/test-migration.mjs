// Prueba destructiva SOLO sobre una base vacía y exclusiva con sufijo _migracion_test.
// Se niega a operar si esa base ya contiene alguna tabla.
import mysql from "mysql2/promise";
import argon2 from "argon2";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { tableNames } from "../backend/src/models/table-names.ts";
const url =
  process.env.TEST_MIGRATION_DATABASE_URL ||
  "mysql://sige:sige_local_change@127.0.0.1:3306/sige_migracion_test";
assert(
  new URL(url).pathname.endsWith("_migracion_test"),
  "La base debe terminar en _migracion_test.",
);
const db = await mysql.createConnection({
  uri: url,
  timezone: "Z",
  decimalNumbers: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
});
const sha = (v) => createHash("sha256").update(v).digest("hex");
const root = process.cwd();
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("PASS:", name);
}
const names = async () =>
  new Set(
    (
      await db.query(
        "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'",
      )
    )[0].map((r) => r.name),
  );
async function snapshot(table) {
  const [data] = await db.query(`SELECT * FROM \`${table}\``);
  return data.map((v) => JSON.stringify(v)).sort();
}
function migrate(success = true) {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/migrate.ts"], {
    cwd: path.join(root, "backend"),
    env: {
      ...process.env,
      DATABASE_URL: url,
      NODE_ENV: "test",
      STORAGE_PROVIDER: "local",
    },
    encoding: "utf8",
  });
  if (success) assert.equal(r.status, 0, r.stderr);
  else assert.notEqual(r.status, 0, "Debía detenerse por conflicto.");
  return r;
}
try {
  assert.equal(
    (await names()).size,
    0,
    "La base de pruebas no está vacía. No se cambió ningún dato. Usa una base exclusiva nueva.",
  );
  await db.query("SET time_zone = '+00:00'");
  const original = await readFile(
    "database/migrations/001_initial.sql",
    "utf8",
  );
  for (const statement of original
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean))
    await db.query(statement);
  await db.query(
    "CREATE TABLE schema_migrations(name VARCHAR(190) PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  await db.query("INSERT INTO schema_migrations(name,checksum) VALUES(?,?)", [
    "001_initial.sql",
    sha(original),
  ]);
  for (const statement of (
    await readFile("tests/migration/datos_anteriores.sql", "utf8")
  )
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean))
    await db.query(statement);
  await db.query("UPDATE users SET password_hash=? WHERE id=1", [
    await argon2.hash("ContrasenaFixture!2026", { type: argon2.argon2id }),
  ]);
  const [beforeFk] = await db.query(
    "SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME,ORDINAL_POSITION FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL",
  );
  const before = Object.fromEntries(
    await Promise.all(
      Object.keys(tableNames).map(async (old) => [old, await snapshot(old)]),
    ),
  );
  const history = await snapshot("schema_migrations");
  migrate();
  const afterNames = await names();
  check("22 tablas de negocio y el historial con nombres españoles", () =>
    assert.deepEqual(
      [...afterNames].sort(),
      [...Object.values(tableNames), "migraciones_esquema"].sort(),
    ),
  );
  for (const [old, next] of Object.entries(tableNames)) {
    assert.deepEqual(await snapshot(next), before[old]);
    check(`datos idénticos: ${old} → ${next}`, () => {});
  }
  const originalHistory = (await snapshot("migraciones_esquema")).filter(
    (v) => JSON.parse(v).name === "001_initial.sql",
  );
  check("historial original y su checksum conservados", () =>
    assert.deepEqual(originalHistory, history),
  );
  const [foreign] = await db.query(
    "SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME,ORDINAL_POSITION FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL",
  );
  check("claves foráneas apuntan al esquema español", () => {
    assert(foreign.length > 0);
    assert.deepEqual(
      foreign.map((r) => JSON.stringify(r)).sort(),
      beforeFk
        .map((r) =>
          JSON.stringify({
            ...r,
            TABLE_NAME: tableNames[r.TABLE_NAME],
            REFERENCED_TABLE_NAME: tableNames[r.REFERENCED_TABLE_NAME],
          }),
        )
        .sort(),
    );
    for (const f of foreign) {
      assert(afterNames.has(f.TABLE_NAME));
      assert(afterNames.has(f.REFERENCED_TABLE_NAME));
    }
  });
  const spanishBefore = Object.fromEntries(
    await Promise.all([...afterNames].map(async (t) => [t, await snapshot(t)])),
  );
  migrate();
  for (const t of afterNames)
    assert.deepEqual(await snapshot(t), spanishBefore[t]);
  check("segunda ejecución sin cambios de datos ni de historial", () => {});
  await db.query(
    "DELETE FROM migraciones_esquema WHERE name='002_tablas_en_espanol.sql'",
  );
  migrate();
  for (const [old, next] of Object.entries(tableNames))
    assert.deepEqual(await snapshot(next), before[old]);
  check(
    "recuperación si el renombrado terminó antes de registrar el historial",
    () => {},
  );
  await db.query(
    "DELETE FROM migraciones_esquema WHERE name='002_tablas_en_espanol.sql'",
  );
  await db.query("CREATE TABLE customers (id INT PRIMARY KEY)");
  const conflict = migrate(false);
  check("esquema mezclado detenido sin renombrar datos", () =>
    assert.match(conflict.stderr, /no coinciden/),
  );
  for (const [old, next] of Object.entries(tableNames))
    assert.deepEqual(await snapshot(next), before[old]);
  await db.query("DROP TABLE customers");
  migrate();
  const [inserted] = await db.query(
    "INSERT INTO categorias(name) VALUES('Categoría posterior')",
  );
  check("AUTO_INCREMENT conservado después del cambio", () =>
    assert.equal(inserted.insertId, 2),
  );
  console.log(`Migración verificada: ${passed} comprobaciones aprobadas.`);
} finally {
  await db.end();
}
