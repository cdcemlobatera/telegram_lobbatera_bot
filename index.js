// LOTE 1: Configuración inicial
require("dotenv").config();
const express = require("express");
const { Telegraf } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils");

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`);
app.use(bot.webhookCallback("/bot"));

app.get("/", (req, res) => res.send("✅ Bot operativo y escuchando correctamente"));

// LOTE 2: Validación de cédula, ficha y flujo condicional
bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");
  const hoy = new Date().toISOString().split("T")[0];

  // Validación de formato
  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Cédula inválida. Ejemplo válido: V12345678");
  }

  // Buscar persona por cédula
  const { data: persona, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .maybeSingle();

  if (error || !persona) {
    return ctx.reply("🧐 No encontré información para esa cédula.");
  }

  // Mostrar ficha institucional
  await ctx.reply(formatearRespuesta(persona));

  // Buscar convocatoria activa por rango de fechas
  const { data: convocatoriaActiva } = await supabase
    .from("convocatorias")
    .select("*")
    .eq("activa", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy)
    .maybeSingle();

  if (!convocatoriaActiva) {
    return ctx.reply("ℹ️ No hay convocatorias activas actualmente.");
  }

  const convocatoriaId = convocatoriaActiva.id;

  // Verificar si ya asistió
  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("id")
    .eq("cedula", cedulaIngresada)
    .eq("fecha", hoy)
    .maybeSingle();

  // Verificar si ya confirmó
  const { data: yaConfirmo } = await supabase
    .from("confirmaciones")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .eq("convocatoria_id", convocatoriaId)
    .eq("confirmo", true)
    .maybeSingle();

  // Mostrar menú según estado del usuario
  if (yaAsistio) {
    return ctx.reply(`✅ Ya registraste tu asistencia para la actividad: *${convocatoriaActiva.titulo}*.\nGracias por tu participación 👏`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }]
        ]
      }
    });
  }

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

  // Si aún no confirmó, mostrar botones de confirmación
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

// LOTE 3: Acciones del usuario con botones
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const hoy = new Date().toISOString().split("T")[0];

  // ✅ Confirmaciones
  if (callbackData.startsWith("confirmar_")) {
    const [, decision, convocatoriaId, cedula] = callbackData.split("_");
    await ctx.editMessageReplyMarkup(null); // Elimina botones visibles

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

  // 🧠 Solo consulta
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

  // 🟢 Registro de asistencia
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

  // 📌 Registro de motivo alternativo
  if (callbackData.startsWith("motivo_")) {
    const [_, motivo, cedula] = callbackData.split("_");

    if (motivo === "nulo") {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("✅ No se ha registrado participación para hoy.");
    }

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

// LOTE 4: Inicio del servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Bot desplegado y escuchando en el puerto ${PORT}`);
});

// Detención limpia del bot ante señales del sistema (Render / Railway / etc.)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
