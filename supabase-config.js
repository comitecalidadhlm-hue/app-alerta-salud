
window.ALERTA_SUPABASE = Object.freeze({
  url: "https://mruteipysgyfrnxwhjwn.supabase.co",
  publishableKey: "sb_publishable_wnu8PccuNZ0aQuEDAEad3Q_6IxzErlh"
});

// App Alerta Salud V1.9
// Carga del módulo institucional.
document.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src = "./institucional.js";
  script.defer = true;
  script.onerror = () => {
    console.warn("No se pudo cargar el módulo institucional");
  };
  document.body.appendChild(script);
});
