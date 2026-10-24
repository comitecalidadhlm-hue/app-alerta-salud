
/*
 * APP ALERTA SALUD V1.10.0
 * Suscripciones Web Push
 *
 * Requiere:
 * - Clave pública VAPID
 * - Endpoint HTTPS seguro de suscripciones
 *
 * La clave privada VAPID nunca debe
 * incluirse en el frontend.
 */

(() => {
  "use strict";

  const CONFIG = window.ALERTA_PUSH || {};

  const PUBLIC_KEY = CONFIG.publicKey || "";
  const ENDPOINT = CONFIG.subscriptionEndpoint || "";

  const state = {
    registration: null,
    subscription: null,
    busy: false
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
    return (
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function configured() {
    if (!PUBLIC_KEY || !ENDPOINT) return false;

    try {
      const url = new URL(ENDPOINT);

      return (
        url.protocol === "https:" &&
        /^[A-Za-z0-9_-]+$/.test(PUBLIC_KEY)
      );
    } catch {
      return false;
    }
  }

  function decodeKey(base64url) {
    const padding =
      "=".repeat((4 - base64url.length % 4) % 4);

    const base64 = (
      base64url
        .replace(/-/g, "+")
        .replace(/_/g, "/") +
      padding
    );

    const binary = atob(base64);

    return Uint8Array.from(
      binary,
      char => char.charCodeAt(0)
    );
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

  async function sendSubscription(subscription) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "subscribe",
        subscription: subscription.toJSON()
      }),
      credentials: "omit",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        "No se pudo registrar la suscripción " +
        "en el servidor."
      );
    }

    return response;
  }

  async function removeSubscription(subscription) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "unsubscribe",
        endpoint: subscription.endpoint
      }),
      credentials: "omit",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        "No se pudo dar de baja la suscripción " +
        "en el servidor."
      );
    }

    return response;
  }

  async function subscribe() {
    if (!configured()) {
      throw new Error(
        "El servicio push todavía no está configurado."
      );
    }

    const reg = await registration();

    let subscription =
      await reg.pushManager.getSubscription();

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
      await sendSubscription(subscription);
    } catch (error) {
      // Evita dejar una suscripción local
      // que el servidor no conoce.
      await subscription.unsubscribe().catch(() => {});
      throw error;
    }

    state.subscription = subscription;

    return subscription;
  }

  async function unsubscribe() {
    if (!configured()) {
      throw new Error(
        "El servicio push no está configurado."
      );
    }

    const subscription = await refresh();

    if (!subscription) return;

    // Primero se elimina en el servidor.
    await removeSubscription(subscription);

    // Después se elimina del navegador.
    await subscription.unsubscribe();

    state.subscription = null;
  }

  function mount() {
    const parent = document.querySelector(
      ".as-notifications"
    );

    if (!parent || document.getElementById(
      "asPushPreferences"
    )) {
      return;
    }

    const section = element("section");
    section.id = "asPushPreferences";

    section.style.cssText = [
      "margin:16px 0",
      "padding:16px",
      "border:1px solid #d5e0e9",
      "border-radius:12px"
    ].join(";");

    const heading = element(
      "h3",
      "🔔 Avisos en tu dispositivo"
    );

    const description = element(
      "p",
      "Recibí comunicaciones oficiales " +
      "de los establecimientos asistenciales."
    );

    const status = element("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const button = element("button");
    button.type = "button";
    button.className = "secondary";

    section.append(
      heading,
      description,
      status
    );

    if (!supported()) {
      status.textContent =
        "Este navegador o modo de instalación " +
        "no admite notificaciones push.";

      parent.append(section);
      return;
    }

    if (!configured()) {
      status.textContent =
        "La recepción de avisos push está " +
        "en preparación. Las comunicaciones " +
        "oficiales siguen disponibles " +
        "en este Centro de Notificaciones.";

      parent.append(section);
      return;
    }

    section.append(button);
    parent.append(section);

    async function update() {
      try {
        const subscription = await refresh();

        if (subscription) {
          status.textContent =
            "Notificaciones activadas en este dispositivo.";

          button.textContent =
            "Desactivar notificaciones";
        } else {
          status.textContent =
            "Las notificaciones están desactivadas.";

          button.textContent =
            "Activar notificaciones";
        }
      } catch (error) {
        status.textContent = error.message;
      }
    }

    button.addEventListener(
      "click",
      async () => {
        if (state.busy) return;

        state.busy = true;
        button.disabled = true;

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
          state.busy = false;
          button.disabled = false;
        }
      }
    );

    update();
  }

  // El módulo de notificaciones se carga
  // antes que este archivo.
  mount();

  window.AlertaSaludPush = Object.freeze({
    supported,
    configured,
    refresh
  });
})();
