import { copyFile, access } from "node:fs/promises";
try {
  await access("backend/.env");
  console.log("backend/.env ya existe; se conserva.");
} catch {
  await copyFile("backend/.env.example", "backend/.env");
  console.log("Creado backend/.env para desarrollo.");
}
