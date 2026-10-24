
/*
 * APP ALERTA SALUD V1.9.6
 * Service Worker
 */

const CACHE = "alerta-salud-v1-9-6";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./map.js",
  "./care.js",
  "./institucional.js",
  "./notificaciones.js",
  "./navegacion.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(ASSETS)
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("alerta-salud-") &&
            key !== CACHE
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
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
      fetch(request).catch(async () => {
        return (
          await caches.match("./index.html")
        ) || Response.error();
      })
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
      .catch(async () => {
        return (
          await caches.match(request)
        ) || Response.error();
      })
  );
});
