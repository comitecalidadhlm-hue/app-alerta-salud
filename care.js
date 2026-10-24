
/*
 * APP ALERTA SALUD V1.9.8
 * Directorio sanitario y novedades institucionales.
 *
 * Conserva los datos asistenciales existentes.
 * Agrega novedades oficiales vigentes e historial
 * por establecimiento, sin publicar ni modificar datos.
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let serial = 0;
  let rowsCache = [];
  let notificationsCache = [];
  let notificationsAvailable = true;

  const names = {
    operativo: "Operativo",
    parcial: "Atención parcial",
    suspendido: "Atención suspendida",
    recibe: "Recibe pacientes",
    limitada: "Recepción limitada",
    no_recibe: "No recibe pacientes",
    accesible: "Accesible",
    restringido: "Acceso restringido",
    interrumpido: "Acceso interrumpido",
    normal: "Normal",
    afectado: "Afectado",
    sin_servicio: "Sin servicio",
    sin_verificar: "Sin verificar"
  };

  const noticeTypes = {
    cambio_horario: "Cambio de horarios",
    restriccion: "Restricción de atención",
    suspension: "Suspensión de atención",
    cierre: "Cierre de atención",
    restablecimiento: "Restablecimiento",
    otro: "Modificación de servicio"
  };

  const noticeIcons = {
    cambio_horario: "🕒",
    restriccion: "⚠️",
    suspension: "⛔",
    cierre: "⛔",
    restablecimiento: "✅",
    otro: "📢"
  };

  const style = document.createElement("style");

  style.textContent = `
    .as-care-notices {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #d5e0e9;
    }

    .as-care-notices h4 {
      margin: 0 0 10px;
      font-size: 1rem;
    }

    .as-care-notice {
      margin: 10px 0;
      padding: 12px;
      border: 1px solid #d5e0e9;
      border-left: 4px solid #b45309;
      border-radius: 9px;
      background: #fffaf0;
      overflow-wrap: anywhere;
    }

    .as-care-notice.restored {
      border-left-color: #15803d;
      background: #f0fdf4;
    }

    .as-care-notice h5 {
      margin: 8px 0;
      font-size: 1rem;
    }

    .as-care-notice p {
      margin: 7px 0;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .as-care-notice small {
      display: block;
      margin-top: 8px;
      color: #526577;
    }

    .as-care-history {
      margin-top: 12px;
      border: 1px solid #d5e0e9;
      border-radius: 9px;
      padding: 10px;
    }

    .as-care-history summary {
      cursor: pointer;
      font-weight: 600;
    }

    .as-care-history .as-care-notice {
      background: #f7f9fb;
      border-left-color: #64748b;
    }

    .as-care-muted {
      color: #526577;
      font-size: .9rem;
    }

    .as-care-warning {
      margin: 10px 0;
      color: #854d0e;
      font-size: .9rem;
    }
  `;

  document.head.append(style);

  function node(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function line(card, label, text) {
    const paragraph = node("p");

    paragraph.append(
      node("strong", null, label + ": "),
      document.createTextNode(text)
    );

    card.append(paragraph);
  }

  function dateText(value) {
    if (!value) return "No informada";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "No informada"
      : date.toLocaleString("es-AR");
  }

  function getRawState(row) {
    const data = row?.estado_actual;

    return Array.isArray(data)
      ? data[0] || null
      : data || null;
  }

  function valid(state) {
    if (!state || state.validado !== true) {
      return false;
    }

    if (!state.verificado_hasta) {
      return false;
    }

    const expiration = Date.parse(
      state.verificado_hasta
    );

    return Number.isFinite(expiration) &&
      expiration > Date.now();
  }

  function state(row) {
    const raw = getRawState(row);
    return valid(raw) ? raw : null;
  }

  function value(current, key) {
    if (!current) return "Sin verificar";

    const code = current[key];

    return Object.prototype.hasOwnProperty.call(
      names,
      code
    )
      ? names[code]
      : "Sin verificar";
  }

  function freshness(raw) {
    if (!raw) return "Sin declaración verificada";

    if (!raw.validado) {
      return "Información no validada";
    }

    if (!raw.verificado_hasta) {
      return "Sin vigencia confirmada";
    }

    const expiration = Date.parse(
      raw.verificado_hasta
    );

    if (!Number.isFinite(expiration)) {
      return "Vigencia no disponible";
    }

    return expiration <= Date.now()
      ? "Verificación vencida"
      : "Información vigente";
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

  function noticesForCenter(centerId) {
    return notificationsCache.filter(
      item => String(item.centro_id) ===
        String(centerId)
    );
  }

  function noticeCard(item, historical = false) {
    const article = node(
      "article",
      "as-care-notice" +
      (
        item.tipo_cambio === "restablecimiento" &&
        !historical
          ? " restored"
          : ""
      )
    );

    const type = noticeTypes[item.tipo_cambio] ||
      "Comunicación institucional";

    article.append(
      node(
        "strong",
        null,
        (noticeIcons[item.tipo_cambio] || "📢") +
        " " + type
      ),
      node("h5", null, item.titulo)
    );

    if (item.servicio_afectado) {
      line(
        article,
        "Servicio",
        item.servicio_afectado
      );
    }

    if (item.descripcion) {
      article.append(
        node("p", null, item.descripcion)
      );
    }

    if (item.indicaciones) {
      line(
        article,
        "Indicaciones",
        item.indicaciones
      );
    }

    const status = historical
      ? (
          isCurrent(item)
            ? "Vigente, reemplazada por otra comunicación"
            : (
                Date.parse(item.vigente_desde) >
                Date.now()
                  ? "Programada"
                  : "Fuera de vigencia"
              )
        )
      : "Vigente";

    article.append(
      node(
        "small",
        null,
        "Estado: " + status +
        " · Publicado: " +
        dateText(item.publicado_en)
      )
    );

    if (item.vigente_hasta) {
      article.append(
        node(
          "small",
          null,
          "Vigente hasta: " +
          dateText(item.vigente_hasta)
        )
      );
    }

    return article;
  }

  function appendNotices(card, centerId) {
    const section = node(
      "section",
      "as-care-notices"
    );

    section.append(
      node(
        "h4",
        null,
        "🔔 Novedades y afectaciones de servicios"
      )
    );

    if (!notificationsAvailable) {
      section.append(
        node(
          "p",
          "as-care-warning",
          "No fue posible consultar las comunicaciones " +
          "institucionales. Consultá el Centro de " +
          "Notificaciones para verificar la información."
        )
      );

      card.append(section);
      return;
    }

    const all = noticesForCenter(centerId);

    // Una comunicación posterior vinculada a otra
    // la reemplaza en la vista principal.
    const replacedIds = new Set(
      all
        .filter(item =>
          item.notificacion_anterior_id &&
          isCurrent(item)
        )
        .map(item =>
          String(item.notificacion_anterior_id)
        )
    );

    const current = all.filter(
      item =>
        isCurrent(item) &&
        !replacedIds.has(String(item.id))
    );

    const history = all.filter(
      item => !current.includes(item)
    );

    if (!current.length) {
      section.append(
        node(
          "p",
          "as-care-muted",
          "No hay novedades institucionales " +
          "vigentes registradas para este establecimiento. " +
          "Esto no garantiza ausencia de afectaciones."
        )
      );
    } else {
      section.append(
        node(
          "p",
          "as-care-muted",
          current.length === 1
            ? "1 comunicación institucional vigente."
            : current.length +
              " comunicaciones institucionales vigentes."
        )
      );

      for (const item of current) {
        section.append(noticeCard(item));
      }
    }

    if (history.length) {
      const disclosure = node(
        "details",
        "as-care-history"
      );

      disclosure.append(
        node(
          "summary",
          null,
          "Ver historial de comunicaciones (" +
          history.length + ")"
        )
      );

      for (const item of history) {
        disclosure.append(
          noticeCard(item, true)
        );
      }

      section.append(disclosure);
    }

    card.append(section);
  }

  function render() {
    const list = $("careList");
    const summary = $("careSummary");
    const filter = $("careFilter");

    if (!list) return;

    list.replaceChildren();

    const selection = filter?.value || "todos";
    let found = 0;

    for (const row of rowsCache) {
      const raw = getRawState(row);
      const current = state(row);

      const operation =
        current?.operatividad || "sin_verificar";

      if (
        selection !== "todos" &&
        operation !== selection
      ) {
        continue;
      }

      found++;

      const card = node("article", "care-item");

      card.append(
        node("h3", null, "🏥 " + row.nombre),
        node(
          "span",
          "care-tag care-" + operation,
          names[operation] || "Sin verificar"
        )
      );

      line(
        card,
        "Dirección",
        row.direccion || "No informada"
      );

      line(
        card,
        "Habilitación sanitaria",
        row.habilitacion_sanitaria === "habilitado"
          ? "Habilitación documentada"
          : row.habilitacion_sanitaria ===
            "no_habilitado"
            ? "No habilitado (documentado)"
            : "Sin verificar"
      );

      line(
        card,
        "Funcionamiento",
        value(current, "operatividad")
      );

      line(
        card,
        "Recepción de pacientes",
        value(current, "recepcion_pacientes")
      );

      line(
        card,
        "Accesibilidad",
        value(current, "accesibilidad")
      );

      line(
        card,
        "Suministro eléctrico",
        value(current, "energia")
      );

      line(
        card,
        "Verificación",
        freshness(raw)
      );

      if (current) {
        line(
          card,
          "Vigente hasta",
          dateText(current.verificado_hasta)
        );
      } else {
        line(
          card,
          "Disponibilidad asistencial",
          "No confirmada actualmente"
        );
      }

      // Novedades propias de este establecimiento.
      appendNotices(card, row.id);

      // Enlace geográfico original.
      const lat = Number(row.latitud);
      const lon = Number(row.longitud);

      if (
        row.latitud !== null &&
        row.longitud !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
      ) {
        const link = node(
          "a",
          null,
          "📍 Ver ubicación en el mapa ↗"
        );

        link.href =
          "https://www.openstreetmap.org/" +
          "?mlat=" + lat +
          "&mlon=" + lon +
          "#map=16/" + lat + "/" + lon;

        link.target = "_blank";
        link.rel = "noopener noreferrer";

        card.append(link);
      }

      list.append(card);
    }

    if (summary) {
      summary.textContent = rowsCache.length
        ? `${found} de ${rowsCache.length} ` +
          "establecimientos visibles."
        : "";
    }

    if (rowsCache.length && !found) {
      list.append(
        node(
          "p",
          "care-empty",
          "No hay establecimientos con ese " +
          "estado registrado."
        )
      );
    }
  }

  async function load() {
    const api = window.AlertaSalud;
    const status = $("careStatus");
    const list = $("careList");

    if (!api || !status || !list) return;

    const requestId = ++serial;
    const city = api.getLocalidad();

    rowsCache = [];
    notificationsCache = [];
    notificationsAvailable = true;

    list.replaceChildren();

    const summary = $("careSummary");
    if (summary) summary.textContent = "";

    status.textContent =
      "Consultando establecimientos de " +
      city + "…";

    try {
      const query =
        "select=id,nombre,direccion,localidad," +
        "latitud,longitud,habilitacion_sanitaria," +
        "estado_actual(" +
        "operatividad,recepcion_pacientes," +
        "accesibilidad,energia," +
        "validado,verificado_hasta)" +
        "&activo=eq.true" +
        "&localidad=eq." +
        encodeURIComponent(city) +
        "&order=nombre.asc";

      const rows = await api.fetchPublic(
        "centros_asistenciales",
        query
      );

      if (requestId !== serial) return;

      rowsCache = Array.isArray(rows) ? rows : [];

      // Consultar novedades solo para los centros
      // que efectivamente aparecen en el directorio.
      if (rowsCache.length) {
        try {
          const ids = rowsCache
            .map(row => String(row.id))
            .filter(id => /^\d+$/.test(id));

          if (ids.length) {
            const noticeQuery = [
              "select=" + [
                "id",
                "centro_id",
                "tipo_cambio",
                "servicio_afectado",
                "titulo",
                "descripcion",
                "indicaciones",
                "vigente_desde",
                "vigente_hasta",
                "publicado_en",
                "notificacion_anterior_id"
              ].join(","),
              "centro_id=in.(" + ids.join(",") + ")",
              "publicado=eq.true",
              "es_prueba=eq.false",
              "order=publicado_en.desc",
              "limit=500"
            ].join("&");

            const notifications = await api.fetchPublic(
              "as_notificaciones",
              noticeQuery
            );

            if (requestId !== serial) return;

            notificationsCache = Array.isArray(
              notifications
            ) ? notifications : [];

          }
        } catch (error) {
          if (requestId !== serial) return;

          notificationsAvailable = false;

          console.warn(
            "Novedades institucionales",
            error
          );
        }
      }

      status.textContent = rowsCache.length
        ? `${rowsCache.length} establecimiento(s) ` +
          `registrados en ${city}. ` +
          "La disponibilidad requiere " +
          "una declaración vigente."
        : "Todavía no hay establecimientos " +
          `incorporados para ${city}. ` +
          "Esto no significa que no existan " +
          "centros sanitarios.";

      render();

    } catch (error) {
      if (requestId !== serial) return;

      status.textContent =
        "No se pudo consultar el directorio. " +
        "No es posible confirmar " +
        "disponibilidad asistencial.";

      console.warn(
        "Directorio sanitario",
        error
      );
    }
  }

  $("careFilter")?.addEventListener(
    "change",
    render
  );

  document.addEventListener(
    "alerta:view",
    event => {
      if (event.detail?.view === "mapa") {
        load();
      }
    }
  );

  document.addEventListener(
    "alerta:localidad",
    () => {
      if (
        $("view-mapa")?.classList.contains(
          "active"
        )
      ) {
        load();
      }
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden &&
        $("view-mapa")?.classList.contains(
          "active"
        )
      ) {
        load();
      }
    }
  );

  if (
    $("view-mapa")?.classList.contains(
      "active"
    )
  ) {
    load();
  }

  console.info(
    "App Alerta Salud: directorio V1.9.8"
  );

})();
