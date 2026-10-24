
/*
 * APP ALERTA SALUD V1.10.9
 * Web Push - Integración compacta
 *
 * Archivo: push.js
 * Acción: REEMPLAZAR COMPLETO
 *
 * La configuración se integra en
 * .as-notification-actions.
 *
 * No modifica publicaciones institucionales.
 * Registro real desactivado hasta completar
 * las pruebas de seguridad.
 */

(() => {
  "use strict";

  const CONFIG = window.ALERTA_PUSH || {};

  const PUBLIC_KEY = CONFIG.publicKey || "";

  const API = (
    CONFIG.subscriptionEndpoint || ""
  ).replace(/\/+$/, "");

  const TEST_MODE = true;

  const STORAGE_KEY =
    "alerta_salud_push_device_v1";

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
      // Se conserva el error HTTP.
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
    const credentials = readCredentials();

    if (!credentials) {
      throw new Error(
        "El dispositivo no está registrado."
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
      const server =
        await getServerSubscription();

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

      subscription =
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            decodeKey(PUBLIC_KEY)
        });
    }

    try {
      const result = await request(
        "/subscribe",
        {
          subscription:
            subscription.toJSON()
        }
      );

      saveCredentials(result);

      state.subscription = subscription;

      return subscription;

    } catch (error) {
      if (error.status !== 409) {
        await subscription
          .unsubscribe()
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
      await request(
        "/unsubscribe",
        credentials
      );

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
      document.getElementById(
        "asPushPreferences"
      )
    ) {
      return;
    }

    /*
     * Se integra dentro de la barra
     * de acciones ya existente.
     */

    const details = element("details");
    details.id = "asPushPreferences";

    details.style.cssText = [
      "width:100%",
      "margin:0",
      "padding:0"
    ].join(";");

    const summary = element(
      "summary",
      "🔔 Configurar avisos"
    );

    summary.style.cssText = [
      "cursor:pointer",
      "font-weight:600",
      "font-size:12px",
      "padding:8px 10px",
      "border:1px solid #c5d4e2",
      "border-radius:8px",
      "background:#eef3f8",
      "color:#16344d"
    ].join(";");

    const content = element("div");

    content.style.cssText = [
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

    const centersContainer =
      element("div");

    centersContainer.style.cssText = [
      "display:grid",
      "gap:6px",
      "margin:10px 0"
    ].join(";");

    const activateButton =
      element(
        "button",
        "Activar notificaciones"
      );

    activateButton.type = "button";
    activateButton.className = "secondary";

    const saveButton =
      element(
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

    details.append(
      summary,
      content
    );

    /*
     * Reutiliza la barra existente.
     * No crea una tarjeta independiente.
     */

    actions.append(details);

    /*
     * Ajuste compacto de la barra.
     * Mantiene el botón de actualización.
     */

    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.alignItems = "flex-start";
    actions.style.gap = "8px";

    details.style.flex = "1 1 150px";

    if (!supported()) {
      status.textContent =
        "Este navegador no admite Web Push.";

      buttons.hidden = true;
      return;
    }

    if (!configured()) {
      status.textContent =
        "Las notificaciones están en preparación.";

      buttons.hidden = true;
      return;
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
          "padding:7px 8px",
          "border:1px solid #e2e8f0",
          "border-radius:7px",
          "font-size:12px",
          "cursor:pointer"
        ].join(";");

        const checkbox =
          document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = String(center.id);

        checkbox.checked =
          state.selected.has(Number(center.id));

        checkbox.addEventListener(
          "change",
          () => {
            const id = Number(center.id);

            if (checkbox.checked) {
              state.selected.add(id);
            } else {
              state.selected.delete(id);
            }
          }
        );

        const name = element(
          "span",
          center.nombre
        );

        label.append(
          checkbox,
          name
        );

        centersContainer.append(label);
      }
    }

    async function update() {
      const subscription = await refresh();
      const credentials = readCredentials();

      if (subscription && credentials) {
        const server =
          await getServerSubscription();

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

    function setBusy(value) {
      state.busy = value;

      activateButton.disabled =
        value || TEST_MODE;

      saveButton.disabled =
        value || TEST_MODE;
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
          status.textContent =
            error.message;
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
          status.textContent =
            error.message;
        } finally {
          setBusy(false);
        }
      }
    );

    let initialized = false;
    let initializing = false;

    details.addEventListener(
      "toggle",
      async () => {
        if (
          !details.open ||
          initialized ||
          initializing
        ) {
          return;
        }

        initializing = true;
        setBusy(true);

        try {
          await loadCenters();

          renderCenters();

          if (TEST_MODE) {
            status.textContent =
              "Vista previa: la activación estará " +
              "disponible después de las pruebas.";
          } else {
            await update();
          }

          initialized = true;

        } catch (error) {
          status.textContent =
            error.message;
        } finally {
          initializing = false;
          setBusy(false);
        }
      }
    );
  }

  mount();

  window.AlertaSaludPush = Object.freeze({
    supported,
    configured,
    refresh,
    loadCenters
  });
})();
