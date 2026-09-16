# Integraciones y activación de servicios externos

Estado de las pruebas externas: **pendiente de credenciales externas**. No hay claves reales en las plantillas. Un proveedor configurado no equivale a un flujo probado. No se aprueban pagos ficticios, no se simula una llamada ni se registra como correo enviado una excepción SMTP.

## Orden de configuración

1. **Servidor y dominio HTTPS.** Usa tu servidor existente o contrata uno que ejecute Docker, con almacenamiento persistente y respaldo externo. Configura DNS, certificado TLS, firewall y las cuatro bases PostgreSQL, RabbitMQ y Redis. No es obligatorio contratar versiones gestionadas: el Compose incluye estos componentes. La plantilla de producción solo publica 80/443; no publica bases, Redis, panel RabbitMQ ni Mailpit.
2. **Almacenamiento privado S3 compatible.** Crea bucket privado, bloqueo de acceso público, credenciales limitadas al bucket y política de copias/retención. El adaptador usa Put/Get/DeleteObject y HeadBucket; los enlaces de lectura vencen en 180 segundos. No hace falta contratar AWS específicamente: debe ser compatible con su API S3 y permitir HTTPS.
3. **Correo transaccional SMTP.** Configura remitente de tu dominio y autenticación TLS; publica los registros SPF/DKIM y política DMARC indicados por tu proveedor. Prueba registro, verificación y recuperación con una dirección que controles. No habilites operaciones para usuarios sin correo verificado.
4. **Cuenta administradora y configuración operativa.** Crea el administrador con el comando interactivo, sustituye los borradores legales por textos revisados, publica sus versiones y revisa tarifas/capacidades/categorías. Los seeds no publican términos ni aprueban comercios o repartidores. Esta revisión no requiere que compartas secretos con el asistente.
5. **Mapas nativos.** Configura proyectos y claves restringidas por paquete Android/SHA y, si se distribuirá iOS, bundle identifier. Las coordenadas son reales; las líneas de los mapas y las cotizaciones actuales son distancia recta Haversine, no navegación vial ni ETA calculado por tráfico. No se debe publicitar navegación giro a giro.
6. **LiveKit.** Elige LiveKit Cloud o un despliegue propio con dominio WSS/TLS, puertos RTC y TURN según su documentación. No es necesario contratar ambos. Habilita solo voz; no configures grabación/egress. Prueba entre dos dispositivos en redes distintas: permiso de micrófono, aceptar/rechazar, reconexión y cierre. La comprobación de disponibilidad del servidor no verifica la calidad del audio.
7. **Firebase Android.** En un proyecto Firebase registra **dos aplicaciones**: `pe.edu.pdgp.delivereats.client` y `pe.edu.pdgp.delivereats.driver`. Cada una tiene su propio `google-services.json`. Proporciona una cuenta de servicio FCM al servicio de notificaciones. La app pide permiso cuando el usuario pulsa Activar notificaciones, registra token nativo FCM y lo vincula a la versión de sesión. Cerrar sesión invalida los registros anteriores. Prueba en compilación nativa; el navegador y Expo Go no validan FCM Android.
8. **Mercado Pago.** Cuando quieras activarlo, configura la cuenta comercial, credenciales reales y webhook HTTPS; después habilita el método en Administración → Configuración. Ejecuta una compra y devolución controladas desde una cuenta que puedas verificar. Hasta entonces no aparece como opción de pago. No se requieren sus claves para desarrollar o probar CASH.
9. **Distribución móvil.** Configura EAS o Android Studio, firma de Android y cuenta de Play Console si publicarás en tienda. Conserva la clave de subida en un gestor seguro. La compilación de producción es AAB; preview/development generan APK. No se ha acreditado una publicación en tienda ni una prueba física por generar el bundle JavaScript.

Si ya tienes un servicio, configúralo; no lo contrates nuevamente. Los costes dependen de proveedor, consumo y región y no se han presupuestado aquí.

## Variables exactas

Las plantillas raíz son `.env.example` (local) y `.env.production.example` (producción). No copies `.env` local a producción. Los secretos de infraestructura, códigos de envío y eventos deben respaldarse separadamente: perder una clave de cifrado impide recuperar datos cifrados existentes.

| Grupo | Variables | Uso |
|---|---|---|
| Entorno y sesiones | `NODE_ENV`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_SECRET`, `EVENTS_ENCRYPTION_KEY`, `SHIPMENT_CODES_KEY` | Producción explícita; secretos distintos, aleatorios, de al menos 32 caracteres. `SHIPMENT_CODES_KEY` es exactamente 32 bytes en base64. |
| Orígenes web | `WEB_URL`, `PUBLIC_API_URL`, `PUBLIC_USERS_URL`, `CORS_ORIGINS`, `COOKIE_SECURE` | `WEB_URL=https://tu-dominio`, `PUBLIC_API_URL=https://tu-dominio/api/orders`, `PUBLIC_USERS_URL=https://tu-dominio/api/users`; CORS son orígenes HTTPS exactos separados por coma. Cookie segura true. Los ejemplos de dominio no son valores desplegados. |
| PostgreSQL | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `USERS_DATABASE_URL`, `ORDERS_DATABASE_URL`, `DRIVERS_DATABASE_URL`, `NOTIFICATIONS_DATABASE_URL` | Una base por servicio. En Compose los hosts son postgres-users, postgres-orders, postgres-drivers, postgres-notifications:5432 y las bases users_db, orders_db, drivers_db, notifications_db. Codifica caracteres reservados de contraseña en las URLs. |
| Colas y GPS | `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_URL`, `REDIS_PASSWORD`, `REDIS_URL` | URLs autenticadas a rabbitmq:5672 y redis:6379 en la red privada. Para servicios gestionados usa TLS amqps/rediss y sus instrucciones. No expongas estos puertos a Internet. |
| S3 | `STORAGE_PROVIDER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_ENDPOINT` | Endpoint HTTPS. `S3_PUBLIC_ENDPOINT` es opcional si el mismo endpoint es accesible por el dispositivo; no implica bucket público. |
| Solo local | `STORAGE_PROVIDER=local`, `LOCAL_STORAGE_PATH`, `LOCAL_STORAGE_SIGNING_KEY` | Almacén real de archivos privados. Está prohibido en NODE_ENV=production. No se selecciona silenciosamente si falla S3. |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | 465 con secure=true o 587/2525 con STARTTLS requerido. Usa el puerto real del proveedor. En local: Mailpit 1025, sin autenticación ni TLS. |
| Push | `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo en una sola variable **del backend de notificaciones**, nunca EXPO_PUBLIC ni una app. Si se escribe en dotenv, encierra el JSON en comillas simples conservando los `\n` de la clave PEM. |
| Audio | `LIVEKIT_URL`, `LIVEKIT_INTERNAL_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `COMMUNICATION_GRACE_MINUTES` | URL pública WSS; interna opcional para la API del servidor (usa pública si está vacía). Gracia de comunicaciones después de terminar pedido, 15 minutos por defecto. Los tokens efímeros se generan en backend y están limitados a sala, participante y micrófono. |
| Audio local | `LIVEKIT_NODE_IP` | IP alcanzable del equipo para el contenedor LiveKit local. No usar localhost en un teléfono físico. |
| Mercado Pago | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Solo backend de pedidos. Webhook: POST `https://tu-dominio/api/orders/payments/webhook/mercadopago`. Se valida firma, antigüedad, referencia, moneda y monto consultando la API oficial. No requiere una public key para este Checkout Pro alojado. |
| Apps | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`, `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_MAPS_IOS_API_KEY`, `EXPO_EAS_PROJECT_ID`, `GOOGLE_SERVICES_JSON`, `APP_VARIANT` | URLs son públicas; no guardar secretos ahí. Configura por separado en el directorio/EAS de cada app. GOOGLE_SERVICES_JSON es la ruta al archivo correspondiente a ESA app, no la cuenta de servicio backend. APP_VARIANT=production activa las comprobaciones HTTPS. |
| TLS del servidor | `TLS_CERTIFICATE_PATH`, `TLS_PRIVATE_KEY_PATH` | Rutas absolutas existentes del fullchain y clave privada en el servidor, montadas de solo lectura en Nginx. Configura renovación fuera del repositorio. |

`USERS_SERVICE_URL`, `ORDERS_SERVICE_URL`, `DRIVERS_SERVICE_URL` y `NOTIFICATIONS_SERVICE_URL` se inyectan automáticamente dentro de Compose; si ejecutas los servicios en host, define sus direcciones internas reales. `NEXT_PUBLIC_SOCKET_URL` se conserva por compatibilidad, pero las pantallas web actuales usan el proxy del mismo origen; no es un secreto ni habilita una integración por sí sola.

## Comportamiento de pagos y notificaciones

- CASH: se registra pago al confirmar la entrega, no al crear el pedido.
- YAPE_MANUAL y PLIN_MANUAL: requieren cuenta, instrucciones y QR propios configurados por administrador. Cliente adjunta comprobante privado y código de operación; queda pendiente hasta revisión explícita. No hay supuesta API privada de Yape/Plin.
- Mercado Pago: no hay fallback a mock. Crear un checkout no prueba que se pagó. Las devoluciones totales se concilian por webhook verificado; un contracargo no se interpreta como devolución al cliente. Las devoluciones parciales y la gestión de disputas requieren conciliación operativa específica antes de ofrecérselas a usuarios.
- Firebase: una respuesta aceptada por FCM no prueba que el teléfono mostró la notificación. Tokens APNs iOS y Expo Push **no** se envían a Firebase como si fueran FCM. Push iOS requiere otro adaptador/token FCM iOS y validación nativa; no se declara implementado.
- Sin dispositivos vigentes o proveedor disponible, un envío PUSH falla explícitamente; no se marca enviado. El usuario aún puede consultar su bandeja interna.
- LiveKit inaccesible: se deshabilita iniciar audio; el chat continúa. El cierre remoto de salas se reintenta desde registros persistentes. Los mensajes de chat no se sustituyen por una llamada ficticia.

## Fuentes técnicas

[FCM y APNs con Expo](https://docs.expo.dev/push-notifications/sending-notifications-custom/), [configuración Firebase Android](https://docs.expo.dev/push-notifications/fcm-credentials/), [LiveKit con Expo](https://docs.livekit.io/home/quickstarts/expo). Revisa también las instrucciones de tu proveedor para su región y configuración concreta.
