
/*
 * APP ALERTA SALUD V1.9.5
 * CODIGO 15C
 * Centro publico de notificaciones.
 *
 * Solo lectura.
 * No publica ni modifica avisos.
 * No utiliza datos ficticios.
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const api = window.AlertaSalud;

  if (!api || !$("view-mas")) {
    console.warn(
      "Notificaciones: aplicación no disponible"
    );
    return;
  }

  const TYPES = {
    cambio_horario: "Cambio de horarios",
    restriccion: "Restricción de atención",
    suspension: "Suspensión de atención",
    cierre: "Cierre de atención",
    restablecimiento: "Servicio restablecido",
    otro: "Otra modificación",
    novedad: "Novedad"
  };

  const ICONS = {
    cambio_horario: "🕒",
    restriccion: "⚠️",
    suspension: "⛔",
    cierre: "🚨",
    restablecimiento: "✅",
    otro: "📢",
    novedad: "ℹ️"
  };

  const PRIORITIES = {
    informativa: "Información",
    normal: "Cambio informado",
    alta: "Cambio importante",
    critica: "Aviso crítico"
  };

  let records = [];
  let tab = "vigentes";
  let loading = false;
  let loaded = false;

  const section = document.createElement("section");
  section.id = "asNotifications";
  section.className = "as-notifications";

  section.innerHTML = `
    <div class="as-notifications-heading">
      <h2>🔔 Centro de Notificaciones</h2>
      <p>
        Cambios comunicados oficialmente por los
        establecimientos sanitarios.
      </p>
    </div>

    <div class="as-notification-tabs"
         role="group"
         aria-label="Tipo de consulta">
      <button type="button"
              id="asNotCurrent"
              class="as-notification-tab selected">
        Avisos vigentes
      </button>
      <button type="button"
              id="asNotHistory"
              class="as-notification-tab">
        Historial
      </button>
    </div>

    <div class="as-notification-filters">
      <label for="asNotCenter">
        Establecimiento
      </label>
      <select id="asNotCenter">
        <option value="todos">
          Todos los establecimientos
        </option>
      </select>

      <label for="asNotType">
        Tipo de comunicación
      </label>
      <select id="asNotType">
        <option value="todos">
          Todos los tipos
        </option>
        <option value="cambio_horario">
          Cambios de horarios
        </option>
        <option value="restriccion">
          Restricciones
        </option>
        <option value="suspension">
          Suspensiones
        </option>
        <option value="cierre">
          Cierres
        </option>
        <option value="restablecimiento">
          Restablecimientos
        </option>
        <option value="otro">
          Otras modificaciones
        </option>
      </select>

      <label class="as-notification-check">
        <input id="asNotOnlyLocal"
               type="checkbox"
               checked>
        Solo mi localidad
      </label>
    </div>

    <div class="as-notification-actions">
      <button type="button"
              id="asNotReload"
              class="secondary">
        ↻ Consultar nuevamente
      </button>
    </div>

    <p id="asNotStatus"
       role="status"
       aria-live="polite">
      Abrí Notificaciones para consultar
      las publicaciones oficiales.
    </p>

    <div id="asNotList"
         class="as-notification-list">
    </div>

    <p class="as-notification-disclaimer">
      Los avisos reflejan comunicaciones
      institucionales registradas.
      Ante una urgencia, utilizá los canales
      oficiales de asistencia.
    </p>
  `;

  const style = document.createElement("style");

  style.textContent = `
    .as-notifications {
      margin: 18px 0 26px;
      padding: 15px;
      border: 1px solid #d5e0ea;
      border-radius: 14px;
      background: #fff;
      color: #193047;
    }

    .as-notifications-heading h2 {
      margin: 0 0 8px;
      font-size: 18px;
    }

    .as-notifications-heading p {
      margin: 0 0 15px;
      font-size: 13px;
      line-height: 1.5;
      color: #526477;
    }

    .as-notification-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }

    .as-notification-tab {
      padding: 11px 7px;
      border: 1px solid #c5d4e2;
      border-radius: 8px;
      background: #eef3f8;
      color: #16344d;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }

    .as-notification-tab.selected {
      background: #17628c;
      color: #fff;
      border-color: #17628c;
    }

    .as-notification-filters {
      display: grid;
      gap: 7px;
    }

    .as-notification-filters > label {
      font-size: 12px;
      font-weight: 700;
    }

    .as-notification-filters select {
      width: 100%;
      min-height: 39px;
      padding: 8px;
      border: 1px solid #b9ccdd;
      border-radius: 8px;
      background: white;
      color: #17324a;
      margin-bottom: 7px;
    }

    .as-notification-check {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 5px 0;
      font-weight: 500 !important;
    }

    .as-notification-check input {
      width: 17px;
      height: 17px;
    }

    .as-notification-actions {
      margin: 12px 0;
    }

    .as-notification-actions button {
      font-size: 12px;
      padding: 9px 12px;
    }

    #asNotStatus {
      font-size: 12px;
      color: #526477;
      line-height: 1.5;
    }

    .as-notification-list {
      display: grid;
      gap: 11px;
      margin-top: 12px;
    }

    .as-notification-card {
      border: 1px solid #d5e0ea;
      border-left: 4px solid #69869b;
      border-radius: 10px;
      padding: 13px;
      background: #f8fafc;
    }

    .as-notification-card.high {
      border-left-color: #c67b17;
    }

    .as-notification-card.critical {
      border-left-color: #c0392b;
    }

    .as-notification-card.restored {
      border-left-color: #27845c;
    }

    .as-notification-card.expired {
      opacity: .83;
    }

    .as-notification-label {
      font-size: 11px;
      font-weight: 700;
      color: #526477;
      margin-bottom: 8px;
    }

    .as-notification-card h3 {
      font-size: 15px;
      line-height: 1.35;
      margin: 0 0 7px;
    }

    .as-notification-center {
      font-size: 13px;
      font-weight: 700;
      margin: 0 0 9px;
    }

    .as-notification-description {
      font-size: 13px;
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .as-notification-meta {
      margin-top: 10px;
      padding-top: 9px;
      border-top: 1px solid #d9e3eb;
      font-size: 11px;
      line-height: 1.6;
      color: #526477;
    }

    .as-notification-more {
      margin-top: 10px;
      font-size: 12px;
    }

    .as-notification-more summary {
      cursor: pointer;
      font-weight: 700;
      color: #17628c;
    }

    .as-notification-more p {
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .as-notification-disclaimer {
      margin: 18px 0 0;
      font-size: 11px;
      color: #65788b;
      line-height: 1.5;
    }

    .as-notification-empty {
      padding: 18px 12px;
      text-align: center;
      border: 1px dashed #c6d5e2;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.6;
      color: #526477;
    }
  `;

  document.head.appendChild(style);
  $("view-mas").appendChild(section);

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) node.className = className;

    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }

    return node;
  }

  function dateText(input) {
    if (!input) return "Sin fecha de finalización";

    const date = new Date(input);

    if (Number.isNaN(date.getTime())) {
      return "Fecha no disponible";
    }

    return date.toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function isCurrent(item) {
    const now = Date.now();

    const start = Date.parse(item.vigente_desde);

    if (!Number.isFinite(start) || start > now) {
      return false;
    }

    if (!item.vigente_hasta) return true;

    const end = Date.parse(item.vigente_hasta);

    return Number.isFinite(end) && end > now;
  }

  function centerName(item) {
    return (
      item.centros_asistenciales?.nombre ||
      (item.centro_id
        ? "Establecimiento no disponible"
        : "App Alerta Salud")
    );
  }

  function centerLocality(item) {
    return (
      item.centros_asistenciales?.localidad ||
      ""
    );
  }

  function updateCenterOptions() {
    const select = $("asNotCenter");
    const previous = select.value;

    select.replaceChildren(
      new Option(
        "Todos los establecimientos",
        "todos"
      )
    );

    const centers = new Map();

    for (const item of records) {
      if (item.centro_id && (!$("asNotOnlyLocal").checked || centerLocality(item) === api.getLocalidad())) {
        centers.set(
          String(item.centro_id),
          centerName(item)
        );
      }
    }

    [...centers.entries()]
      .sort((a, b) =>
        a[1].localeCompare(b[1], "es")
      )
      .forEach(([id, name]) => {
        select.add(new Option(name, id));
      });

    if ([...select.options].some(
      option => option.value === previous
    )) {
      select.value = previous;
    }
  }

  function renderCard(item) {
    const current = isCurrent(item);

    let appearance = "";

    if (item.prioridad === "critica") {
      appearance = "critical";
    } else if (item.prioridad === "alta") {
      appearance = "high";
    }

    if (item.tipo_cambio === "restablecimiento") {
      appearance = "restored";
    }

    if (!current) appearance += " expired";

    const card = element(
      "article",
      "as-notification-card " + appearance
    );

    const type =
      TYPES[item.tipo_cambio] ||
      "Comunicación institucional";

    const priority =
      PRIORITIES[item.prioridad] ||
      "Comunicación";

    const label = element(
      "div",
      "as-notification-label",
      `${ICONS[item.tipo_cambio] || "📢"} ` +
      `${type} · ${priority}`
    );

    const title = element(
      "h3",
      null,
      item.titulo
    );

    const center = element(
      "p",
      "as-notification-center",
      centerName(item)
    );

    const description = element(
      "p",
      "as-notification-description",
      item.descripcion
    );

    card.append(label, title, center);

    if (item.servicio_afectado) {
      card.append(
        element(
          "p",
          null,
          "Servicio: " + item.servicio_afectado
        )
      );
    }

    card.append(description);

    const meta = element(
      "div",
      "as-notification-meta"
    );

    const status = current
      ? "Vigente"
      : "No vigente / histórica";

    meta.append(
      element("div", null, "Estado: " + status),
      element(
        "div",
        null,
        "Publicado: " +
        dateText(item.publicado_en)
      ),
      element(
        "div",
        null,
        "Desde: " +
        dateText(item.vigente_desde)
      ),
      element(
        "div",
        null,
        "Hasta: " +
        dateText(item.vigente_hasta)
      )
    );

    card.append(meta);

    if (item.indicaciones) {
      const details = element(
        "details",
        "as-notification-more"
      );

      details.append(
        element(
          "summary",
          null,
          "Ver indicaciones"
        ),
        element(
          "p",
          null,
          item.indicaciones
        )
      );

      card.append(details);
    }

    return card;
  }

  function render() {
    const list = $("asNotList");

    list.replaceChildren();

    const selectedCenter = $("asNotCenter").value;
    const selectedType = $("asNotType").value;
    const onlyLocal = $("asNotOnlyLocal").checked;

    const locality = api.getLocalidad();

    const filtered = records.filter(item => {
      if (
        tab === "vigentes" &&
        !isCurrent(item)
      ) {
        return false;
      }

      if (
        selectedCenter !== "todos" &&
        String(item.centro_id) !== selectedCenter
      ) {
        return false;
      }

      if (
        selectedType !== "todos" &&
        item.tipo_cambio !== selectedType
      ) {
        return false;
      }

      if (
        onlyLocal &&
        centerLocality(item) !== locality
      ) {
        return false;
      }

      return true;
    });

    if (!filtered.length) {
      list.append(
        element(
          "div",
          "as-notification-empty",
          tab === "vigentes"
            ? "No hay comunicaciones oficiales " +
              "vigentes que coincidan con los filtros. " +
              "Esto no confirma que los servicios " +
              "funcionen normalmente."
            : "No hay comunicaciones registradas " +
              "que coincidan con los filtros."
        )
      );
    } else {
      filtered.forEach(item => {
        list.append(renderCard(item));
      });
    }

    $("asNotStatus").textContent =
      `${filtered.length} comunicación(es) ` +
      `en ${tab === "vigentes"
        ? "avisos vigentes"
        : "historial"}.`;
  }

  async function load() {
    if (loading) return;

    loading = true;

    $("asNotReload").disabled = true;

    $("asNotStatus").textContent =
      "Consultando comunicaciones oficiales…";

    try {
      const query = [
        "select=" + [
          "id",
          "centro_id",
          "categoria",
          "tipo_cambio",
          "servicio_afectado",
          "titulo",
          "descripcion",
          "indicaciones",
          "prioridad",
          "vigente_desde",
          "vigente_hasta",
          "publicado_en",
          "notificacion_anterior_id",
          "centros_asistenciales(nombre,localidad)"
        ].join(","),
        "publicado=eq.true",
        "es_prueba=eq.false",
        "order=publicado_en.desc",
        "limit=200"
      ].join("&");

      const data = await api.fetchPublic(
        "as_notificaciones",
        query
      );

      if (!Array.isArray(data)) {
        throw new Error(
          "Respuesta de notificaciones no válida"
        );
      }

      records = data;
      loaded = true;

      updateCenterOptions();
      render();

    } catch (error) {
      console.warn(
        "Error consultando notificaciones",
        error
      );

      if (!loaded) {
        $("asNotList").replaceChildren();
      }

      $("asNotStatus").textContent =
        "No se pudo actualizar la información. " +
        "Verificá tu conexión. " +
        "No es posible confirmar avisos vigentes.";

      // No se presenta información anterior
      // como si acabara de verificarse.
      $("asNotList").replaceChildren();

    } finally {
      loading = false;
      $("asNotReload").disabled = false;
    }
  }

  function switchTab(next) {
    tab = next;

    $("asNotCurrent").classList.toggle(
      "selected",
      tab === "vigentes"
    );

    $("asNotHistory").classList.toggle(
      "selected",
      tab === "historial"
    );

    if (loaded) {
      render();
    } else {
      load();
    }
  }

  function openPanel(next) {
    switchTab(next);

    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    load();
  }

  $("asNotCurrent").addEventListener(
    "click",
    () => switchTab("vigentes")
  );

  $("asNotHistory").addEventListener(
    "click",
    () => switchTab("historial")
  );

  $("asNotCenter").addEventListener(
    "change",
    render
  );

  $("asNotType").addEventListener(
    "change",
    render
  );

  $("asNotOnlyLocal").addEventListener(
    "change",
    render
  );

  $("asNotReload").addEventListener(
    "click",
    load
  );

  // Capturamos los botones existentes
  // antes de que ejecuten sus mensajes
  // informativos anteriores.
  const notificationsButton =
    $("menuNotifications");

  const historyButton = $("menuHistory");

  if (notificationsButton) {
    notificationsButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPanel("vigentes");
      },
      true
    );

    const small =
      notificationsButton.querySelector("small");

    if (small) {
      small.textContent =
        "Comunicaciones institucionales";
    }
  }

  if (historyButton) {
    historyButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPanel("historial");
      },
      true
    );

    const small =
      historyButton.querySelector("small");

    if (small) {
      small.textContent =
        "Consultar publicaciones anteriores";
    }
  }

  // Si el usuario vuelve a la aplicación
  // mientras está consultando avisos,
  // se realiza una nueva consulta.
  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden &&
        $("view-mas")?.classList.contains(
          "active"
        ) &&
        loaded
      ) {
        load();
      }
    }
  );

  document.addEventListener(
    "alerta:localidad",
    () => {
      if (loaded) { updateCenterOptions(); render(); }
    }
  );

})();
