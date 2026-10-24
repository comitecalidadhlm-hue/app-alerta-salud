
/*
 * APP ALERTA SALUD V1.10.15
 * Web Push - Prueba controlada de dispositivos
 *
 * Archivo: push.js
 * Acción: REEMPLAZAR COMPLETO
 *
 * Conserva las tres pestañas.
 * Permite registrar, consultar, renovar,
 * guardar preferencias y dar de baja.
 *
 * No envía notificaciones.
 */

(() => {
  "use strict";

  const CONFIG = window.ALERTA_PUSH || {};

  const PUBLIC_KEY = String(
    CONFIG.publicKey || ""
  );

  const API = String(
    CONFIG.subscriptionEndpoint || ""
  ).replace(/\/+$/, "");

  const STORAGE_KEY =
    "alerta_salud_push_device_v1";

  const state = {
    registration: null,
    centers: [],
    selected: new Set(),
    initialized: false,
    loading: false,
    busy: false,
    mode: "vigentes",
    registered: false
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

  function decodeKey(value) {
    const padded = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(
        Math.ceil(value.length / 4) * 4,
        "="
      );

    return Uint8Array.from(
      atob(padded),
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

    return reg.pushManager.getSubscription();
  }

  async function request(path, body) {
    if (!configured()) {
      throw new Error(
        "El servicio Web Push no está configurado."
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
      const error = new Error(
        result.error ||
        "No se pudo completar la operación."
      );

      error.status = response.status;
      error.code = result.code || "";

      throw error;
    }

    return result;
  }

  async function loadCenters() {
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

  async function subscribe() {
    const reg = await registration();

    const existing = await reg.pushManager
      .getSubscription();

    const credentials = readCredentials();

    /*
     * Si existe una suscripción local
     * sin credencial, no intentamos
     * apropiarnos del endpoint remoto.
     */
    if (existing && !credentials) {
      throw new Error(
        "Este navegador conserva una suscripción " +
        "anterior sin credencial de administración. " +
        "No se modificó por seguridad."
      );
    }

    let subscription = existing;
    let createdLocally = false;

    if (!subscription) {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "No se concedió permiso para recibir avisos."
        );
      }

      subscription =
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(
            PUBLIC_KEY
          )
        });

      createdLocally = true;
    }

    try {
      const payload = {
        subscription: subscription.toJSON()
      };

      if (credentials) {
        payload.subscriptionId =
          credentials.subscriptionId;

        payload.token = credentials.token;
      }

      const result = await request(
        "/subscribe",
        payload
      );

      if (
        !result.subscriptionId ||
        !result.token
      ) {
        throw new Error(
          "El servidor no devolvió las credenciales."
        );
      }

      saveCredentials(result);

      state.registered = true;

      return result;

    } catch (error) {
      /*
       * Nunca damos de baja una
       * suscripción local preexistente
       * ante un error de comunicación.
       */
      if (createdLocally) {
        await subscription.unsubscribe()
          .catch(() => {});
      }

      throw error;
    }
  }

  async function savePreferences(centerIds) {
    const credentials = readCredentials();

    if (!credentials) {
      throw new Error(
        "Primero activá las notificaciones."
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

  async function unsubscribe() {
    const credentials = readCredentials();

    if (!credentials) {
      throw new Error(
        "No hay credenciales para dar de baja el dispositivo."
      );
    }

    /*
     * Primero revocamos el acceso remoto.
     * Después eliminamos la suscripción
     * local y las credenciales.
     */
    await request(
      "/unsubscribe",
      credentials
    );

    clearCredentials();
    state.registered = false;

    const subscription = await refresh();

    if (subscription) {
      await subscription.unsubscribe();
    }
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

    const settingsTab = create(
      "button",
      "⚙ Configurar",
      "as-notification-tab"
    );

    settingsTab.id = "asNotSettings";
    settingsTab.type = "button";

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

    const panel = create("div");

    panel.id = "asPushPreferences";
    panel.hidden = true;

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

    const saveButton = create(
      "button",
      "Guardar selección",
      "secondary"
    );

    saveButton.type = "button";

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

    tabs.insertAdjacentElement(
      "afterend",
      panel
    );

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

    function setBusy(value) {
      state.busy = value;

      activateButton.disabled = value;
      saveButton.disabled =
        value || !state.registered;
    }

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
            const id = Number(center.id);

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

    async function updateStatus() {
      const credentials = readCredentials();

      if (!credentials) {
        state.registered = false;
        activateButton.textContent =
          "Activar notificaciones";

        status.textContent =
          "Notificaciones desactivadas.";

        setBusy(false);
        return;
      }

      try {
        const server =
          await getServerSubscription();

        const local = await refresh();

        if (server?.active && local) {
          state.registered = true;

          state.selected = new Set(
            (server.centerIds || []).map(Number)
          );

          renderCenters();

          activateButton.textContent =
            "Desactivar notificaciones";

          status.textContent =
            "Dispositivo registrado. " +
            "Los envíos de prueba todavía " +
            "no están habilitados.";
        } else {
          state.registered = false;

          status.textContent =
            "La suscripción requiere revisión.";

          activateButton.textContent =
            "Activar notificaciones";
        }
      } catch (error) {
        state.registered = false;

        status.textContent =
          "No se pudo verificar el registro: " +
          error.message;
      }

      setBusy(false);
    }

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
        setBusy(true);

        status.textContent =
          "Consultando establecimientos...";

        try {
          await loadCenters();
          renderCenters();

          if (!supported()) {
            status.textContent =
              "Este navegador no admite Web Push.";

            buttons.hidden = true;
          } else {
            await updateStatus();
          }

          state.initialized = true;
        } catch (error) {
          status.textContent =
            error.message;
        } finally {
          state.loading = false;
          setBusy(false);
        }
      }
    );

    current.addEventListener(
      "click",
      () => setMode("vigentes")
    );

    history.addEventListener(
      "click",
      () => setMode("historial")
    );

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

    activateButton.addEventListener(
      "click",
      async () => {
        if (state.busy) return;

        if (!configured() || !supported()) {
          status.textContent =
            "Web Push no está disponible.";
          return;
        }

        const action = state.registered
          ? "desactivar"
          : "activar";

        const message = action === "activar"
          ? "¿Querés registrar este dispositivo " +
            "para las pruebas de notificaciones? " +
            "Todavía no se enviarán avisos."
          : "¿Querés desactivar las notificaciones " +
            "de este dispositivo?";

        if (!window.confirm(message)) return;

        setBusy(true);

        try {
          if (action === "activar") {
            await subscribe();
          } else {
            await unsubscribe();
          }

          await updateStatus();
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
        if (
          state.busy ||
          !state.registered
        ) {
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

    setMode("vigentes");
    setBusy(false);
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
