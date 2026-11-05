/* AlertaSalud V1.11.8 — logo de cabecera desde Supabase Storage.
   Ruta pública: alerta-salud-assets/branding/logo.png
   El logo grande de Más opciones NO se muestra ni se actualiza.
   La imagen local permanece como respaldo si no hay conexión o archivo remoto.
   Actualización del logo visible: al iniciar, como máximo una consulta por hora.
   No altera los iconos del sistema operativo de una PWA instalada.
*/
(() => {
  "use strict";
  const base = window.ALERTA_SUPABASE?.url;
  if (!base || !/^https:\/\//.test(base)) return;
  const logo = document.querySelector("header .brand-logo, .brand-logo");
  if (!logo) return;
  const fallback = logo.getAttribute("src") || "./icon-192.png";
  const remote = base.replace(/\/$/, "") +
    "/storage/v1/object/public/alerta-salud-assets/branding/logo.png";
  const candidate = remote + "?revision=" + Math.floor(Date.now() / 3600000);
  const probe = new Image();
  probe.onload = () => {
    if (probe.naturalWidth < 32 || probe.naturalHeight < 32) return;
    logo.onerror = () => { logo.onerror = null; logo.src = fallback; };
    logo.src = candidate;
  };
  probe.onerror = () => {};
  probe.src = candidate;
})();
