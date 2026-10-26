
/*
 * APP ALERTA SALUD V1.10.22
 * Service Worker + Web Push
 */

"use strict";

const CACHE = "alerta-salud-v1-11-4-territorial";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./map.js",
  "./care.js",
  "./inicio.js",
  "./institucional.js",
  "./notificaciones.js",
  "./navegacion.js",
  "./push.js",
  "./emergencia.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("alerta-salud-") &&
              key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match("./index.html")) ||
        Response.error()
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          event.waitUntil(
            caches.open(CACHE).then(cache =>
              cache.put(request, copy)
            )
          );
        }

        return response;
      })
      .catch(async () =>
        (await caches.match(request)) ||
        Response.error()
      )
  );
});

/*
 * Recepción de avisos Web Push.
 *
 * El servidor debe enviar JSON con:
 * title, body, url, tag y notification_id.
 */

self.addEventListener("push", event => {
  let payload = {};

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    payload = {};
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    payload = {};
  }

  const title =
    typeof payload.title === "string" &&
    payload.title.trim()
      ? payload.title.slice(0, 120)
      : "Alerta Salud";

  const body =
    typeof payload.body === "string"
      ? payload.body.slice(0, 300)
      : "Hay una nueva comunicación institucional.";

  const origin = self.location.origin;

  let destination = new URL("./", self.registration.scope);

  try {
    if (typeof payload.url === "string") {
      const candidate = new URL(
        payload.url,
        self.registration.scope
      );

      if (
        candidate.origin === origin &&
        candidate.pathname.startsWith(
          new URL(self.registration.scope).pathname
        )
      ) {
        destination = candidate;
      }
    }
  } catch {
    // Se mantiene la URL segura de la aplicación.
  }

  const tag =
    typeof payload.tag === "string"
      ? payload.tag.slice(0, 100)
      : "alerta-salud";

  const isCritical = payload.prioridad === "critica";
  event.waitUntil(
    (async () => {
      if (isCritical) {
        const clients = await self.clients.matchAll({
          type: "window", includeUncontrolled: true
        });
        await Promise.all(clients.map(client =>
          client.postMessage({type:"AS_CRITICAL_PUSH"})
        ));
      }
      return self.registration.showNotification(title, {
      body,
      icon: "./icon.svg",
      badge: "./icon.svg",
      tag,
      renotify: false,
      requireInteraction: isCritical,
      data: {
        url: destination.href,
        notification_id:
          payload.notification_id || null
      }
      });
    })()
  );
});

/*
 * Apertura del aviso al tocar la notificación.
 */

self.addEventListener(
  "notificationclick",
  event => {
    event.notification.close();

    const fallback = new URL(
      "./",
      self.registration.scope
    ).href;

    let destination = fallback;

    try {
      const candidate = new URL(
        event.notification.data?.url || fallback
      );

      if (
        candidate.origin === self.location.origin &&
        candidate.pathname.startsWith(
          new URL(self.registration.scope).pathname
        )
      ) {
        destination = candidate.href;
      }
    } catch {
      destination = fallback;
    }

    event.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });

        for (const client of windows) {
          if (
            client.url.startsWith(
              self.registration.scope
            )
          ) {
            await client.navigate(destination);

            if (client.focus) {
              await client.focus();
            }

            return;
          }
        }

        if (self.clients.openWindow) {
          await self.clients.openWindow(destination);
        }
      })()
    );
  }
);

self.addEventListener(
  "pushsubscriptionchange",
  event => {
    // La renovación de la suscripción requiere
    // sincronización con el backend.
    // No se genera una suscripción huérfana.
    event.waitUntil(Promise.resolve());
  }
);
