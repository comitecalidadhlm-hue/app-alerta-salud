/* AlertaSalud V1.11.9 - Banner horizontal remoto, con respaldo local.
   Ruta: alerta-salud-assets/branding/logo-horizontal.png.
   No altera iconos de instalacion ni imagenes de otras pantallas.
*/
(() => {
  "use strict";
  const logo = document.querySelector(".as-banner-logo");
  const base = window.ALERTA_SUPABASE?.url;
  if (!logo || !base || !/^https:\/\//.test(base)) return;
  const fallback = logo.getAttribute("src") || "./logo-horizontal.png";
  const remote = base.replace(/\/$/, "") +
    "/storage/v1/object/public/alerta-salud-assets/branding/logo-horizontal.png";
  const candidate = remote + "?revision=" + Math.floor(Date.now() / 3600000);
  const probe = new Image();
  probe.onload = () => {
    if (probe.naturalWidth < 300 || probe.naturalHeight < 80) return;
    logo.onerror = () => { logo.onerror = null; logo.src = fallback; };
    logo.src = candidate;
  };
  probe.onerror = () => {};
  probe.src = candidate;
})();
