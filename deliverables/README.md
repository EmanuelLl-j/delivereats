# APK de evaluación local

Estos binarios no son una publicación de producción ni certifican los flujos en un teléfono. Lee el estado actualizado en [entrega](../docs/entrega.md).

## Archivos verificados

Ambas compilaciones terminaron con `BUILD SUCCESSFUL`; `apksigner verify` confirmó firma v2 válida con certificado Android Debug.

| Archivo | Bytes | SHA-256 |
|---|---:|---|
| [Cliente](DeliverEats-Cliente-evaluacion-arm64.apk) | 56516710 | `FFB05C5296C35C18A5BED6D6CA17EEAC4420EB3E343CB05F5FA365E97AE9FFB5` |
| [Repartidor](DeliverEats-Repartidor-evaluacion-arm64.apk) | 56475106 | `603B87EE3E7CC8A1416055E277C43C0286DFA052E38E766CAC5BDFD5832165F6` |

## Alcance

- Arquitectura: ARM64 (`arm64-v8a`); Android mínimo API 24, destino API 36.
- Firma local: Android Debug. No usar como firma de distribución pública.
- Servidor incorporado: `http://10.0.2.2/api`; Socket: `http://10.0.2.2`. Son direcciones del host desde un emulador Android compatible, no la IP de tu servidor en un teléfono físico.
- No hay credenciales externas incorporadas ni cuentas de demostración predeterminadas.
- Maps, Firebase, SMTP, S3, LiveKit y Mercado Pago requieren la configuración real indicada en [servicios externos](../docs/external-services.md). No se ha validado su funcionamiento real en estos APK.

## Prueba en teléfono físico

1. Configura y verifica primero el backend según [despliegue](../docs/deployment.md). Los contenedores antiguos no se actualizan al compilar una app.
2. En cada app, completa sus variables `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_SOCKET_URL` con direcciones alcanzables desde el teléfono. Para producción usa HTTPS y `APP_VARIANT=production`; agrega las variables reales requeridas por la app sin compartir secretos en el chat.
3. Regenera y compila con los comandos documentados. Cambiar variables después de generar el APK no cambia el servidor incorporado.
4. Instala únicamente tu APK de evaluación en un dispositivo propio autorizado y verifica inicio, registro/acceso, permisos y un ciclo de entrega controlado. Prueba audio entre dos participantes y recepción push real por separado.

No anunciar seguimiento en segundo plano: el GPS del repartidor está implementado en primer plano. La compilación aprobada no sustituye una prueba de aceptación ni resuelve los pendientes funcionales y de seguridad del documento de entrega.
