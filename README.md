# App Alerta Salud V1.3 — etapa segura de integración SMN

Esta versión mantiene la app V1.2 y agrega el estado de integración y un enlace al aviso original en registros publicados. **No consulta automáticamente el SMN** ni publica alertas por su cuenta.

## Pasos
1. En Supabase SQL Editor, ejecutar `01_preparacion_fuentes.sql` una sola vez.
2. En GitHub, reemplazar los ocho archivos web existentes (`index.html`, `app.js`, `styles.css`, `supabase-config.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `README.md`). El SQL puede quedar en el repositorio como referencia, pero no es ejecutado por Cloudflare.
3. Verificar el despliegue en Cloudflare y recargar la PWA.
4. En la pestaña Alertas, verificar que el estado sea «Fuente SMN sin sincronización configurada» y que no se muestren alertas inventadas.

## Próximo hito antes de automatizar
- Confirmar operatividad y condiciones del feed CAP/RSS del SMN (`https://ssl.smn.gob.ar/feeds/CAP/rss_alertaCAP_nuevo.xml`), formato, frecuencia, disponibilidad y autorización de reutilización.
- Implementar en backend una tarea programada que descargue y valide XML CAP, vigencia, identificador, geografía exacta y cancelaciones; no filtrar por coincidencia textual de localidades.
- Registrar documentos en `alertas_entrantes`, validar geografía contra coordenadas/polígonos, deduplicar, auditar y recién entonces promover a `alertas` mediante una operación administrativa controlada.
- Configurar secretos exclusivamente en servidor; jamás `service_role` en frontend/GitHub.
- En caso de fallo, mostrar datos no disponibles y enlace al SMN. No indicar «sin alertas» como sinónimo de «sin riesgo».

El objetivo de costo $0 depende de mantenerse dentro de las cuotas gratuitas de Cloudflare y Supabase.


## V1.6 - Mapa georreferenciado
La pestaña Mapa consulta localidades y departamentos de Supabase y representa sus centroides con Leaflet/OpenStreetMap. Requiere conexión a Internet y permisos RLS SELECT. No representa alertas meteorológicas.
