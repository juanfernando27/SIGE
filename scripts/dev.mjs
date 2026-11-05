import { spawn } from "node:child_process";
import path from "node:path";
const root = process.cwd();
const processes = [
  spawn(process.execPath, ["--watch", "--import", "tsx", "src/server.ts"], {
    cwd: path.join(root, "backend"),
    stdio: "inherit",
    env: { ...process.env, PORT: "3001" },
  }),
  spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "0.0.0.0",
      ...process.argv.slice(2),
    ],
    { cwd: path.join(root, "frontend"), stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of processes) {
  child.on("error", (e) => {
    console.error(e.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code || 0));
}
