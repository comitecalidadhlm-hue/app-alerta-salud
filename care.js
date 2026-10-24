
/*
 * APP ALERTA SALUD V1.9.4
 * Directorio sanitario publico.
 *
 * Muestra:
 * - Funcionamiento
 * - Recepcion de pacientes
 * - Accesibilidad
 * - Energia
 * - Vigencia de la informacion
 *
 * No muestra nivel de complejidad.
 * No presenta estados vencidos como vigentes.
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let serial = 0;
  let rowsCache = [];

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

    return (
      Number.isFinite(expiration) &&
      expiration > Date.now()
    );
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

  function node(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

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

  function freshness(raw) {
    if (!raw) {
      return "Sin declaración verificada";
    }

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

    if (expiration <= Date.now()) {
      return "Verificación vencida";
    }

    return "Información vigente";
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

      // Datos del establecimiento.
      // Nunca mostrar nivel de complejidad.
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

      // Estados asistenciales independientes.
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

      // Vigencia.
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

      // Ubicación en OpenStreetMap.
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

  // Revisar vigencia mientras la pantalla
  // permanezca abierta, sin nuevas consultas.
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

})();
