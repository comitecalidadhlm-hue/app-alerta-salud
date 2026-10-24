
/*
 * APP ALERTA SALUD V1.9.6
 * CODIGO 16A - NAVEGACION INTERNA
 *
 * Pantallas independientes para:
 * - Mas opciones
 * - Notificaciones
 * - Historial
 * - Acceso institucional
 *
 * No destruye formularios ni sesiones.
 * No publica ni modifica datos.
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const host = $("view-mas");

  if (!host || host.dataset.navV196 === "ready") {
    return;
  }

  const notificationPanel = $("asNotifications");
  const institutionalPanel =
    host.querySelector(".as-panel");

  if (!notificationPanel || !institutionalPanel) {
    console.warn(
      "Navegación: faltan módulos para organizar"
    );
    return;
  }

  host.dataset.navV196 = "ready";

  const css = document.createElement("style");

  css.textContent = `
    #view-mas .as-subscreen[hidden] {
      display: none !important;
    }

    #view-mas .as-subscreen {
      width: 100%;
      box-sizing: border-box;
    }

    .as-screen-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 18px;
    }

    .as-screen-header h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.3;
      color: #17324b;
    }

    .as-screen-back {
      flex-shrink: 0;
      border: 1px solid #c6d5e3;
      border-radius: 9px;
      background: #fff;
      color: #164568;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .as-screen-back:focus-visible,
    .as-menu-entry:focus-visible {
      outline: 3px solid #2686c4;
      outline-offset: 2px;
    }

    .as-menu-entry {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      text-align: left;
      padding: 13px 14px;
      margin-top: 8px;
      border: 1px solid #d6e1ea;
      border-radius: 10px;
      background: #fff;
      color: #16344d;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    .as-menu-entry small {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      font-weight: 400;
      color: #60758a;
    }

    #asScreenNotifications .as-notifications,
    #asScreenInstitutional .as-panel {
      margin-top: 0;
    }

    #asScreenNotifications .as-notifications-heading {
      display: none;
    }

    #asScreenInstitutional .as-panel {
      width: 100%;
      box-sizing: border-box;
    }

    @media (min-width: 850px) {
      #view-mas .as-subscreen {
        max-width: 650px;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `;

  document.head.appendChild(css);

  // Se conservan los elementos originales
  // para no perder sus eventos ni su estado.
  const menu = document.createElement("div");
  menu.id = "asScreenMenu";
  menu.className = "as-subscreen";

  while (host.firstChild) {
    const child = host.firstChild;

    if (
      child === notificationPanel ||
      child === institutionalPanel
    ) {
      host.removeChild(child);
      continue;
    }

    menu.appendChild(child);
  }

  host.appendChild(menu);

  function createScreen(id, title) {
    const screen = document.createElement("section");

    screen.id = id;
    screen.className = "as-subscreen";
    screen.hidden = true;

    const header = document.createElement("div");
    header.className = "as-screen-header";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "as-screen-back";
    back.textContent = "← Volver";

    const heading = document.createElement("h1");
    heading.textContent = title;

    back.addEventListener("click", () => {
      open("menu");
    });

    header.append(back, heading);
    screen.appendChild(header);
    host.appendChild(screen);

    return screen;
  }

  const notificationsScreen = createScreen(
    "asScreenNotifications",
    "Notificaciones"
  );

  const institutionalScreen = createScreen(
    "asScreenInstitutional",
    "Acceso institucional"
  );

  notificationsScreen.appendChild(
    notificationPanel
  );

  institutionalScreen.appendChild(
    institutionalPanel
  );

  const screens = {
    menu,
    notifications: notificationsScreen,
    institutional: institutionalScreen
  };

  let current = "menu";

  function open(name) {
    if (!screens[name]) return;

    current = name;

    Object.entries(screens).forEach(
      ([key, screen]) => {
        screen.hidden = key !== name;
      }
    );

    window.scrollTo({
      top: 0,
      behavior: "instant"
    });

    if (name === "notifications") {
      const heading =
        $("asScreenNotifications")
          ?.querySelector("h1");

      if (heading) {
        heading.textContent =
          $("asNotHistory")
            ?.classList.contains("selected")
            ? "Historial de comunicaciones"
            : "Notificaciones";
      }
    }
  }

  function openNotifications(history) {
    open("notifications");

    const tab = history
      ? $("asNotHistory")
      : $("asNotCurrent");

    // El módulo de notificaciones conserva
    // su propia lógica de consulta y filtros.
    if (tab) {
      tab.click();
    }

    const heading =
      notificationsScreen.querySelector(
        ".as-screen-header h1"
      );

    if (heading) {
      heading.textContent = history
        ? "Historial de comunicaciones"
        : "Notificaciones";
    }

    $("asNotReload")?.click();
  }

  // Se utiliza el menú original.
  const notificationsButton =
    $("menuNotifications");

  const historyButton = $("menuHistory");

  if (notificationsButton) {
    notificationsButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openNotifications(false);
      },
      true
    );
  }

  if (historyButton) {
    historyButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openNotifications(true);
      },
      true
    );
  }

  // Nuevo acceso institucional dentro
  // del menú Más, sin duplicar el formulario.
  const institutionalButton =
    document.createElement("button");

  institutionalButton.type = "button";
  institutionalButton.id =
    "menuInstitutional";

  institutionalButton.className =
    "as-menu-entry";

  const buttonContent =
    document.createElement("span");

  buttonContent.textContent =
    "🔐 Acceso institucional";

  const description =
    document.createElement("small");

  description.textContent =
    "Área reservada para personal autorizado";

  buttonContent.appendChild(description);

  const arrow = document.createElement("span");
  arrow.textContent = "›";
  arrow.setAttribute("aria-hidden", "true");

  institutionalButton.append(
    buttonContent,
    arrow
  );

  institutionalButton.addEventListener(
    "click",
    () => open("institutional")
  );

  const menuList =
    menu.querySelector(".menu-list");

  if (menuList) {
    menuList.appendChild(institutionalButton);
  } else {
    menu.appendChild(institutionalButton);
  }

  // Cuando se vuelve a tocar "Más"
  // desde la barra inferior, se muestra
  // el menú principal de esa sección.
  document.querySelectorAll(
    '.nav-item[data-view="mas"]'
  ).forEach(button => {
    button.addEventListener(
      "click",
      () => open("menu")
    );
  });

  // El botón de configuración también
  // vuelve al menú de opciones.
  $("openSettings")?.addEventListener(
    "click",
    () => open("menu")
  );

  // Al regresar desde otras secciones
  // se mantiene la navegación coherente.
  document.addEventListener(
    "alerta:view",
    event => {
      if (
        event.detail?.view === "mas" &&
        !host.classList.contains("active")
      ) {
        return;
      }
    }
  );

  open("menu");

  console.info(
    "App Alerta Salud: navegación V1.9.6 activa"
  );
})();
