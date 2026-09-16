# Estado de seguridad de dependencias

Consulta del registro: 8 de septiembre de 2026. `pnpm audit --prod` encontró dos alertas altas y cuatro moderadas antes de la última corrección de qs. No se presenta como una auditoría aprobada.

- `qs 6.15.3`: se añadió override compatible a `6.16.0`, versión publicada que cubre las dos alertas del servidor: [límite de arrays](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) e [isBuffer controlable](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).
- `image-size 1.2.1`, en herramientas transitivas de Expo: dos alertas altas de denegación de servicio en analizadores de imágenes. El registro consultado aún no publica `2.0.3`, indicada como corregida por [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) y [JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). No se forzó una versión inexistente ni una actualización mayor sin comprobar compatibilidad. No procesar imágenes no confiables con esas herramientas de compilación; esta limitación no elimina la alerta.
- `decode-uri-component 0.2.2`: alerta moderada; la versión `0.4.3` indicada en [el aviso](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) tampoco estaba publicada en la consulta.
- `uuid 7.0.3/9.0.1`: alerta moderada sobre buffers de v3/v5/v6, con parche publicado `11.1.1`. [Aviso](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Cambiar estas dependencias transitivas entre versiones mayores exige verificar sus consumidores; no se ocultó la alerta con una exclusión.

Antes del lanzamiento, revisar nuevamente el registro y actualizar o aplicar parches compatibles probados. Mantener la auditoría como condición de revisión, no ignorar su código de salida. No convertir “sin parche publicado” en “sin riesgo”.

Protecciones del código: JWT revocable, refresh de un uso, cookies HttpOnly/CSRF de mismo origen, archivos privados por propósito, secreto interno, OTP cifrado y limitado, importes verificados por servidor y eventos persistentes. `.dockerignore` excluye secretos, copias y archivos privados del contexto de construcción. Estas medidas no sustituyen una evaluación de seguridad completa.
