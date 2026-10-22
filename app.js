(()=>{'use strict';
const $=id=>document.getElementById(id);
const places=[...$('localidad').options].map(o=>o.value);
let place='Santa Rosa';try{const saved=localStorage.getItem('alertaSalud.localidad');if(places.includes(saved))place=saved}catch{}
function updatePlace(){document.querySelectorAll('.current-location').forEach(el=>el.textContent=place);$('heroLocation').textContent=place;$('localidad').value=place}updatePlace();
function show(view){if(!$('view-'+view))return;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));document.querySelectorAll('.nav-item').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>show(el.dataset.view)));
function openPlace(){$('localidad').value=place;$('locationDialog').showModal()}
$('changeLocation').addEventListener('click',openPlace);$('menuLocation').addEventListener('click',openPlace);$('openSettings').addEventListener('click',()=>show('mas'));
$('locationDialog').addEventListener('close',()=>{if($('locationDialog').returnValue==='save'){place=$('localidad').value;try{localStorage.setItem('alertaSalud.localidad',place)}catch{}updatePlace()}});
const topics={calor:{icon:'☀️',title:'Cuidados frente al calor',intro:'Recomendaciones generales para días calurosos:',tips:['Tomá agua regularmente, aunque no sientas sed.','Buscá lugares frescos y evitá la exposición al sol en las horas de mayor calor.','Prestá atención a niños, adultos mayores y personas con enfermedades crónicas.','Si hay confusión, desmayo o signos de golpe de calor, buscá asistencia médica urgente.']},frio:{icon:'❄️',title:'Cuidados frente al frío',intro:'Medidas generales para temperaturas bajas:',tips:['Abrigate en capas y protegé manos, cabeza y pies.','Ventilá los ambientes y revisá los sistemas de calefacción.','Nunca uses braseros o artefactos de combustión en espacios cerrados sin ventilación adecuada.','Prestá especial atención a personas vulnerables.']},tormentas:{icon:'⛈️',title:'Seguridad durante tormentas',intro:'Recomendaciones generales de prevención:',tips:['Permanecé en un lugar seguro durante tormentas eléctricas.','Evitá refugiarte bajo árboles aislados y alejate de cables caídos.','No cruces calles ni caminos inundados.','Seguí las indicaciones de las autoridades locales.']},aire:{icon:'🍃',title:'Cuidado ante humo y mala calidad del aire',intro:'Si las autoridades advierten contaminación o humo:',tips:['Reducí la actividad física intensa al aire libre.','Mantené cerradas las ventanas cuando haya humo exterior intenso, si es seguro hacerlo.','Seguí la información oficial sobre calidad del aire.','Consultá ante dificultad respiratoria u otros síntomas preocupantes.']}};
function renderTopic(key){const t=topics[key];$('advice').replaceChildren();const icon=document.createElement('div');icon.className='advice-icon';icon.textContent=t.icon;const h=document.createElement('h2');h.textContent=t.title;const p=document.createElement('p');p.textContent=t.intro;const ul=document.createElement('ul');t.tips.forEach(tip=>{const li=document.createElement('li');li.textContent=tip;ul.append(li)});$('advice').append(icon,h,p,ul);document.querySelectorAll('.topic').forEach(b=>b.classList.toggle('selected',b.dataset.topic===key))}renderTopic('calor');document.querySelectorAll('.topic').forEach(b=>b.addEventListener('click',()=>renderTopic(b.dataset.topic)));
function info(title,message){$('infoTitle').textContent=title;$('infoMessage').textContent=message;$('infoDialog').showModal()}
$('menuNotifications').addEventListener('click',()=>info('Notificaciones','Las notificaciones push no están activas en esta versión. Se implementarán al disponer de una fuente verificada y un sistema de suscripciones.'));
$('menuHistory').addEventListener('click',()=>info('Historial','El historial estará disponible cuando se conecte el servicio de alertas. No se mostrarán eventos ficticios como reales.'));
let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});$('menuInstall').addEventListener('click',async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else info('Instalar Alerta Salud','En Android, usá el menú del navegador y elegí Instalar app o Agregar a pantalla principal. En iPhone, abrí la web en Safari, tocá Compartir y elegí Agregar a inicio. Se requiere publicación por HTTPS para instalarla correctamente.')});

// Lectura publica con RLS: no incluye claves privadas ni operaciones de escritura.
async function fetchPublic(table,params=''){
 const cfg=window.ALERTA_SUPABASE;
 if(!cfg?.url||!cfg?.publishableKey)throw new Error('Configuración de Supabase incompleta');
 const response=await fetch(`${cfg.url}/rest/v1/${table}?${params}`,{
   headers:{'apikey':cfg.publishableKey,'Accept':'application/json'},
   signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error(`Supabase HTTP ${response.status}`);
 return response.json();
}
function renderDbMessage(message){const node=$('dbAlerts');if(node)node.textContent=message;}
async function loadLocalidades(){
 try{
  const data=await fetchPublic('localidades','select=nombre,provincia&activa=eq.true&order=nombre.asc');
  if(!Array.isArray(data)||!data.length)return;
  const select=$('localidad');select.replaceChildren();
  data.forEach(item=>{const option=document.createElement('option');option.value=item.nombre;option.textContent=`${item.nombre} (${item.provincia})`;select.append(option)});
  if(!data.some(item=>item.nombre===place))place=data[0].nombre;
  updatePlace();
 }catch(error){console.warn('Localidades: no se pudo consultar Supabase',error)}
}
async function loadAlertas(){
 renderDbMessage('Consultando alertas publicadas y vigentes…');
 try{
  const data=await fetchPublic('alertas','select=titulo,descripcion,tipo,nivel,inicio,fin,localidad_id,localidades(nombre)&estado=eq.publicada&order=inicio.desc&limit=50');
  const matching=data.filter(a=>!a.localidad_id||a.localidades?.nombre===place);
  const node=$('dbAlerts');node.replaceChildren();
  if(!matching.length){renderDbMessage('No hay alertas publicadas para esta localidad en nuestra base de datos. Esto NO significa que no existan alertas oficiales. Consultá el SMN.');return;}
  matching.forEach(a=>{
   const article=document.createElement('article');article.style.cssText='padding:12px 0;border-bottom:1px solid #d7e1ea';
   const heading=document.createElement('h3');heading.textContent=`${a.tipo==='oficial'?'Alerta oficial registrada':'Aviso preventivo'} · ${a.titulo}`;
   const detail=document.createElement('p');detail.textContent=a.descripcion;
   const meta=document.createElement('small');meta.textContent=`Nivel: ${a.nivel} · Inicio: ${new Date(a.inicio).toLocaleString('es-AR')} · Fuente y vigencia: consultar aviso original`;
   article.append(heading,detail,meta);node.append(article);
  });
 }catch(error){renderDbMessage('No se pudo consultar Supabase. Verificá la conexión y consultá directamente las fuentes oficiales.');console.warn(error)}
}
loadLocalidades().then(loadAlertas);
$('locationDialog').addEventListener('close',()=>{if($('locationDialog').returnValue==='save')loadAlertas()});

if('serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
