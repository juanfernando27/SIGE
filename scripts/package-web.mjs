import { mkdir, copyFile, cp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir("build", { recursive: true });
await rm("build/web", { recursive: true, force: true });
await mkdir("build/web");
await cp("frontend/dist", "build/web", { recursive: true });
await copyFile("infrastructure/nginx.conf", "build/web/nginx.conf");
const r = spawnSync(
  "tar",
  ["-czf", "build/sige-web.tar.gz", "-C", "build/web", "."],
  { stdio: "inherit" },
);
if (r.status !== 0)
  throw new Error(
    "No se pudo crear el tar.gz. Verifica que tar esté disponible.",
  );
await rm("build/web", { recursive: true });
console.log("Creado build/sige-web.tar.gz");
