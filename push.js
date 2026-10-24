
/*
 * APP ALERTA SALUD V1.10.13
 * Configuración Web Push integrada
 *
 * Archivo: push.js
 * Acción: REEMPLAZAR COMPLETO
 *
 * Tres pestañas:
 * - Avisos vigentes
 * - Historial
 * - Configurar avisos
 *
 * Sin módulos ni tarjetas adicionales.
 * TEST_MODE: no registra dispositivos.
 */

(() => {
  "use strict";

  const CONFIG = window.ALERTA_PUSH || {};

  const PUBLIC_KEY = CONFIG.publicKey || "";

  const API = String(
    CONFIG.subscriptionEndpoint || ""
  ).replace(/\/+$/, "");

  const TEST_MODE = true;

  const STORAGE_KEY =
    "alerta_salud_push_device_v1";

  const state = {
    registration: null,
    subscription: null,
    centers: [],
    selected: new Set(),
    initialized: false,
    loading: false,
    mode: "vigentes"
  };

  const $ = id => document.getElementById(id);

  function create(tag, text, className) {
    const node = document.createElement(tag);

    if (text !== undefined) {
      node.textContent = text;
    }

    if (className) {
      node.className = className;
    }

    return node;
  }

  function supported() {
    return Boolean(
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function configured() {
    if (!PUBLIC_KEY || !API) return false;

    try {
      const url = new URL(API);

      return (
        url.protocol === "https:" &&
        /^[A-Za-z0-9_-]+$/.test(PUBLIC_KEY)
      );
    } catch {
      return false;
    }
  }

  function readCredentials() {
    try {
      const raw = localStorage.getItem(
        STORAGE_KEY
      );

      if (!raw) return null;

      const data = JSON.parse(raw);

      if (
        typeof data.subscriptionId !== "string" ||
        typeof data.token !== "string"
      ) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  async function registration() {
    if (!supported()) {
      throw new Error(
        "Este navegador no admite Web Push."
      );
    }

    if (!state.registration) {
      state.registration =
        await navigator.serviceWorker.ready;
    }

    return state.registration;
  }

  async function refresh() {
    const reg = await registration();

    state.subscription =
      await reg.pushManager.getSubscription();

    return state.subscription;
  }

  async function request(path, body) {
    if (!configured()) {
      throw new Error(
        "El servicio de notificaciones no está configurado."
      );
    }

    const response = await fetch(
      API + path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        credentials: "omit",
        cache: "no-store"
      }
    );

    const result = await response.json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
        "No se pudo completar la operación."
      );
    }

    return result;
  }

  async function loadCenters() {
    if (!configured()) {
      throw new Error(
        "El servicio está en preparación."
      );
    }

    const response = await fetch(
      API + "/centers",
      {
        credentials: "omit",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "No se pudo consultar el directorio."
      );
    }

    const result = await response.json();

    state.centers = Array.isArray(
      result.centers
    )
      ? result.centers
      : [];

    return state.centers;
  }

  async function getServerSubscription() {
    const credentials = readCredentials();

    if (!credentials) return null;

    return request(
      "/subscription",
      credentials
    );
  }

  async function savePreferences(centerIds) {
    if (TEST_MODE) {
      throw new Error(
        "El guardado estará disponible al finalizar las pruebas."
      );
    }

    const credentials = readCredentials();

    if (!credentials) {
      throw new Error(
        "Este dispositivo no está registrado."
      );
    }

    return request(
      "/preferences",
      {
        ...credentials,
        centerIds
      }
    );
  }

  function mount() {
    const parent = document.querySelector(
      ".as-notifications"
    );

    const tabs = parent?.querySelector(
      ".as-notification-tabs"
    );

    const current = $("asNotCurrent");
    const history = $("asNotHistory");

    if (
      !parent ||
      !tabs ||
      !current ||
      !history ||
      $("asPushPreferences")
    ) {
      return;
    }

    /*
     * TERCERA PESTAÑA
     */

    const settingsTab = create(
      "button",
      "⚙ Configurar",
      "as-notification-tab"
    );

    settingsTab.type = "button";
    settingsTab.id = "asNotSettings";

    settingsTab.setAttribute(
      "aria-controls",
      "asPushPreferences"
    );

    tabs.append(settingsTab);

    tabs.style.gridTemplateColumns =
      "repeat(3,minmax(0,1fr))";

    tabs.style.gap = "5px";

    for (const button of [
      current,
      history,
      settingsTab
    ]) {
      button.style.minWidth = "0";
      button.style.padding = "10px 3px";
      button.style.fontSize = "11px";
      button.style.whiteSpace = "normal";
      button.style.lineHeight = "1.25";
    }

    /*
     * CONTENIDO DE CONFIGURACIÓN
     *
     * Se utiliza el mismo espacio
     * de los avisos y el historial.
     */

    const panel = create("div");
    panel.id = "asPushPreferences";
    panel.hidden = true;
    panel.style.display = "none";

    panel.style.cssText = [
      "display:none",
      "width:100%",
      "min-width:0",
      "box-sizing:border-box",
      "padding:3px 0 10px"
    ].join(";");

    const title = create(
      "h3",
      "Notificaciones en mi dispositivo"
    );

    title.style.cssText = [
      "font-size:14px",
      "margin:4px 0 7px"
    ].join(";");

    const description = create(
      "p",
      "Seleccioná los establecimientos de los " +
      "que querés recibir avisos oficiales."
    );

    description.style.cssText = [
      "font-size:12px",
      "line-height:1.5",
      "margin:0 0 10px"
    ].join(";");

    const status = create("p");

    status.setAttribute("role", "status");
    status.setAttribute(
      "aria-live",
      "polite"
    );

    status.style.cssText = [
      "font-size:12px",
      "color:#526477",
      "margin:8px 0"
    ].join(";");

    const centersContainer = create("div");

    centersContainer.style.cssText = [
      "display:grid",
      "gap:7px",
      "margin:10px 0"
    ].join(";");

    const buttons = create("div");

    buttons.style.cssText = [
      "display:flex",
      "gap:8px",
      "flex-wrap:wrap",
      "margin-top:12px"
    ].join(";");

    const activateButton = create(
      "button",
      "Activar notificaciones",
      "secondary"
    );

    activateButton.type = "button";
    activateButton.disabled = true;

    const saveButton = create(
      "button",
      "Guardar selección",
      "secondary"
    );

    saveButton.type = "button";
    saveButton.disabled = true;

    buttons.append(
      activateButton,
      saveButton
    );

    panel.append(
      title,
      description,
      status,
      centersContainer,
      buttons
    );

    /*
     * Insertar debajo de las pestañas,
     * dentro del Centro existente.
     */

    tabs.insertAdjacentElement(
      "afterend",
      panel
    );

    /*
     * Elementos existentes:
     * se ocultan solamente cuando
     * se abre Configurar.
     */

    const regularContent = [
      parent.querySelector(
        ".as-notification-filters"
      ),
      parent.querySelector(
        ".as-notification-actions"
      ),
      $("asNotStatus"),
      $("asNotList"),
      parent.querySelector(
        ".as-notification-disclaimer"
      )
    ].filter(Boolean);

    /*
     * Por seguridad, no modificamos
     * la lógica de consulta de avisos.
     */

    function showRegularContent(show) {
      for (const node of regularContent) {
        node.hidden = !show;

        if (show) {
          node.style.removeProperty(
            "display"
          );
        } else {
          node.style.setProperty(
            "display",
            "none"
          );
        }
      }
    }

    function setMode(mode) {
      state.mode = mode;

      const isSettings =
        mode === "configurar";

      panel.hidden = !isSettings;
      panel.style.display =
        isSettings ? "block" : "none";

      showRegularContent(!isSettings);

      settingsTab.classList.toggle(
        "selected",
        isSettings
      );

      if (isSettings) {
        current.classList.remove(
          "selected"
        );

        history.classList.remove(
          "selected"
        );
      }

      settingsTab.setAttribute(
        "aria-pressed",
        String(isSettings)
      );
    }

    /*
     * RENDERIZAR ESTABLECIMIENTOS
     */

    function renderCenters() {
      centersContainer.replaceChildren();

      if (!state.centers.length) {
        centersContainer.append(
          create(
            "p",
            "No hay establecimientos disponibles."
          )
        );
        return;
      }

      for (const center of state.centers) {
        const label = create("label");

        label.style.cssText = [
          "display:flex",
          "align-items:center",
          "gap:9px",
          "padding:10px",
          "border:1px solid #dbe4ec",
          "border-radius:8px",
          "width:100%",
          "box-sizing:border-box",
          "font-size:12px",
          "cursor:pointer"
        ].join(";");

        const checkbox = create("input");

        checkbox.type = "checkbox";
        checkbox.value = String(
          center.id
        );

        checkbox.checked =
          state.selected.has(
            Number(center.id)
          );

        checkbox.addEventListener(
          "change",
          () => {
            const id = Number(
              center.id
            );

            if (checkbox.checked) {
              state.selected.add(id);
            } else {
              state.selected.delete(id);
            }
          }
        );

        const name = create(
          "span",
          center.nombre
        );

        name.style.minWidth = "0";
        name.style.overflowWrap =
          "anywhere";

        label.append(
          checkbox,
          name
        );

        centersContainer.append(label);
      }
    }

    /*
     * ABRIR CONFIGURACIÓN
     */

    settingsTab.addEventListener(
      "click",
      async () => {
        setMode("configurar");

        if (
          state.initialized ||
          state.loading
        ) {
          return;
        }

        state.loading = true;

        status.textContent =
          "Consultando establecimientos...";

        try {
          await loadCenters();

          renderCenters();

          if (!supported()) {
            status.textContent =
              "Este navegador no admite notificaciones Web Push.";
            buttons.hidden = true;
          } else if (TEST_MODE) {
            status.textContent =
              "La activación está en preparación. " +
              "Podés consultar los establecimientos disponibles.";
          } else {
            const server =
              await getServerSubscription();

            if (server?.active) {
              state.selected = new Set(
                server.centerIds || []
              );

              renderCenters();
            }
          }

          state.initialized = true;

        } catch (error) {
          status.textContent =
            error.message;
        } finally {
          state.loading = false;
        }
      }
    );

    /*
     * VOLVER A AVISOS O HISTORIAL
     *
     * Sus eventos originales siguen
     * funcionando en notificaciones.js.
     */

    current.addEventListener(
      "click",
      () => setMode("vigentes")
    );

    history.addEventListener(
      "click",
      () => setMode("historial")
    );

    /*
     * Cuando otra parte de la aplicación
     * selecciona una pestaña original,
     * sincronizamos la vista.
     *
     * Esto incluye los accesos del menú
     * Más > Notificaciones / Historial.
     */

    const observer = new MutationObserver(
      () => {
        if (
          current.classList.contains(
            "selected"
          ) &&
          state.mode === "configurar"
        ) {
          setMode("vigentes");
        } else if (
          history.classList.contains(
            "selected"
          ) &&
          state.mode === "configurar"
        ) {
          setMode("historial");
        }
      }
    );

    observer.observe(current, {
      attributes: true,
      attributeFilter: ["class"]
    });

    observer.observe(history, {
      attributes: true,
      attributeFilter: ["class"]
    });

    /*
     * MODO DE PRUEBA
     *
     * No se ejecutan altas, bajas
     * ni modificaciones de suscripciones.
     */

    activateButton.addEventListener(
      "click",
      () => {
        if (TEST_MODE) return;
      }
    );

    saveButton.addEventListener(
      "click",
      async () => {
        if (TEST_MODE) return;

        try {
          await savePreferences(
            [...state.selected]
          );

          status.textContent =
            "Preferencias guardadas.";
        } catch (error) {
          status.textContent =
            error.message;
        }
      }
    );

    setMode("vigentes");
  }

  mount();

  window.AlertaSaludPush = Object.freeze({
    supported,
    configured,
    refresh,
    loadCenters,
    getServerSubscription
  });
})();
