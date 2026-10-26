
/* App Alerta Salud V1.10.26 — Inicio Inteligente.
   Lectura pública y detalle de avisos sin salir de Inicio. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const api = window.AlertaSalud;

  if (!api?.fetchPublic || !$('asHomeCareStatus')) return;

  let sequence = 0;

  const isCurrent = notice => {
    const start = Date.parse(notice.vigente_desde);
    const end = notice.vigente_hasta
      ? Date.parse(notice.vigente_hasta)
      : Infinity;

    return Number.isFinite(start) &&
      start <= Date.now() &&
      end > Date.now();
  };

  const stateOf = row => {
    const raw = Array.isArray(row.estado_actual)
      ? row.estado_actual[0]
      : row.estado_actual;

    if (!raw || raw.validado !== true) return null;

    const expiry = Date.parse(raw.verificado_hasta);

    return Number.isFinite(expiry) && expiry > Date.now()
      ? raw.operatividad
      : null;
  };

  const go = view => {
    document.querySelector(
      `.bottom-nav [data-view="${view}"]`
    )?.click();
  };

  const dateLabel = value => {
    if (!value) return 'No informada';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 'No informada'
      : date.toLocaleString('es-AR');
  };

  // Ventana de detalle del aviso seleccionado.
  const dialog = document.createElement('dialog');

  dialog.id = 'asHomeNoticeDialog';
  dialog.setAttribute(
    'aria-label',
    'Detalle del aviso sanitario'
  );

  dialog.style.cssText = [
    'width:min(440px,calc(100vw - 32px))',
    'max-height:85vh',
    'overflow:auto',
    'border:1px solid #cbd5e1',
    'border-radius:14px',
    'padding:20px',
    'color:#17324b',
    'background:#fff',
    'box-shadow:0 20px 70px #0004'
  ].join(';');

  dialog.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:center
    ">
      <strong>Comunicación institucional</strong>
      <button
        type="button"
        id="asHomeNoticeClose"
        style="
          border:1px solid #cbd5e1;
          border-radius:8px;
          background:#fff;
          padding:8px 12px;
          cursor:pointer
        "
      >Cerrar</button>
    </div>
    <div
      id="asHomeNoticeDetail"
      style="
        margin-top:16px;
        white-space:pre-wrap;
        overflow-wrap:anywhere
      "
    ></div>
  `;

  document.body.append(dialog);

  function closeDialog() {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  dialog.querySelector('#asHomeNoticeClose')
    .addEventListener('click', closeDialog);

  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });

  function openNotice(notice) {
    const detail = dialog.querySelector(
      '#asHomeNoticeDetail'
    );

    detail.replaceChildren();

    const add = (label, value) => {
      if (value === undefined ||
          value === null ||
          value === '') return;

      const heading = document.createElement('div');

      heading.style.cssText = [
        'font-size:12px',
        'font-weight:700',
        'color:#475569',
        'margin-top:14px'
      ].join(';');

      heading.textContent = label;

      const content = document.createElement('div');

      content.style.cssText = [
        'font-size:14px',
        'line-height:1.55',
        'margin-top:4px'
      ].join(';');

      content.textContent = String(value);

      detail.append(heading, content);
    };

    const title = document.createElement('h2');

    title.style.cssText = 'font-size:19px;margin:0 0 12px';
    title.textContent =
      notice.titulo || 'Comunicación institucional';

    detail.append(title);

    add(
      'Establecimiento',
      notice.centros_asistenciales?.nombre ||
        'Información institucional'
    );

    add('Publicado', dateLabel(notice.publicado_en));
    add('Prioridad', notice.prioridad);
    add('Descripción', notice.descripcion);
    add('Indicaciones', notice.indicaciones);

    add(
      'Vigente hasta',
      notice.vigente_hasta
        ? dateLabel(notice.vigente_hasta)
        : 'Sin fecha de finalización informada'
    );

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  document.querySelectorAll('[data-home-go]')
    .forEach(button => {
      button.addEventListener('click', () => {
        go(button.dataset.homeGo);
      });
    });

  $('asHomeCriticalGo')
    ?.addEventListener('click', () => go('alertas'));

  function status(message) {
    $('asHomeCareStatus').textContent = message;
    $('asHomeStats').hidden = true;
    $('asHomeUnknown').textContent = '';
  }

  async function refresh() {
    const serial = ++sequence;
    const city = api.getLocalidad();

    status(
      `Consultando declaraciones institucionales de ${city}…`
    );

    $('asHomeNotices').textContent =
      'Consultando comunicaciones oficiales…';

    $('asHomeCritical').hidden = true;

    try {
      const [centers, notices] = await Promise.all([
        api.fetchPublic(
          'centros_asistenciales',
          'select=id,nombre,localidad,' +
          'estado_actual(operatividad,validado,verificado_hasta)' +
          '&activo=eq.true' +
          '&localidad=eq.' + encodeURIComponent(city) +
          '&order=nombre.asc'
        ),

        api.fetchPublic(
          'as_notificaciones',
          'select=id,centro_id,titulo,descripcion,' +
          'indicaciones,prioridad,vigente_desde,' +
          'vigente_hasta,publicado_en,' +
          'centros_asistenciales(nombre,localidad)' +
          '&publicado=eq.true' +
          '&es_prueba=eq.false' +
          '&order=publicado_en.desc' +
          '&limit=150'
        )
      ]);

      if (serial !== sequence) return;

      const counts = {
        operativo: 0,
        parcial: 0,
        suspendido: 0,
        unknown: 0
      };

      for (const row of centers) {
        const code = stateOf(row);

        if (
          Object.hasOwn(counts, code) &&
          code !== 'unknown'
        ) {
          counts[code]++;
        } else {
          counts.unknown++;
        }
      }

      $('asHomeOperational').textContent =
        counts.operativo;

      $('asHomePartial').textContent =
        counts.parcial;

      $('asHomeSuspended').textContent =
        counts.suspendido;

      $('asHomeStats').hidden = !centers.length;

      $('asHomeCareStatus').textContent =
        centers.length
          ? `${centers.length} establecimiento(s) registrado(s) en ${city}.`
          : `Sin establecimientos registrados para ${city}.`;

      $('asHomeUnknown').textContent =
        counts.unknown
          ? `${counts.unknown} establecimiento(s) sin estado verificado vigente; no se incluyen en los conteos anteriores.`
          : '';

      const visible = notices.filter(notice => {
        const noticeCity =
          notice.centros_asistenciales?.localidad;

        return isCurrent(notice) &&
          noticeCity === city;
      });

      const container = $('asHomeNotices');
      container.replaceChildren();

      if (!visible.length) {
        container.textContent =
          'No hay avisos institucionales vigentes registrados para esta localidad. Esto no garantiza ausencia de novedades.';
      }

      visible.slice(0, 3).forEach(notice => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'as-home-notice';

        // Abre el aviso elegido sin cambiar de sección.
        button.addEventListener('click', () => {
          openNotice(notice);
        });

        const dot = document.createElement('span');

        dot.className =
          'as-home-dot ' +
          (
            notice.prioridad === 'critica'
              ? 'critical'
              : (
                  notice.prioridad === 'urgente' ||
                  notice.prioridad === 'alta'
                )
                ? 'urgent'
                : 'regular'
          );

        const body = document.createElement('span');
        body.className = 'as-home-notice-body';

        const title = document.createElement('strong');

        title.textContent =
          notice.titulo || 'Comunicación institucional';

        const meta = document.createElement('small');

        meta.textContent = [
          notice.centros_asistenciales?.nombre ||
            'Información institucional',
          notice.publicado_en
            ? dateLabel(notice.publicado_en)
            : ''
        ].filter(Boolean).join(' · ');

        body.append(title, meta);

        const arrow = document.createElement('span');
        arrow.textContent = '›';

        button.append(dot, body, arrow);
        container.append(button);
      });

      const urgent = visible.find(notice =>
        notice.prioridad === 'critica' ||
        notice.prioridad === 'urgente' ||
        notice.prioridad === 'alta'
      );

      if (urgent) {
        $('asHomeCriticalTitle').textContent =
          urgent.prioridad === 'critica'
            ? 'Alerta crítica vigente'
            : 'Aviso urgente vigente';

        $('asHomeCriticalDetail').textContent =
          urgent.titulo || 'Consultar información oficial';

        $('asHomeCritical').hidden = false;
      }

    } catch (error) {
      if (serial !== sequence) return;

      console.warn(
        'Inicio Inteligente: consulta no disponible',
        error
      );

      status(
        'No fue posible verificar el estado de los establecimientos. Consultá el mapa o las autoridades correspondientes.'
      );

      $('asHomeNotices').textContent =
        'No se pudieron verificar los avisos vigentes. Consultá la sección Alertas.';
    }
  }

  document.addEventListener(
    'alerta:localidad',
    refresh
  );

  document.addEventListener(
    'alerta:view',
    event => {
      if (event.detail?.view === 'inicio') {
        refresh();
      }
    }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        !document.hidden &&
        $('view-inicio')?.classList.contains('active')
      ) {
        refresh();
      }
    }
  );

  refresh();
})();
