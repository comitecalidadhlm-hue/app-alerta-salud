
/*
 * APP ALERTA SALUD V1.10.7
 * Configuración y carga de módulos
 *
 * Archivo: supabase-config.js
 * Acción: REEMPLAZAR COMPLETO
 *
 * Cloudflare Workers + Supabase
 *
 * IMPORTANTE:
 * - La clave de Supabase es pública.
 * - La clave VAPID incluida es pública.
 * - Nunca incluir claves privadas o service_role.
 */

"use strict";

/* =========================================
   SUPABASE
   ========================================= */

window.ALERTA_SUPABASE = Object.freeze({
  url: "https://mruteipysgyfrnxwhjwn.supabase.co",

  publishableKey:
    "sb_publishable_wnu8PccuNZ0aQuEDAEad3Q_6IxzErlh"
});

/* =========================================
   WEB PUSH
   ========================================= */

window.ALERTA_PUSH = Object.freeze({

  // Clave pública VAPID.
  publicKey:
    "BANf4kJOT8E0yog5v80AjV0mWRqxQBf3EkAkcSbhf-B8oX59NcGn0UUTgDf55Ujm6DClv8ws7oTrZHSk85G0g1M",

  // Backend seguro en Cloudflare.
  subscriptionEndpoint:
    "https://alerta-salud-push.comitecalidadhlm.workers.dev"

});

/* =========================================
   CARGA SECUENCIAL DE MÓDULOS
   ========================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const modules = [
      "./institucional.js",
      "./notificaciones.js",
      "./push.js",
      "./navegacion.js"
    ];

    function loadNext(index) {

      if (index >= modules.length) {
        return;
      }

      const script =
        document.createElement("script");

      script.src = modules[index];

      script.async = false;

      script.onload = () => {
        loadNext(index + 1);
      };

      script.onerror = () => {
        console.error(
          "No se pudo cargar:",
          modules[index]
        );
      };

      document.body.appendChild(script);
    }

    loadNext(0);
  }
);
