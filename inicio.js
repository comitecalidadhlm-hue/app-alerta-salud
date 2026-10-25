/* App Alerta Salud V1.10.22 — Inicio Inteligente. Lectura pública, sin publicaciones. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = window.AlertaSalud;
  if (!api?.fetchPublic || !$('asHomeCareStatus')) return;
  let sequence = 0;
  const isCurrent = n => {
    const start = Date.parse(n.vigente_desde);
    const end = n.vigente_hasta ? Date.parse(n.vigente_hasta) : Infinity;
    return Number.isFinite(start) && start <= Date.now() && end > Date.now();
  };
  const stateOf = row => {
    const raw = Array.isArray(row.estado_actual) ? row.estado_actual[0] : row.estado_actual;
    if (!raw || raw.validado !== true) return null;
    const expiry = Date.parse(raw.verificado_hasta);
    return Number.isFinite(expiry) && expiry > Date.now() ? raw.operatividad : null;
  };
  const go = view => document.querySelector(`.bottom-nav [data-view="${view}"]`)?.click();
  document.querySelectorAll('[data-home-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.homeGo)));
  $('asHomeCriticalGo').addEventListener('click', () => go('alertas'));
  function status(message) { $('asHomeCareStatus').textContent = message; $('asHomeStats').hidden = true; $('asHomeUnknown').textContent = ''; }
  async function refresh() {
    const serial = ++sequence;
    const city = api.getLocalidad();
    status(`Consultando declaraciones institucionales de ${city}…`);
    $('asHomeNotices').textContent = 'Consultando comunicaciones oficiales…';
    $('asHomeCritical').hidden = true;
    try {
      const [centers, notices] = await Promise.all([
        api.fetchPublic('centros_asistenciales', 'select=id,nombre,localidad,estado_actual(operatividad,validado,verificado_hasta)&activo=eq.true&localidad=eq.' + encodeURIComponent(city) + '&order=nombre.asc'),
        api.fetchPublic('as_notificaciones', 'select=id,centro_id,titulo,descripcion,prioridad,vigente_desde,vigente_hasta,publicado_en,centros_asistenciales(nombre,localidad)&publicado=eq.true&es_prueba=eq.false&order=publicado_en.desc&limit=150')
      ]);
      if (serial !== sequence) return;
      const counts = {operativo:0,parcial:0,suspendido:0,unknown:0};
      for (const row of centers) {
        const code = stateOf(row);
        if (Object.hasOwn(counts,code) && code !== 'unknown') counts[code]++;
        else counts.unknown++;
      }
      $('asHomeOperational').textContent = counts.operativo;
      $('asHomePartial').textContent = counts.parcial;
      $('asHomeSuspended').textContent = counts.suspendido;
      $('asHomeStats').hidden = !centers.length;
      $('asHomeCareStatus').textContent = centers.length ? `${centers.length} establecimiento(s) registrado(s) en ${city}.` : `Sin establecimientos registrados para ${city}.`;
      $('asHomeUnknown').textContent = counts.unknown ? `${counts.unknown} establecimiento(s) sin estado verificado vigente; no se incluyen en los conteos anteriores.` : '';
      const visible = notices.filter(n => isCurrent(n) && (!n.centros_asistenciales?.localidad || n.centros_asistenciales.localidad === city));
      const container = $('asHomeNotices');container.replaceChildren();
      if (!visible.length) container.textContent = 'No hay avisos institucionales vigentes registrados para esta localidad. Esto no garantiza ausencia de novedades.';
      visible.slice(0,3).forEach(n => {
        const button = document.createElement('button');button.type = 'button';button.className = 'as-home-notice';button.addEventListener('click', () => go('alertas'));
        const dot = document.createElement('span');dot.className = 'as-home-dot ' + (n.prioridad === 'critica' ? 'critical' : n.prioridad === 'urgente' ? 'urgent' : 'regular');
        const body = document.createElement('span');body.className = 'as-home-notice-body';
        const title = document.createElement('strong');title.textContent = n.titulo || 'Comunicación institucional';
        const meta = document.createElement('small');meta.textContent = [n.centros_asistenciales?.nombre || 'Información institucional', n.publicado_en ? new Date(n.publicado_en).toLocaleString('es-AR') : ''].filter(Boolean).join(' · ');
        body.append(title,meta);const arrow = document.createElement('span');arrow.textContent = '›';button.append(dot,body,arrow);container.append(button);
      });
      const urgent = visible.find(n => n.prioridad === 'critica' || n.prioridad === 'urgente');
      if (urgent) {
        $('asHomeCriticalTitle').textContent = urgent.prioridad === 'critica' ? 'Alerta crítica vigente' : 'Aviso urgente vigente';
        $('asHomeCriticalDetail').textContent = urgent.titulo || 'Consultar información oficial';
        $('asHomeCritical').hidden = false;
      }
    } catch (error) {
      if (serial !== sequence) return;
      console.warn('Inicio Inteligente: consulta no disponible',error);
      status('No fue posible verificar el estado de los establecimientos. Consultá el mapa o las autoridades correspondientes.');
      $('asHomeNotices').textContent = 'No se pudieron verificar los avisos vigentes. Consultá la sección Alertas.';
    }
  }
  document.addEventListener('alerta:localidad', refresh);
  document.addEventListener('alerta:view', event => { if (event.detail?.view === 'inicio') refresh(); });
  document.addEventListener('visibilitychange', () => {if (!document.hidden && $('view-inicio')?.classList.contains('active')) refresh();});
  refresh();
})();
