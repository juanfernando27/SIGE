# Sesiones, permisos y archivos

## Autenticación

Argon2id se encarga de las contraseñas. Se generan tokens aleatorios de 256 bits y solo se guardan sus hashes SHA-256 en MySQL. El acceso dura 15 minutos por defecto y la sesión tiene vencimiento absoluto de siete días. Renovar no extiende indefinidamente ese vencimiento.

Login y refresh establecen cookies HttpOnly, SameSite=Strict y path `/`. En producción usan `Secure` y prefijo `__Host-`. El token CSRF también se transporta en cookie HttpOnly y se devuelve por JSON para mantenerlo en memoria del cliente; se vincula por hash a la sesión. No se usan localStorage ni sessionStorage para tokens.

Toda escritura exige el `Origin` configurado y que `X-CSRF-Token` coincida con la cookie. Con sesión, también se compara con el hash asociado. El navegador adjunta Origin en fetch POST/PUT/DELETE. Postman debe enviarlo explícitamente. En producción se requiere APP_ORIGIN HTTPS y almacenamiento S3; la aplicación rechaza un arranque que no cumpla esas condiciones o que no active TLS de base de datos.

El refresh rota acceso, renovación y CSRF en una transacción. Guarda el hash de renovación consumido; si reaparece, revoca su sesión completa. En una misma pestaña las renovaciones se coordinan con una promesa compartida. Dos pestañas que renueven a la vez pueden provocar la detección conservadora de reutilización y exigir nuevo login; no se aplica un período de gracia que permita reutilizar el token.

Cerrar sesión revoca el registro en MySQL. Cambiar contraseña revoca todas las sesiones del usuario. Desactivar una cuenta, cambiar su rol o restablecer su contraseña desde usuarios también revoca sus sesiones. Además, cada solicitud lee el estado y permisos actuales; no conserva permisos de un token antiguo.

Hay un control de intentos por identidad persistido en MySQL: diez intentos en quince minutos. Se realiza cómputo Argon2 también para una identidad desconocida y el mensaje no revela si existe. Como defensa adicional, Express aplica un límite por IP; este último es por proceso y no sustituye la barrera persistida.

## Matriz de permisos del seed

| Capacidad                                 | Administrador | Vendedor | Inventario |
| ----------------------------------------- | ------------- | -------- | ---------- |
| Dashboard y notificaciones                | Sí            | Sí       | Sí         |
| Consultar productos/categorías/inventario | Sí            | Sí       | Sí         |
| Crear/editar productos y categorías       | Sí            | No       | Sí         |
| Ajustar inventario                        | Sí            | No       | Sí         |
| Gestionar clientes                        | Sí            | Sí       | No         |
| Gestionar proveedores                     | Sí            | No       | Sí         |
| Consultar y operar ventas                 | Sí            | Sí       | No         |
| Consultar y operar compras                | Sí            | No       | Sí         |
| Reportes y auditoría                      | Sí            | No       | No         |
| Gestionar usuarios y roles                | Sí            | No       | No         |
| Cambiar su contraseña y consultar perfil  | Sí            | Sí       | Sí         |

El dashboard y las notificaciones son información común para los tres roles. Esta entrega no aplica separación por sucursal, empresa ni secreto de costos por rol. La autorización es por módulo y operación, no por propietario del cliente o de la venta. Los permisos residen en `permisos` y `roles_permisos`; los roles iniciales se asignan mediante usuarios.

En documentos, leer exige permiso de lectura de su entidad; subir exige permiso de escritura. Eliminar exige además ser el autor o administrador. No existe carpeta pública de uploads. Las imágenes del catálogo se obtienen por un endpoint autenticado. El usuario no puede cambiar su propio rol/estado desde el CRUD y se bloquea la eliminación del último administrador activo. Los borrados de usuarios son desactivaciones.

## Archivos

Se aceptan PNG, JPEG y PDF, máximo 5 MiB por archivo. Se valida la firma inicial del contenido y su coincidencia con el MIME, además de los límites de Multer. La clave interna siempre es UUID; no se usa el nombre recibido como ruta. No se admiten SVG, HTML ni ejecutables.

La validación de firma no es un análisis antivirus ni garantiza que un PDF esté libre de contenido malicioso. Antes de abrir cargas a usuarios externos debe añadirse un proceso de cuarentena y análisis según el entorno. Los PDF se descargan como adjuntos; solo se permite representación inline de imágenes. Se envían encabezados anti sniffing y caché privada sin almacenamiento para documentos.

La URL S3 prefirmada de lectura dura 60 segundos y solo se genera después de autorizar el documento. La API local no requiere AWS. Para una futura subida directa a S3, el flujo será: autorizar asociación → emitir una clave de cuarentena y URL/POST con límite y tipo → subir → verificar objeto, tamaño, firma y análisis → crear metadatos y habilitar descarga. Esta fase de subida directa no está implementada; las subidas actuales pasan por la API.

Una instalación no migra objetos automáticamente entre proveedores. Antes de cambiar local por S3, copia los objetos conservando sus claves, verifica los archivos y actualiza el campo `provider` mediante un procedimiento controlado. Cambiar una variable de entorno no traslada archivos existentes.

## Auditoría y operación

Las modificaciones exitosas de negocio se auditan dentro de sus transacciones. Los intentos de escritura fallidos con sesión se registran por separado de forma best effort, sin volcar el cuerpo recibido. Los fallos de login también se registran. No se pretende auditar cada lectura HTTP.

La auditoría elimina recursivamente campos cuyo nombre indique password, token, hash, secret o cookie. Puede contener nombres, contactos y otros cambios de negocio necesarios; solo el administrador consulta este módulo. Define una retención acorde con el uso real de datos.

Los SQL dinámicos de catálogos usan nombres de tabla de una lista interna y columnas de esquemas Zod estrictos; los valores siempre son parámetros. Los errores de base de datos no se devuelven completos al cliente. Los campos de texto de un CSV se neutralizan si pueden interpretarse como una fórmula de hoja de cálculo.

En producción, limita la red de RDS, usa TLS verificado (`DATABASE_TLS=true` y una CA confiable cuando corresponda), secretos gestionados, rotación de credenciales, respaldos y un usuario de aplicación con permisos mínimos. Usa un usuario separado con permisos DDL para migraciones. Los valores de Docker son únicamente locales.

Retención de ejemplo, a programar externamente después de definir la política:

```sql
DELETE FROM tokens_renovacion_usados WHERE expires_at < UTC_TIMESTAMP();
DELETE FROM sesiones_autenticacion WHERE expires_at < UTC_TIMESTAMP();
DELETE FROM intentos_inicio_sesion WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY);
```

Elimina primero los tokens consumidos por la FK. Los registros de auditoría y movimientos requieren una política propia y no se eliminan con esos comandos.
