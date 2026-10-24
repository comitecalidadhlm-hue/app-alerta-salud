
/*
 * APP ALERTA SALUD V1.9
 * Módulo institucional
 *
 * Requiere:
 * - supabase-config.js
 * - tablas y funciones SQL de la V1.9
 *
 * No publica estados directamente.
 * No envía notificaciones push ni SMS.
 */

(() => {
  "use strict";

  const cfg = window.ALERTA_SUPABASE;
  if (!cfg?.url || !cfg?.publishableKey) return;

  const $ = id => document.getElementById(id);
  const API = cfg.url.replace(/\/$/, "");

  let accessToken = null;
  let perfil = null;
  let usuario = null;

  const style = document.createElement("style");
  style.textContent = `
    .as-box {
      border: 1px solid #d7e1ea;
      border-radius: 14px;
      padding: 16px;
      margin: 16px 0;
      background: #fff;
      color: #172b3a;
    }
    .as-box h2, .as-box h3 {
      margin: 0 0 12px;
    }
    .as-box p { line-height: 1.5; }
    .as-field {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 11px;
      margin: 6px 0 12px;
      border: 1px solid #aebdca;
      border-radius: 8px;
      background: white;
      color: #172b3a;
      font: inherit;
    }
    .as-button {
      display: inline-block;
      padding: 10px 14px;
      margin: 4px 6px 4px 0;
      border: 0;
      border-radius: 8px;
      background: #14618b;
      color: white;
      cursor: pointer;
      font: inherit;
    }
    .as-button:disabled {
      opacity: .55;
      cursor: wait;
    }
    .as-secondary { background: #475569; }
    .as-danger { background: #a72b35; }
    .as-notice {
      padding: 10px;
      border-radius: 8px;
      background: #edf5fb;
      margin: 12px 0;
      white-space: pre-wrap;
    }
    .as-card {
      border: 1px solid #d7e1ea;
      border-radius: 10px;
      padding: 12px;
      margin: 12px 0;
    }
    .as-card small {
      display: block;
      margin: 6px 0;
      color: #526577;
    }
    .as-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .as-hidden { display: none !important; }
  `;
  document.head.appendChild(style);

  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) {
      el.textContent = String(text);
    }
    if (className) el.className = className;
    return el;
  }

  function button(text, callback, extraClass = "") {
    const el = element(
      "button",
      text,
      `as-button ${extraClass}`
    );
    el.type = "button";
    el.addEventListener("click", callback);
    return el;
  }

  function field(label, type = "text") {
    const wrapper = element("label");
    wrapper.append(element("span", label));

    const input = element("input");
    input.type = type;
    input.className = "as-field";
    input.required = true;

    wrapper.append(input);
    return { wrapper, input };
  }

  function selectField(label, options) {
    const wrapper = element("label");
    wrapper.append(element("span", label));

    const select = element("select");
    select.className = "as-field";

    options.forEach(([value, text]) => {
      const option = element("option", text);
      option.value = value;
      select.append(option);
    });

    wrapper.append(select);
    return { wrapper, select };
  }

  function notice(message) {
    $("as-message").textContent = message;
  }

  function dateText(value) {
    if (!value) return "Sin fecha";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Fecha no disponible"
      : date.toLocaleString("es-AR");
  }

  async function request(path, options = {}) {
    const headers = {
      apikey: cfg.publishableKey,
      Accept: "application/json",
      ...(options.headers || {})
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.message ||
        body?.msg ||
        body?.error_description ||
        body?.error ||
        `Error HTTP ${response.status}`
      );
    }

    return body;
  }

  async function rest(table, query) {
    return request(`/rest/v1/${table}?${query}`);
  }

  async function rpc(name, args) {
    return request(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });
  }

  const container = element("section", null, "as-box");
  container.id = "as-container";

  const title = element("h2", "Acceso institucional");
  const message = element("div", "", "as-notice");
  message.id = "as-message";
  message.setAttribute("role", "status");

  const content = element("div");
  content.id = "as-content";

  container.append(title, message, content);

  // La sección se agrega en "Más opciones".
  // No aparece en la navegación pública principal.
  const more = $("view-mas");
  if (!more) return;
  more.append(container);

  function clear() {
    content.replaceChildren();
  }

  function showLogin() {
    clear();
    title.textContent = "Acceso institucional";
    notice(
      "Ingreso exclusivo para administradores autorizados."
    );

    const form = element("form");
    const email = field("Correo electrónico", "email");
    const password = field("Contraseña", "password");

    email.input.autocomplete = "username";
    password.input.autocomplete = "current-password";

    const submit = element(
      "button",
      "Ingresar",
      "as-button"
    );
    submit.type = "submit";

    form.append(
      email.wrapper,
      password.wrapper,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;
      notice("Verificando credenciales…");

      try {
        const session = await request(
          "/auth/v1/token?grant_type=password",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: email.input.value.trim(),
              password: password.input.value
            })
          }
        );

        accessToken = session.access_token;
        usuario = session.user;

        const rows = await rest(
          "as_perfiles",
          "select=usuario_id,rol,nombre,activo" +
          "&usuario_id=eq." +
          encodeURIComponent(usuario.id) +
          "&limit=1"
        );

        perfil = rows?.[0] || null;

        if (
          !perfil?.activo ||
          !["admin", "superadmin"].includes(perfil.rol)
        ) {
          throw new Error(
            "La cuenta no tiene autorización institucional."
          );
        }

        password.input.value = "";
        await showDashboard();

      } catch (error) {
        accessToken = null;
        usuario = null;
        perfil = null;
        notice(error.message);
      } finally {
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  function logout() {
    accessToken = null;
    perfil = null;
    usuario = null;
    showLogin();
  }

  async function showDashboard() {
    if (!accessToken || !perfil) {
      showLogin();
      return;
    }

    clear();
    title.textContent = "Panel institucional";

    const roleName = perfil.rol === "superadmin"
      ? "Superadmin"
      : "Administrador institucional";

    notice(
      `${perfil.nombre || "Usuario"} · ${roleName}\n` +
      "Los estados públicos no cambian hasta su validación."
    );

    const actions = element("div", null, "as-actions");

    actions.append(
      button("Actualizar", showDashboard),
      button("Cerrar sesión", logout, "as-secondary")
    );

    content.append(actions);

    const requestsBox = element("div", null, "as-box");
    requestsBox.append(
      element("h3", "Solicitudes pendientes")
    );
    content.append(requestsBox);

    try {
      let query =
        "select=id,centro_id,motivo,estado,mensaje," +
        "creada_en,destinatario_id" +
        "&estado=eq.pendiente" +
        "&order=creada_en.desc" +
        "&limit=100";

      if (perfil.rol !== "superadmin") {
        query += "&destinatario_id=eq." +
          encodeURIComponent(usuario.id);
      }

      const solicitudes = await rest(
        "as_solicitudes_verificacion",
        query
      );

      const centros = await rest(
        "centros_asistenciales",
        "select=id,nombre&order=nombre.asc"
      );

      const nombres = new Map(
        centros.map(c => [String(c.id), c.nombre])
      );

      if (!solicitudes.length) {
        requestsBox.append(
          element("p", "No hay solicitudes pendientes.")
        );
      }

      for (const solicitud of solicitudes) {
        const card = element("article", null, "as-card");

        card.append(
          element(
            "h3",
            nombres.get(solicitud.centro_id) ||
            `Establecimiento ${solicitud.centro_id}`
          ),
          element(
            "small",
            `Solicitud: ${dateText(solicitud.creada_en)}`
          ),
          element(
            "p",
            solicitud.mensaje ||
            "Se solicita verificar el estado institucional."
          )
        );

        if (solicitud.destinatario_id === usuario.id) {
          card.append(
            button(
              "Responder solicitud",
              () => showResponse(solicitud, nombres)
            )
          );
        } else {
          card.append(
            element(
              "small",
              "Asignada a otro administrador."
            )
          );
        }

        requestsBox.append(card);
      }

      if (perfil.rol === "superadmin") {
        await showValidations(nombres);
      }

    } catch (error) {
      notice(
        "No se pudieron cargar los datos: " +
        error.message
      );
    }
  }

  function showResponse(solicitud, nombres) {
    clear();

    title.textContent = "Reporte institucional";
    notice(
      "Completá la situación real del establecimiento. " +
      "No utilices datos de prueba como si fueran reales."
    );

    const heading = element(
      "h3",
      nombres.get(solicitud.centro_id) ||
      `Establecimiento ${solicitud.centro_id}`
    );

    const form = element("form");

    const estado = selectField(
      "Funcionamiento",
      [
        ["sin_verificar", "Sin verificar"],
        ["operativo", "Operativo"],
        ["limitado", "Operativo con limitaciones"],
        ["no_operativo", "No operativo"]
      ]
    );

    const recepcion = selectField(
      "Recepción de pacientes",
      [
        ["sin_verificar", "Sin verificar"],
        ["normal", "Recibe pacientes"],
        ["restringida", "Recepción restringida"],
        ["no_recibe", "No recibe pacientes"]
      ]
    );

    const acceso = selectField(
      "Accesibilidad",
      [
        ["sin_verificar", "Sin verificar"],
        ["normal", "Acceso normal"],
        ["restringido", "Acceso restringido"],
        ["interrumpido", "Acceso interrumpido"]
      ]
    );

    const observationsLabel = element("label");
    observationsLabel.append(
      element("span", "Acciones de respuesta y observaciones")
    );

    const observations = element("textarea");
    observations.className = "as-field";
    observations.rows = 4;
    observations.maxLength = 3000;
    observationsLabel.append(observations);

    const submit = element(
      "button",
      "Enviar reporte",
      "as-button"
    );
    submit.type = "submit";

    form.append(
      heading,
      estado.wrapper,
      recepcion.wrapper,
      acceso.wrapper,
      observationsLabel,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!window.confirm(
        "¿Confirmás que la información corresponde " +
        "a la situación real del establecimiento?"
      )) return;

      submit.disabled = true;
      notice("Enviando reporte…");

      try {
        await rpc("as_responder_solicitud", {
          p_solicitud_id: solicitud.id,
          p_estado_operativo: estado.select.value,
          p_recepcion_pacientes: recepcion.select.value,
          p_accesibilidad: acceso.select.value,
          p_observaciones: observations.value.trim()
        });

        await showDashboard();
        notice(
          "Reporte enviado. Pendiente de validación."
        );

      } catch (error) {
        notice("No se pudo enviar: " + error.message);
        submit.disabled = false;
      }
    });

    content.append(
      button(
        "Volver al panel",
        showDashboard,
        "as-secondary"
      ),
      form
    );
  }

  async function showValidations(nombres) {
    const box = element("div", null, "as-box");
    box.append(
      element("h3", "Reportes pendientes de validación")
    );
    content.append(box);

    const reportes = await rest(
      "as_reportes_institucionales",
      "select=id,centro_id,estado_operativo," +
      "recepcion_pacientes,accesibilidad," +
      "observaciones,creado_en,validacion" +
      "&validacion=eq.pendiente" +
      "&order=creado_en.desc&limit=100"
    );

    if (!reportes.length) {
      box.append(
        element("p", "No hay reportes para validar.")
      );
      return;
    }

    for (const reporte of reportes) {
      const card = element("article", null, "as-card");

      card.append(
        element(
          "h3",
          nombres.get(reporte.centro_id) ||
          `Establecimiento ${reporte.centro_id}`
        ),
        element(
          "p",
          `Funcionamiento: ${reporte.estado_operativo}`
        ),
        element(
          "p",
          `Recepción: ${reporte.recepcion_pacientes}`
        ),
        element(
          "p",
          `Accesibilidad: ${reporte.accesibilidad}`
        ),
        element(
          "p",
          `Observaciones: ${reporte.observaciones || "Ninguna"}`
        ),
        element(
          "small",
          `Enviado: ${dateText(reporte.creado_en)}`
        )
      );

      const actions = element("div", null, "as-actions");

      async function decide(decision) {
        const texto = decision === "aprobado"
          ? "aprobar"
          : "rechazar";

        if (!window.confirm(
          `¿Confirmás que querés ${texto} este reporte?`
        )) return;

        try {
          await rpc("as_validar_reporte", {
            p_reporte_id: reporte.id,
            p_decision: decision
          });

          await showDashboard();
          notice(
            decision === "aprobado"
              ? "Reporte aprobado. La publicación pública " +
                "todavía no está conectada."
              : "Reporte rechazado."
          );

        } catch (error) {
          notice(
            "No se pudo procesar el reporte: " +
            error.message
          );
        }
      }

      actions.append(
        button("Aprobar", () => decide("aprobado")),
        button(
          "Rechazar",
          () => decide("rechazado"),
          "as-danger"
        )
      );

      card.append(actions);
      box.append(card);
    }
  }

  showLogin();

})();
