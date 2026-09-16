# Entrega y punto de continuación — 9 de septiembre de 2026

## Compilación Android completada

Después de que el usuario liberara espacio, se completaron ambos APK ARM64 de evaluación: cliente (`BUILD SUCCESSFUL`, 8 min 41 s) y repartidor (`BUILD SUCCESSFUL`, 10 min 2 s). Ambos verifican con `apksigner` y firma Android Debug; versión 1.0.0, Android mínimo API 24, destino API 36. No hay dispositivo conectado: no se afirma instalación, arranque ni aceptación en teléfono.

Correcciones conservadas en ambas apps: CMake 3.31.6 / Ninja 1.12.1 mediante `plugins/native-build.cjs` antes de `expo-root-project`; raíz de Metro alineada para `export:embed` con acceso al workspace pnpm. Los bundles Android procesaron 3.264 módulos del cliente y 3.257 del repartidor. ESLint volvió a pasar tras el ajuste. No se repitieron las suites del backend sin cambios.

Archivos: [APK cliente](../deliverables/DeliverEats-Cliente-evaluacion-arm64.apk), [APK repartidor](../deliverables/DeliverEats-Repartidor-evaluacion-arm64.apk), [instrucciones y SHA-256](../deliverables/README.md). Son binarios locales con servidor `10.0.2.2`, firma de depuración y sin credenciales externas; **no distribuir como producción**. Para teléfono físico se deben configurar URLs alcanzables y recompilar. Los comandos están en [despliegue](deployment.md#compilación-local-de-evaluación-en-windows).

## Resultado verificable

El código conserva cuatro servicios NestJS y sus bases independientes, el portal Next.js y las dos apps Expo. La implementación local está probada en los flujos indicados abajo. **No se declara el proyecto aprobado para lanzamiento público ni la especificación completa cerrada.** No se hizo push ni despliegue remoto.

| Verificación | Resultado |
|---|---|
| ESLint y TypeScript | Aprobados en los once workspaces |
| Compilación | Next.js, cuatro servicios y exportación web de ambas apps aprobados |
| Unitarias | 43 aprobadas; una prueba PostgreSQL omitida en la suite general y ejecutada por separado |
| E2E con cuatro servicios reales | 15 aprobadas, incluidas privacidad y baja; cero omitidas |
| Migraciones | Ocho escenarios aprobados: limpio y actualización para cada base, sin reset |
| Concurrencia PostgreSQL | 48 solicitudes / tres repartidores; ninguna doble asignación activa |
| Restauración del respaldo | Cuatro copias restauradas en bases nuevas y retiradas después |
| Compose de producción | Sintaxis y publicación exclusiva de puertos 80/443 comprobadas; TLS remoto no probado |
| Android | Ambos APK ARM64 compilados y firma verificada; instalación y aceptación en dispositivo pendientes |
| Inspección visual | Acceso web, recuperación y retorno de pago; pantalla móvil de 390 × 844 sin desbordamiento observado |

La prueba E2E cubre registro y verificación de correo mediante SMTP real hacia un receptor aislado; almacenamiento local privado y firma; pedido de dos comercios; autorización por subpedido; dos recogidas antes de entregar; efectivo; reembolso solicitado sin duplicación; chat privado e idempotente; ausencia honesta de audio/MP; rechazo multi-comercio; categoría archivada; capacidad y políticas de envíos; OTP por fase; exportación de los cuatro dominios; soporte autorizado; refresh de un uso y desactivación de cuentas sin operaciones activas.

Evidencias locales ignoradas por Git:

- `.test-artifacts/e2e-438ede924f1c/isolation.json`: última ejecución después del parche de `qs`, limpieza completa; 15 comprobaciones aprobadas en la salida de ejecución.
- `.test-artifacts/migrations-d25fd47ddc43/results.json`: ocho escenarios.
- `.test-artifacts/concurrency-d5c942735301/result.log`: asignación concurrente.
- `.test-artifacts/restore-199e27f6f45c/results.json`: restauración de las cuatro bases.
- `backups/2026-09-07T17-48-56.423Z-aa83e2d6`: respaldo privado anterior a la actualización del entorno normal. No publicarlo.

## Uso y despliegue sin otra conversación

1. Sigue [despliegue local y producción](deployment.md), con respaldo antes de reconstruir servicios existentes. Los contenedores normales antiguos no se han sustituido automáticamente; una prueba aislada no actualiza ese entorno.
2. Crea tu administrador real con `pnpm admin:create`, sin escribir sus credenciales en documentación. No hay una contraseña predeterminada que deba usarse.
3. Publica textos legales revisados y configura tarifas; aprueba comercios y repartidores reales. Los seeds actuales no crean cuentas, comercios, productos ni pedidos de demostración. Los datos heredados de la instalación anterior no se borraron: revísalos antes de producción.
4. Completa las variables descritas en [servicios externos](external-services.md). Las plantillas `.env.example` y `.env.production.example` no contienen secretos externos.
5. Ejecuta `pnpm check:production` en el servidor con los valores reales. Una validación estática no sustituye probar HTTPS, correo, archivos, pagos, notificaciones y audio.

Orden recomendado: servidor/dominio/TLS → almacenamiento privado S3 → SMTP → administrador/legal/tarifas → mapas → LiveKit → Firebase Android → Mercado Pago → firma y distribución de apps. No necesitas contratar un servicio que ya tengas operativo; PostgreSQL, Redis y RabbitMQ también pueden alojarse en el servidor.

## Pendientes que no deben ocultarse

- **Pendiente de credenciales externas:** SMTP del dominio, S3 remoto, Firebase Android, LiveKit entre dos dispositivos y Mercado Pago real. Los providers están implementados; las pruebas negativas sin credenciales no validan esos proveedores.
- **Android:** APK de evaluación completados; faltan configuración del servidor real, firma de distribución e instalación/aceptación en teléfono. SDK utilizado: plataforma Android 36, Build Tools 36.0.0, NDK 27.1.12297006, CMake 3.31.6 y Java 21. La firma de depuración es solo para evaluación, no para publicar.
- **Segundo plano:** GPS actual de primer plano; no prometer seguimiento con pantalla bloqueada. Push iOS no está implementado como FCM nativo y no debe anunciarse como disponible.
- **Cobertura funcional pendiente de cierre:** validar toda la matriz de pantallas del documento original, agregación de valoraciones mostradas y recuperación ante interrupciones de red/broker en dispositivos. Las pruebas descritas no certifican estos puntos.
- **Operación financiera:** revisar manualmente comprobantes reales, liquidación de ganancias y conciliación. No hay desembolso bancario automático certificado ni gestión integral de disputas/reembolsos parciales.
- **Privacidad:** la baja desactiva acceso y operación, conserva historia y rechaza pedidos/asignaciones activos. No es borrado físico completo ni una declaración de cumplimiento legal. Definir retención/supresión y revisar casos concurrentes de baja entre servicios antes de abrir al público.
- **Seguridad:** ver [alertas de dependencias](security-status.md). No se declara auditoría sin vulnerabilidades.

## No repetir para ahorrar tiempo

No reiniciar el proyecto, no regenerar la arquitectura, no crear cuentas ficticias, no volver a analizar los videos y no borrar volúmenes. El análisis visual está en `docs/reference/prototype-analysis.md`. Para una modificación puntual, ejecutar las pruebas de su área y la suite integral si afecta identidad, pagos, pedidos o reparto. No es necesario solicitar ni compartir claves en el chat.
