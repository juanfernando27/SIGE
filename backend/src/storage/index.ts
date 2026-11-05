import { mkdir, writeFile, readFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
export interface StorageProvider {
  name: "local" | "s3";
  put(key: string, data: Buffer, type: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  ready(): Promise<void>;
  downloadUrl?(key: string, filename: string): Promise<string>;
}
export class LocalStorageProvider implements StorageProvider {
  name = "local" as const;
  constructor(private root = path.resolve(env.UPLOAD_DIR)) {}
  private target(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key))
      throw new Error("Clave de archivo inválida.");
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.target(key), data, { flag: "wx" });
  }
  async get(key: string) {
    return readFile(this.target(key));
  }
  async delete(key: string) {
    await unlink(this.target(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  async ready() {
    await mkdir(this.root, { recursive: true });
    await access(this.root);
  }
}
export class S3StorageProvider implements StorageProvider {
  name = "s3" as const;
  private client = new S3Client({ region: env.AWS_REGION });
  private bucket = env.S3_BUCKET!;
  async put(key: string, data: Buffer, type: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: type,
        ServerSideEncryption: "AES256",
      }),
    );
  }
  async get(key: string) {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
  async ready() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
  downloadUrl(key: string, filename: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      }),
      { expiresIn: 60 },
    );
  }
}
export const storage: StorageProvider =
  env.STORAGE_PROVIDER === "s3"
    ? new S3StorageProvider()
    : new LocalStorageProvider();
