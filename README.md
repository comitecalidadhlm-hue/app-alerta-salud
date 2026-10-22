# Alerta Salud V1.1 — dashboard combinado

Prototipo gratuito de PWA con HTML, CSS y JavaScript, sin dependencias ni claves privadas.

## Archivos
- `index.html`: pantallas y navegación.
- `styles.css`: diseño responsive del dashboard.
- `app.js`: navegación, selección local y consejos sanitarios educativos.
- `manifest.webmanifest`: metadatos de instalación.
- `sw.js`: caché de archivos de la interfaz para uso sin conexión.
- `icon.svg`: ícono de la app.

## Cómo probar
1. Abrí la carpeta en Visual Studio Code.
2. Usá un servidor local, por ejemplo la extensión Live Server, y abrí la URL local indicada.
3. Para probar instalación en celulares, publicá los archivos estáticos por HTTPS, por ejemplo con Cloudflare Pages en un plan gratuito.
4. En Android instalá desde el menú del navegador; en iPhone desde Safari > Compartir > Agregar a inicio.

## Seguridad y alcance
Esta es una **demo sin datos en vivo**. No hay conexión con SMN, datos de calidad del aire, alertas reales, mapas georreferenciados ni notificaciones push. Los consejos sanitarios son educativos y no indican que exista una alerta vigente. La localidad elegida se guarda localmente, sin enviarse a ningún servidor. No usar como sistema de emergencias.

## Próximas etapas
Validar fuentes y permisos oficiales; crear adaptador de datos con esquema de alertas (id, fuente, nivel, zona, inicio, fin, enlace, última actualización); configurar panel administrativo y auditoría; luego implementar notificaciones con consentimiento, deduplicación y caducidad.

## Costos
Sin costo de licencias ni servicios para probar localmente; la publicación puede realizarse en planes gratuitos sujetos a límites y condiciones. No se incluyen tarifas de tiendas.
