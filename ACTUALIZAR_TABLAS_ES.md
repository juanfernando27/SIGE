# Actualizar SIGE: tablas en español sin Docker

Si ya tienes acceso a tu MySQL instalado directamente, **no necesitas Docker** para ejecutar SIGE. Workbench es la herramienta de administración; MySQL Server es el servicio que debe permanecer encendido.

## Qué cambia

Esta versión actualiza las consultas SQL, los nombres físicos de los modelos Drizzle, las consultas dinámicas mediante una lista permitida, el seed, las pruebas y el modelo de datos. Las 22 tablas de negocio quedan en español; `roles` conserva su nombre y las otras 21 se renombran. La tabla técnica `schema_migrations` pasa a llamarse `migraciones_esquema`.

Los nombres de columnas, las rutas API y los valores internos de estados o entidades se mantienen. Por ejemplo, una ruta `/api/products` consulta la tabla `productos`; un valor `source_type='sales'` se conserva para no romper movimientos anteriores. Esta entrega traduce nombres de tablas, no todas las columnas del sistema.

El archivo `database/migrations/001_initial.sql` permanece idéntico al original para conservar su checksum y permitir actualizar una base ya migrada. La nueva `002_tablas_en_espanol.sql` renombra las tablas en un solo comando; no contiene DROP, TRUNCATE ni recreación de registros. El SQL final de referencia está en `database/esquema_actual_espanol.sql`.

## Antes de comenzar

1. Detén SIGE con **Ctrl+C** en su terminal. Ninguna instancia de la versión antigua debe seguir escribiendo mientras se actualiza.
2. Guarda un respaldo completo de la base `sige` con MySQL Workbench u otra herramienta de respaldo. Conserva también una copia de tu carpeta de proyecto actual y de los archivos en `backend/uploads`, si existen.
3. Conserva tu archivo **`backend/.env`**. El ZIP actualizado no incluye credenciales privadas, dependencias instaladas ni copias de tus archivos subidos.
4. Utiliza Node 24 y MySQL 8.0/8.4 con tablas InnoDB. Se verificó la migración con MySQL 8.0.46; no se certificó MariaDB.

## Aplicar la actualización en Windows

1. Extrae el ZIP nuevo en **una carpeta distinta**. Abre su carpeta `SIGE` en VS Code.
2. Copia tu `backend/.env` anterior a `backend/.env` en la carpeta nueva. Si tenías archivos subidos, copia también `backend/uploads` respetando la misma ubicación relativa. Si configuraste `UPLOAD_DIR` con una ruta absoluta, conserva esa ruta y sus permisos.
3. Verifica que la conexión siga apuntando a la base original. Para la configuración local que venías usando:

   ```env
   DATABASE_URL=mysql://sige:sige_local_change@127.0.0.1:3306/sige
   ```

   Si habías cambiado usuario, contraseña o puerto, conserva tus valores reales. No cambies el nombre de la base para traducir las tablas.

4. Desde la carpeta principal `SIGE`, ejecuta:

   ```powershell
   npm ci
   npm run db:migrate
   ```

   En una base actualizada desde la versión original debes ver:

   ```text
   Sin cambios: 001_initial.sql
   Aplicada 002_tablas_en_espanol.sql
   ```

   El historial técnico anterior también se renombra automáticamente. Si vuelves a ejecutar el comando, ambas migraciones deben indicar `Sin cambios`.

5. Inicia la versión nueva:

   ```powershell
   npm run dev
   ```

6. Abre http://localhost:5173. Usa tu usuario y contraseña habituales. En Workbench actualiza la lista de Schemas y Tables con su botón de refrescar.

**Para actualizar no ejecutes `npm run db:seed`:** el cambio de nombres no necesita agregar demostraciones ni modificar contraseñas o existencias. Tampoco necesitas ejecutar `docker compose up`.

## Comprobar el resultado

En Workbench puedes ejecutar consultas de lectura:

```sql
USE sige;
SHOW TABLES;
SELECT name, applied_at FROM migraciones_esquema ORDER BY name;
SELECT COUNT(*) AS total_productos FROM productos;
SELECT COUNT(*) AS total_clientes FROM clientes;
SELECT COUNT(*) AS total_ventas FROM ventas;
SELECT product_id, stock FROM inventarios ORDER BY product_id;
```

Comprueba también en SIGE que puedes iniciar sesión y consultar catálogo, historial de ventas, compras e inventario. Si tenías documentos, verifica una descarga después de conservar `backend/uploads`.

## Si aparece un error

- **Migración modificada: 001_initial.sql:** no cambies el checksum ni borres el historial. La entrega conserva el archivo original; compara la versión que se aplicó en tu base con la del ZIP.
- **Falta el historial de migraciones:** la base contiene tablas pero no su registro de instalación. El ejecutor se detiene para no superponer un esquema. Conserva la base y revisa cómo se creó; no la recrees para solucionar el mensaje.
- **Tablas no coinciden / nombres ya usados:** puede haber tablas renombradas manualmente, tablas faltantes o nombres destino existentes. El ejecutor se detiene antes del renombrado de negocio. Revisa los nombres junto con el respaldo.
- **Permisos insuficientes:** la cuenta que ejecuta la migración necesita permisos DDL para renombrar tablas y crear/actualizar el historial. La cuenta `sige` configurada con ALL sobre `sige.*` en las instrucciones locales los tiene; una cuenta restringida puede requerir un usuario de migración.
- **El proceso se interrumpió después de renombrar:** si detecta todas las tablas con nombres españoles y falta solo el registro de 002, el ejecutor recupera ese registro al volver a ejecutarlo. Si el esquema está mezclado, se detiene.

El DDL de MySQL no se revierte con un ROLLBACK de aplicación. Para volver a la versión anterior después de migrar, detén la aplicación y restaura el respaldo completo junto con el código anterior; no arranques el código antiguo contra las tablas renombradas.

## ¿Debo editar el SQL que recibí antes?

**No necesitas editarlo manualmente.** Utiliza este proyecto actualizado y ejecuta `npm run db:migrate`. No vuelvas a importar `001_initial.sql` sobre tu base existente, no ejecutes el SQL de referencia encima de tus tablas y no renombres tablas sueltas desde Workbench.

Si después escribes consultas SQL propias, usa los nombres nuevos, por ejemplo `SELECT * FROM productos;`. La correspondencia completa se encuentra en `database/nombres_tablas.json` y en `docs/TABLAS_ES.md`.
