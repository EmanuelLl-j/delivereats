# Guion de demostración end-to-end

## Preparación

1. Ejecuta el inicio rápido del README y confirma que `docker compose ps` muestre servicios healthy.
2. Abre cuatro vistas: cliente Expo, driver Expo, [portal comercio](http://localhost/comercio) y [admin](http://localhost/admin).
3. Inicia sesión con las cuentas demo. En la app driver activa disponibilidad.

## Pedido multi-negocio

1. En cliente abre Botica San Gabriel y agrega `Kit de Medicamentos Básico` (S/ 42).
2. Abre Fresh Market Huamanga y agrega `Compra de Víveres - Pack Familiar` (S/ 45).
3. Comprueba que el carrito tenga dos establecimientos.
4. En checkout usa la dirección demo, cupón `PDGP10` y Yape. El servidor debe responder subtotal S/ 87, delivery S/ 5, service fee S/ 4.35, descuento S/ 8.70 y total S/ 87.65.
5. Confirma. El cliente muestra el PaymentIntent sandbox; el comercio recibe la orden sin recargar.

## Pago, preparación y driver

1. En Admin → Pagos encuentra el intent pendiente y pulsa **Aprobar**. El backend marca pago `APPROVED` y pedido `CONFIRMED`.
2. En comercio pulsa **Aceptar y buscar driver**. El sistema ordena drivers por distancia y reserva uno atómicamente.
3. La app driver muestra ganancia, destino, número de recojos y contador de 15 segundos. Acepta la oferta.
4. En comercio inicia preparación y marca listo.
5. En driver abre la entrega y confirma primero Botica, luego Fresh Market. Con todos los recojos confirmados comienza la ruta al cliente.

## Tracking y cierre

1. La app driver envía GPS cada cinco segundos. En cliente abre Tracking: Socket.IO actualiza el mapa; REST consulta cada cinco segundos como respaldo.
2. Driver pulsa **Confirmar entrega y cobro**. El pedido cambia a `DELIVERED` y el driver vuelve `AVAILABLE`.
3. Cliente abre el pedido y registra una calificación.
4. Admin → Pedidos muestra pago, subpedidos, driver y estado final; Admin → Notificaciones muestra los mensajes consumidos.

## Resiliencia RabbitMQ

1. Detén solo el consumidor: `docker compose stop notifications-service`.
2. Crea otro pedido. Checkout y portal comercio deben seguir funcionando porque publicar el evento no depende de una respuesta del consumidor.
3. En RabbitMQ Management verifica mensajes `Ready` en `notifications.queue`.
4. Reinicia: `docker compose start notifications-service`.
5. La cola vuelve a cero y las notificaciones aparecen. Si un mensaje falla tres veces, inspecciónalo en `notifications.dlq`.

## Pago rechazado

Crea un checkout Yape adicional y en Admin → Pagos pulsa **Rechazar**. El PaymentIntent pasa a `REJECTED`, el pedido no avanza a búsqueda de driver y el evento `payment.rejected` queda trazado.
