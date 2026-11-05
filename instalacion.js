/* Alerta Salud - asistente de instalación PWA, sin modificar Web Push. */
(()=>{'use strict';
const trigger=document.getElementById('menuInstall');if(!trigger)return;
let pending=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pending=e;});
window.addEventListener('appinstalled',()=>{pending=null;});
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ua=navigator.userAgent||'';
const ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const android=/Android/i.test(ua);
const safari=/Safari/i.test(ua)&&!/CriOS|FxiOS|EdgiOS/i.test(ua);
const dialog=document.createElement('dialog');dialog.id='asInstallDialog';
dialog.setAttribute('aria-label','Instalar Alerta Salud');
dialog.innerHTML=`<form method="dialog" style="max-width:440px"><h2 id="asInstallTitle">Instalar Alerta Salud</h2><p id="asInstallText" style="white-space:pre-line;line-height:1.6"></p><div class="dialog-actions" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end"><button value="cancel" class="secondary">Cerrar</button><button id="asInstallNow" type="button" class="primary" hidden>Instalar ahora</button></div></form>`;
document.body.append(dialog);
const title=dialog.querySelector('#asInstallTitle'),text=dialog.querySelector('#asInstallText'),now=dialog.querySelector('#asInstallNow');
trigger.addEventListener('click',()=>{
 now.hidden=true;
 if(isStandalone()){
 title.textContent='Alerta Salud ya está instalada';
 text.textContent='Estás utilizando la aplicación instalada. No necesitás volver a instalarla.';
 }else if(pending){
 title.textContent='Instalar Alerta Salud';
 text.textContent='Podés agregar Alerta Salud a tu dispositivo para abrirla como una aplicación.';
 now.hidden=false;
 }else if(ios){
 title.textContent='Instalar en iPhone o iPad';
 text.textContent=safari?'1. Tocá Compartir en Safari.\n2. Elegí «Agregar a pantalla de inicio».\n3. Confirmá con «Agregar».':'1. Abrí esta página en Safari.\n2. Tocá Compartir.\n3. Elegí «Agregar a pantalla de inicio» y confirmá.';
 }else if(android){
 title.textContent='Instalar en Android';
 text.textContent='1. Abrí el menú ⋮ del navegador.\n2. Elegí «Instalar app» o «Agregar a pantalla principal».\n3. Confirmá la instalación.\nSi ya aparece en tus aplicaciones, no necesitás instalarla nuevamente.';
 }else{
 title.textContent='Instalar Alerta Salud';
 text.textContent='Abrí el menú del navegador y buscá «Instalar aplicación» o «Agregar a pantalla de inicio». La opción depende del navegador y dispositivo.';
 }
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
});
now.addEventListener('click',async()=>{
 if(!pending)return;
 const event=pending;pending=null;now.disabled=true;
 try{await event.prompt();await event.userChoice;dialog.close();}
 catch{ text.textContent='No se pudo iniciar la instalación. Probá desde el menú del navegador.';}
 finally{now.disabled=false;now.hidden=true;}
});
})();
