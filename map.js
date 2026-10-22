/* App Alerta Salud V1.6.2 - Mapa de centroides oficiales. Sin alertas. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let map=null,markers=new Map(),loaded=false,loading=false;
const status=message=>{if($('mapStatus'))$('mapStatus').textContent=message};
function select(nombre){const api=window.AlertaSalud;if(!api)return;api.seleccionarLocalidad(nombre);focus(nombre)}
function focus(nombre){$('mapSelected').textContent='Localidad seleccionada: '+nombre;for(const [key,marker] of markers){marker.setStyle({color:key===nombre?'#ef8a17':'#116bc6',fillColor:key===nombre?'#ef8a17':'#116bc6',radius:key===nombre?10:7,weight:2})}const m=markers.get(nombre);if(m&&map){map.setView(m.getLatLng(),Math.max(map.getZoom(),9));m.openPopup()}}
async function init(){if(loaded||loading)return;loading=true;try{
 if(!window.L){status('No se pudo cargar el mapa. Verificá la conexión a internet.');return}
 const api=window.AlertaSalud;if(!api)throw new Error('La aplicación no está lista');
 map=L.map('territoryMap',{scrollWheelZoom:false,preferCanvas:true,zoomControl:false}).setView([-36.6,-65],7);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
 status('Consultando localidades georreferenciadas en Supabase…');
 const rows=await api.fetchPublic('localidades','select=nombre,provincia,latitud,longitud,codigo_georef,departamentos(nombre)&provincia=eq.La%20Pampa&activa=eq.true&order=nombre.asc');
 const valid=rows.filter(r=>Number.isFinite(r.latitud)&&Number.isFinite(r.longitud)&&r.latitud>=-40&&r.latitud<=-34&&r.longitud>=-69&&r.longitud<=-62);
 if(!valid.length){status('No hay localidades con coordenadas accesibles. Revisá los permisos de lectura en Supabase.');return}
 const bounds=[];const list=$('mapPlaces');list.replaceChildren();
 for(const row of valid){const latlng=[row.latitud,row.longitud];bounds.push(latlng);const marker=L.circleMarker(latlng,{radius:7,color:'#116bc6',fillColor:'#116bc6',fillOpacity:.9,weight:2}).addTo(map);
 const popup=document.createElement('div');const strong=document.createElement('strong');strong.textContent=row.nombre;const detail=document.createElement('div');detail.textContent='Departamento: '+(row.departamentos?.nombre||'Sin información');const note=document.createElement('small');note.textContent='Punto geográfico de referencia, no alerta';const button=document.createElement('button');button.type='button';button.textContent='Seleccionar localidad';button.addEventListener('click',()=>select(row.nombre));popup.append(strong,detail,note,document.createElement('br'),button);marker.bindPopup(popup);marker.on('click',()=>{$('mapSelected').textContent='Localidad seleccionada: '+row.nombre});markers.set(row.nombre,marker);
 const item=document.createElement('button');item.type='button';item.textContent='📍 '+row.nombre;item.addEventListener('click',()=>select(row.nombre));list.append(item);
 }
 map.fitBounds(bounds,{padding:[25,25],maxZoom:9});loaded=true;status(`${valid.length} localidades ubicadas. Tocá un punto o elegí una localidad.`);focus(api.getLocalidad());
 }catch(error){console.warn('Mapa:',error);status('No fue posible consultar el mapa geográfico. Verificá la conexión y los permisos de Supabase.')}finally{loading=false;requestAnimationFrame(()=>requestAnimationFrame(()=>map?.invalidateSize({pan:false})));setTimeout(()=>map?.invalidateSize({pan:false}),250)}}
 document.addEventListener('alerta:view',event=>{if(event.detail.view==='mapa'){init();requestAnimationFrame(()=>requestAnimationFrame(()=>map?.invalidateSize({pan:false})));setTimeout(()=>map?.invalidateSize({pan:false}),250)}});
 window.addEventListener('resize',()=>{if(map)map.invalidateSize()});
 document.addEventListener('alerta:localidad',event=>{if(loaded)focus(event.detail.nombre)});
 if($('view-mapa')?.classList.contains('active'))init();
})();
