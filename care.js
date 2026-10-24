
/* App Alerta Salud V1.9 — Directorio sanitario público */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let serial = 0;
  let rowsCache = [];

  const names = {
    operativo: "Operativo",
    parcial: "Atención parcial",
    suspendido: "Atención suspendida",
    accesible: "Accesible",
    restringido: "Acceso restringido",
    interrumpido: "Acceso interrumpido",
    normal: "Normal",
    afectado: "Afectado",
    sin_servicio: "Sin servicio",
    sin_verificar: "Sin verificar"
  };

  function valid(s) {
    return (
      s?.validado === true &&
      !!s?.verificado_hasta &&
      Number.isFinite(Date.parse(s.verificado_hasta)) &&
      Date.parse(s.verificado_hasta) > Date.now()
    );
  }

  function state(row) {
    const s = Array.isArray(row.estado_actual)
      ? row.estado_actual[0]
      : row.estado_actual;

    return valid(s) ? s : null;
  }

  function value(s, key) {
    return s && names[s[key]]
      ? names[s[key]]
      : "Sin verificar";
  }

  function node(tag, cls, txt) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined) el.textContent = txt;
    return el;
  }

  function line(card, label, txt) {
    const p = node("p");
    p.append(
      node("strong", null, label + ": "),
      document.createTextNode(txt)
    );
    card.append(p);
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
      const s = state(row);
      const op = s?.operatividad || "sin_verificar";

      if (selection !== "todos" && op !== selection) {
        continue;
      }

      found++;

      const card = node("article", "care-item");

      card.append(
        node("h3", null, "🏥 " + row.nombre),
        node(
          "span",
          "care-tag care-" + op,
          names[op] || "Sin verificar"
        )
      );

      // No mostrar nivel ni tipo de complejidad.
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
          : row.habilitacion_sanitaria === "no_habilitado"
            ? "No habilitado (documentado)"
            : "Sin verificar"
      );

      line(card, "Atención", value(s, "operatividad"));
      line(card, "Accesibilidad", value(s, "accesibilidad"));
      line(card, "Energía", value(s, "energia"));

      if (s) {
        line(
          card,
          "Verificado hasta",
          new Date(s.verificado_hasta)
            .toLocaleString("es-AR")
        );
      } else {
        line(
          card,
          "Actualización",
          "Sin verificación vigente"
        );
      }

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
        const a = node(
          "a",
          null,
          "📍 Ver ubicación en el mapa ↗"
        );

        a.href =
          "https://www.openstreetmap.org/" +
          "?mlat=" + lat +
          "&mlon=" + lon +
          "#map=16/" + lat + "/" + lon;

        a.target = "_blank";
        a.rel = "noopener noreferrer";
        card.append(a);
      }

      list.append(card);
    }

    summary.textContent = rowsCache.length
      ? `${found} de ${rowsCache.length} establecimientos visibles.`
      : "";

    if (rowsCache.length && !found) {
      list.append(
        node(
          "p",
          "care-empty",
          "No hay establecimientos con ese estado registrado."
        )
      );
    }
  }

  async function load() {
    const api = window.AlertaSalud;
    const status = $("careStatus");
    const list = $("careList");

    if (!api || !status || !list) return;

    const token = ++serial;
    const city = api.getLocalidad();

    rowsCache = [];
    list.replaceChildren();
    $("careSummary").textContent = "";

    status.textContent =
      "Consultando establecimientos de " + city + "…";

    try {
      const query =
        "select=id,nombre,direccion,localidad," +
        "latitud,longitud,habilitacion_sanitaria," +
        "estado_actual(" +
        "operatividad,accesibilidad,energia," +
        "validado,verificado_hasta)" +
        "&activo=eq.true" +
        "&localidad=eq." + encodeURIComponent(city) +
        "&order=nombre.asc";

      const rows = await api.fetchPublic(
        "centros_asistenciales",
        query
      );

      if (token !== serial) return;

      rowsCache = rows;

      status.textContent = rows.length
        ? `${rows.length} establecimiento(s) registrados en ${city}. ` +
          "Los estados requieren verificación vigente."
        : `Todavía no hay establecimientos incorporados para ${city}. ` +
          "Esto no significa que no existan centros sanitarios.";

      render();

    } catch (error) {
      if (token !== serial) return;

      status.textContent =
        "No se pudo consultar el directorio. " +
        "No es posible confirmar disponibilidad asistencial.";

      console.warn("Directorio sanitario", error);
    }
  }

  $("careFilter")?.addEventListener("change", render);

  document.addEventListener("alerta:view", event => {
    if (event.detail.view === "mapa") load();
  });

  document.addEventListener("alerta:localidad", () => {
    if ($("view-mapa")?.classList.contains("active")) {
      load();
    }
  });

  if ($("view-mapa")?.classList.contains("active")) {
    load();
  }
})();
