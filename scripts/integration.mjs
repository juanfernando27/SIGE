import { spawnSync } from "node:child_process";
import path from "node:path";
const url =
  process.env.TEST_DATABASE_URL ||
  "mysql://sige:sige_local_change@127.0.0.1:3306/sige_test";
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL debe terminar en _test.");
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: url,
  APP_ORIGIN: "http://localhost:5173",
  STORAGE_PROVIDER: "local",
  UPLOAD_DIR: path.resolve("backend/uploads/test"),
};
for (const args of [
  ["--import", "tsx", "src/migrate.ts"],
  ["--import", "tsx", "src/seed.ts"],
  [
    path.resolve("node_modules/vitest/vitest.mjs"),
    "run",
    "src/tests/integration.test.ts",
  ],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve("backend"),
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
