
/*
 * APP ALERTA SALUD V1.9.1
 * CODIGO 12 - PANEL INSTITUCIONAL
 *
 * Funciones:
 * - Acceso institucional
 * - Solicitudes reales y de prueba
 * - Respuesta institucional
 * - Validacion de reportes
 * - Publicacion supervisada
 *
 * Requiere las funciones SQL:
 * as_crear_solicitud_real
 * as_responder_solicitud
 * as_validar_reporte
 * as_publicar_reporte
 *
 * No envia correos, SMS ni notificaciones push.
 */

(() => {
  "use strict";

  const cfg = window.ALERTA_SUPABASE;
  const host = document.getElementById("view-mas");

  if (!cfg?.url || !cfg?.publishableKey || !host) {
    return;
  }

  const API = cfg.url.replace(/\/$/, "");

  let token = null;
  let usuario = null;
  let perfil = null;

  const $ = id => document.getElementById(id);

  const css = document.createElement("style");

  css.textContent = `
    .as-panel {
      background: #fff;
      border: 1px solid #d7e1ea;
      border-radius: 14px;
      padding: 15px;
      margin: 18px 0;
      color: #172b3a;
    }

    .as-panel h2,
    .as-panel h3 {
      margin: 0 0 12px;
    }

    .as-panel p {
      line-height: 1.5;
    }

    .as-field {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin: 6px 0 13px;
      padding: 11px;
      border: 1px solid #aebdca;
      border-radius: 8px;
      background: white;
      color: #172b3a;
      font: inherit;
    }

    .as-label {
      display: block;
      margin-top: 10px;
      font-weight: 600;
    }

    .as-btn {
      padding: 10px 13px;
      margin: 4px 5px 4px 0;
      border: 0;
      border-radius: 8px;
      background: #14618b;
      color: white;
      font: inherit;
      cursor: pointer;
    }

    .as-btn:disabled {
      opacity: .55;
      cursor: wait;
    }

    .as-secondary {
      background: #475569;
    }

    .as-danger {
      background: #a72b35;
    }

    .as-notice {
      padding: 11px;
      margin: 12px 0;
      background: #edf5fb;
      border-radius: 8px;
      white-space: pre-wrap;
    }

    .as-card {
      padding: 12px;
      margin: 12px 0;
      border: 1px solid #d7e1ea;
      border-radius: 10px;
    }

    .as-card h4 {
      margin: 0 0 8px;
    }

    .as-card p {
      margin: 7px 0;
    }

    .as-card small {
      display: block;
      margin: 6px 0;
      color: #526577;
    }

    .as-tag {
      display: inline-block;
      padding: 4px 8px;
      margin: 5px 0;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
    }

    .as-test {
      background: #e5e7eb;
      color: #374151;
    }

    .as-real {
      background: #dbeafe;
      color: #1e40af;
    }

    .as-section {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #d7e1ea;
    }

    .as-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
  `;

  document.head.append(css);

  function el(tag, text, className) {
    const node = document.createElement(tag);

    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }

    if (className) node.className = className;

    return node;
  }

  function btn(text, callback, className = "") {
    const node = el("button", text, `as-btn ${className}`);
    node.type = "button";
    node.addEventListener("click", callback);
    return node;
  }

  function input(label, type = "text") {
    const wrap = el("label", null, "as-label");
    wrap.append(el("span", label));

    const node = el("input", null, "as-field");
    node.type = type;
    node.required = true;

    wrap.append(node);

    return { wrap, node };
  }

  function select(label, options) {
    const wrap = el("label", null, "as-label");
    wrap.append(el("span", label));

    const node = el("select", null, "as-field");

    for (const [value, text] of options) {
      const option = el("option", text);
      option.value = value;
      node.append(option);
    }

    wrap.append(node);

    return { wrap, node };
  }

  function dateText(value) {
    if (!value) return "Sin fecha";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Fecha no disponible"
      : date.toLocaleString("es-AR");
  }

  async function api(path, options = {}) {
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
        body?.msg ||
        body?.error_description ||
        body?.error ||
        `Error HTTP ${response.status}`
      );
    }

    return body;
  }

  async function rest(table, query) {
    return api(`/rest/v1/${table}?${query}`);
  }

  async function rpc(name, args) {
    return api(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });
  }

  const panel = el("section", null, "as-panel");
  const title = el("h2", "Acceso institucional");
  const message = el("div", "", "as-notice");
  const content = el("div");

  message.setAttribute("role", "status");

  panel.append(title, message, content);
  host.append(panel);

  function notice(text) {
    message.textContent = text;
  }

  function clear() {
    content.replaceChildren();
  }

  function badge(isTest) {
    return el(
      "span",
      isTest ? "MODO PRUEBA" : "SOLICITUD REAL",
      `as-tag ${isTest ? "as-test" : "as-real"}`
    );
  }

  function logout() {
    token = null;
    usuario = null;
    perfil = null;
    showLogin();
  }

  function showLogin() {
    clear();

    title.textContent = "Acceso institucional";

    notice(
      "Ingreso exclusivo para administradores autorizados."
    );

    const form = el("form");

    const email = input("Correo electrónico", "email");
    const password = input("Contraseña", "password");

    email.node.autocomplete = "username";
    password.node.autocomplete = "current-password";

    const submit = el("button", "Ingresar", "as-btn");
    submit.type = "submit";

    form.append(
      email.wrap,
      password.wrap,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      submit.disabled = true;
      notice("Verificando credenciales...");

      try {
        const session = await api(
          "/auth/v1/token?grant_type=password",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: email.node.value.trim(),
              password: password.node.value
            })
          }
        );

        token = session.access_token;
        usuario = session.user;

        const rows = await rest(
          "as_perfiles",
          "select=usuario_id,nombre,rol,activo" +
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

        password.node.value = "";

        await dashboard();

      } catch (error) {
        token = null;
        usuario = null;
        perfil = null;
        notice(error.message);
      } finally {
        submit.disabled = false;
      }
    });

    content.append(form);
  }

  async function dashboard() {
    if (!token || !perfil) {
      showLogin();
      return;
    }

    clear();

    title.textContent = "Panel institucional";

    const isSuper = perfil.rol === "superadmin";

    notice(
      `${perfil.nombre || "Usuario"} · ` +
      `${isSuper ? "Superadmin" : "Administrador"}\n` +
      "Los estados públicos requieren aprobación y publicación."
    );

    const actions = el("div", null, "as-actions");

    actions.append(
      btn("Actualizar", dashboard),
      btn("Cerrar sesión", logout, "as-secondary")
    );

    content.append(actions);

    try {
      const centros = await rest(
        "centros_asistenciales",
        "select=id,nombre&order=nombre.asc"
      );

      const nombres = new Map(
        centros.map(c => [String(c.id), c.nombre])
      );

      if (isSuper) {
        await showCreateRequest(centros);
      }

      await showRequests(nombres);

      if (isSuper) {
        await showValidations(nombres);
        await showPublications(nombres);
      }

    } catch (error) {
      notice("Error al cargar el panel: " + error.message);
    }
  }

  async function showCreateRequest(centros) {
    const box = el("section", null, "as-section");

    box.append(
      el("h3", "Solicitar verificación institucional"),
      el(
        "p",
        "Esta función genera una solicitud REAL. " +
        "Usala únicamente cuando se necesite información " +
        "efectiva del establecimiento."
      )
    );

    const asignaciones = await rest(
      "as_asignaciones",
      "select=centro_id,usuario_id,activo" +
      "&activo=eq.true"
    );

    const perfiles = await rest(
      "as_perfiles",
      "select=usuario_id,nombre,rol,activo" +
      "&activo=eq.true"
    );

    const administradores = new Map(
      perfiles
        .filter(p => ["admin", "superadmin"].includes(p.rol))
        .map(p => [p.usuario_id, p])
    );

    const opcionesCentro = [
      ["", "Seleccionar establecimiento"]
    ];

    for (const centro of centros) {
      opcionesCentro.push([
        String(centro.id),
        centro.nombre
      ]);
    }

    const centro = select(
      "Establecimiento",
      opcionesCentro
    );

    const destinatario = select(
      "Administrador responsable",
      [["", "Seleccionar administrador"]]
    );

    function updateDestinatarios() {
      destinatario.node.replaceChildren();

      const initial = el(
        "option",
        "Seleccionar administrador"
      );

      initial.value = "";
      destinatario.node.append(initial);

      const ids = new Set(
        asignaciones
          .filter(a =>
            String(a.centro_id) === centro.node.value &&
            a.activo === true
          )
          .map(a => a.usuario_id)
      );

      for (const id of ids) {
        const admin = administradores.get(id);
        if (!admin) continue;

        const option = el(
          "option",
          `${admin.nombre || "Administrador"} (${admin.rol})`
        );

        option.value = id;
        destinatario.node.append(option);
      }
    }

    centro.node.addEventListener(
      "change",
      updateDestinatarios
    );

    const label = el("label", null, "as-label");

    label.append(
      el("span", "Mensaje institucional")
    );

    const mensaje = el("textarea", null, "as-field");

    mensaje.rows = 4;
    mensaje.minLength = 15;
    mensaje.maxLength = 2000;
    mensaje.required = true;

    mensaje.value =
      "Se solicita verificar el funcionamiento, " +
      "la recepción de pacientes, la accesibilidad " +
      "y las acciones de respuesta del establecimiento.";

    label.append(mensaje);

    const send = btn(
      "Enviar solicitud real",
      async () => {
        if (!centro.node.value) {
          notice("Seleccioná un establecimiento.");
          return;
        }

        if (!destinatario.node.value) {
          notice("Seleccioná un administrador asignado.");
          return;
        }

        const texto = mensaje.value.trim();

        if (texto.length < 15 || texto.length > 2000) {
          notice("El mensaje debe tener entre 15 y 2000 caracteres.");
          return;
        }

        const nombre = centro.node.selectedOptions[0].textContent;

        if (!window.confirm(
          "ATENCIÓN: vas a crear una solicitud REAL para " +
          nombre +
          ".\n\n¿Confirmás que corresponde a una necesidad real?"
        )) return;

        send.disabled = true;

        try {
          await rpc("as_crear_solicitud_real", {
            p_centro_id: centro.node.value,
            p_destinatario_id: destinatario.node.value,
            p_mensaje: texto
          });

          await dashboard();

          notice(
            "Solicitud REAL registrada correctamente. " +
            "Está disponible en la bandeja institucional. " +
            "No se envió un correo ni una notificación push."
          );

        } catch (error) {
          notice("No se pudo crear: " + error.message);
          send.disabled = false;
        }
      }
    );

    box.append(
      centro.wrap,
      destinatario.wrap,
      label,
      send
    );

    content.append(box);
  }

  async function showRequests(nombres) {
    const box = el("section", null, "as-section");

    box.append(
      el("h3", "Solicitudes pendientes")
    );

    content.append(box);

    let query =
      "select=id,centro_id,destinatario_id," +
      "estado,mensaje,creada_en,es_prueba" +
      "&estado=eq.pendiente" +
      "&order=creada_en.desc&limit=100";

    if (perfil.rol !== "superadmin") {
      query +=
        "&destinatario_id=eq." +
        encodeURIComponent(usuario.id);
    }

    const solicitudes = await rest(
      "as_solicitudes_verificacion",
      query
    );

    if (!solicitudes.length) {
      box.append(
        el("p", "No hay solicitudes pendientes.")
      );
      return;
    }

    for (const solicitud of solicitudes) {
      const card = el("article", null, "as-card");

      card.append(
        el(
          "h4",
          nombres.get(String(solicitud.centro_id)) ||
          `Establecimiento ${solicitud.centro_id}`
        ),
        badge(solicitud.es_prueba),
        el(
          "small",
          `Solicitada: ${dateText(solicitud.creada_en)}`
        ),
        el(
          "p",
          solicitud.mensaje ||
          "Se solicita verificar el estado institucional."
        )
      );

      if (solicitud.destinatario_id === usuario.id) {
        card.append(
          btn(
            "Responder solicitud",
            () => showResponse(solicitud, nombres)
          )
        );
      } else {
        card.append(
          el("small", "Asignada a otro administrador.")
        );
      }

      box.append(card);
    }
  }

  function showResponse(solicitud, nombres) {
    clear();

    title.textContent = "Reporte institucional";

    notice(
      solicitud.es_prueba
        ? "MODO PRUEBA: este reporte no se publicará."
        : "SOLICITUD REAL: informá únicamente datos comprobados."
    );

    const form = el("form");

    const heading = el(
      "h3",
      nombres.get(String(solicitud.centro_id)) ||
      `Establecimiento ${solicitud.centro_id}`
    );

    const estado = select(
      "Funcionamiento",
      [
        ["sin_verificar", "Sin verificar"],
        ["operativo", "Operativo"],
        ["limitado", "Operativo con limitaciones"],
        ["no_operativo", "No operativo"]
      ]
    );

    const recepcion = select(
      "Recepción de pacientes",
      [
        ["sin_verificar", "Sin verificar"],
        ["normal", "Recibe pacientes"],
        ["restringida", "Recepción restringida"],
        ["no_recibe", "No recibe pacientes"]
      ]
    );

    const acceso = select(
      "Accesibilidad",
      [
        ["sin_verificar", "Sin verificar"],
        ["normal", "Acceso normal"],
        ["restringido", "Acceso restringido"],
        ["interrumpido", "Acceso interrumpido"]
      ]
    );

    const label = el("label", null, "as-label");

    label.append(
      el("span", "Acciones de respuesta y observaciones")
    );

    const observaciones = el("textarea", null, "as-field");

    observaciones.rows = 4;
    observaciones.maxLength = 3000;

    label.append(observaciones);

    const submit = el(
      "button",
      "Enviar reporte",
      "as-btn"
    );

    submit.type = "submit";

    form.append(
      heading,
      badge(solicitud.es_prueba),
      estado.wrap,
      recepcion.wrap,
      acceso.wrap,
      label,
      submit
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const confirmacion = solicitud.es_prueba
        ? "¿Confirmás el envío de este reporte de PRUEBA?"
        : "¿Confirmás que los datos reflejan la situación REAL?";

      if (!window.confirm(confirmacion)) return;

      submit.disabled = true;

      try {
        await rpc("as_responder_solicitud", {
          p_solicitud_id: solicitud.id,
          p_estado_operativo: estado.node.value,
          p_recepcion_pacientes: recepcion.node.value,
          p_accesibilidad: acceso.node.value,
          p_observaciones: observaciones.value.trim()
        });

        await dashboard();

        notice(
          "Reporte enviado correctamente. " +
          "Queda pendiente de validación."
        );

      } catch (error) {
        notice("No se pudo enviar: " + error.message);
        submit.disabled = false;
      }
    });

    content.append(
      btn("Volver al panel", dashboard, "as-secondary"),
      form
    );
  }

  async function showValidations(nombres) {
    const box = el("section", null, "as-section");

    box.append(
      el("h3", "Reportes pendientes de validación")
    );

    content.append(box);

    const reportes = await rest(
      "as_reportes_institucionales",
      "select=id,centro_id,estado_operativo," +
      "recepcion_pacientes,accesibilidad," +
      "observaciones,creado_en,validacion,es_prueba" +
      "&validacion=eq.pendiente" +
      "&order=creado_en.desc&limit=100"
    );

    if (!reportes.length) {
      box.append(
        el("p", "No hay reportes pendientes.")
      );
      return;
    }

    for (const reporte of reportes) {
      const card = el("article", null, "as-card");

      card.append(
        el(
          "h4",
          nombres.get(String(reporte.centro_id)) ||
          `Establecimiento ${reporte.centro_id}`
        ),
        badge(reporte.es_prueba),
        el("p", `Funcionamiento: ${reporte.estado_operativo}`),
        el("p", `Recepción: ${reporte.recepcion_pacientes}`),
        el("p", `Accesibilidad: ${reporte.accesibilidad}`),
        el("p", `Observaciones: ${reporte.observaciones || "Ninguna"}`),
        el("small", `Enviado: ${dateText(reporte.creado_en)}`)
      );

      async function decide(decision) {
        const accion = decision === "aprobado"
          ? "aprobar"
          : "rechazar";

        if (!window.confirm(
          `¿Confirmás que querés ${accion} este reporte?`
        )) return;

        try {
          await rpc("as_validar_reporte", {
            p_reporte_id: reporte.id,
            p_decision: decision
          });

          await dashboard();

          notice(
            decision === "aprobado"
              ? "Reporte aprobado. No se publicó automáticamente."
              : "Reporte rechazado."
          );

        } catch (error) {
          notice("No se pudo validar: " + error.message);
        }
      }

      card.append(
        btn("Aprobar", () => decide("aprobado")),
        btn(
          "Rechazar",
          () => decide("rechazado"),
          "as-danger"
        )
      );

      box.append(card);
    }
  }

  async function showPublications(nombres) {
    const box = el("section", null, "as-section");

    box.append(
      el("h3", "Publicación de estados verificados"),
      el(
        "p",
        "Solo se muestran reportes reales aprobados. " +
        "La publicación modifica el estado público del establecimiento."
      )
    );

    content.append(box);

    const reportes = await rest(
      "as_reportes_institucionales",
      "select=id,centro_id,estado_operativo," +
      "recepcion_pacientes,accesibilidad," +
      "creado_en,es_prueba,validacion,publicado_en" +
      "&validacion=eq.aprobado" +
      "&es_prueba=eq.false" +
      "&publicado_en=is.null" +
      "&order=creado_en.desc&limit=100"
    );

    if (!reportes.length) {
      box.append(
        el("p", "No hay reportes reales pendientes de publicación.")
      );
      return;
    }

    for (const reporte of reportes) {
      const card = el("article", null, "as-card");

      card.append(
        el(
          "h4",
          nombres.get(String(reporte.centro_id)) ||
          `Establecimiento ${reporte.centro_id}`
        ),
        badge(false),
        el("p", `Funcionamiento: ${reporte.estado_operativo}`),
        el("p", `Recepción: ${reporte.recepcion_pacientes}`),
        el("p", `Accesibilidad: ${reporte.accesibilidad}`),
        el("small", `Reporte: ${dateText(reporte.creado_en)}`)
      );

      const vigencia = select(
        "Vigencia de la publicación",
        [
          ["1", "1 hora"],
          ["3", "3 horas"],
          ["6", "6 horas"],
          ["12", "12 horas"],
          ["24", "24 horas"]
        ]
      );

      vigencia.node.value = "6";

      const publicar = btn(
        "Publicar estado verificado",
        async () => {
          const nombre =
            nombres.get(String(reporte.centro_id)) ||
            `Establecimiento ${reporte.centro_id}`;

          if (!window.confirm(
            "PUBLICACIÓN REAL\n\n" +
            nombre +
            "\n\nEsta acción actualizará la información pública " +
            "durante " + vigencia.node.value + " horas.\n\n" +
            "¿Confirmás que verificaste el reporte?"
          )) return;

          publicar.disabled = true;

          try {
            await rpc("as_publicar_reporte", {
              p_reporte_id: reporte.id,
              p_vigencia_horas: Number(vigencia.node.value)
            });

            await dashboard();

            notice(
              "Estado publicado. " +
              "Verificá su visualización y vigencia en el directorio."
            );

          } catch (error) {
            notice(
              "No se pudo publicar: " + error.message
            );

            publicar.disabled = false;
          }
        }
      );

      card.append(vigencia.wrap, publicar);
      box.append(card);
    }
  }

  showLogin();
})();
