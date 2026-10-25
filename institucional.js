
/*
 * APP ALERTA SALUD V1.10.19
 * PANEL INSTITUCIONAL
 *
 * Funciones:
 * - Inicio y cierre de sesión
 * - Declaraciones oficiales
 * - Publicación de novedades institucionales
 * - Vista previa y confirmación
 * - Administración de autoridades
 * - Consulta y revocación de habilitaciones
 *
 * La autorización definitiva se verifica
 * mediante funciones seguras de Supabase.
 */

(() => {
  "use strict";

  const cfg = window.ALERTA_SUPABASE;
  const host = document.getElementById("view-mas");

  if (!cfg?.url || !cfg?.publishableKey || !host) {
    console.error("Configuración institucional no disponible");
    return;
  }

  if (document.getElementById("asInstitutionalPanel")) {
    return;
  }

  const API = cfg.url.replace(/\/$/, "");

  let token = null;
  let user = null;
  let profile = null;
  let centers = [];
  let authorities = [];
  let users = [];

  const $ = id => document.getElementById(id);

  const style = document.createElement("style");

  style.textContent = `
    .as-panel {
      margin: 20px 0;
      padding: 16px;
      border: 1px solid #d5e0e9;
      border-radius: 13px;
      background: #fff;
      color: #173047;
      box-sizing: border-box;
    }

    .as-panel h2 {
      margin: 0 0 12px;
    }

    .as-panel h3 {
      margin: 14px 0 8px;
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

    .as-panel .as-secondary {
      background: #475569;
    }

    .as-panel .as-danger {
      background: #a72b35;
    }

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

    .as-panel .as-card p {
      margin: 6px 0;
    }

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

    .as-panel .as-preview {
      border: 2px solid #9bb9cf;
      background: #f5f9fc;
      padding: 15px;
      border-radius: 10px;
      margin: 14px 0;
    }

    .as-panel .as-preview p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.55;
    }

    .as-panel .as-warning {
      border-left: 4px solid #bb7921;
      background: #fff7e8;
      padding: 12px;
      margin: 12px 0;
      line-height: 1.5;
    }

    .as-panel .as-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 12px 0;
    }
  `;

  document.head.append(style);

  function node(tag, text = null, className = "") {
    const element = document.createElement(tag);

    if (text !== null) {
      element.textContent = String(text);
    }

    if (className) {
      element.className = className;
    }

    return element;
  }

  function button(text, action, className = "") {
    const element = node("button", text, className);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
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

    for (const [value, text] of options) {
      input.add(new Option(text, String(value)));
    }

    wrapper.append(input);
    return { wrapper, input };
  }

  function textArea(label, maxLength = 2000) {
    const wrapper = node("label", label);
    const input = node("textarea");

    input.rows = 4;
    input.maxLength = maxLength;
    wrapper.append(input);

    return { wrapper, input };
  }

  function dateText(value) {
    if (!value) return "Sin fecha de finalización";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Fecha inválida"
      : date.toLocaleString("es-AR");
  }

  function centerName(id) {
    return centers.find(
      center => String(center.id) === String(id)
    )?.nombre || `Establecimiento ${id}`;
  }

  function activeAuthority(authority) {
    const now = Date.now();

    return authority.activo === true &&
      !authority.revocado_en &&
      Date.parse(authority.habilitado_desde) <= now &&
      (
        !authority.habilitado_hasta ||
        Date.parse(authority.habilitado_hasta) > now
      );
  }

  function isSuperadmin() {
    return profile?.activo === true &&
      profile?.rol === "superadmin";
  }

  async function request(path, options = {}) {
    const headers = {
      apikey: cfg.publishableKey,
      Accept: "application/json",
      ...options.headers
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });
  }

  const panel = node("section", null, "as-panel");
  panel.id = "asInstitutionalPanel";

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

  function notifyAuth() {
    document.dispatchEvent(new Event("alerta:auth"));
  }

  window.AlertaSaludInstitucionalAuth = Object.freeze({
    getAccessToken: () => (isSuperadmin() && token ? token : null),
    isSuperadmin: () => Boolean(token && isSuperadmin())
  });

  function logout() {
    token = null;
    user = null;
    profile = null;
    centers = [];
    authorities = [];
    users = [];
    notifyAuth();
    login();
  }

  function login() {
    screen("Acceso institucional");

    notice(
      "Ingreso exclusivo para Dirección, Comité de Crisis " +
      "y administradores autorizados."
    );

    const form = node("form");

    const email = inputField(
      "Correo electrónico",
      "email"
    );

    const password = inputField(
      "Contraseña",
      "password"
    );

    const submit = node("button", "Ingresar");
    submit.type = "submit";

    email.input.autocomplete = "username";
    password.input.autocomplete = "current-password";

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

        token = session.access_token;
        user = session.user;

        await loadIdentity();
        notifyAuth();
        dashboard();

      } catch (error) {
        token = null;
        user = null;
        profile = null;
        notifyAuth();

        notice(
          "No se pudo ingresar: " + error.message
        );

      } finally {
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  async function loadIdentity() {
    if (!user?.id) {
      throw new Error("Sesión institucional no disponible");
    }

    const profiles = await rest(
      "as_perfiles",
      "select=usuario_id,nombre,rol,activo" +
      "&usuario_id=eq." +
      encodeURIComponent(user.id) +
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
      "&usuario_id=eq." +
      encodeURIComponent(user.id)
    );

    const institutionalRole =
      profile?.activo === true &&
      ["superadmin", "admin"].includes(profile.rol);

    if (
      !institutionalRole &&
      !authorities.some(activeAuthority)
    ) {
      throw new Error(
        "No existe una habilitación institucional vigente."
      );
    }
  }

  function dashboard() {
    screen("Panel institucional");

    const own = authorities.filter(activeAuthority);
    const superadmin = isSuperadmin();
    notice(`${profile?.nombre || user?.email || "Usuario"}\n` +
      (superadmin
        ? "Superadmin: gestión y publicación para todos los establecimientos. Cada publicación requiere autorización del servidor."
        : "Las publicaciones oficiales requieren una habilitación institucional vigente."));

    const actions = node("div", null, "as-actions");
    actions.append(
      button("Actualizar", async () => {
        try { await loadIdentity(); notifyAuth(); dashboard(); }
        catch (error) { notice(error.message); }
      }),
      button("Cerrar sesión", logout, "as-secondary")
    );
    content.append(actions);

    const publicationSection = node("section", null, "as-card");
    publicationSection.append(node("h3", "Publicaciones institucionales"));

    if (superadmin) {
      publicationSection.append(node("p",
        "Seleccioná el establecimiento. La simulación no publica ni envía avisos; la publicación real exige doble confirmación."));
      const availableCenters = centers.filter(c => c.activo === true);
      if (!availableCenters.length) {
        publicationSection.append(node("p", "No se encontraron establecimientos activos.", "as-muted"));
      } else {
        const options = availableCenters.map(c => [String(c.id), c.nombre]);
        const selected = selectField("Establecimiento", options);
        publicationSection.append(selected.wrapper);
        const chosenAuthority = () => ({ centro_id: Number(selected.input.value),
          tipo_autoridad: "superadmin", cargo: "Superadmin" });
        const publicationActions = node("div", null, "as-actions");
        publicationActions.append(
          button("Crear aviso o alerta", () => notificationForm(chosenAuthority())),
          button("Declarar estado operativo", () => declarationForm(chosenAuthority()), "as-secondary")
        );
        publicationSection.append(publicationActions);
      }
    } else if (own.length) {
      for (const authority of own) {
        const card = node("div", null, "as-card");
        card.append(
          node("h3", centerName(authority.centro_id)),
          node("p", authority.tipo_autoridad === "direccion" ? "Dirección" : "Comité de Crisis"),
          node("p", authority.cargo),
          button("Declarar estado operativo", () => declarationForm(authority)),
          button("Crear aviso o alerta", () => notificationForm(authority))
        );
        publicationSection.append(card);
      }
    } else {
      publicationSection.append(node("p",
        "No tenés establecimientos habilitados para realizar publicaciones oficiales.", "as-muted"));
    }
    content.append(publicationSection);

    if (superadmin) {
      const section = node("section", null, "as-card");
      section.append(
        node("h3", "Administración de autoridades"),
        node("p", "Registrar, consultar y revocar designaciones institucionales."),
        button("Gestionar autoridades", authoritiesAdmin),
        button("⚠ Simular alarma crítica", async () => {
          try { await window.AlertaSaludEmergencia.demo(); }
          catch (error) { notice("No se pudo iniciar la demostración: " + error.message); }
        })
      );
      content.append(section);
    }
  }

  // =========================================
  // DECLARACIONES DE ESTADO OPERATIVO
  // =========================================

  function declarationForm(authority) {
    screen("Declaración oficial");

    notice(
      "Establecimiento: " +
      centerName(authority.centro_id) +
      "\nLa confirmación publica información real."
    );

    content.append(
      button(
        "Volver al panel",
        dashboard,
        "as-secondary"
      )
    );

    const form = node("form");

    const operation = selectField("Funcionamiento", [
      ["sin_verificar", "Sin verificar"],
      ["operativo", "Operativo"],
      ["parcial", "Operativo parcialmente"],
      ["suspendido", "Atención suspendida"]
    ]);

    const reception = selectField(
      "Recepción de pacientes",
      [
        ["sin_verificar", "Sin verificar"],
        ["recibe", "Recibe pacientes"],
        ["limitada", "Recepción limitada"],
        ["no_recibe", "No recibe pacientes"]
      ]
    );

    const access = selectField("Accesibilidad", [
      ["sin_verificar", "Sin verificar"],
      ["accesible", "Accesible"],
      ["restringido", "Acceso restringido"],
      ["interrumpido", "Acceso interrumpido"]
    ]);

    const energy = selectField(
      "Suministro eléctrico",
      [
        ["sin_verificar", "Sin verificar"],
        ["normal", "Normal"],
        ["afectado", "Afectado"],
        ["sin_servicio", "Sin servicio"]
      ]
    );

    const validity = selectField(
      "Vigencia del aviso",
      [
        ["1", "1 hora"],
        ["3", "3 horas"],
        ["6", "6 horas"],
        ["12", "12 horas"],
        ["24", "24 horas"]
      ]
    );

    validity.input.value = "6";

    const observations = textArea(
      "Observaciones y acciones de respuesta",
      3000
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

      if (
        [
          values.p_operatividad,
          values.p_recepcion_pacientes,
          values.p_accesibilidad,
          values.p_energia
        ].every(value => value === "sin_verificar")
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
        notice(
          "No se pudo publicar: " + error.message
        );
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  // =========================================
  // NOVEDADES INSTITUCIONALES V1.9.7
  // =========================================

  function notificationForm(authority) {
    screen("Nueva comunicación institucional");

    const center = centerName(authority.centro_id);

    notice(
      "Establecimiento: " + center +
      "\nEsta función comunica cambios específicos " +
      "en los servicios. No modifica automáticamente " +
      "el estado operativo general del establecimiento."
    );

    content.append(
      button(
        "Volver al panel",
        dashboard,
        "as-secondary"
      )
    );

    const warning = node(
      "div",
      "Seleccioná primero el modo de trabajo. SIMULACIÓN no publica " +
      "ni envía mensajes. PUBLICACIÓN REAL requiere doble confirmación.",
      "as-warning"
    );

    content.append(warning);

    const form = node("form");
    const mode = selectField("Modo de trabajo", [
      ["simulacion", "SIMULACIÓN — sin publicar ni enviar"],
      ["real", "PUBLICACIÓN REAL — requiere doble confirmación"]
    ]);
    mode.input.value = "simulacion";
    form.append(mode.wrapper);


    const type = selectField(
      "Tipo de cambio",
      [
        ["cambio_horario", "Cambio de horarios"],
        ["restriccion", "Restricción de atención"],
        ["suspension", "Suspensión de atención"],
        ["cierre", "Cierre de atención"],
        ["restablecimiento", "Restablecimiento"],
        ["otro", "Otra modificación"]
      ]
    );

    const service = inputField(
      "Servicio afectado"
    );

    service.input.maxLength = 150;
    service.input.minLength = 2;
    service.input.placeholder =
      "Ej.: Consultorios externos";

    const headline = inputField(
      "Título de la comunicación"
    );

    headline.input.minLength = 5;
    headline.input.maxLength = 150;
    headline.input.placeholder =
      "Describí el cambio de forma breve";

    const description = textArea(
      "Descripción del cambio",
      2000
    );

    description.input.minLength = 10;
    description.input.required = true;
    description.input.placeholder =
      "Explicá qué cambia, a quiénes afecta " +
      "y desde cuándo.";

    const instructions = textArea(
      "Indicaciones para la población (opcional)",
      2000
    );

    instructions.input.placeholder =
      "Ej.: Los pacientes con turnos asignados " +
      "deben comunicarse por los canales oficiales.";

    const start = inputField(
      "Inicio de vigencia (opcional)",
      "datetime-local",
      false
    );

    const end = inputField(
      "Finalización de vigencia (opcional)",
      "datetime-local",
      false
    );

    const previous = selectField(
      "Comunicación anterior relacionada",
      [
        ["", "Ninguna / comunicación nueva"]
      ]
    );

    const previousStatus = node(
      "p",
      "Consultando comunicaciones anteriores…",
      "as-muted"
    );

    const previewButton = button(
      "Revisar comunicación",
      () => {
        if (!form.reportValidity()) return;

        const values = collectValues();

        if (!validateValues(values)) return;

        showPreview(values);
      }
    );

    form.append(
      type.wrapper,
      service.wrapper,
      headline.wrapper,
      description.wrapper,
      instructions.wrapper,
      start.wrapper,
      end.wrapper,
      previous.wrapper,
      previousStatus,
      previewButton
    );

    content.append(form);

    // Cargar comunicaciones previas oficiales
    // del mismo establecimiento.
    async function loadPrevious() {
      try {
        const rows = await rest(
          "as_notificaciones",
          "select=id,titulo,publicado_en" +
          "&centro_id=eq." +
          encodeURIComponent(authority.centro_id) +
          "&publicado=eq.true" +
          "&es_prueba=eq.false" +
          "&order=publicado_en.desc" +
          "&limit=100"
        );

        for (const item of rows || []) {
          previous.input.add(
            new Option(
              `${item.titulo} — ${dateText(item.publicado_en)}`,
              item.id
            )
          );
        }

        previousStatus.textContent =
          rows?.length
            ? "Podés vincular esta novedad con una " +
              "comunicación oficial anterior."
            : "No hay comunicaciones anteriores disponibles.";

      } catch (error) {
        previousStatus.textContent =
          "No fue posible consultar comunicaciones " +
          "anteriores. Podés continuar con una " +
          "comunicación nueva.";
        console.warn(error);
      }
    }

    function collectValues() {
      return {
        p_centro_id: Number(authority.centro_id),
        p_tipo_cambio: type.input.value,
        p_servicio_afectado:
          service.input.value.trim(),
        p_titulo:
          headline.input.value.trim(),
        p_descripcion:
          description.input.value.trim(),
        p_indicaciones:
          instructions.input.value.trim() || null,
        p_vigente_desde:
          start.input.value
            ? new Date(start.input.value).toISOString()
            : null,
        p_vigente_hasta:
          end.input.value
            ? new Date(end.input.value).toISOString()
            : null,
        p_notificacion_anterior_id:
          previous.input.value || null
      };
    }

    function validateValues(values) {
      if (
        values.p_servicio_afectado.length < 2 ||
        values.p_servicio_afectado.length > 150
      ) {
        notice(
          "Identificá el servicio afectado " +
          "con entre 2 y 150 caracteres."
        );
        return false;
      }

      if (
        values.p_titulo.length < 5 ||
        values.p_titulo.length > 150
      ) {
        notice(
          "El título debe tener entre 5 y 150 caracteres."
        );
        return false;
      }

      if (
        values.p_descripcion.length < 10 ||
        values.p_descripcion.length > 2000
      ) {
        notice(
          "La descripción debe tener entre " +
          "10 y 2000 caracteres."
        );
        return false;
      }

      const from = values.p_vigente_desde
        ? Date.parse(values.p_vigente_desde)
        : Date.now();

      if (
        values.p_vigente_hasta &&
        Date.parse(values.p_vigente_hasta) <= from
      ) {
        notice(
          "La fecha de finalización debe ser " +
          "posterior al inicio de vigencia."
        );
        return false;
      }

      return true;
    }

    function showPreview(values) {
      const oldPreview = $("asPublicationPreview");
      oldPreview?.remove();

      const box = node(
        "section",
        null,
        "as-preview"
      );

      box.id = "asPublicationPreview";

      box.append(
        node("h3", "Vista previa de la comunicación"),
        node("p", "Establecimiento: " + center),
        node(
          "p",
          "Tipo: " +
          type.input.selectedOptions[0].text
        ),
        node(
          "p",
          "Servicio: " + values.p_servicio_afectado
        ),
        node("h3", values.p_titulo),
        node("p", values.p_descripcion)
      );

      if (values.p_indicaciones) {
        box.append(
          node("h3", "Indicaciones"),
          node("p", values.p_indicaciones)
        );
      }

      box.append(
        node(
          "p",
          "Inicio: " +
          (
            values.p_vigente_desde
              ? dateText(values.p_vigente_desde)
              : "Al momento de publicar"
          )
        ),
        node(
          "p",
          "Finalización: " +
          dateText(values.p_vigente_hasta)
        )
      );

      if (values.p_notificacion_anterior_id) {
        box.append(
          node(
            "p",
            "Esta comunicación quedará vinculada " +
            "a una publicación anterior."
          )
        );
      }

      const isReal = mode.input.value === "real";
      const selectedMode = mode.input.value;
      box.append(node("p", isReal
        ? "MODO REAL: la publicación será visible para la población. " +
          "El envío Push requiere habilitar el motor de distribución por separado."
        : "SIMULACIÓN LOCAL: no se publica en Supabase ni se envía Push.",
        "as-warning"));

      if (!isReal) {
        box.append(
          node("p", "DEMOSTRACIÓN · NO ES UNA EMERGENCIA REAL"),
          button("Cerrar simulación", () => box.remove(), "as-secondary")
        );
      } else {
        const firstCheck = node("input");
        firstCheck.type = "checkbox";
        firstCheck.id = "asRealConfirm1";
        const firstLabel = node("label");
        firstLabel.append(firstCheck, document.createTextNode(
          " Confirmo que esta comunicación es REAL, no una simulación, " +
          "y que revisé el establecimiento, contenido y vigencia."
        ));
        const secondArea = node("div");
        secondArea.hidden = true;
        const secondLabel = node("label", "Confirmación 2 de 2: escribí ENVIAR ALERTA REAL");
        const secondInput = node("input");
        secondInput.type = "text";
        secondInput.autocomplete = "off";
        secondInput.spellcheck = false;
        secondLabel.append(secondInput);
        const confirmButton = button("Autorizar publicación REAL", async () => {
          if (mode.input.value !== selectedMode ||
              JSON.stringify(collectValues()) !== JSON.stringify(values)) {
            notice("Se modificó el modo o el formulario. Revisá nuevamente.");
            box.remove();
            return;
          }
          if (!firstCheck.checked ||
              secondInput.value.trim() !== "ENVIAR ALERTA REAL") {
            notice("Debés completar ambas confirmaciones.");
            return;
          }
          confirmButton.disabled = true;
          previewButton.disabled = true;
          notice("Publicando comunicación oficial…");
          try {
            const id = await rpc("as_publicar_notificacion_institucional", values);
            dashboard();
            notice("Comunicación oficial publicada. Identificador: " + id +
              "\nLa distribución Push masiva no se inicia desde esta pantalla. " +
              "Requiere autorización del motor de envíos de producción.");
          } catch (error) {
            notice("No se pudo publicar: " + error.message);
            confirmButton.disabled = false;
            previewButton.disabled = false;
          }
        }, "as-danger");
        confirmButton.disabled = true;
        const continueButton = button("Continuar a confirmación 2 de 2", () => {
          if (!firstCheck.checked) {
            notice("Primero confirmá que no es una simulación.");
            return;
          }
          if (mode.input.value !== selectedMode ||
              JSON.stringify(collectValues()) !== JSON.stringify(values)) {
            notice("El formulario cambió. Revisá nuevamente.");
            box.remove();
            return;
          }
          firstCheck.disabled = true;
          continueButton.disabled = true;
          secondArea.hidden = false;
          secondInput.focus();
        });
        secondInput.addEventListener("input", () => {
          confirmButton.disabled = secondInput.value.trim() !== "ENVIAR ALERTA REAL";
        });
        secondArea.append(secondLabel, confirmButton);
        box.append(firstLabel, continueButton, secondArea);
      }
      box.append(button("Volver a editar", () => box.remove(), "as-secondary"));

      form.after(box);

      box.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    loadPrevious();
  }

  // =========================================
  // ADMINISTRACIÓN DE AUTORIDADES
  // =========================================

  async function authoritiesAdmin() {
    if (!isSuperadmin()) {
      notice("No tenés permiso para gestionar autoridades.");
      return;
    }

    screen("Gestión de autoridades");

    notice(
      "Las habilitaciones requieren designación previa. " +
      "Registrar una autoridad no publica información."
    );

    content.append(
      button(
        "Volver al panel",
        dashboard,
        "as-secondary"
      )
    );

    const tabs = node("div", null, "as-tabs");
    const body = node("div");

    tabs.append(
      button(
        "Nueva habilitación",
        () => showAuthorityForm(body)
      ),
      button(
        "Autoridades registradas",
        () => showAuthoritiesList(body)
      )
    );

    content.append(tabs, body);

    try {
      users = await rpc(
        "as_listar_usuarios_institucionales"
      );

      if (!Array.isArray(users)) {
        throw new Error(
          "Formato de usuarios inesperado"
        );
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

    body.append(
      node("h3", "Nueva habilitación")
    );

    if (!centers.length || !users.length) {
      body.append(
        node(
          "p",
          "No hay establecimientos o usuarios " +
          "institucionales disponibles."
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

    const type = selectField(
      "Tipo de autoridad",
      [
        ["direccion", "Dirección"],
        ["comite_crisis", "Comité de Crisis"]
      ]
    );

    const position = inputField(
      "Cargo institucional"
    );

    const documentField = inputField(
      "Documento o acto de designación"
    );

    const until = inputField(
      "Fecha de finalización (opcional)",
      "datetime-local",
      false
    );

    const observations = textArea(
      "Observaciones administrativas",
      3000
    );

    const submit = node(
      "button",
      "Registrar habilitación"
    );

    submit.type = "submit";

    form.append(
      center.wrapper,
      person.wrapper,
      type.wrapper,
      position.wrapper,
      documentField.wrapper,
      until.wrapper,
      observations.wrapper,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const selectedUser = users.find(
        u => u.usuario_id === person.input.value
      );

      if (!selectedUser) {
        notice("Seleccioná un usuario válido.");
        return;
      }

      const confirmation = [
        "¿CONFIRMÁS ESTA HABILITACIÓN?",
        "",
        "Establecimiento: " +
          centerName(center.input.value),
        "Usuario: " + selectedUser.nombre,
        "Correo: " + selectedUser.correo,
        "Autoridad: " +
          type.input.selectedOptions[0].text,
        "Cargo: " + position.input.value.trim(),
        "Designación: " +
          documentField.input.value.trim(),
        "",
        "Confirmá únicamente si existe una " +
        "designación institucional válida."
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
            documentField.input.value.trim(),
          p_habilitado_desde:
            new Date().toISOString(),
          p_habilitado_hasta:
            until.input.value
              ? new Date(
                  until.input.value
                ).toISOString()
              : null,
          p_observaciones:
            observations.input.value.trim() || null
        });

        notice(
          "Habilitación registrada correctamente. " +
          "No se publicó información."
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

    body.append(
      node("h3", "Autoridades registradas")
    );

    const filters = node("div", null, "as-card");

    const centerFilter = selectField(
      "Filtrar por establecimiento",
      [
        ["", "Todos los establecimientos"],
        ...centers.map(
          c => [String(c.id), c.nombre]
        )
      ]
    );

    const statusFilter = selectField(
      "Estado",
      [
        ["", "Todas"],
        ["vigente", "Vigentes"],
        ["no_vigente", "No vigentes"]
      ]
    );

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
          String(a.centro_id) ===
            centerFilter.input.value;

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

      for (const authority of filtered) {
        const person = users.find(
          u => u.usuario_id === authority.usuario_id
        );

        const card = node(
          "article",
          null,
          "as-card"
        );

        card.append(
          node(
            "h3",
            centerName(authority.centro_id)
          ),
          node(
            "p",
            "Autoridad: " +
            (
              authority.tipo_autoridad === "direccion"
                ? "Dirección"
                : "Comité de Crisis"
            )
          ),
          node(
            "p",
            "Persona: " +
            (
              person?.nombre ||
              "Usuario no disponible"
            )
          ),
          node(
            "p",
            "Correo: " +
            (
              person?.correo ||
              "No disponible"
            )
          ),
          node(
            "p",
            "Cargo: " + authority.cargo
          ),
          node(
            "p",
            "Designación: " +
            authority.documento_designacion
          ),
          node(
            "p",
            "Desde: " +
            dateText(authority.habilitado_desde)
          ),
          node(
            "p",
            "Hasta: " +
            dateText(authority.habilitado_hasta)
          ),
          node(
            "p",
            "Estado: " +
            (
              activeAuthority(authority)
                ? "Vigente"
                : "No vigente"
            )
          )
        );

        if (
          authority.activo &&
          !authority.revocado_en
        ) {
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
                )) {
                  return;
                }

                try {
                  await rpc(
                    "as_revocar_autoridad",
                    {
                      p_autorizacion_id: authority.id,
                      p_motivo: reason.trim()
                    }
                  );

                  notice(
                    "Habilitación revocada correctamente."
                  );

                  await showAuthoritiesList(body);

                } catch (error) {
                  notice(
                    "No se pudo revocar: " +
                    error.message
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

    centerFilter.input.addEventListener(
      "change",
      render
    );

    statusFilter.input.addEventListener(
      "change",
      render
    );

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

  // =========================================
  // INICIO
  // =========================================

  login();

  console.info(
    "App Alerta Salud: panel institucional V1.10.19"
  );

})();
