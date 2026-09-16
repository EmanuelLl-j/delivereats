# Pruebas y evidencia

## Comandos

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:migrations
pnpm test:restore
pnpm test:concurrency
pnpm test:e2e
```

Prerrequisitos de integración: .env local preparado y los cuatro PostgreSQL más RabbitMQ de Compose en ejecución. Los servicios normales de aplicación no son necesarios para E2E. Compila los servicios antes de ejecutar la suite directamente con node.

- Unitarias: autenticación, RBAC, checkout, pagos y firmas, límites/políticas de envíos, ubicación caducada y configuración/archivos privados.
- Migraciones: cuatro bases limpias y cuatro actualizaciones desde el esquema anterior, con registros centinela conservados. Las ocho bases son temporales.
- Concurrencia: 48 pedidos simultáneos sobre tres repartidores y comprobación de unicidad. Utiliza una base recién creada; no reutiliza drivers_db.
- Restauración: `test:restore` usa la última copia completa de backups (o el nombre indicado como argumento), restaura en cuatro bases nuevas y las retira al finalizar; nunca restaura sobre las bases normales.
- E2E: inicia los cuatro servicios reales en puertos efímeros, cuatro bases exclusivas, un vhost RabbitMQ y un contenedor Redis. Usa un receptor SMTP de prueba local y el proveedor SMTP real. Comprueba flujos HTTP completos sin tocar el sistema operativo normal.
- Build: compila servicios y Next.js; exporta las apps a web. No equivale a APK ni prueba en un dispositivo.

Los registros se guardan en .test-artifacts/, ignorado por Git. isolation.json especifica los recursos temporales y si su limpieza terminó. Si una prueba falla, no se considera validado su flujo. No mostrar ni guardar credenciales en capturas o informes.

## Estado externo

Firebase Android, audio LiveKit entre dos dispositivos, S3 remoto, SMTP del dominio y Mercado Pago de producción: **pendiente de credenciales externas**. Las comprobaciones de ausencia de configuración son pruebas negativas, no pruebas exitosas del proveedor remoto.

## Aceptación manual pendiente

Comprueba pantallas en móvil físico (permisos, red intermitente, pantalla apagada, micrófono, subir fotos), navegación del panel en anchos pequeños y grandes, y el recorrido de docs/demo.md. El seguimiento actual es de primer plano: no certificar segundo plano por observar solo un teléfono visible.

Para resiliencia, usa exclusivamente el entorno aislado: detener su consumidor y verificar recuperación desde outbox/cola, vencimiento de oferta sin duplicados, reconexión GPS y doble clic. No detener servicios de un entorno con entregas reales para ejecutar una prueba.

## Producción

/health es liveness. /ready comprueba dependencias. Un resultado configurado o alcanzable para un proveedor no demuestra entrega a un teléfono ni movimiento de dinero. Ejecuta check:production sobre tu servidor y realiza transacciones controladas con evidencias. No declarar una devolución completada sin confirmación verificable del proveedor o referencia/comprobante del pago manual.
