# Verificación: actualización de tablas a español

Se probó esta actualización con Node 24.22.1 y MySQL 8.0.46 real, sin Docker ni SQLite. La interfaz y el contrato API se mantienen; el alcance de esta entrega es renombrar las tablas y adaptar su acceso.

| Comprobación               | Resultado                                              |
| -------------------------- | ------------------------------------------------------ |
| `npm run typecheck`        | Frontend y backend sin errores                         |
| `npm run build`            | Ambos proyectos compilados                             |
| `npm test`                 | 11 pruebas unitarias aprobadas                         |
| `npm run test:integration` | 17 pruebas aprobadas con esquema español en MySQL real |
| `npm run test:migration`   | 29 comprobaciones de migración aprobadas               |
| Migración original 001     | Mismo SHA-256 que el ZIP recibido; no se modificó      |

El registro de la ejecución está en `docs/evidence/pruebas-tablas-espanol.txt`. El registro de la versión original se conserva por separado como antecedente, no como verificación de esta actualización.

## Conservación de datos

Se creó una base de prueba vacía y exclusiva con la migración original en inglés y su historial. Se agregaron datos a las 22 tablas: usuario con hash Argon2id, sesiones, tokens consumidos, intentos de login, terceros, producto, compra recibida, venta confirmada, sus detalles, saldo y movimientos, documento con imagen, notificación y lectura, auditoría y permisos.

Antes y después de migrar se comparó cada fila completa, incluidos IDs, fechas, decimales, hashes y referencias. Todas fueron idénticas. Se compararon las claves foráneas y sus columnas contra las referencias equivalentes en español. También se comprobó que el registro de la migración original y su fecha se conservaron.

Se volvió a ejecutar la migración: no cambió datos ni historial. Se simuló una interrupción posterior al renombrado pero anterior al registro de 002 y se verificó su recuperación. Se introdujo un nombre antiguo en conflicto y se comprobó que el ejecutor se detuvo sin cambiar los datos. Una inserción posterior verificó la continuidad de AUTO_INCREMENT.

La prueba conserva exactamente la estructura de la migración original; la migración inicial no se reescribió a español para simular una actualización.

## Comportamiento funcional

La batería de integración se ejecutó sobre otra base nueva aplicando 001 + 002 y el seed actualizado. Verificó autenticación, CSRF, permisos, sesiones y renovación, catálogos, ventas/compras concurrentes, recepción idempotente, reversión, rollback por stock insuficiente, documentos locales, reportes, dashboard, auditoría, notificaciones y el adaptador Lambda. Además se comprobó que solo existen las 22 tablas de negocio con nombres españoles y `migraciones_esquema`.

## Reproducir la prueba de migración

Usa una base **vacía y exclusiva** cuyo nombre termine en `_migracion_test`, con permisos del usuario de prueba. El valor predeterminado es `sige_migracion_test` y se puede definir otra conexión mediante `TEST_MIGRATION_DATABASE_URL`. La prueba se niega a empezar si encuentra tablas; no debe ejecutarse sobre tu base `sige`.

```sql
CREATE DATABASE sige_migracion_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON sige_migracion_test.* TO 'sige'@'localhost';
```

Después, desde la raíz:

```powershell
npm run test:migration
```

El sufijo obligatorio y la comprobación de base vacía evitan que el ejecutor use una base de negocio por error. Para repetir la prueba, crea otra base vacía exclusiva y configura su URL; no borres tu base de SIGE.

## Límites

Estas pruebas no se ejecutaron dentro de tu computador ni modificaron su base real. Antes de actualizar tu instalación conserva un respaldo y tu `.env`, y detén el aplicativo anterior. Revisa el resultado con tu propia base siguiendo `ACTUALIZAR_TABLAS_ES.md`.

No se volvieron a probar visualmente todas las pantallas ni se desplegaron recursos AWS. La configuración de Docker se conserva como alternativa opcional, pero no se utilizó en esta verificación. Windows, MySQL 8.4 y MariaDB no se probaron en esta ejecución; se requiere MySQL 8.0/8.4 con InnoDB y Node 24 para el proyecto. No se tradujeron nombres de columnas ni se migraron archivos de un proveedor de almacenamiento a otro.
