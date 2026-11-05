import mysql, { type PoolConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "./env.js";
export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 5,
  connectTimeout: 5000,
  ssl:
    env.DATABASE_TLS === "true"
      ? {
          rejectUnauthorized: true,
          ...(env.DATABASE_CA_BASE64
            ? {
                ca: Buffer.from(env.DATABASE_CA_BASE64, "base64").toString(
                  "utf8",
                ),
              }
            : {}),
        }
      : undefined,
  timezone: "Z",
  decimalNumbers: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
});
pool.on("connection", (connection: any) => {
  connection.query("SET time_zone = '+00:00'", (error: any) => {
    if (error) connection.destroy();
  });
});
export const orm = drizzle(pool);
export interface Queryable {
  query(sql: string, params?: any): Promise<any>;
}
export async function rows<T = any>(
  db: Queryable,
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  const [r] = await db.query(sql, params);
  return r as T[];
}
export async function one<T = any>(
  db: Queryable,
  sql: string,
  params: any[] = [],
): Promise<T | undefined> {
  return (await rows<T>(db, sql, params))[0];
}
export async function transaction<T>(
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const tx = await pool.getConnection();
  try {
    await tx.query("SET time_zone = '+00:00'");
    await tx.beginTransaction();
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.release();
  }
}
