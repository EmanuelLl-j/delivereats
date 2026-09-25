# DeliverEats Ayacucho

Estado de entrega, pruebas verificadas y pendientes: [leer primero](docs/entrega.md).

Plataforma de pedidos de varios comercios y envíos personales: panel Next.js, apps Expo Cliente/Repartidor y cuatro servicios NestJS independientes con PostgreSQL, RabbitMQ y Redis.

## Empezar

Lee [Despliegue y ejecución](docs/deployment.md) y [Servicios externos y variables](docs/external-services.md). No necesitas credenciales externas para desarrollar y probar el flujo local. No existen cuentas precargadas ni aprobación de pagos simulada.

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d postgres-users postgres-orders postgres-drivers postgres-notifications rabbitmq redis mailpit
pnpm backup:local
docker compose up -d --build
pnpm db:seed
pnpm admin:create
```

En una instalación existente, respalda antes de aplicar las nuevas migraciones. El administrador se crea interactivamente con tus datos. Publica versiones legales revisadas, habilita tarifas y aprueba solicitudes reales antes de aceptar operaciones.

## Funciones

- Registro por rol, verificación de correo, recuperación, refresh de un solo uso y revocación; cookies HttpOnly en web y SecureStore en móviles nativos.
- Catálogo con fotos propias, carrito multicomercio, cotización en servidor y conservación de precios en el historial.
- Preparación por subpedido, asignación atómica y recogidas previas a entrega. Rechazo motivado antes de recogida con cancelación y devolución pendiente, nunca devolución ficticia.
- Envíos con límites de peso/volumen, políticas permitidas/restringidas/prohibidas, revisión, declaraciones explícitas y códigos distintos para recogida/entrega.
- CASH, pagos manuales con comprobante y revisión, Mercado Pago mediante SDK/webhook verificado. Sin credenciales, Mercado Pago no se ofrece.
- GPS real de primer plano, memoria temporal para recuperación de conexión, ubicación caducada identificada y ningún repartidor inventado.
- Chat privado entre participantes y llamadas de voz LiveKit; el audio no disponible no se sustituye por simulación.
- SMTP real, notificaciones internas y adaptador Firebase Android con registro de dispositivos ligado a sesión.
- Documentos legales versionados, soporte, auditoría, solicitudes de privacidad, gestión operativa y métricas basadas en registros.
- Archivos privados locales únicamente para desarrollo/pruebas; S3 privado obligatorio en producción.

## Verificación

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:migrations
pnpm test:concurrency
pnpm test:e2e
```

Consulta [Pruebas](docs/testing.md). E2E crea servicios, cuatro bases, un vhost RabbitMQ y Redis aislados, y los elimina al finalizar. **No definas E2E_BASE_URL hacia un entorno compartido.** Los fixtures temporales no se incluyen en los seeds operativos.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Recorrido de aceptación](docs/demo.md)
- [Variables, proveedores y orden de contratación/configuración](docs/external-services.md)
- [Despliegue, respaldo y compilación Android](docs/deployment.md)
- [Análisis de prototipos](docs/reference/prototype-analysis.md)
- [Auditoría de producción](docs/production-audit.md)

Los APK/AAB, la publicación y las integraciones externas requieren pruebas adicionales; una exportación web no acredita una app instalada. Revisa los pendientes antes de una salida real a producción.


