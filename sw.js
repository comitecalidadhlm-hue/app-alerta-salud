
/*
 * APP ALERTA SALUD V1.9.4
 * Service Worker
 */

const CACHE = "alerta-salud-v1-9-4";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./map.js",
  "./care.js",
  "./institucional.js",
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

  // No interceptar APIs externas ni Supabase.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Las navegaciones usan primero la red.
  // Si no hay conexión, se usa el HTML
  // previamente almacenado.
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

  // Recursos locales: red primero,
  // caché como respaldo.
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
