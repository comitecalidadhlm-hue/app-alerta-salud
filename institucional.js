
/*
 * APP ALERTA SALUD V1.9.3
 * Gestión de autoridades y declaraciones oficiales.
 *
 * Requiere:
 * - supabase-config.js
 * - SQL 14A, 14B, 14C, 14D
 * - SQL 14E.3A: as_listar_usuarios_institucionales
 *
 * No modifica estados al iniciar.
 * Publica únicamente tras confirmación expresa.
 */

(() => {
  "use strict";

  const cfg = window.ALERTA_SUPABASE;
  const host = document.getElementById("view-mas");

  if (!cfg?.url || !cfg?.publishableKey || !host) return;

  const API = cfg.url.replace(/\/$/, "");
  let token = null;
  let user = null;
  let profile = null;
  let centers = [];
  let authorities = [];
  let users = [];

  const style = document.createElement("style");
  style.textContent = `
    .as-panel {
      margin: 20px 0;
      padding: 16px;
      border: 1px solid #d5e0e9;
      border-radius: 13px;
      background: #fff;
      color: #173047;
    }
    .as-panel h2 { margin: 0 0 12px; }
    .as-panel h3 { margin: 14px 0 8px; }
    .as-panel label {
      display: block;
      margin: 12px 0;
      font-weight: 600;
    }
    .as-panel input,
    .as-panel select,
    .as-panel textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin-top: 5px;
      padding: 10px;
      border: 1px solid #afc0ce;
      border-radius: 8px;
      background: #fff;
      color: #173047;
      font: inherit;
      font-weight: 400;
    }
    .as-panel button {
      padding: 10px 13px;
      margin: 4px 5px 4px 0;
      border: 0;
      border-radius: 8px;
      background: #14618b;
      color: white;
      font: inherit;
      cursor: pointer;
    }
    .as-panel button:disabled {
      opacity: .55;
      cursor: wait;
    }
    .as-panel .as-secondary { background: #475569; }
    .as-panel .as-danger { background: #a72b35; }
    .as-panel .as-message {
      padding: 11px;
      margin: 10px 0;
      border-radius: 8px;
      background: #eaf3fa;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .as-panel .as-card {
      margin: 12px 0;
      padding: 13px;
      border: 1px solid #d5e0e9;
      border-radius: 10px;
    }
    .as-panel .as-card p { margin: 6px 0; }
    .as-panel .as-muted {
      font-size: .9rem;
      color: #526577;
    }
    .as-panel .as-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin: 12px 0;
    }
    .as-panel .as-tabs button {
      flex: 1;
      min-width: 110px;
    }
    .as-panel .as-active-tab {
      background: #0c354f;
    }
  `;
  document.head.append(style);

  function node(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined && text !== null) {
      item.textContent = String(text);
    }
    if (className) item.className = className;
    return item;
  }

  function button(text, action, className = "") {
    const item = node("button", text, className);
    item.type = "button";
    item.addEventListener("click", action);
    return item;
  }

  function inputField(label, type = "text", required = true) {
    const wrapper = node("label", label);
    const input = node("input");
    input.type = type;
    input.required = required;
    wrapper.append(input);
    return { wrapper, input };
  }

  function selectField(label, options) {
    const wrapper = node("label", label);
    const input = node("select");

    for (const [value, title] of options) {
      const option = node("option", title);
      option.value = String(value);
      input.append(option);
    }

    wrapper.append(input);
    return { wrapper, input };
  }

  function textArea(label) {
    const wrapper = node("label", label);
    const input = node("textarea");
    input.rows = 3;
    input.maxLength = 3000;
    wrapper.append(input);
    return { wrapper, input };
  }

  function dateText(value) {
    if (!value) return "Sin fecha de finalización";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? "Fecha inválida"
      : d.toLocaleString("es-AR");
  }

  async function request(path, options = {}) {
    const headers = {
      apikey: cfg.publishableKey,
      Accept: "application/json",
      ...options.headers
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(API + path, {
      ...options,
      headers,
      cache: "no-store"
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.error_description ||
        result?.error ||
        `Error HTTP ${response.status}`
      );
    }

    return result;
  }

  function rest(table, query) {
    return request(`/rest/v1/${table}?${query}`);
  }

  function rpc(name, args = {}) {
    return request(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
  }

  const panel = node("section", null, "as-panel");
  const title = node("h2", "Acceso institucional");
  const message = node("div", "", "as-message");
  const content = node("div");

  message.setAttribute("role", "status");
  panel.append(title, message, content);
  host.append(panel);

  function notice(text) {
    message.textContent = String(text);
  }

  function screen(heading) {
    title.textContent = heading;
    content.replaceChildren();
  }

  function centerName(id) {
    return centers.find(c => String(c.id) === String(id))
      ?.nombre || `Establecimiento ${id}`;
  }

  function activeAuthority(a) {
    const now = Date.now();

    return a.activo === true &&
      !a.revocado_en &&
      Date.parse(a.habilitado_desde) <= now &&
      (
        !a.habilitado_hasta ||
        Date.parse(a.habilitado_hasta) > now
      );
  }

  function isSuperadmin() {
    return profile?.activo === true &&
      profile?.rol === "superadmin";
  }

  function logout() {
    token = null;
    user = null;
    profile = null;
    centers = [];
    authorities = [];
    users = [];
    login();
  }

  function login() {
    screen("Acceso institucional");
    notice(
      "Ingreso exclusivo para Dirección, Comité de Crisis " +
      "y administradores autorizados."
    );

    const form = node("form");
    const email = inputField("Correo electrónico", "email");
    const password = inputField("Contraseña", "password");
    const submit = node("button", "Ingresar");

    email.input.autocomplete = "username";
    password.input.autocomplete = "current-password";
    submit.type = "submit";

    form.append(email.wrapper, password.wrapper, submit);

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

        token = session.access_token;
        user = session.user;

        await loadIdentity();
        dashboard();

      } catch (error) {
        token = null;
        user = null;
        profile = null;
        notice("No se pudo ingresar: " + error.message);
      } finally {
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  async function loadIdentity() {
    const profiles = await rest(
      "as_perfiles",
      "select=usuario_id,nombre,rol,activo" +
      "&usuario_id=eq." + encodeURIComponent(user.id) +
      "&limit=1"
    );

    profile = profiles?.[0] || null;

    centers = await rest(
      "centros_asistenciales",
      "select=id,nombre,activo" +
      "&activo=eq.true&order=nombre.asc"
    );

    authorities = await rest(
      "as_autoridades_institucionales",
      "select=id,centro_id,usuario_id,tipo_autoridad," +
      "cargo,documento_designacion,habilitado_desde," +
      "habilitado_hasta,activo,revocado_en" +
      "&usuario_id=eq." + encodeURIComponent(user.id)
    );

    const hasInstitutionalRole =
      profile?.activo === true &&
      ["superadmin", "admin"].includes(profile.rol);

    if (
      !hasInstitutionalRole &&
      !authorities.some(activeAuthority)
    ) {
      throw new Error(
        "No existe una habilitación institucional vigente."
      );
    }
  }

  function dashboard() {
    screen("Panel institucional");

    notice(
      `${profile?.nombre || user?.email || "Usuario"}\n` +
      "La publicación de estados está reservada " +
      "a autoridades previamente habilitadas."
    );

    content.append(
      button("Actualizar", async () => {
        try {
          await loadIdentity();
          dashboard();
        } catch (error) {
          notice(error.message);
        }
      }),
      button("Cerrar sesión", logout, "as-secondary")
    );

    const own = authorities.filter(activeAuthority);

    if (own.length) {
      const section = node("section", null, "as-card");
      section.append(
        node("h3", "Declaraciones institucionales")
      );

      for (const authority of own) {
        const card = node("div", null, "as-card");

        card.append(
          node("h3", centerName(authority.centro_id)),
          node(
            "p",
            authority.tipo_autoridad === "direccion"
              ? "Dirección"
              : "Comité de Crisis"
          ),
          node("p", authority.cargo),
          button(
            "Declarar estado operativo",
            () => declarationForm(authority)
          )
        );

        section.append(card);
      }

      content.append(section);
    }

    if (isSuperadmin()) {
      const section = node("section", null, "as-card");

      section.append(
        node("h3", "Administración de autoridades"),
        node(
          "p",
          "Registrar, consultar y revocar " +
          "designaciones institucionales."
        ),
        button(
          "Gestionar autoridades",
          authoritiesAdmin
        )
      );

      content.append(section);
    }

    if (!own.length && !isSuperadmin()) {
      content.append(
        node(
          "p",
          "No tenés establecimientos habilitados " +
          "para publicar estados.",
          "as-muted"
        )
      );
    }
  }

  function declarationForm(authority) {
    screen("Declaración oficial");

    notice(
      "Establecimiento: " +
      centerName(authority.centro_id) +
      "\nATENCIÓN: la confirmación publica " +
      "información real inmediatamente."
    );

    content.append(
      button("Volver", dashboard, "as-secondary")
    );

    const form = node("form");

    const operation = selectField("Funcionamiento", [
      ["sin_verificar", "Sin verificar"],
      ["operativo", "Operativo"],
      ["parcial", "Operativo parcialmente"],
      ["suspendido", "Atención suspendida"]
    ]);

    const reception = selectField("Recepción de pacientes", [
      ["sin_verificar", "Sin verificar"],
      ["recibe", "Recibe pacientes"],
      ["limitada", "Recepción limitada"],
      ["no_recibe", "No recibe pacientes"]
    ]);

    const access = selectField("Accesibilidad", [
      ["sin_verificar", "Sin verificar"],
      ["accesible", "Accesible"],
      ["restringido", "Acceso restringido"],
      ["interrumpido", "Acceso interrumpido"]
    ]);

    const energy = selectField("Suministro eléctrico", [
      ["sin_verificar", "Sin verificar"],
      ["normal", "Normal"],
      ["afectado", "Afectado"],
      ["sin_servicio", "Sin servicio"]
    ]);

    const validity = selectField("Vigencia del aviso", [
      ["1", "1 hora"],
      ["3", "3 horas"],
      ["6", "6 horas"],
      ["12", "12 horas"],
      ["24", "24 horas"]
    ]);

    validity.input.value = "6";

    const observations = textArea(
      "Observaciones y acciones de respuesta"
    );

    const submit = node(
      "button",
      "Revisar y publicar declaración"
    );
    submit.type = "submit";

    form.append(
      operation.wrapper,
      reception.wrapper,
      access.wrapper,
      energy.wrapper,
      validity.wrapper,
      observations.wrapper,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const values = {
        p_centro_id: Number(authority.centro_id),
        p_operatividad: operation.input.value,
        p_recepcion_pacientes: reception.input.value,
        p_accesibilidad: access.input.value,
        p_energia: energy.input.value,
        p_observaciones:
          observations.input.value.trim() || null,
        p_vigencia_horas: Number(validity.input.value)
      };

      const allUnknown = [
        values.p_operatividad,
        values.p_recepcion_pacientes,
        values.p_accesibilidad,
        values.p_energia
      ].every(value => value === "sin_verificar");

      if (allUnknown) {
        notice(
          "Debés informar al menos una condición verificada."
        );
        return;
      }

      const summary = [
        "¿CONFIRMÁS LA PUBLICACIÓN OFICIAL?",
        "",
        centerName(authority.centro_id),
        "",
        "Funcionamiento: " +
          operation.input.selectedOptions[0].text,
        "Recepción: " +
          reception.input.selectedOptions[0].text,
        "Accesibilidad: " +
          access.input.selectedOptions[0].text,
        "Energía: " +
          energy.input.selectedOptions[0].text,
        "Vigencia: " +
          validity.input.selectedOptions[0].text,
        "",
        "La información será pública inmediatamente.",
        "Quedará registrada bajo tu identidad."
      ].join("\n");

      if (!window.confirm(summary)) return;

      submit.disabled = true;
      notice("Publicando declaración oficial…");

      try {
        const id = await rpc(
          "as_publicar_declaracion_oficial",
          values
        );

        dashboard();

        notice(
          "Declaración publicada correctamente.\n" +
          "Identificador: " + id +
          "\nPodés actualizar nuevamente en cualquier momento."
        );

      } catch (error) {
        notice("No se pudo publicar: " + error.message);
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  async function authoritiesAdmin() {
    screen("Gestión de autoridades");
    notice(
      "Las habilitaciones requieren designación previa. " +
      "Registrar una autoridad no publica estados."
    );

    content.append(
      button("Volver al panel", dashboard, "as-secondary")
    );

    const tabs = node("div", null, "as-tabs");
    const body = node("div");

    const newTab = button(
      "Nueva habilitación",
      () => showAuthorityForm(body)
    );

    const listTab = button(
      "Autoridades registradas",
      () => showAuthoritiesList(body)
    );

    tabs.append(newTab, listTab);
    content.append(tabs, body);

    try {
      users = await rpc("as_listar_usuarios_institucionales");

      if (!Array.isArray(users)) {
        throw new Error("Formato de usuarios inesperado");
      }

      showAuthorityForm(body);

    } catch (error) {
      notice(
        "No se pudo obtener el listado de usuarios: " +
        error.message
      );
    }
  }

  function showAuthorityForm(body) {
    body.replaceChildren();
    body.append(node("h3", "Nueva habilitación"));

    if (!centers.length) {
      body.append(
        node("p", "No hay establecimientos activos.")
      );
      return;
    }

    if (!users.length) {
      body.append(
        node(
          "p",
          "No hay usuarios institucionales activos disponibles."
        )
      );
      return;
    }

    const form = node("form");

    const center = selectField(
      "Establecimiento",
      centers.map(c => [c.id, c.nombre])
    );

    const person = selectField(
      "Usuario institucional",
      users.map(u => [
        u.usuario_id,
        `${u.nombre || "Sin nombre"} — ` +
        `${u.correo || "Sin correo"}`
      ])
    );

    const type = selectField("Tipo de autoridad", [
      ["direccion", "Dirección"],
      ["comite_crisis", "Comité de Crisis"]
    ]);

    const position = inputField("Cargo institucional");

    const document = inputField(
      "Documento o acto de designación"
    );

    const until = inputField(
      "Fecha de finalización (opcional)",
      "datetime-local",
      false
    );

    const observations = textArea(
      "Observaciones administrativas"
    );

    const submit = node("button", "Registrar habilitación");
    submit.type = "submit";

    form.append(
      center.wrapper,
      person.wrapper,
      type.wrapper,
      position.wrapper,
      document.wrapper,
      until.wrapper,
      observations.wrapper,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const selectedUser = users.find(
        u => u.usuario_id === person.input.value
      );

      const selectedCenter = centerName(
        center.input.value
      );

      if (!selectedUser) {
        notice("Seleccioná un usuario válido.");
        return;
      }

      const confirmation = [
        "¿CONFIRMÁS ESTA HABILITACIÓN?",
        "",
        "Establecimiento: " + selectedCenter,
        "Usuario: " + selectedUser.nombre,
        "Correo: " + selectedUser.correo,
        "Autoridad: " +
          type.input.selectedOptions[0].text,
        "Cargo: " + position.input.value.trim(),
        "Designación: " + document.input.value.trim(),
        "",
        "Confirmá únicamente si existe " +
          "una designación institucional válida."
      ].join("\n");

      if (!window.confirm(confirmation)) return;

      submit.disabled = true;
      notice("Registrando habilitación…");

      try {
        await rpc("as_habilitar_autoridad", {
          p_centro_id: Number(center.input.value),
          p_usuario_id: person.input.value,
          p_tipo_autoridad: type.input.value,
          p_cargo: position.input.value.trim(),
          p_documento_designacion:
            document.input.value.trim(),
          p_habilitado_desde: new Date().toISOString(),
          p_habilitado_hasta: until.input.value
            ? new Date(until.input.value).toISOString()
            : null,
          p_observaciones:
            observations.input.value.trim() || null
        });

        notice(
          "Habilitación registrada correctamente. " +
          "No se publicó ningún estado."
        );

        await showAuthoritiesList(body);

      } catch (error) {
        notice(
          "No se pudo registrar la habilitación: " +
          error.message
        );
      } finally {
        submit.disabled = false;
      }
    });

    body.append(form);
  }

  async function showAuthoritiesList(body) {
    body.replaceChildren();
    body.append(node("h3", "Autoridades registradas"));

    const filters = node("div", null, "as-card");

    const centerFilter = selectField(
      "Filtrar por establecimiento",
      [
        ["", "Todos los establecimientos"],
        ...centers.map(c => [String(c.id), c.nombre])
      ]
    );

    const statusFilter = selectField("Estado", [
      ["", "Todas"],
      ["vigente", "Vigentes"],
      ["no_vigente", "No vigentes"]
    ]);

    const list = node("div");

    filters.append(
      centerFilter.wrapper,
      statusFilter.wrapper
    );

    body.append(filters, list);

    let rows = [];

    function render() {
      list.replaceChildren();

      const filtered = rows.filter(a => {
        const centerMatches =
          !centerFilter.input.value ||
          String(a.centro_id) === centerFilter.input.value;

        const valid = activeAuthority(a);

        const statusMatches =
          !statusFilter.input.value ||
          (
            statusFilter.input.value === "vigente"
              ? valid
              : !valid
          );

        return centerMatches && statusMatches;
      });

      if (!filtered.length) {
        list.append(
          node(
            "p",
            "No hay habilitaciones que coincidan " +
            "con los filtros."
          )
        );
      }

      for (const a of filtered) {
        const person = users.find(
          u => u.usuario_id === a.usuario_id
        );

        const card = node("article", null, "as-card");

        card.append(
          node("h3", centerName(a.centro_id)),
          node(
            "p",
            "Autoridad: " +
            (
              a.tipo_autoridad === "direccion"
                ? "Dirección"
                : "Comité de Crisis"
            )
          ),
          node(
            "p",
            "Persona: " +
            (person?.nombre || "Usuario no disponible")
          ),
          node(
            "p",
            "Correo: " +
            (person?.correo || "No disponible")
          ),
          node("p", "Cargo: " + a.cargo),
          node(
            "p",
            "Designación: " + a.documento_designacion
          ),
          node(
            "p",
            "Desde: " + dateText(a.habilitado_desde)
          ),
          node(
            "p",
            "Hasta: " + dateText(a.habilitado_hasta)
          ),
          node(
            "p",
            "Estado: " +
            (
              activeAuthority(a)
                ? "Vigente"
                : "No vigente"
            )
          )
        );

        if (a.activo && !a.revocado_en) {
          card.append(
            button(
              "Revocar habilitación",
              async () => {
                const reason = window.prompt(
                  "Motivo de revocación " +
                  "(mínimo 10 caracteres):"
                );

                if (reason === null) return;

                if (reason.trim().length < 10) {
                  notice(
                    "El motivo debe tener al menos " +
                    "10 caracteres."
                  );
                  return;
                }

                if (!window.confirm(
                  "¿Confirmás la revocación inmediata " +
                  "de esta habilitación?"
                )) return;

                try {
                  await rpc("as_revocar_autoridad", {
                    p_autorizacion_id: a.id,
                    p_motivo: reason.trim()
                  });

                  notice(
                    "Habilitación revocada correctamente."
                  );

                  await showAuthoritiesList(body);

                } catch (error) {
                  notice(
                    "No se pudo revocar: " + error.message
                  );
                }
              },
              "as-danger"
            )
          );
        }

        list.append(card);
      }
    }

    centerFilter.input.addEventListener("change", render);
    statusFilter.input.addEventListener("change", render);

    try {
      rows = await rest(
        "as_autoridades_institucionales",
        "select=id,centro_id,usuario_id,tipo_autoridad," +
        "cargo,documento_designacion,activo," +
        "habilitado_desde,habilitado_hasta,revocado_en" +
        "&order=creado_en.desc&limit=500"
      );

      render();

    } catch (error) {
      notice(
        "No se pudieron consultar las habilitaciones: " +
        error.message
      );
    }
  }

  login();
})();
