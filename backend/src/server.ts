import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";
const server = app.listen(env.PORT, () =>
  console.log(`SIGE API: http://localhost:${env.PORT}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
