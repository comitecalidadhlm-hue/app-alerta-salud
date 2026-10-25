/*
 * APP ALERTA SALUD V1.10.20
 * MODO EMERGENCIA GLOBAL
 *
 * Solo presenta publicaciones oficiales vigentes
 * cuya prioridad sea exactamente "critica".
 * No genera publicaciones ni envios.
 */
(() => {
  "use strict";
  const cfg = window.ALERTA_SUPABASE;
  if (!cfg?.url || !cfg?.publishableKey) return;

  const POLL_MS = 60000;
  const DISMISS_PREFIX = "as-emergencia-reconocida:";
  const MAX_TEXT = 3000;
  let busy = false;
  let currentId = null;
  let previousFocus = null;
  let lastRecords = [];
  let active = false;

  const root = document.createElement("section");
  root.id = "asEmergencyOverlay";
  root.className = "as-emergency";
  root.hidden = true;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "asEmergencyTitle");
  root.setAttribute("aria-describedby", "asEmergencyDescription");
  root.innerHTML = `
    <div class="as-emergency-shell">
      <header class="as-emergency-header">
        <div class="as-emergency-eyebrow">⚠ ALERTA SANITARIA CRÍTICA</div>
        <h1 id="asEmergencyTitle"></h1>
        <p id="asEmergencyCenter"></p>
      </header>
      <main class="as-emergency-body">
        <div class="as-emergency-icon" aria-hidden="true">⚠</div>
        <h2>Información de seguridad</h2>
        <p id="asEmergencyDescription" class="as-emergency-description"></p>
        <section class="as-emergency-instructions" aria-labelledby="asEmergencyInstructionsTitle">
          <h3 id="asEmergencyInstructionsTitle">Indicaciones oficiales</h3>
          <p id="asEmergencyInstructions"></p>
        </section>
        <p class="as-emergency-meta" id="asEmergencyMeta"></p>
        <p class="as-emergency-disclaimer">
          Información institucional. Ante una urgencia, utilizá los canales oficiales de asistencia.
        </p>
      </main>
      <footer class="as-emergency-footer">
        <button id="asEmergencyAcknowledge" type="button">Entendido · Volver a la aplicación</button>
        <button id="asEmergencyNext" type="button" hidden>Ver otra alerta crítica</button>
      </footer>
    </div>
  `;
  document.body.append(root);

  const el = id => document.getElementById(id);
  const acknowledge = el("asEmergencyAcknowledge");
  const next = el("asEmergencyNext");
  const safe = v => typeof v === "string" ? v.slice(0, MAX_TEXT) : "";
  const isCurrent = (item, now) => {
    if (item?.publicado !== true || item?.es_prueba !== false || item?.prioridad !== "critica") return false;
    const start = Date.parse(item.vigente_desde);
    if (!Number.isFinite(start) || start > now) return false;
    if (item.vigente_hasta) {
      const end = Date.parse(item.vigente_hasta);
      if (!Number.isFinite(end) || end <= now) return false;
    }
    return true;
  };
  const acknowledged = id => {
    try { return sessionStorage.getItem(DISMISS_PREFIX + id) === "1"; }
    catch { return false; }
  };
  const remember = id => {
    try { sessionStorage.setItem(DISMISS_PREFIX + id, "1"); }
    catch { /* session storage puede estar bloqueado */ }
  };
  const pending = () => lastRecords.filter(item => !acknowledged(String(item.id)));

  function show(item) {
    if (!item || !isCurrent(item, Date.now())) return;
    currentId = String(item.id);
    if (!active) previousFocus = document.activeElement;
    active = true;
    el("asEmergencyTitle").textContent = safe(item.titulo) || "Alerta sanitaria crítica";
    el("asEmergencyCenter").textContent =
      safe(item.centros_asistenciales?.nombre) || "Establecimiento sanitario";
    el("asEmergencyDescription").textContent = safe(item.descripcion);
    el("asEmergencyInstructions").textContent =
      safe(item.indicaciones) || "Consultá la comunicación oficial y seguí las indicaciones del establecimiento.";
    const date = item.publicado_en ? new Date(item.publicado_en) : null;
    el("asEmergencyMeta").textContent =
      "Publicado: " + (date && Number.isFinite(date.getTime()) ?
        date.toLocaleString("es-AR") : "Fecha no disponible") +
      (item.servicio_afectado ? " · Servicio: " + safe(item.servicio_afectado) : "");
    next.hidden = pending().length <= 1;
    root.hidden = false;
    document.documentElement.classList.add("as-emergency-active");
    document.body.classList.add("as-emergency-active");
    acknowledge.focus({preventScroll:true});
  }

  function hide() {
    root.hidden = true;
    document.documentElement.classList.remove("as-emergency-active");
    document.body.classList.remove("as-emergency-active");
    active = false;
    currentId = null;
    if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
      previousFocus.focus({preventScroll:true});
    }
    previousFocus = null;
  }

  function acknowledgeCurrent() {
    if (currentId) remember(currentId);
    const another = pending()[0];
    if (another) show(another);
    else hide();
  }

  acknowledge.addEventListener("click", acknowledgeCurrent);
  next.addEventListener("click", acknowledgeCurrent);
  root.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      const focusable = [acknowledge, next].filter(button => !button.hidden);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });

  async function refresh() {
    if (busy || document.visibilityState === "hidden") return;
    busy = true;
    try {
      const base = cfg.url.replace(/\/$/, "");
      const query = [
        "select=id,centro_id,titulo,descripcion,indicaciones,servicio_afectado,prioridad,publicado,es_prueba,vigente_desde,vigente_hasta,publicado_en,centros_asistenciales(nombre)",
        "publicado=eq.true",
        "es_prueba=eq.false",
        "prioridad=eq.critica",
        "order=publicado_en.desc",
        "limit=100"
      ].join("&");
      const response = await fetch(base + "/rest/v1/as_notificaciones?" + query, {
        headers: { apikey: cfg.publishableKey, Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Respuesta no válida");
      lastRecords = rows.filter(item => isCurrent(item, Date.now()));
      if (active) {
        const stillCurrent = lastRecords.find(item => String(item.id) === currentId);
        if (!stillCurrent) {
          const another = pending()[0];
          if (another) show(another);
          else hide();
        }
      } else {
        const first = pending()[0];
        if (first) show(first);
      }
    } catch (error) {
      console.warn("Modo emergencia: no se pudieron consultar alertas oficiales", error);
      // Ante un fallo de red no se inventan alarmas.
    } finally {
      busy = false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "AS_CRITICAL_PUSH") refresh();
    });
  }
  window.AlertaSaludEmergencia = Object.freeze({ refresh });
  refresh();
  setInterval(refresh, POLL_MS);
})();
