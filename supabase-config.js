
/*
 * APP ALERTA SALUD V1.9.6
 * Configuracion y carga de modulos.
 */

window.ALERTA_SUPABASE = Object.freeze({
  url: "https://mruteipysgyfrnxwhjwn.supabase.co",
  publishableKey:
    "sb_publishable_wnu8PccuNZ0aQuEDAEad3Q_6IxzErlh"
});

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const modules = [
      "./institucional.js",
      "./notificaciones.js",
      "./navegacion.js"
    ];

    // Carga secuencial para que navegación
    // encuentre los módulos ya construidos.
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
