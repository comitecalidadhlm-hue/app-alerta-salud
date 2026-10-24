
/*
 * APP ALERTA SALUD V1.9.6
 * NAVEGACION POR PANTALLAS INDEPENDIENTES
 *
 * Mas opciones
 * Notificaciones
 * Historial
 * Acceso institucional
 *
 * No modifica datos ni permisos.
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const host = $("view-mas");

  if (!host) {
    console.error("No se encontro view-mas");
    return;
  }

  if (host.dataset.navV196 === "ready") {
    return;
  }

  const notifications = $("asNotifications");

  // Buscar el panel institucional sin
  // depender exclusivamente de una clase.
  const institutional =
    host.querySelector(".as-panel") ||
    host.querySelector("#asInstitutional") ||
    host.querySelector(
      '[id*="institucional"]'
    );

  if (!notifications || !institutional) {
    console.error(
      "No se encontraron los modulos:",
      {
        notifications: !!notifications,
        institutional: !!institutional
      }
    );
    return;
  }

  // ======================================
  // ESTILOS
  // ======================================

  const style = document.createElement("style");

  style.textContent = `
    #view-mas .as-subscreen[hidden] {
      display: none !important;
    }

    #view-mas .as-subscreen {
      width: 100%;
      box-sizing: border-box;
      padding-bottom: 12px;
    }

    #view-mas .as-screen-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    #view-mas .as-screen-header h2 {
      margin: 0;
      font-size: 19px;
      color: #17324b;
    }

    #view-mas .as-back-button {
      padding: 10px 12px;
      border: 1px solid #c5d5e2;
      border-radius: 9px;
      background: #fff;
      color: #174b6b;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    #view-mas .as-menu-button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 13px;
      margin-top: 8px;
      border: 1px solid #d5e0ea;
      border-radius: 9px;
      background: #fff;
      color: #17324b;
      font-size: 13px;
      font-weight: 700;
      text-align: left;
      cursor: pointer;
    }

    #view-mas .as-menu-button small {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      font-weight: 400;
      color: #63778b;
    }

    #view-mas .as-chevron {
      font-size: 19px;
      color: #64748b;
    }

    #asScreenNotifications
    .as-notifications-heading {
      display: none;
    }

    #asScreenNotifications .as-notifications,
    #asScreenInstitutional .as-panel {
      margin-top: 0;
      width: 100%;
      box-sizing: border-box;
    }
  `;

  document.head.appendChild(style);

  // ======================================
  // CONSERVAR EL MENU ORIGINAL
  // ======================================

  const menu = document.createElement("div");

  menu.id = "asScreenMenu";
  menu.className = "as-subscreen";

  const originalNodes = Array.from(
    host.childNodes
  );

  for (const node of originalNodes) {
    if (
      node === notifications ||
      node === institutional
    ) {
      continue;
    }

    menu.appendChild(node);
  }

  host.appendChild(menu);

  // ======================================
  // CREAR PANTALLAS INDEPENDIENTES
  // ======================================

  function createScreen(id, title) {
    const screen = document.createElement(
      "section"
    );

    screen.id = id;
    screen.className = "as-subscreen";
    screen.hidden = true;

    const header = document.createElement(
      "div"
    );

    header.className = "as-screen-header";

    const back = document.createElement(
      "button"
    );

    back.type = "button";
    back.className = "as-back-button";
    back.textContent = "← Volver";

    const heading = document.createElement(
      "h2"
    );

    heading.textContent = title;

    back.addEventListener("click", () => {
      openScreen("menu");
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
    notifications
  );

  institutionalScreen.appendChild(
    institutional
  );

  const screens = {
    menu,
    notifications: notificationsScreen,
    institutional: institutionalScreen
  };

  // ======================================
  // CAMBIAR PANTALLA
  // ======================================

  function openScreen(name) {
    if (!screens[name]) return;

    Object.entries(screens).forEach(
      ([key, screen]) => {
        screen.hidden = key !== name;
      }
    );

    host.scrollIntoView({
      behavior: "auto",
      block: "start"
    });
  }

  // ======================================
  // NOTIFICACIONES E HISTORIAL
  // ======================================

  function openNotifications(history) {
    openScreen("notifications");

    const heading =
      notificationsScreen.querySelector(
        ".as-screen-header h2"
      );

    if (heading) {
      heading.textContent = history
        ? "Historial de comunicaciones"
        : "Notificaciones";
    }

    const tab = history
      ? $("asNotHistory")
      : $("asNotCurrent");

    if (tab) tab.click();

    $("asNotReload")?.click();
  }

  // Capturamos los clics antes de los
  // eventos antiguos de app.js.
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

      event.preventDefault();
      event.stopImmediatePropagation();

      openNotifications(
        button.id === "menuHistory"
      );
    },
    true
  );

  // ======================================
  // ACCESO INSTITUCIONAL
  // ======================================

  const accessButton =
    document.createElement("button");

  accessButton.type = "button";
  accessButton.id = "menuInstitutional";
  accessButton.className = "as-menu-button";

  const label = document.createElement("span");

  label.textContent = "🔐 Acceso institucional";

  const description =
    document.createElement("small");

  description.textContent =
    "Área reservada para personal autorizado";

  label.appendChild(description);

  const arrow = document.createElement("span");

  arrow.className = "as-chevron";
  arrow.textContent = "›";
  arrow.setAttribute("aria-hidden", "true");

  accessButton.append(label, arrow);

  accessButton.addEventListener(
    "click",
    () => openScreen("institutional")
  );

  const menuList =
    menu.querySelector(".menu-list");

  if (menuList) {
    menuList.appendChild(accessButton);
  } else {
    menu.appendChild(accessButton);
  }

  // ======================================
  // VOLVER AL MENU DESDE BARRA INFERIOR
  // ======================================

  document.querySelectorAll(
    '[data-view="mas"]'
  ).forEach(button => {
    button.addEventListener(
      "click",
      () => openScreen("menu")
    );
  });

  // ======================================
  // INICIALIZACION
  // ======================================

  host.dataset.navV196 = "ready";

  openScreen("menu");

  console.info(
    "App Alerta Salud: navegacion V1.9.6 lista"
  );

})();
