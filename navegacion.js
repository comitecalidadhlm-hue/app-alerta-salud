
  // =========================================
  // NOTIFICACIONES E HISTORIAL
  // APP ALERTA SALUD V1.9.6
  // =========================================

  function openNotifications(history) {

    // Abrir exclusivamente la pantalla
    // de notificaciones.
    openScreen("notifications");

    // Actualizar el titulo de la pantalla.
    const heading =
      notificationsScreen.querySelector(
        ".as-screen-header h2"
      );

    if (heading) {
      heading.textContent = history
        ? "Historial de comunicaciones"
        : "Notificaciones";
    }

    // Seleccionar la pestaña correspondiente.
    const tab = history
      ? document.getElementById("asNotHistory")
      : document.getElementById("asNotCurrent");

    if (tab) {
      tab.click();
    }

    // Consultar las comunicaciones oficiales
    // sin recargar toda la aplicacion.
    document.getElementById("asNotReload")
      ?.click();
  }

  // Interceptar los clics desde el contenedor
  // principal del menu.
  //
  // Se utiliza la fase de captura para evitar
  // que los eventos anteriores de app.js y
  // notificaciones.js se ejecuten.

  menu.addEventListener(
    "click",
    event => {

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(
        "#menuNotifications, #menuHistory"
      );

      if (!button || !menu.contains(button)) {
        return;
      }

      // Bloquear las acciones anteriores.
      event.preventDefault();
      event.stopImmediatePropagation();

      // Abrir la pantalla correspondiente.
      openNotifications(
        button.id === "menuHistory"
      );

    },
    true
  );
