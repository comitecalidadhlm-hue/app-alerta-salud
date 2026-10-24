
/*
 * APP ALERTA SALUD V1.10.11
 * Web Push - Configuración integrada y compacta
 *
 * Archivo: push.js
 * Acción: REEMPLAZAR COMPLETO
 *
 * Corrección:
 * - Dos controles en la misma fila.
 * - Configuración desplegable a ancho completo.
 * - Sin tarjetas ni módulos adicionales.
 * - TEST_MODE activo: sin registros reales.
 */

(() => {
  "use strict";

  const CONFIG = window.ALERTA_PUSH || {};
  const PUBLIC_KEY = CONFIG.publicKey || "";
  const API = String(
    CONFIG.subscriptionEndpoint || ""
  ).replace(/\/+$/, "");

  const TEST_MODE = true;
  const STORAGE_KEY = "alerta_salud_push_device_v1";

  const state = {
    registration: null,
    subscription: null,
    busy: false,
    centers: [],
    selected: new Set()
  };

  function element(tag, text, className) {
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

  function decodeKey(value) {
    const padding = "=".repeat(
      (4 - value.length % 4) % 4
    );

    const binary = atob(
      value.replace(/-/g, "+")
        .replace(/_/g, "/") +
      padding
    );

    return Uint8Array.from(
      binary,
      char => char.charCodeAt(0)
    );
  }

  function readCredentials() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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

  function saveCredentials(data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        subscriptionId: data.subscriptionId,
        token: data.token
      })
    );
  }

  function clearCredentials() {
    localStorage.removeItem(STORAGE_KEY);
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

  async function request(path, data) {
    const response = await fetch(
      `${API}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        credentials: "omit",
        cache: "no-store"
      }
    );

    let result = {};

    try {
      result = await response.json();
    } catch {
      // Conservamos el estado HTTP.
    }

    if (!response.ok) {
      const error = new Error(
        result.error ||
        "No se pudo completar la operación."
      );

      error.status = response.status;
      error.code = result.code;

      throw error;
    }

    return result;
  }

  async function loadCenters() {
    const response = await fetch(
      `${API}/centers`,
      {
        credentials: "omit",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "No se pudo cargar el directorio."
      );
    }

    const result = await response.json();

    state.centers = Array.isArray(result.centers)
      ? result.centers
      : [];

    return state.centers;
  }

  async function getServerSubscription() {
    const credentials = readCredentials();

    if (!credentials) return null;

    return request("/subscription", credentials);
  }

  async function savePreferences(centerIds) {
    const credentials = readCredentials();

    if (!credentials) {
      throw new Error(
        "El dispositivo no está registrado."
      );
    }

    return request("/preferences", {
      ...credentials,
      centerIds
    });
  }

  async function subscribe() {
    if (TEST_MODE) {
      throw new Error(
        "El registro continúa en preparación."
      );
    }

    if (!configured()) {
      throw new Error(
        "El servicio push no está configurado."
      );
    }

    const reg = await registration();

    let subscription =
      await reg.pushManager.getSubscription();

    const credentials = readCredentials();

    if (subscription && credentials) {
      const server = await getServerSubscription();

      if (server?.active) {
        state.subscription = subscription;
        return subscription;
      }
    }

    if (subscription && !credentials) {
      throw new Error(
        "Existe una suscripción anterior sin credencial."
      );
    }

    if (!subscription) {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "No se otorgó permiso para recibir avisos."
        );
      }

      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(PUBLIC_KEY)
      });
    }

    try {
      const result = await request("/subscribe", {
        subscription: subscription.toJSON()
      });

      saveCredentials(result);
      state.subscription = subscription;

      return subscription;
    } catch (error) {
      if (error.status !== 409) {
        await subscription.unsubscribe()
          .catch(() => {});
      }

      throw error;
    }
  }

  async function unsubscribe() {
    if (TEST_MODE) {
      throw new Error(
        "La gestión de dispositivos está en preparación."
      );
    }

    const subscription = await refresh();
    const credentials = readCredentials();

    if (credentials) {
      await request("/unsubscribe", credentials);
      clearCredentials();
    } else if (subscription) {
      throw new Error(
        "No se puede cancelar el registro remoto sin credencial."
      );
    }

    if (subscription) {
      await subscription.unsubscribe();
    }

    state.subscription = null;
  }

  function mount() {
    const parent = document.querySelector(
      ".as-notifications"
    );

    const actions = parent?.querySelector(
      ".as-notification-actions"
    );

    if (
      !parent ||
      !actions ||
      document.getElementById("asPushPreferences")
    ) {
      return;
    }

    const reloadButton = actions.querySelector(
      "#asNotReload"
    );

    if (!reloadButton) return;

    /*
     * Estructura:
     *
     * .as-notification-actions
     *   ├─ #asNotReload
     *   ├─ #asPushToggle
     *   └─ #asPushPreferences (fila completa)
     *
     * No se usa display:contents ni details.
     */

    actions.style.display = "grid";
    actions.style.gridTemplateColumns =
      "minmax(0,1fr) minmax(0,1fr)";
    actions.style.columnGap = "8px";
    actions.style.rowGap = "0";
    actions.style.alignItems = "start";

    reloadButton.style.width = "100%";
    reloadButton.style.minWidth = "0";
    reloadButton.style.minHeight = "38px";
    reloadButton.style.margin = "0";
    reloadButton.style.padding = "8px 5px";
    reloadButton.style.fontSize = "11px";

    const toggleButton = element(
      "button",
      "🔔 Configurar avisos"
    );

    toggleButton.id = "asPushToggle";
    toggleButton.type = "button";
    toggleButton.className = "secondary";

    toggleButton.style.cssText = [
      "width:100%",
      "min-width:0",
      "min-height:38px",
      "margin:0",
      "padding:8px 5px",
      "font-size:11px",
      "text-align:center"
    ].join(";");

    toggleButton.setAttribute(
      "aria-expanded",
      "false"
    );

    toggleButton.setAttribute(
      "aria-controls",
      "asPushPreferences"
    );

    const content = element("div");
    content.id = "asPushPreferences";
    content.hidden = true;

    content.style.cssText = [
      "grid-column:1 / -1",
      "width:100%",
      "min-width:0",
      "box-sizing:border-box",
      "padding:10px 0 2px",
      "font-size:12px"
    ].join(";");

    const description = element(
      "p",
      "Elegí los establecimientos de los " +
      "que deseás recibir avisos oficiales."
    );

    description.style.margin = "0 0 8px";

    const status = element("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    status.style.cssText = [
      "font-size:12px",
      "margin:8px 0",
      "color:#526477"
    ].join(";");

    const centersContainer = element("div");

    centersContainer.style.cssText = [
      "display:grid",
      "gap:6px",
      "margin:10px 0"
    ].join(";");

    const activateButton = element(
      "button",
      "Activar notificaciones"
    );

    activateButton.type = "button";
    activateButton.className = "secondary";

    const saveButton = element(
      "button",
      "Guardar selección"
    );

    saveButton.type = "button";
    saveButton.className = "secondary";

    const buttons = element("div");

    buttons.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "gap:8px",
      "margin-top:10px"
    ].join(";");

    buttons.append(
      activateButton,
      saveButton
    );

    content.append(
      description,
      status,
      centersContainer,
      buttons
    );

    actions.append(toggleButton, content);

    /*
     * La configuración empieza cerrada.
     * El atributo hidden mantiene la segunda
     * fila fuera de la distribución.
     */

    let opened = false;
    let initialized = false;
    let initializing = false;

    function syncVisibility() {
      content.hidden = !opened;

      toggleButton.setAttribute(
        "aria-expanded",
        String(opened)
      );

      toggleButton.textContent = opened
        ? "🔔 Ocultar configuración"
        : "🔔 Configurar avisos";
    }

    function setBusy(value) {
      state.busy = value;

      activateButton.disabled =
        value || TEST_MODE;

      saveButton.disabled =
        value || TEST_MODE;
    }

    function renderCenters() {
      centersContainer.replaceChildren();

      if (!state.centers.length) {
        centersContainer.append(
          element(
            "p",
            "No hay establecimientos disponibles."
          )
        );
        return;
      }

      for (const center of state.centers) {
        const label = element("label");

        label.style.cssText = [
          "display:flex",
          "align-items:center",
          "gap:8px",
          "padding:9px 10px",
          "border:1px solid #e2e8f0",
          "border-radius:7px",
          "font-size:12px",
          "cursor:pointer",
          "width:100%",
          "box-sizing:border-box"
        ].join(";");

        const checkbox = element("input");
        checkbox.type = "checkbox";
        checkbox.value = String(center.id);

        checkbox.checked = state.selected.has(
          Number(center.id)
        );

        checkbox.addEventListener("change", () => {
          const id = Number(center.id);

          if (checkbox.checked) {
            state.selected.add(id);
          } else {
            state.selected.delete(id);
          }
        });

        const name = element(
          "span",
          center.nombre
        );

        name.style.minWidth = "0";
        name.style.overflowWrap = "anywhere";

        label.append(checkbox, name);
        centersContainer.append(label);
      }
    }

    async function update() {
      const subscription = await refresh();
      const credentials = readCredentials();

      if (subscription && credentials) {
        const server = await getServerSubscription();

        if (server?.active) {
          state.selected = new Set(
            server.centerIds || []
          );

          renderCenters();

          activateButton.textContent =
            "Desactivar notificaciones";

          status.textContent =
            "Dispositivo registrado.";

          return;
        }
      }

      activateButton.textContent =
        "Activar notificaciones";

      status.textContent =
        "Notificaciones desactivadas.";
    }

    activateButton.addEventListener(
      "click",
      async () => {
        if (state.busy || TEST_MODE) return;

        setBusy(true);

        try {
          const current = await refresh();

          if (current) {
            await unsubscribe();
          } else {
            await subscribe();
          }

          await update();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          setBusy(false);
        }
      }
    );

    saveButton.addEventListener(
      "click",
      async () => {
        if (state.busy || TEST_MODE) return;

        setBusy(true);

        try {
          await savePreferences(
            [...state.selected]
          );

          status.textContent =
            "Selección guardada.";
        } catch (error) {
          status.textContent = error.message;
        } finally {
          setBusy(false);
        }
      }
    );

    toggleButton.addEventListener(
      "click",
      async () => {
        opened = !opened;
        syncVisibility();

        if (
          !opened ||
          initialized ||
          initializing
        ) {
          return;
        }

        initializing = true;
        setBusy(true);

        try {
          if (!configured()) {
            throw new Error(
              "El servicio push está en preparación."
            );
          }

          await loadCenters();
          renderCenters();

          if (!supported()) {
            status.textContent =
              "Este navegador no admite Web Push.";
            buttons.hidden = true;
          } else if (TEST_MODE) {
            status.textContent =
              "Vista previa: la activación estará " +
              "disponible después de las pruebas.";
          } else {
            await update();
          }

          initialized = true;
        } catch (error) {
          status.textContent = error.message;
          buttons.hidden = true;
        } finally {
          initializing = false;
          setBusy(false);
        }
      }
    );

    syncVisibility();
    setBusy(false);
  }

  mount();

  window.AlertaSaludPush = Object.freeze({
    supported,
    configured,
    refresh,
    loadCenters
  });
})();
