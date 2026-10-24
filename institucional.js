
/*
 * APP ALERTA SALUD V1.9.1
 * Panel de autoridades y declaraciones oficiales
 *
 * Requiere SQL 14A, 14B, 14C y 14D.
 * La autorización efectiva se comprueba en Supabase.
 * No almacena contraseñas ni sesiones en localStorage.
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
  let authorities = [];
  let centers = [];

  const css = document.createElement("style");
  css.textContent = `
    .as-panel {
      margin: 20px 0;
      padding: 18px;
      background: #fff;
      color: #172b3a;
      border: 1px solid #d7e1ea;
      border-radius: 14px;
    }
    .as-panel h2, .as-panel h3 {
      margin: 0 0 12px;
    }
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
      border: 1px solid #aebdca;
      border-radius: 8px;
      background: white;
      color: #172b3a;
      font: inherit;
      font-weight: 400;
    }
    .as-panel button {
      padding: 10px 14px;
      margin: 5px 6px 5px 0;
      background: #14618b;
      color: white;
      border: 0;
      border-radius: 8px;
      font: inherit;
      cursor: pointer;
    }
    .as-panel button:disabled {
      opacity: .55;
      cursor: wait;
    }
    .as-panel button.as-secondary {
      background: #475569;
    }
    .as-panel button.as-danger {
      background: #a72b35;
    }
    .as-message {
      padding: 12px;
      margin: 12px 0;
      background: #edf5fb;
      border-radius: 8px;
      white-space: pre-wrap;
    }
    .as-card {
      padding: 14px;
      margin: 12px 0;
      border: 1px solid #d7e1ea;
      border-radius: 10px;
    }
    .as-card p {
      margin: 7px 0;
    }
    .as-muted {
      color: #526577;
      font-size: .9rem;
    }
    .as-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  `;
  document.head.appendChild(css);

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    if (className) node.className = className;
    return node;
  }

  function btn(text, fn, className = "") {
    const b = el("button", text, className);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function field(label, type = "text") {
    const wrap = el("label", label);
    const input = el("input");
    input.type = type;
    input.required = true;
    wrap.append(input);
    return { wrap, input };
  }

  function select(label, options) {
    const wrap = el("label", label);
    const input = el("select");

    for (const [value, name] of options) {
      const option = el("option", name);
      option.value = value;
      input.append(option);
    }

    wrap.append(input);
    return { wrap, input };
  }

  function textarea(label) {
    const wrap = el("label", label);
    const input = el("textarea");
    input.rows = 4;
    input.maxLength = 3000;
    wrap.append(input);
    return { wrap, input };
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

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(API + path, {
      ...options,
      headers,
      cache: "no-store"
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.message ||
        body?.error_description ||
        body?.error ||
        `Error HTTP ${response.status}`
      );
    }

    return body;
  }

  function rest(table, query) {
    return request(`/rest/v1/${table}?${query}`);
  }

  function rpc(name, args) {
    return request(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });
  }

  const panel = el("section", null, "as-panel");
  const heading = el("h2", "Acceso institucional");
  const message = el("div", "", "as-message");
  const content = el("div");

  message.setAttribute("role", "status");
  panel.append(heading, message, content);
  host.append(panel);

  function notice(text) {
    message.textContent = text;
  }

  function clear(title) {
    heading.textContent = title;
    content.replaceChildren();
  }

  function centerName(id) {
    return centers.find(c => String(c.id) === String(id))
      ?.nombre || `Establecimiento ${id}`;
  }

  function activeAuthority(a) {
    const now = Date.now();
    return (
      a.activo === true &&
      !a.revocado_en &&
      Date.parse(a.habilitado_desde) <= now &&
      (
        !a.habilitado_hasta ||
        Date.parse(a.habilitado_hasta) > now
      )
    );
  }

  function logout() {
    token = null;
    user = null;
    profile = null;
    authorities = [];
    centers = [];
    showLogin();
  }

  function showLogin() {
    clear("Acceso institucional");

    notice(
      "Ingreso exclusivo para Dirección, Comité de Crisis " +
      "y administradores autorizados."
    );

    const form = el("form");
    const email = field("Correo electrónico", "email");
    const password = field("Contraseña", "password");

    email.input.autocomplete = "username";
    password.input.autocomplete = "current-password";

    const submit = el("button", "Ingresar");
    submit.type = "submit";

    form.append(email.wrap, password.wrap, submit);

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
        await dashboard();

      } catch (error) {
        logout();
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

    const isSuper = (
      profile?.activo === true &&
      profile?.rol === "superadmin"
    );

    const isAdmin = (
      profile?.activo === true &&
      profile?.rol === "admin"
    );

    if (
      !isSuper &&
      !isAdmin &&
      !authorities.some(activeAuthority)
    ) {
      throw new Error(
        "La cuenta no tiene una habilitación institucional vigente."
      );
    }
  }

  async function dashboard() {
    clear("Panel institucional");

    notice(
      `${profile?.nombre || user.email || "Usuario"}\n` +
      "La publicación de estados está reservada a " +
      "autoridades institucionales previamente habilitadas."
    );

    const actions = el("div", null, "as-actions");
    actions.append(
      btn("Actualizar", async () => {
        try {
          await loadIdentity();
          await dashboard();
        } catch (error) {
          notice(error.message);
        }
      }),
      btn("Cerrar sesión", logout, "as-secondary")
    );

    content.append(actions);

    const own = authorities.filter(activeAuthority);

    if (own.length) {
      const box = el("section", null, "as-card");
      box.append(
        el("h3", "Declaraciones institucionales")
      );

      for (const a of own) {
        const card = el("div", null, "as-card");

        card.append(
          el("h3", centerName(a.centro_id)),
          el(
            "p",
            a.tipo_autoridad === "direccion"
              ? "Autoridad: Dirección"
              : "Autoridad: Comité de Crisis"
          ),
          el("p", "Cargo: " + a.cargo),
          btn(
            "Declarar estado operativo",
            () => declarationForm(a)
          )
        );

        box.append(card);
      }

      content.append(box);
    }

    if (profile?.activo && profile.rol === "superadmin") {
      const box = el("section", null, "as-card");
      box.append(
        el("h3", "Administración de autoridades"),
        el(
          "p",
          "Registrar o revocar designaciones institucionales."
        ),
        btn(
          "Gestionar autoridades",
          authoritiesAdmin
        )
      );
      content.append(box);
    }

    if (!own.length && profile?.rol !== "superadmin") {
      content.append(
        el(
          "p",
          "No tenés establecimientos habilitados para " +
          "publicar estados operativos.",
          "as-muted"
        )
      );
    }
  }

  function declarationForm(authority) {
    clear("Declaración oficial");

    notice(
      "Establecimiento: " +
      centerName(authority.centro_id) +
      "\nEsta acción publica información REAL " +
      "inmediatamente en el sistema."
    );

    content.append(
      btn("Volver", dashboard, "as-secondary")
    );

    const form = el("form");

    const operation = select("Funcionamiento", [
      ["sin_verificar", "Sin verificar"],
      ["operativo", "Operativo"],
      ["parcial", "Operativo parcialmente"],
      ["suspendido", "Atención suspendida"]
    ]);

    const reception = select("Recepción de pacientes", [
      ["sin_verificar", "Sin verificar"],
      ["recibe", "Recibe pacientes"],
      ["limitada", "Recepción limitada"],
      ["no_recibe", "No recibe pacientes"]
    ]);

    const access = select("Accesibilidad", [
      ["sin_verificar", "Sin verificar"],
      ["accesible", "Accesible"],
      ["restringido", "Acceso restringido"],
      ["interrumpido", "Acceso interrumpido"]
    ]);

    const energy = select("Suministro eléctrico", [
      ["sin_verificar", "Sin verificar"],
      ["normal", "Normal"],
      ["afectado", "Afectado"],
      ["sin_servicio", "Sin servicio"]
    ]);

    const validity = select("Vigencia del aviso", [
      ["1", "1 hora"],
      ["3", "3 horas"],
      ["6", "6 horas"],
      ["12", "12 horas"],
      ["24", "24 horas"]
    ]);

    validity.input.value = "6";

    const observations = textarea(
      "Observaciones y acciones de respuesta"
    );

    const submit = el(
      "button",
      "Revisar y publicar declaración"
    );
    submit.type = "submit";

    form.append(
      operation.wrap,
      reception.wrap,
      access.wrap,
      energy.wrap,
      validity.wrap,
      observations.wrap,
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
        p_observaciones: observations.input.value.trim(),
        p_vigencia_horas: Number(validity.input.value)
      };

      if (
        [
          values.p_operatividad,
          values.p_recepcion_pacientes,
          values.p_accesibilidad,
          values.p_energia
        ].every(v => v === "sin_verificar")
      ) {
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
        "Funcionamiento: " + operation.input.selectedOptions[0].text,
        "Recepción: " + reception.input.selectedOptions[0].text,
        "Accesibilidad: " + access.input.selectedOptions[0].text,
        "Energía: " + energy.input.selectedOptions[0].text,
        "Vigencia: " + validity.input.selectedOptions[0].text,
        "",
        "La información será pública inmediatamente.",
        "Quedará registrada bajo tu identidad institucional."
      ].join("\n");

      if (!window.confirm(summary)) return;

      submit.disabled = true;
      notice("Publicando declaración oficial…");

      try {
        const id = await rpc(
          "as_publicar_declaracion_oficial",
          values
        );

        await dashboard();

        notice(
          "Declaración publicada correctamente.\n" +
          "Identificador: " + id +
          "\nPodés realizar una nueva actualización " +
          "en cualquier momento."
        );

      } catch (error) {
        notice(
          "No se pudo publicar: " + error.message
        );
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  async function authoritiesAdmin() {
    clear("Gestión de autoridades");

    notice(
      "Las habilitaciones requieren designación previa. " +
      "Registrar una autoridad no publica estados."
    );

    content.append(
      btn("Volver al panel", dashboard, "as-secondary")
    );

    const form = el("form");

    const center = select(
      "Establecimiento",
      centers.map(c => [String(c.id), c.nombre])
    );

    const userId = field(
      "UUID del usuario registrado en Supabase Auth"
    );

    const type = select("Tipo de autoridad", [
      ["direccion", "Dirección"],
      ["comite_crisis", "Comité de Crisis"]
    ]);

    const position = field("Cargo institucional");
    const document = field(
      "Documento o acto de designación"
    );

    const until = field(
      "Fecha de finalización (opcional)",
      "datetime-local"
    );
    until.input.required = false;

    const observations = textarea(
      "Observaciones administrativas"
    );

    const submit = el("button", "Registrar habilitación");
    submit.type = "submit";

    form.append(
      center.wrap,
      userId.wrap,
      type.wrap,
      position.wrap,
      document.wrap,
      until.wrap,
      observations.wrap,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!window.confirm(
        "¿Confirmás que existe una designación institucional " +
        "previa y válida para esta persona?"
      )) return;

      submit.disabled = true;
      notice("Registrando autorización…");

      try {
        await rpc("as_habilitar_autoridad", {
          p_centro_id: Number(center.input.value),
          p_usuario_id: userId.input.value.trim(),
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
          "Autoridad habilitada. " +
          "La designación quedó registrada."
        );

        await showAuthoritiesList();

      } catch (error) {
        notice(
          "No se pudo habilitar: " + error.message
        );
      } finally {
        submit.disabled = false;
      }
    });

    content.append(
      el("h3", "Nueva habilitación"),
      form,
      el("h3", "Habilitaciones registradas")
    );

    await showAuthoritiesList();
  }

  async function showAuthoritiesList() {
    let list = document.getElementById("as-authorities-list");

    if (!list) {
      list = el("div");
      list.id = "as-authorities-list";
      content.append(list);
    }

    list.replaceChildren();

    try {
      const rows = await rest(
        "as_autoridades_institucionales",
        "select=id,centro_id,usuario_id,tipo_autoridad," +
        "cargo,documento_designacion,activo," +
        "habilitado_desde,habilitado_hasta,revocado_en" +
        "&order=creado_en.desc&limit=100"
      );

      if (!rows.length) {
        list.append(
          el("p", "Todavía no hay autoridades registradas.")
        );
      }

      for (const a of rows) {
        const card = el("article", null, "as-card");

        card.append(
          el("h3", centerName(a.centro_id)),
          el(
            "p",
            a.tipo_autoridad === "direccion"
              ? "Dirección"
              : "Comité de Crisis"
          ),
          el("p", "Cargo: " + a.cargo),
          el("p", "Usuario: " + a.usuario_id),
          el(
            "p",
            "Designación: " + a.documento_designacion
          ),
          el(
            "p",
            "Desde: " + dateText(a.habilitado_desde)
          ),
          el(
            "p",
            "Hasta: " +
            (
              a.habilitado_hasta
                ? dateText(a.habilitado_hasta)
                : "Sin fecha de finalización"
            )
          ),
          el(
            "p",
            "Estado: " +
            (
              activeAuthority(a)
                ? "Habilitación vigente"
                : "No vigente"
            )
          )
        );

        if (a.activo && !a.revocado_en) {
          card.append(
            btn(
              "Revocar habilitación",
              async () => {
                const reason = window.prompt(
                  "Indicá el motivo de revocación " +
                  "(mínimo 10 caracteres):"
                );

                if (reason === null) return;

                if (reason.trim().length < 10) {
                  notice(
                    "El motivo debe tener al menos 10 caracteres."
                  );
                  return;
                }

                if (!window.confirm(
                  "¿Confirmás la revocación inmediata?"
                )) return;

                try {
                  await rpc("as_revocar_autoridad", {
                    p_autorizacion_id: a.id,
                    p_motivo: reason.trim()
                  });

                  notice("Habilitación revocada.");
                  await showAuthoritiesList();

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

    } catch (error) {
      notice(
        "No se pudieron consultar las autoridades: " +
        error.message
      );
    }
  }

  showLogin();

})();
