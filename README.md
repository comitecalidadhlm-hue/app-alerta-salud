AlertaSalud V1.11.9 - Cabecera horizontal

REEMPLAZAR: index.html, styles.css, identidad.js, sw.js
CREAR: logo-horizontal.png (respaldo local)

1. En Supabase Storage, bucket publico alerta-salud-assets, carpeta branding, subir logo-horizontal.png. No borrar branding/logo.png.
2. En GitHub subir/reemplazar los cinco archivos en la raiz del repositorio.
3. Esperar despliegue Cloudflare. Recargar la PWA.
4. La imagen se busca desde Supabase cada hora por version de URL; si no esta disponible se usa logo-horizontal.png del repositorio.
5. El boton configuracion se mantiene. No se alteran iconos instalados.

IMPORTANTE: Imagen generada como arte visual; verificar autorizacion institucional para uso de denominacion Ministerio de Salud.
