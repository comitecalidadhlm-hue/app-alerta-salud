
/*
 * APP ALERTA SALUD V1.9.5
 * Configuracion de Supabase
 * y carga de modulos.
 */

window.ALERTA_SUPABASE = Object.freeze({
  url: "https://mruteipysgyfrnxwhjwn.supabase.co",
  publishableKey:
    "sb_publishable_wnu8PccuNZ0aQuEDAEad3Q_6IxzErlh"
});

document.addEventListener(
  "DOMContentLoaded",
  () => {

    // Modulo institucional existente.
    const institutional =
      document.createElement("script");

    institutional.src = "./institucional.js";
    institutional.defer = true;

    institutional.onerror = () => {
      console.warn(
        "No se pudo cargar el módulo institucional"
      );
    };

    document.body.appendChild(institutional);

    // Nuevo Centro de Notificaciones.
    // Se carga cuando app.js ya inicializo
    // window.AlertaSalud.
    const notifications =
      document.createElement("script");

    notifications.src = "./notificaciones.js";
    notifications.defer = true;

    notifications.onerror = () => {
      console.warn(
        "No se pudo cargar el Centro de Notificaciones"
      );
    };

    document.body.appendChild(notifications);
  }
);
