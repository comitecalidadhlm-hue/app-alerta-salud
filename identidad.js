/* Alerta Salud - identidad visual remota con respaldo local.
   Para actualizar el logo desde un futuro Dashboard: subir una imagen PNG
   al bucket PUBLICO 'alerta-salud-assets', ruta 'branding/logo.png'.
   Si no existe, se conserva la imagen incluida en el repositorio.
   No usar esta ruta para datos sensibles ni habilitar escrituras anonimas.
*/
(()=>{'use strict';
const base=window.ALERTA_SUPABASE?.url;
if(!base)return;
const remote=base+'/storage/v1/object/public/alerta-salud-assets/branding/logo.png';
const stamp=Math.floor(Date.now()/3600000);
const candidate=remote+'?revision='+stamp;
const targets=[...document.querySelectorAll('.brand-logo, .as-brand-poster img')];
if(!targets.length)return;
const probe=new Image();
probe.onload=()=>{if(probe.naturalWidth<32||probe.naturalHeight<32)return;
 targets.forEach(img=>{img.dataset.logoFallback=img.getAttribute('src')||'';img.src=candidate;
 img.addEventListener('error',()=>{if(img.dataset.logoFallback)img.src=img.dataset.logoFallback},{once:true});});};
probe.onerror=()=>{};
probe.src=candidate;
})();
