# Nombres de tablas en español

La migración conserva filas, columnas, claves e identificadores. El nombre de la base sigue siendo `sige`. Las columnas y los identificadores lógicos de la API no se traducen en esta versión.

| Nombre anterior       | Nombre en MySQL después de actualizar |
| --------------------- | ------------------------------------- |
| `roles`               | `roles`                               |
| `permissions`         | `permisos`                            |
| `role_permissions`    | `roles_permisos`                      |
| `users`               | `usuarios`                            |
| `auth_sessions`       | `sesiones_autenticacion`              |
| `used_refresh_tokens` | `tokens_renovacion_usados`            |
| `login_attempts`      | `intentos_inicio_sesion`              |
| `categories`          | `categorias`                          |
| `customers`           | `clientes`                            |
| `suppliers`           | `proveedores`                         |
| `products`            | `productos`                           |
| `inventories`         | `inventarios`                         |
| `sales`               | `ventas`                              |
| `purchases`           | `compras`                             |
| `sale_items`          | `detalles_venta`                      |
| `purchase_items`      | `detalles_compra`                     |
| `inventory_movements` | `movimientos_inventario`              |
| `documents`           | `documentos`                          |
| `product_images`      | `imagenes_producto`                   |
| `notifications`       | `notificaciones`                      |
| `notification_reads`  | `lecturas_notificaciones`             |
| `audit_logs`          | `registros_auditoria`                 |
| `schema_migrations`   | `migraciones_esquema`                 |

`roles` ya estaba en español. El ejecutor de migraciones se ocupa del historial técnico `migraciones_esquema`; la migración 002 renombra las otras 21 tablas de negocio.

Para actualizar, sigue `ACTUALIZAR_TABLAS_ES.md` desde la raíz del proyecto. No importes el esquema final encima de una base existente ni cambies nombres sueltos en Workbench.

Se conservan valores internos como `documents.entity_type` (columna ahora dentro de `documentos`) y `source_type='sales'` (columna ahora dentro de `movimientos_inventario`), porque son discriminadores usados por la API, no nombres de tablas. Los metadatos de archivos y sus claves de almacenamiento no cambian.
