
/*
 * APP ALERTA SALUD V1.10.0
 * Configuración y carga de módulos
 */

window.ALERTA_SUPABASE = Object.freeze({
  url: "https://mruteipysgyfrnxwhjwn.supabase.co",
  publishableKey:
    "sb_publishable_wnu8PccuNZ0aQuEDAEad3Q_6IxzErlh"
});

/*
 * Configuración Web Push.
 *
 * Completar en la siguiente etapa:
 * - publicKey: clave VAPID pública
 * - subscriptionEndpoint: URL HTTPS del backend
 *
 * Nunca colocar claves privadas aquí.
 */

window.ALERTA_PUSH = Object.freeze({
  publicKey: "",
  subscriptionEndpoint: ""
});

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
      if (index >= modules.length) return;

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
