// LOTE 1: Configuración base y servicios
require("dotenv").config(); // 🔐 Carga de variables de entorno (.env)

const express = require("express");         // 🌐 Servidor para webhook
const { Telegraf } = require("telegraf");   // 🤖 Librería del bot Telegram
const { createClient } = require("@supabase/supabase-js"); // 🔗 Cliente para Supabase
const { formatearRespuesta } = require("./utils"); // 📄 Función personalizada para mostrar ficha de usuario

const app = express();
const PORT = process.env.PORT || 3000;

// 🧠 Inicializa Supabase con las claves de entorno
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🤖 Inicializa el bot de Telegram
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Configura el webhook de Telegram (Render, Railway, etc.)
bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`);
app.use(bot.webhookCallback("/bot"));

// Ruta simple para verificar que el servidor responde
app.get("/", (req, res) => res.send("✅ Bot educativo activo y operativo"));

// LOTE 2: Procesamiento de cédula e inicio de flujo
bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");
  const hoy = new Date().toISOString().split("T")[0];

  // Validación de formato
  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Cédula inválida. Ejemplo válido: V12345678");
  }

  // Consulta de ficha institucional
  const { data: persona, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .maybeSingle();

  if (error || !persona) {
    return ctx.reply("🧐 No encontré información para esa cédula.");
  }

  // Muestra la ficha al usuario
  await ctx.reply(formatearRespuesta(persona));

  // Consulta convocatoria activa (fecha dentro de rango + activa = true)
  const { data: convocatoriaActiva } = await supabase
    .from("convocatorias")
    .select("*")
    .eq("activa", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy)
    .maybeSingle();

  // 🎯 SI NO HAY convocatoria → mostrar menú institucional
  if (!convocatoriaActiva) {
    await ctx.reply("ℹ️ No hay convocatorias activas en este momento.");
    await ctx.reply("Puedes registrar tu participación institucional eligiendo uno de los siguientes motivos:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📌 Reunión Pedagógica", callback_data: `motivo_Reunión Pedagógica_${cedulaIngresada}` }],
          [{ text: "📚 Consejo de Sección", callback_data: `motivo_Consejo de Sección_${cedulaIngresada}` }],
          [{ text: "✍️ Solicitar Constancia", callback_data: `motivo_Solicitud de Constancia_${cedulaIngresada}` }],
          [{ text: "📞 Contactar CDCE Lobatera", callback_data: `motivo_Contacto con CDCE_${cedulaIngresada}` }],
          [{ text: "✅ Solo marcar asistencia", callback_data: `motivo_Asistencia General_${cedulaIngresada}` }],
          [{ text: "❌ Ninguno hoy", callback_data: `motivo_nulo_${cedulaIngresada}` }]
        ]
      }
    });
    return; // 🛑 Detiene el flujo aquí si no hay convocatoria
  }

  // Si hay convocatoria, continúa el flujo normal:
  const convocatoriaId = convocatoriaActiva.id;

  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("id")
    .eq("cedula", cedulaIngresada)
    .eq("fecha", hoy)
    .eq("convocatoria_id", convocatoriaId)
    .maybeSingle();

  const { data: yaConfirmo } = await supabase
    .from("confirmaciones")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .eq("convocatoria_id", convocatoriaId)
    .eq("confirmo", true)
    .maybeSingle();

  // Si ya asistió
  if (yaAsistio) {
    return ctx.reply(`✅ Ya registraste tu asistencia para: *${convocatoriaActiva.titulo}*.\nGracias por tu participación 👏`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }]
        ]
      }
    });
  }

  // Si ya confirmó, pero no ha asistido aún
  if (yaConfirmo) {
    return ctx.reply(`📌 Ya confirmaste tu participación en: *${convocatoriaActiva.titulo}*\n¿Deseas registrar tu asistencia ahora?`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Registrar asistencia ahora", callback_data: `asistir_${convocatoriaId}_${cedulaIngresada}` }],
          [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }]
        ]
      }
    });
  }

  // Si aún no ha confirmado
  return ctx.reply(`📢 *${convocatoriaActiva.titulo}*\n¿Confirmas tu participación en esta actividad?`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Sí, asistiré", callback_data: `confirmar_si_${convocatoriaId}_${cedulaIngresada}` },
          { text: "❌ No podré", callback_data: `confirmar_no_${convocatoriaId}_${cedulaIngresada}` }
        ],
        [
          { text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }
        ]
      ]
    }
  });
});

// LOTE 3: Acciones del usuario (confirmar, asistir, motivo, consulta)
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const hoy = new Date().toISOString().split("T")[0];

  // 🟢 Confirmar participación (sí / no)
  if (callbackData.startsWith("confirmar_")) {
    const [, decision, convocatoriaId, cedula] = callbackData.split("_");
    await ctx.editMessageReplyMarkup(null);

    await supabase.from("confirmaciones").insert({
      cedula,
      convocatoria_id: parseInt(convocatoriaId),
      confirmo: decision === "si",
      fecha_confirmacion: new Date().toISOString()
    });

    return ctx.reply(
      decision === "si"
        ? "✅ Confirmación registrada. ¡Nos vemos en la actividad!"
        : "👍 Entendido. No asistirás a esta convocatoria."
    );
  }

  // 👁️ Solo consultar ficha
  if (callbackData.startsWith("solo_")) {
    const [, cedula] = callbackData.split("_");
    const { data: persona } = await supabase
      .from("raclobatera")
      .select("*")
      .eq("cedula", cedula)
      .maybeSingle();

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply(`👁️ Consulta realizada. No se ha registrado confirmación ni asistencia.\n\n${formatearRespuesta(persona)}`);
  }

  // ✅ Registrar asistencia
  if (callbackData.startsWith("asistir_")) {
    const [, convocatoriaId, cedula] = callbackData.split("_");

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id")
      .eq("cedula", cedula)
      .eq("fecha", hoy)
      .eq("convocatoria_id", convocatoriaId);

    if (yaAsistio?.length > 0) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("🔁 Ya registraste tu asistencia para esta convocatoria.");
    }

    const nuevo = {
      cedula,
      fecha: hoy,
      registrado_en: new Date().toISOString(),
      motivo: "Asistencia Confirmada",
      convocatoria_id: parseInt(convocatoriaId)
    };

    const { error } = await supabase.from("asistencia").insert(nuevo);
    if (error) {
      console.error("❌ Error al guardar asistencia:", error);
      return ctx.reply("🚫 Ocurrió un error al registrar tu asistencia.");
    }

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply("✅ Asistencia registrada correctamente. ¡Gracias por tu participación!");
  }

  // 📋 Registrar participación con motivo institucional
  if (callbackData.startsWith("motivo_")) {
    const [, motivo, cedula] = callbackData.split("_");

    if (motivo === "nulo") {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("✅ No se ha registrado participación para hoy.");
    }

    // Verificar si ya tiene asistencia hoy
    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id, motivo")
      .eq("cedula", cedula)
      .eq("fecha", hoy);

    if (yaAsistio?.length > 0) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply(`🔁 Ya registraste tu participación con motivo: *${yaAsistio[0].motivo}*`, {
        parse_mode: "Markdown"
      });
    }

    // Obtener convocatoria activa (por si deseas asociarla)
    const { data: convocatoria } = await supabase
      .from("convocatorias")
      .select("id")
      .eq("activa", true)
      .lte("fecha_inicio", hoy)
      .gte("fecha_fin", hoy)
      .maybeSingle();

    const nuevo = {
      cedula,
      fecha: hoy,
      registrado_en: new Date().toISOString(),
      motivo,
      convocatoria_id: convocatoria?.id || null
    };

    const { error } = await supabase.from("asistencia").insert(nuevo);
    if (error) {
      console.error("❌ Error al guardar motivo:", error);
      return ctx.reply("🚫 Hubo un error al registrar tu participación.");
    }

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply(`✅ Asistencia registrada con motivo: *${motivo}*`, {
      parse_mode: "Markdown"
    });
  }
});

// LOTE 3: Acciones del usuario (confirmar, asistir, motivo, consulta)
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const hoy = new Date().toISOString().split("T")[0];

  // 🟢 Confirmar participación (sí / no)
  if (callbackData.startsWith("confirmar_")) {
    const [, decision, convocatoriaId, cedula] = callbackData.split("_");
    await ctx.editMessageReplyMarkup(null);

    await supabase.from("confirmaciones").insert({
      cedula,
      convocatoria_id: parseInt(convocatoriaId),
      confirmo: decision === "si",
      fecha_confirmacion: new Date().toISOString()
    });

    return ctx.reply(
      decision === "si"
        ? "✅ Confirmación registrada. ¡Nos vemos en la actividad!"
        : "👍 Entendido. No asistirás a esta convocatoria."
    );
  }

  // 👁️ Solo consultar ficha
  if (callbackData.startsWith("solo_")) {
    const [, cedula] = callbackData.split("_");
    const { data: persona } = await supabase
      .from("raclobatera")
      .select("*")
      .eq("cedula", cedula)
      .maybeSingle();

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply(`👁️ Consulta realizada. No se ha registrado confirmación ni asistencia.\n\n${formatearRespuesta(persona)}`);
  }

  // ✅ Registrar asistencia
  if (callbackData.startsWith("asistir_")) {
    const [, convocatoriaId, cedula] = callbackData.split("_");

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id")
      .eq("cedula", cedula)
      .eq("fecha", hoy)
      .eq("convocatoria_id", convocatoriaId);

    if (yaAsistio?.length > 0) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("🔁 Ya registraste tu asistencia para esta convocatoria.");
    }

    const nuevo = {
      cedula,
      fecha: hoy,
      registrado_en: new Date().toISOString(),
      motivo: "Asistencia Confirmada",
      convocatoria_id: parseInt(convocatoriaId)
    };

    const { error } = await supabase.from("asistencia").insert(nuevo);
    if (error) {
      console.error("❌ Error al guardar asistencia:", error);
      return ctx.reply("🚫 Ocurrió un error al registrar tu asistencia.");
    }

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply("✅ Asistencia registrada correctamente. ¡Gracias por tu participación!");
  }

  // 📋 Registrar participación con motivo institucional
  if (callbackData.startsWith("motivo_")) {
    const [, motivo, cedula] = callbackData.split("_");

    if (motivo === "nulo") {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("✅ No se ha registrado participación para hoy.");
    }

    // Verificar si ya tiene asistencia hoy
    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id, motivo")
      .eq("cedula", cedula)
      .eq("fecha", hoy);

    if (yaAsistio?.length > 0) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply(`🔁 Ya registraste tu participación con motivo: *${yaAsistio[0].motivo}*`, {
        parse_mode: "Markdown"
      });
    }

    // Obtener convocatoria activa (por si deseas asociarla)
    const { data: convocatoria } = await supabase
      .from("convocatorias")
      .select("id")
      .eq("activa", true)
      .lte("fecha_inicio", hoy)
      .gte("fecha_fin", hoy)
      .maybeSingle();

    const nuevo = {
      cedula,
      fecha: hoy,
      registrado_en: new Date().toISOString(),
      motivo,
      convocatoria_id: convocatoria?.id || null
    };

    const { error } = await supabase.from("asistencia").insert(nuevo);
    if (error) {
      console.error("❌ Error al guardar motivo:", error);
      return ctx.reply("🚫 Hubo un error al registrar tu participación.");
    }

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply(`✅ Asistencia registrada con motivo: *${motivo}*`, {
      parse_mode: "Markdown"
    });
  }
});
