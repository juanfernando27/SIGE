import dotenv from "dotenv";
import { z } from "zod";
dotenv.config({ quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z
    .string()
    .default("mysql://sige:sige_local_change@127.0.0.1:3306/sige"),
  DATABASE_TLS: z.enum(["true", "false"]).default("false"),
  DATABASE_CA_BASE64: z.string().optional(),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  ACCESS_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  AWS_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
});
export const env = schema.parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (env.DATABASE_TLS !== "true" ||
    env.STORAGE_PROVIDER !== "s3" ||
    !env.APP_ORIGIN.startsWith("https://") ||
    !env.S3_BUCKET)
)
  throw new Error(
    "Producción requiere DATABASE_TLS=true, S3_BUCKET, STORAGE_PROVIDER=s3 y APP_ORIGIN HTTPS.",
  );
