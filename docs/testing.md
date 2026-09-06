# Pruebas y verificación

## Suite rápida

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

La suite cubre autenticación/registro, hash de refresh, RBAC, totales, transiciones, mapeo del consumer RabbitMQ y lógica compartida. Las apps Expo se exportan también para web para detectar rutas e imports específicos de plataforma.

## E2E con Docker

```bash
docker compose up -d --build
pnpm db:seed
E2E_BASE_URL=http://localhost pnpm test:e2e
```

En PowerShell:

```powershell
$env:E2E_BASE_URL='http://localhost'
pnpm test:e2e
```

El test inicia sesión como cliente, limpia el carrito, agrega productos de dos comercios, aplica `PDGP10`, crea el PaymentIntent Yape sandbox y verifica 2 subpedidos y el total S/ 87.65.

## Concurrencia de drivers

Usa una base PostgreSQL exclusiva; la prueba crea sus propios datos y no debe apuntar a una base compartida.

```powershell
$env:DRIVERS_TEST_DATABASE_URL='postgresql://delivereats:development-only-change-me-database@localhost:5435/drivers_db?schema=concurrency_test'
pnpm --filter @delivereats/drivers-service test
```

El escenario dispara ofertas concurrentes sobre el mismo conjunto de drivers y afirma que ningún driver tenga más de una asignación `OFFERED`/`ACCEPTED` activa. La reserva usa estado + versión dentro de una transacción serializable.

## Resiliencia

La demostración manual verificable está descrita en [demo.md](demo.md). RabbitMQ conserva mensajes mientras notifications-service está detenido y el consumer los procesa al reiniciar. Las colas retry y DLQ pueden inspeccionarse en el puerto 15672.

## Criterio de auditoría

Antes de entregar una versión ejecuta `pnpm verify`, `docker compose config`, revisa `docker compose ps`, consulta los cuatro `/health`, ejecuta E2E y confirma que `git grep` no encuentre credenciales reales.
