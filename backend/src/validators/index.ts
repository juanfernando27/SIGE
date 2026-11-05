import { z } from "zod";
export const id = z.coerce.number().int().positive().max(4294967295);
const text = (max = 120) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).default("");
export const price = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/,
    "Usa un importe positivo con máximo 2 decimales.",
  );
const status = z.enum(["active", "inactive"]).default("active");
export const password = z
  .string()
  .min(12, "La contraseña requiere al menos 12 caracteres.")
  .max(128);
export const entities = {
  categories: z
    .object({ name: text(), description: optionalText(1000), status })
    .strict(),
  products: z
    .object({
      code: text(40),
      name: text(140),
      description: optionalText(1000),
      category_id: id,
      supplier_id: id.nullable().default(null),
      purchase_price: price,
      sale_price: price,
      min_stock: z.coerce.number().int().min(0).max(1000000),
      status,
    })
    .strict(),
  customers: z
    .object({
      identification: text(40),
      name: text(),
      phone: optionalText(40),
      email: z.union([z.email().max(190), z.literal("")]).default(""),
      address: optionalText(300),
      status,
    })
    .strict(),
  suppliers: z
    .object({
      identification: text(40),
      name: text(),
      phone: optionalText(40),
      email: z.union([z.email().max(190), z.literal("")]).default(""),
      address: optionalText(300),
      status,
    })
    .strict(),
  users: z
    .object({
      name: text(),
      email: z
        .email()
        .max(190)
        .transform((v) => v.toLowerCase()),
      role_id: id,
      status,
      password: password.optional(),
    })
    .strict(),
};
export type Entity = keyof typeof entities;
export const paging = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(15),
    q: z.string().max(140).default(""),
    status: z.string().max(30).default(""),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "El rango de fechas es inválido.",
  });
export const orderInput = z
  .object({
    party_id: id,
    request_key: z.uuid(),
    items: z
      .array(
        z
          .object({
            product_id: id,
            quantity: z.coerce.number().int().min(1).max(1000000),
            unit_price: price.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.product_id)).size === v.items.length,
    { message: "No repitas productos en una operación." },
  );
export const adjustment = z
  .object({
    product_id: id,
    quantity: z.coerce
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0),
    reason: text(500),
  })
  .strict();
export const cancellation = z.object({ reason: text(500) }).strict();
