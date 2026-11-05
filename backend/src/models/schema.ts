import { tableNames } from "./table-names.js";
// ORM read models. DDL constraints and indexes live in the versioned SQL migration.
import {
  mysqlTable,
  int,
  bigint,
  varchar,
  char,
  decimal,
  datetime,
  json,
} from "drizzle-orm/mysql-core";
export const roles = mysqlTable(tableNames.roles, {
  id: int("id", { unsigned: true }),
  name: varchar("name", { length: 40 }),
});
export const permissions = mysqlTable(tableNames.permissions, {
  id: int("id", { unsigned: true }),
  name: varchar("name", { length: 80 }),
});
export const role_permissions = mysqlTable(tableNames.role_permissions, {
  role_id: int("role_id", { unsigned: true }),
  permission_id: int("permission_id", { unsigned: true }),
});
export const users = mysqlTable(tableNames.users, {
  id: int("id", { unsigned: true }),
  name: varchar("name", { length: 120 }),
  email: varchar("email", { length: 190 }),
  password_hash: varchar("password_hash", { length: 255 }),
  role_id: int("role_id", { unsigned: true }),
  status: varchar("status", { length: 16 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const auth_sessions = mysqlTable(tableNames.auth_sessions, {
  id: char("id", { length: 36 }),
  user_id: int("user_id", { unsigned: true }),
  access_hash: char("access_hash", { length: 64 }),
  refresh_hash: char("refresh_hash", { length: 64 }),
  csrf_hash: char("csrf_hash", { length: 64 }),
  access_expires_at: datetime("access_expires_at"),
  expires_at: datetime("expires_at"),
  revoked_at: datetime("revoked_at"),
  created_at: datetime("created_at"),
});
export const used_refresh_tokens = mysqlTable(tableNames.used_refresh_tokens, {
  token_hash: char("token_hash", { length: 64 }),
  session_id: char("session_id", { length: 36 }),
  expires_at: datetime("expires_at"),
});
export const login_attempts = mysqlTable(tableNames.login_attempts, {
  id: bigint("id", { mode: "number", unsigned: true }),
  identity_hash: char("identity_hash", { length: 64 }),
  created_at: datetime("created_at"),
});
export const categories = mysqlTable(tableNames.categories, {
  id: int("id", { unsigned: true }),
  name: varchar("name", { length: 120 }),
  description: varchar("description", { length: 1000 }),
  status: varchar("status", { length: 16 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const customers = mysqlTable(tableNames.customers, {
  id: int("id", { unsigned: true }),
  identification: varchar("identification", { length: 40 }),
  name: varchar("name", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 190 }),
  address: varchar("address", { length: 300 }),
  status: varchar("status", { length: 16 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const suppliers = mysqlTable(tableNames.suppliers, {
  id: int("id", { unsigned: true }),
  identification: varchar("identification", { length: 40 }),
  name: varchar("name", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 190 }),
  address: varchar("address", { length: 300 }),
  status: varchar("status", { length: 16 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const products = mysqlTable(tableNames.products, {
  id: int("id", { unsigned: true }),
  code: varchar("code", { length: 40 }),
  name: varchar("name", { length: 140 }),
  description: varchar("description", { length: 1000 }),
  category_id: int("category_id", { unsigned: true }),
  supplier_id: int("supplier_id", { unsigned: true }),
  purchase_price: decimal("purchase_price", { precision: 18, scale: 2 }),
  sale_price: decimal("sale_price", { precision: 18, scale: 2 }),
  min_stock: int("min_stock", { unsigned: true }),
  status: varchar("status", { length: 16 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const inventories = mysqlTable(tableNames.inventories, {
  product_id: int("product_id", { unsigned: true }),
  stock: int("stock", { unsigned: true }),
  updated_at: datetime("updated_at"),
});
export const sales = mysqlTable(tableNames.sales, {
  id: int("id", { unsigned: true }),
  customer_id: int("customer_id", { unsigned: true }),
  user_id: int("user_id", { unsigned: true }),
  status: varchar("status", { length: 16 }),
  total: decimal("total", { precision: 18, scale: 2 }),
  request_key: char("request_key", { length: 36 }),
  request_hash: char("request_hash", { length: 64 }),
  cancel_reason: varchar("cancel_reason", { length: 500 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const purchases = mysqlTable(tableNames.purchases, {
  id: int("id", { unsigned: true }),
  supplier_id: int("supplier_id", { unsigned: true }),
  user_id: int("user_id", { unsigned: true }),
  status: varchar("status", { length: 16 }),
  total: decimal("total", { precision: 18, scale: 2 }),
  request_key: char("request_key", { length: 36 }),
  request_hash: char("request_hash", { length: 64 }),
  cancel_reason: varchar("cancel_reason", { length: 500 }),
  created_at: datetime("created_at"),
  updated_at: datetime("updated_at"),
});
export const sale_items = mysqlTable(tableNames.sale_items, {
  id: int("id", { unsigned: true }),
  sale_id: int("sale_id", { unsigned: true }),
  product_id: int("product_id", { unsigned: true }),
  product_name: varchar("product_name", { length: 140 }),
  quantity: int("quantity", { unsigned: true }),
  unit_price: decimal("unit_price", { precision: 18, scale: 2 }),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }),
});
export const purchase_items = mysqlTable(tableNames.purchase_items, {
  id: int("id", { unsigned: true }),
  purchase_id: int("purchase_id", { unsigned: true }),
  product_id: int("product_id", { unsigned: true }),
  product_name: varchar("product_name", { length: 140 }),
  quantity: int("quantity", { unsigned: true }),
  unit_price: decimal("unit_price", { precision: 18, scale: 2 }),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }),
});
export const inventory_movements = mysqlTable(tableNames.inventory_movements, {
  id: bigint("id", { mode: "number", unsigned: true }),
  product_id: int("product_id", { unsigned: true }),
  user_id: int("user_id", { unsigned: true }),
  kind: varchar("kind", { length: 30 }),
  quantity: int("quantity", { unsigned: true }),
  balance: int("balance", { unsigned: true }),
  source_type: varchar("source_type", { length: 30 }),
  source_id: int("source_id", { unsigned: true }),
  reason: varchar("reason", { length: 500 }),
  created_at: datetime("created_at"),
});
export const documents = mysqlTable(tableNames.documents, {
  id: int("id", { unsigned: true }),
  user_id: int("user_id", { unsigned: true }),
  entity_type: varchar("entity_type", { length: 30 }),
  entity_id: int("entity_id", { unsigned: true }),
  original_name: varchar("original_name", { length: 200 }),
  storage_key: varchar("storage_key", { length: 100 }),
  mime_type: varchar("mime_type", { length: 80 }),
  size_bytes: int("size_bytes", { unsigned: true }),
  provider: varchar("provider", { length: 10 }),
  created_at: datetime("created_at"),
});
export const product_images = mysqlTable(tableNames.product_images, {
  id: int("id", { unsigned: true }),
  product_id: int("product_id", { unsigned: true }),
  document_id: int("document_id", { unsigned: true }),
});
export const notifications = mysqlTable(tableNames.notifications, {
  id: bigint("id", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 180 }),
  message: varchar("message", { length: 500 }),
  event_key: varchar("event_key", { length: 120 }),
  created_at: datetime("created_at"),
});
export const notification_reads = mysqlTable(tableNames.notification_reads, {
  notification_id: bigint("notification_id", {
    mode: "number",
    unsigned: true,
  }),
  user_id: int("user_id", { unsigned: true }),
  read_at: datetime("read_at"),
});
export const audit_logs = mysqlTable(tableNames.audit_logs, {
  id: bigint("id", { mode: "number", unsigned: true }),
  user_id: int("user_id", { unsigned: true }),
  action: varchar("action", { length: 80 }),
  entity: varchar("entity", { length: 40 }),
  entity_id: varchar("entity_id", { length: 50 }),
  changes: json("changes"),
  result: varchar("result", { length: 16 }),
  created_at: datetime("created_at"),
});
export const models = {
  roles,
  permissions,
  role_permissions,
  users,
  auth_sessions,
  used_refresh_tokens,
  login_attempts,
  categories,
  customers,
  suppliers,
  products,
  inventories,
  sales,
  purchases,
  sale_items,
  purchase_items,
  inventory_movements,
  documents,
  product_images,
  notifications,
  notification_reads,
  audit_logs,
};
