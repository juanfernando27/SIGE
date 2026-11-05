// Identificadores lógicos de la API -> nombres físicos en MySQL.
// Solo se interpolan nombres de esta lista; los datos siguen siendo parámetros SQL.
export const tableNames = {
  roles: "roles",
  permissions: "permisos",
  role_permissions: "roles_permisos",
  users: "usuarios",
  auth_sessions: "sesiones_autenticacion",
  used_refresh_tokens: "tokens_renovacion_usados",
  login_attempts: "intentos_inicio_sesion",
  categories: "categorias",
  customers: "clientes",
  suppliers: "proveedores",
  products: "productos",
  inventories: "inventarios",
  sales: "ventas",
  purchases: "compras",
  sale_items: "detalles_venta",
  purchase_items: "detalles_compra",
  inventory_movements: "movimientos_inventario",
  documents: "documentos",
  product_images: "imagenes_producto",
  notifications: "notificaciones",
  notification_reads: "lecturas_notificaciones",
  audit_logs: "registros_auditoria",
} as const;
export function tableName(entity: string): string {
  if (!Object.hasOwn(tableNames, entity))
    throw new Error("Entidad de base de datos no permitida.");
  return tableNames[entity as keyof typeof tableNames];
}
