
/*
 * APP ALERTA SALUD V1.10.7
 * Gestión de suscripciones Web Push
 *
 * Archivo: push.js
 * Acción: REEMPLAZAR COMPLETO
 *
 * Requiere:
 * window.ALERTA_PUSH.publicKey
 * window.ALERTA_PUSH.subscriptionEndpoint
 *
 * Seguridad:
 * - Nunca almacena claves privadas VAPID.
 * - Guarda la credencial individual en el navegador.
 * - No registra dispositivos mientras TEST_MODE sea true.
 */

(() => {
  "use strict";

  const CONFIG = window.ALERTA_PUSH || {};

  const PUBLIC_KEY = CONFIG.publicKey || "";

  const API = (
    CONFIG.subscriptionEndpoint || ""
  ).replace(/\/+$/, "");

  // Mantener en true hasta completar las pruebas
  // y los controles de seguridad del backend.
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
    if (!PUBLIC_KEY || !API) {
      return false;
    }

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
      value
        .replace(/-/g, "+")
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
      // Se informa el error HTTP.
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
        "Este dispositivo no tiene una credencial de registro."
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
        "El registro de dispositivos aún está en pruebas."
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
        "Existe una suscripción anterior sin credencial. " +
        "Es necesario recuperarla de forma segura antes de continuar."
      );
    }

    if (!subscription) {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "No se otorgó permiso para recibir notificaciones."
        );
      }

      subscription =
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            decodeKey(PUBLIC_KEY)
        });
    }

    let created = false;

    try {
      const result = await request(
        "/subscribe",
        {
          subscription:
            subscription.toJSON()
        }
      );

      saveCredentials(result);
      created = true;

      state.subscription = subscription;

      return subscription;

    } catch (error) {
      if (!created && error.status !== 409) {
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
        "La gestión de dispositivos aún está en pruebas."
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
        "No se puede cancelar el registro remoto sin su credencial."
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

    if (
      !parent ||
      document.getElementById(
        "asPushPreferences"
      )
    ) {
      return;
    }

    const section = element("section");
    section.id = "asPushPreferences";

    section.style.cssText = [
      "margin:16px 0",
      "padding:18px",
      "border:1px solid #d5e0e9",
      "border-radius:12px",
      "background:var(--card,#fff)"
    ].join(";");

    const heading = element(
      "h3",
      "🔔 Avisos en tu dispositivo"
    );

    const description = element(
      "p",
      "Elegí los establecimientos de los que " +
      "deseás recibir comunicaciones oficiales."
    );

    const status = element("p");
    status.setAttribute("role", "status");
    status.setAttribute(
      "aria-live",
      "polite"
    );

    const centersContainer =
      element("div");

    centersContainer.style.cssText = [
      "display:grid",
      "gap:10px",
      "margin:14px 0"
    ].join(";");

    const activateButton =
      element("button");

    activateButton.type = "button";
    activateButton.className = "secondary";
    activateButton.textContent =
      "Activar notificaciones";

    const saveButton = element(
      "button",
      "Guardar establecimientos"
    );

    saveButton.type = "button";
    saveButton.className = "secondary";

    saveButton.style.marginLeft = "8px";

    const buttons = element("div");

    buttons.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "gap:8px"
    ].join(";");

    buttons.append(
      activateButton,
      saveButton
    );

    section.append(
      heading,
      description,
      status
    );

    parent.append(section);

    if (!supported()) {
      status.textContent =
        "Este navegador no admite notificaciones Web Push.";
      return;
    }

    if (!configured()) {
      status.textContent =
        "La recepción de avisos push está en preparación. " +
        "Las comunicaciones oficiales siguen disponibles " +
        "en el Centro de Notificaciones.";
      return;
    }

    section.append(
      centersContainer,
      buttons
    );

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
          "gap:10px",
          "padding:10px",
          "border:1px solid #e2e8f0",
          "border-radius:8px",
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
            "Dispositivo registrado. " +
            "Seleccioná los establecimientos " +
            "y guardá tus preferencias.";

          return;
        }
      }

      activateButton.textContent =
        "Activar notificaciones";

      status.textContent =
        TEST_MODE
          ? "Vista previa: la selección está disponible, " +
            "pero el registro de dispositivos aún no está habilitado."
          : "Las notificaciones están desactivadas.";
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
        if (state.busy || TEST_MODE) {
          return;
        }

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
        if (state.busy || TEST_MODE) {
          return;
        }

        setBusy(true);

        try {
          await savePreferences(
            [...state.selected]
          );

          status.textContent =
            "Preferencias guardadas correctamente.";

        } catch (error) {
          status.textContent =
            error.message;
        } finally {
          setBusy(false);
        }
      }
    );

    async function initialize() {
      setBusy(true);

      try {
        await loadCenters();

        renderCenters();

        if (TEST_MODE) {
          status.textContent =
            "Vista previa de establecimientos. " +
            "La activación de notificaciones " +
            "estará disponible después de las pruebas.";
        } else {
          await update();
        }

      } catch (error) {
        status.textContent =
          error.message;
      } finally {
        setBusy(false);
      }
    }

    initialize();
  }

  mount();

  window.AlertaSaludPush = Object.freeze({
    supported,
    configured,
    refresh,
    loadCenters
  });
})();
