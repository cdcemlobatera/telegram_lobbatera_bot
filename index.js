require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Webhook para Telegram
bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`);
app.use(bot.webhookCallback("/bot"));

// Ruta de verificación
app.get("/", (req, res) => res.send("✅ Bot activo"));

// Comando /start
bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame una cédula como `V12345678` y te mostraré la ficha del trabajador y opciones de registro.");
});

// Manejo de mensajes (cédulas)
bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");

  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Por favor envía una cédula válida. Ejemplo: V12345678");
  }

  // Consulta Supabase
  const { data, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .limit(1);

  if (error || !data || data.length === 0) {
    return ctx.reply("🧐 No encontré información para esa cédula.");
  }

  const ficha = formatearRespuesta(data[0]);
  await ctx.reply(ficha);

  const hoy = new Date().toISOString().split("T")[0];

  // Revisar convocatorias activas
  const { data: convocatoriaActiva } = await supabase
    .from("convocatorias")
    .select("*")
    .eq("fecha", hoy)
    .eq("activa", true)
    .maybeSingle();

  if (convocatoriaActiva) {
    await ctx.reply(`📢 *${convocatoriaActiva.titulo}*\n¿Confirmas tu participación?`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Asistiré", callback_data: `confirmar_si_${convocatoriaActiva.id}_${cedulaIngresada}` },
            { text: "❌ No podré", callback_data: `confirmar_no_${convocatoriaActiva.id}_${cedulaIngresada}` }
          ]
        ]
      }
    });
  }

  // Preguntar motivo de participación del día
  await ctx.reply("Selecciona tu motivo de participación para hoy 👇", {
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
});

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  // 🟢 Confirmación de convocatoria activa
  if (callbackData.startsWith("confirmar_")) {
    const [, decision, convocatoriaId, cedula] = callbackData.split("_");

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

  // 🟨 Registro de motivo de participación
  if (callbackData.startsWith("motivo_")) {
    const [_, motivo, cedula] = callbackData.split("_");
    const hoy = new Date().toISOString().split("T")[0];

    if (motivo === "nulo") {
      return ctx.reply("✅ No se ha registrado participación para hoy.");
    }

    // Validar si ya existe un registro
    const { data: existente } = await supabase
      .from("asistencia")
      .select("id, motivo")
      .eq("cedula", cedula)
      .eq("fecha", hoy);

    if (existente && existente.length > 0) {
      return ctx.reply(`🔁 Ya registraste tu participación para hoy: *${existente[0].motivo}*`, { parse_mode: "Markdown" });
    }

    // Buscar convocatoria activa (opcional para enlazar)
    const { data: convocatoria } = await supabase
      .from("convocatorias")
      .select("id")
      .eq("fecha", hoy)
      .eq("activa", true)
      .maybeSingle();

    const nuevoRegistro = {
      cedula,
      fecha: hoy,
      registrado_en: new Date().toISOString(),
      motivo,
      convocatoria_id: convocatoria?.id || null
    };

    const { error: insertError } = await supabase
      .from("asistencia")
      .insert(nuevoRegistro);

    if (insertError) {
      console.error("❌ Error al registrar motivo:", insertError);
      return ctx.reply("🚫 Hubo un problema al guardar tu participación.");
    }

    return ctx.reply(`✅ Registrado con motivo: *${motivo}*`, { parse_mode: "Markdown" });
  }
});

// Inicia el servidor web (Render detecta el puerto automáticamente)
app.listen(PORT, () => {
  console.log(`🚀 Bot activo por webhook en puerto ${PORT}`);
});

// Manejo de señales para apagado controlado
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
