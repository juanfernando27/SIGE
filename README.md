# SIGE — Sistema Integral de Gestión Empresarial

> **Actualización: tablas en español y uso directo de MySQL.** Si ya tienes SIGE funcionando, sigue primero [ACTUALIZAR_TABLAS_ES.md](ACTUALIZAR_TABLAS_ES.md). No recrees la base ni ejecutes el seed para cambiar nombres. Conserva tu `backend/.env` y tus archivos de `backend/uploads`.

## Arranque con tu MySQL instalado (sin Docker)

Para tu configuración actual, usa `DATABASE_URL=mysql://sige:sige_local_change@127.0.0.1:3306/sige` en `backend/.env`, o conserva tus credenciales reales. La base y el usuario ya existentes sirven para esta actualización. El archivo `.env` privado no se distribuye en el ZIP.

Después de instalar dependencias (`npm ci`), detener la versión anterior y guardar un respaldo, ejecuta:

```powershell
npm run db:migrate
npm run dev
```

Abre http://localhost:5173. No ejecutes Docker Compose si vas a usar tu MySQL directo. Para una instalación completamente nueva, usa `npm run setup` para crear `.env`, crea la base y el usuario, ejecuta migraciones y luego `npm run db:seed` una sola vez para agregar la demostración.

Aplicación académica de gestión comercial en español. Incluye React, una API REST modular y MySQL. Ventas, compras y movimientos de inventario comparten transacciones InnoDB. El mismo backend se puede iniciar con Express o mediante un adaptador para Lambda.

**Estado de esta entrega (1.1.0):** tablas en español, migración verificada conservando los datos y pruebas con MySQL 8.0.46. La configuración recomendada de Docker utiliza MySQL 8.4. Los archivos de AWS son preparación para una fase posterior: no se han desplegado ni se ha comprobado su comportamiento en una cuenta AWS. Consulta [docs/VERIFICACION.md](docs/VERIFICACION.md).

## Alternativa: inicio con Docker en Windows / VS Code

Requisitos: Node.js **24 LTS**, npm, Docker Desktop con Docker Compose y VS Code. Abre la carpeta `SIGE` extraída del ZIP, abre Terminal → Nueva terminal y ejecuta:

```bash
npm ci
npm run setup
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Abre **http://localhost:5173**. API: http://localhost:3001/api/health. Usa `localhost` de forma consistente; `127.0.0.1` como origen del navegador no equivale a `localhost` para cookies y CSRF. Si cambia el puerto del frontend, actualiza `APP_ORIGIN` en `backend/.env`.

`npm run setup` crea `backend/.env` a partir del ejemplo y conserva cualquier configuración existente. El comando `db:migrate` comprueba las migraciones aplicadas mediante checksum. `db:seed` crea los roles y una demostración; volver a ejecutarlo no restablece contraseñas ni saldos existentes.

| Rol           | Usuario local         | Contraseña inicial local |
| ------------- | --------------------- | ------------------------ |
| Administrador | admin@sige.local      | SigeDemo!2026            |
| Vendedor      | ventas@sige.local     | SigeDemo!2026            |
| Inventario    | inventario@sige.local | SigeDemo!2026            |

Puedes definir `SEED_ADMIN_PASSWORD` en `backend/.env` **antes del primer seed** para usar otra contraseña de al menos 12 caracteres para las tres cuentas iniciales. El seed está bloqueado con `NODE_ENV=production`. Estas cuentas son exclusivamente de demostración.

Para detener el aplicativo usa Ctrl+C. Para detener MySQL conservando los datos: `docker compose stop`. No uses `docker compose down -v` si necesitas conservar la base.

## Recorrido de demostración

1. Inicia sesión como administrador y revisa el dashboard. Sus cifras proceden de consultas SQL; los datos de ejemplo se cargan en la base.
2. Crea una categoría, un proveedor, un cliente y un producto. El producto comienza con cero existencias.
3. En **Compras**, crea un borrador con proveedor, producto, cantidad y precio. Ábrelo y selecciona **Recibir mercancía**. Solo entonces aumentan las existencias.
4. En **Ventas**, crea un borrador y confírmalo. El servidor toma el precio de venta y valida las existencias. Descarga el comprobante PDF.
5. Anula la venta indicando un motivo. Comprueba en Inventario → Movimientos que existe una reversión. Repetir la misma operación no aplica inventario dos veces.
6. Sube una imagen PNG/JPEG asociada al producto desde Documentos. Aparecerá en el catálogo. También puedes asociar PDF a productos, terceros y operaciones.
7. Descarga un reporte CSV compatible con Excel o PDF, consulta la auditoría y marca una notificación como leída.
8. Cierra sesión y entra como vendedor o encargado de inventario para comprobar los permisos. La API también los verifica.

## Funciones incluidas

| Módulo                 | Comportamiento implementado                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticación          | Argon2id, acceso de 15 minutos, renovación rotativa, sesiones MySQL, cookies HttpOnly/SameSite, CSRF, cierre de sesión y cambio de contraseña  |
| Dashboard              | Catálogo y terceros activos, compras recibidas, ventas confirmadas, ingresos por período, gráfica, más vendidos, bajo stock y ventas recientes |
| Usuarios               | Creación, edición, roles, estados, búsqueda y paginación; protección del último administrador                                                  |
| Productos y categorías | CRUD, precios decimales, proveedor principal, mínimos, imagen y desactivación con historial                                                    |
| Clientes y proveedores | CRUD, contactos, historial reciente y endpoints paginados para el historial completo                                                           |
| Inventario             | Existencias, movimientos, ajustes con motivo, alerta de mínimo y control de saldos no negativos                                                |
| Compras y ventas       | Borradores, detalle, recepción/confirmación, anulaciones y comprobantes; operaciones atómicas e idempotentes                                   |
| Documentos             | Subida, metadatos, asociaciones, descarga autorizada y eliminación; proveedores local y S3                                                     |
| Reportes               | Ventas, compras, inventario actual y bajo mínimo; fechas para operaciones; JSON, CSV y PDF                                                     |
| Auditoría              | Autor, acción, entidad, registro, fecha, cambios relevantes y resultado; redacción de secretos                                                 |
| Notificaciones         | Alertas de inventario y eventos de operaciones; estado de lectura individual en MySQL                                                          |

`DELETE` en catálogos desactiva registros, conserva claves únicas y mantiene los históricos. En documentos elimina el vínculo y el archivo. No se implementan facturación electrónica DIAN, impuestos, descuentos, devoluciones parciales ni contabilidad: no fueron especificados. La moneda de esta entrega es COP y las cantidades son unidades enteras.

## Estructura

```text
SIGE/
  frontend/src/             Interfaz, rutas protegidas, formularios y gráficos
  backend/src/
    auth/                  Sesiones y contraseñas
    config/                Entorno y conexiones
    controllers/           Adaptadores de respuesta HTTP
    routes/                Endpoints y permisos
    services/              Reglas de negocio independientes de Express
    repositories/          Acceso a datos y auditoría
    models/                Modelos de lectura Drizzle
    validators/            Validación Zod
    middlewares/           CSRF, autenticación y autorización
    storage/               Contrato, almacenamiento local y S3
    utils/                 Dinero y errores
    tests/                 Pruebas unitarias y de integración
  database/migrations/     DDL versionado, claves, índices y restricciones
  infrastructure/          Nginx, CloudFormation, SAM e imagen Lambda
  docs/                    Modelo de datos, API, seguridad, AWS y verificación
  tests/load.js            Prueba futura con k6
  scripts/                 Inicio local, preparación y ejecución de pruebas
```

Drizzle se usa en las consultas del catálogo con modelos tipados. Las operaciones que bloquean filas y modifican varios agregados utilizan SQL parametrizado con mysql2 y una unidad de transacción compartida. Las migraciones SQL son la fuente de verdad para las restricciones e índices; no hay sincronización automática de esquema al arrancar. `001_initial.sql` es histórica e inmutable, `002_tablas_en_espanol.sql` renombra las tablas y `database/esquema_actual_espanol.sql` muestra el esquema final de referencia.

## Comandos

| Comando                    | Uso                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `npm ci`                   | Instala las versiones exactas del lockfile                                               |
| `npm run dev`              | Inicia API y frontend; acepta argumentos de Vite después de `--`                         |
| `npm run typecheck`        | Comprueba TypeScript en ambos proyectos                                                  |
| `npm test`                 | Pruebas unitarias sin necesitar MySQL                                                    |
| `npm run test:migration`   | Comprueba la actualización sobre una base exclusiva y vacía con sufijo `_migracion_test` |
| `npm run test:integration` | Migra y carga la base aislada `sige_test`, luego ejecuta la integración                  |
| `npm run build`            | Compila backend y frontend                                                               |
| `npm start`                | Inicia el backend compilado; el frontend compilado lo sirve Nginx                        |
| `npm run db:migrate`       | Aplica migraciones pendientes a `DATABASE_URL`                                           |
| `npm run db:seed`          | Crea la demostración local                                                               |

### Base aislada de pruebas

El usuario de Docker solo recibe permisos sobre `sige`. Antes de la primera ejecución de integración, crea `sige_test` y concede permisos desde una sesión root:

```bash
docker compose exec mysql mysql -uroot -p
```

La contraseña root local predeterminada de Compose es `root_local_change`. Dentro del cliente:

```sql
CREATE DATABASE IF NOT EXISTS sige_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON sige_test.* TO 'sige'@'%';
EXIT;
```

Luego ejecuta `npm run test:integration`. La URL predeterminada es `mysql://sige:sige_local_change@127.0.0.1:3306/sige_test`. Puedes cambiarla con `TEST_DATABASE_URL`; el ejecutor rechaza nombres que no terminen en `_test`. Las pruebas agregan registros a esa base aislada. Nunca las dirijas a una base con datos que necesites conservar.

### Alternativa XAMPP / MySQL ya instalado

No inicies el contenedor MySQL si el puerto 3306 ya está ocupado. En tu administrador SQL crea `sige`, un usuario local `sige` y sus permisos; configura `DATABASE_URL` con esas credenciales en `backend/.env`. Ejecuta migraciones, seed y `dev` con los mismos comandos.

Algunas instalaciones XAMPP incluyen **MariaDB**, que no es idéntico a MySQL 8. Esta entrega usa `FOR SHARE` y restricciones verificadas en MySQL 8; no se ha certificado MariaDB. Para reproducir el entorno evaluado utiliza MySQL 8.0/8.4 independiente o Docker. No basta con que el panel de XAMPP muestre la etiqueta «MySQL».

## API y documentos técnicos

- [Modelo entidad-relación y diccionario](docs/DATOS.md).
- [Arquitectura, reglas y decisiones](docs/ARQUITECTURA.md).
- [Permisos, sesiones y seguridad](docs/SEGURIDAD.md).
- [Preparación y validación futura en AWS](docs/AWS.md).
- [Pruebas ejecutadas y límites de verificación](docs/VERIFICACION.md).
- [Contrato OpenAPI](docs/openapi.json) y [colección Postman](docs/SIGE.postman_collection.json).

Con sesión de administrador, abre **http://localhost:5173/api/docs/** o **http://localhost:3001/api/docs/** para Swagger. Las operaciones de escritura requieren que `Origin` coincida con `APP_ORIGIN`; para probarlas desde Swagger usa el primer enlace, servido por el proxy del frontend. El JSON de OpenAPI está en `/api/openapi.json` con sesión administradora.

## Problemas habituales

| Situación                      | Revisión                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error de conexión MySQL        | Espera el health check de Compose; revisa puerto, contraseña y `DATABASE_URL`                                                                               |
| Login devuelve 403             | El origen visible debe coincidir exactamente con `APP_ORIGIN`; no mezcles localhost y 127.0.0.1                                                             |
| Login devuelve 401             | Ejecuta el seed y usa las credenciales iniciales; el seed no restablece una contraseña modificada                                                           |
| Archivo no se puede descargar  | Revisa permisos del registro y el proveedor guardado en sus metadatos                                                                                       |
| Operación devuelve 409         | Puede ser stock insuficiente, clave duplicada, estado incompatible o concurrencia; lee el mensaje y recarga                                                 |
| Migración inicial interrumpida | MySQL hace commit implícito del DDL. Revisa el error y restaura la base desde un respaldo; en una base vacía de práctica se puede recrear y volver a migrar |
| Error al instalar Argon2       | Usa Node 24 oficial y una plataforma admitida; instala herramientas de compilación si no hay binario precompilado                                           |

No subas `.env`, archivos de usuarios ni credenciales a GitHub. El ZIP contiene ejemplos de configuración y el lockfile; no incluye dependencias instaladas ni secretos de una cuenta AWS.
