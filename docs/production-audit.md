# Auditoría inicial de la actualización de producción

Fecha: 2026-09-06. Base: `3c72464` (`chore: snapshot before final production update`). Árbol de trabajo limpio al comenzar. No se modifica la arquitectura de cuatro dominios ni se reinician bases existentes.

## Inventario y hallazgos

Se inspeccionaron README, arquitectura, pruebas, guion anterior, Compose, manifiestos de los once workspaces, cuatro schemas y migraciones iniciales, controladores y servicios, gateways, contratos compartidos, pantallas y clientes HTTP móviles/web, seeds, tests y ejemplos de variables.

| Área | Existe | Brecha encontrada |
|---|---|---|
| Identidad | BCrypt, JWT, refresh, reset por email, RBAC, direcciones | Credenciales de demostración precargadas; refresh sin rechazo de usuario suspendido y sin reclamación atómica; reset expone token en desarrollo y no lo reclama atómicamente; no bootstrap seguro ni verificación de email |
| Comercios | Catálogo, carrito, snapshots y dashboard | El owner puede activar su comercio; falta solicitud/aprobación; tiempo medio fijo; estados globales modifican otros subpedidos; DTOs públicos incluyen contacto privado |
| Pedidos | Checkout server-side, pagos, lifecycle, calificaciones | No envíos personales, consentimiento, políticas, cotización ni OTP; falta validación server-side de dirección propia; recogida insuficientemente protegida |
| Pagos | Adaptadores mock/Mercado Pago | Modo mock normal; preferencia de MP confundida con ID de pago recibido en webhook; falta verificar importe/referencia; no evidencia manual ni reembolso controlado |
| Repartidores | Reserva serializable + versión + advisory lock; ofertas, GPS | Tracking REST y suscripción Socket.IO sin ownership; aceptación cross-service deja reserva inconsistente al fallar; disponibilidad no condicionada por versión; no onboarding/documentos/capacidad ni buffer GPS |
| Notificaciones | RabbitMQ durable, confirms, retry, DLQ; in-app/SMTP/FCM | Un registro FAILED se considera procesado en reintento; publisher no reconecta; payload de seguridad expuesto en lectura genérica; push simulado se trata como éxito |
| Comunicaciones | Socket.IO de pedidos y GPS | Faltan chat autorizado, mensajes/leídos, llamadas de audio y tokens por sala |
| Web | Portal comercio/admin, CRUD parcial | Identidades/fecha/KPI fijos, accesos de demostración, botones sin comportamiento, edición de producto incompleta, faltan módulos administrativos solicitados |
| Móviles | Expo Router, SecureStore, catálogo/pedido/mapas | Pantallas y acciones faltantes, tokens web en localStorage, defaults de credenciales/dirección/cupón, manejo incompleto de errores, sin dev-client/EAS/llamadas |
| Datos | Cuatro bases sin FK entre servicios | Seeds introducen ficción y el de drivers borra historial; test E2E usa entorno normal; concurrencia borra tablas sin validar base test |
| Operación | Docker multi-stage, Nginx, health parcial | Sin /ready, storage persistente, perfil de producción ni salud web/proxy; Nginx resuelve DNS de upstream solo al arrancar |
| Validación | Unitarias y E2E anterior | Sin fixtures efímeros aislados, pruebas de privacidad/chat/llamadas/envíos/resiliencia ni pruebas de pantallas |

La ejecución exitosa registrada en agosto no acredita esta actualización. Los resultados nuevos se registrarán por comando y sin confundir tests omitidos con aprobados.

## Secuencia de implementación y verificación

1. Analizar los tres videos y conservar referencias UX.
2. Corregir seguridad, eliminar cuentas/flujo ficticio del código y crear bootstrap administrativo. No borrar cuentas ni datos existentes automáticamente.
3. Migraciones incrementales: legal/privacidad, onboarding, logística/envíos, pagos, comunicaciones y archivos.
4. Conectar operaciones y experiencias web/móviles a contratos reales, con estados de carga/error/vacío/offline.
5. Preparar dev-client, EAS, storage S3, LiveKit, Compose de producción y readiness.
6. Crear fixtures efímeros exclusivamente en entorno TEST aislado; probar migraciones limpias y actualización sin reset.
7. Ejecutar calidad estática, unitarias/integración, marketplace/envíos, concurrencia, privacidad, chat/call auth, GPS y resiliencia RabbitMQ.
8. Documentar evidencia, configuración externa pendiente, APK/EAS y verificación manual necesaria. No push ni publicación pública.

## Límites del entorno detectados

- Los videos originales están en `C:\Users\renzo\Documents\reference\prototypes`.
- FFmpeg/ffprobe no estaban en PATH; se prepara herramienta temporal para el análisis.
- Android Studio está instalado; aún se debe comprobar SDK, emulador y autenticación EAS.
- El disco C tenía aproximadamente 4 GB libres al auditar; los builds se realizarán controlando uso de cachés y sin borrar volúmenes de datos.
