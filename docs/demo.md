# Recorrido de aceptación con cuentas propias

Este guion no carga cuentas, productos, cupones ni pedidos ficticios. Para pruebas automáticas usa exclusivamente test:e2e y sus bases temporales.

1. Crea el administrador por CLI, revisa/publica documentos, configura políticas y tarifas. Revisa la conexión real de los servicios.
2. Registra cliente, comercio y repartidor con datos y correos bajo tu control. Verifica los correos y acepta expresamente las versiones legales.
3. Comercio y repartidor presentan documentos propios. Administración aprueba o rechaza con motivo. No hay aprobación automática.
4. Comercio crea categorías y productos con fotos propias. Configura dirección, horarios y disponibilidad.
5. Cliente guarda una dirección y agrega productos de uno o varios comercios. Comprueba cotización y método realmente disponible. No presupongas un cupón.
6. Para CASH, el pedido queda confirmado pero el dinero aún no se considera cobrado. Para pago manual, adjunta comprobante y revisa desde administración; para Mercado Pago, espera el webhook verificado.
7. Cada comercio acepta/prepara su subpedido y lo marca listo. La asignación comienza cuando todos están listos. Un rechazo anterior a la recogida cancela el pedido completo y solicita devolución si hay pago verificado.
8. El repartidor aprobado activa disponibilidad con GPS vigente y acepta una oferta antes de 15 segundos. Debe recoger todos los subpedidos antes de finalizar.
9. Cliente y repartidor comprueban chat, privacidad frente a terceros y, solo si está disponible, llamada real. No hay datos de contacto inventados.
10. Al entregar, registra efectivo efectivamente recibido cuando corresponda. Comprueba pedido, historial, ganancias devengadas y notificaciones. Ganancia no significa liquidación bancaria.
11. Para envío personal, valida límites, descripción, valor y declaraciones; un artículo prohibido se bloquea y uno restringido queda en revisión sin cobro ni asignación. Usa el código de la fase correcta para recogida y entrega.
12. Verifica soporte, solicitudes de privacidad, cierre de sesión y revocación en otros dispositivos.

No ejecutes recorridos que muevan dinero o impliquen entregas reales sin coordinación con quienes participan. Las pruebas externas deben documentarse como pendientes hasta completarlas.
