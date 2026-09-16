# Referencias UX analizadas

Análisis con FFprobe y FFmpeg; frames periódicos cada 3 segundos en `frames/`, con timestamp impreso. Los videos se conservan en `prototypes/` y sus originales no se modifican.

| Video | Duración | Resolución | Secuencia observada |
|---|---|---|---|
| cliente.mp4 | 109,17 s | 426 × 884 | Home, explorar, pedidos, perfil, comercio/productos, carrito de dos comercios, checkout, confirmación, tracking |
| repartidor.mp4 | 115,95 s | 422 × 876 | Mapa/disponibilidad, entregas, ganancias, perfil/vehículo, oferta de 15 s, dos recogidas, destino, comunicación, confirmación |
| comercio.mp4 | 89,17 s | 1854 × 910 | Kanban, aceptación/preparación/listo/despachado, tabla de productos y filtros, repartidores, métricas, configuración |

## Decisiones visuales

- Mantener superficies blancas sobre fondo frío claro, acciones navy/índigo, acentos ámbar y confirmaciones verdes. Tipografía legible y cards de borde suave.
- Cliente: cuatro destinos principales en navegación inferior (Inicio, Buscar, Pedidos, Perfil), campana en cabecera; home con saludo real, dirección, búsqueda, cuatro categorías, promociones backend y comercios cercanos/recomendados. Carrito combinado agrupado por comercio.
- Repartidor: mapa como superficie principal, disponibilidad destacada, ingresos y entregas calculados; oferta en panel inferior con countdown; recogidas numeradas y destino separados; chat/llamada desde la entrega.
- Comercio: DeliverEats Biz con sidebar estable, KPIs arriba, cuatro columnas operativas, tabla editable de productos, métricas filtrables y formulario de configuración. El negocio y usuario proceden de su sesión.
- Los videos muestran pantallas blancas/transiciones incompletas, botones de salida del prototipo, números personales, simulación de llamada y datos estáticos. Esos comportamientos no se trasladan al producto.
- Envíos personales, onboarding, legal, soporte, administración y comunicaciones amplían el mismo lenguaje visual, con estados vacíos útiles y validación explícita.

Reproducir extracción: `./scripts/analyze-prototypes.ps1 -FfmpegDirectory <directorio-con-ffmpeg-y-ffprobe>`.
