require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Conecta con Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Webhook para Telegram
bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`);
app.use(bot.webhookCallback("/bot"));

// Ruta para comprobar estado
app.get("/", (req, res) => res.send("✅ Bot activo"));

// Comando /start
bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame una cédula como `V12345678` y te mostraré la ficha del trabajador. Luego podrás registrar tu asistencia.");
});

// Procesa texto (cédula)
bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");

  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Por favor envía una cédula válida. Ejemplo: `V12345678`");
  }

  const { data, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .limit(1);

  if (error) {
    console.error("❌ Error Supabase:", error);
    return ctx.reply("🚨 Error al consultar la base de datos.");
  }

  if (!data || data.length === 0) {
    return ctx.reply("🧐 No encontré información para esa cédula.");
  }

  const respuesta = formatearRespuesta(data[0]);
  await ctx.reply(respuesta);

  // Pregunta de asistencia
  await ctx.reply("¿Deseas registrar la asistencia para hoy?", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Sí", callback_data: `asistencia_si_${cedulaIngresada}` },
          { text: "❌ No", callback_data: "asistencia_no" }
        ]
      ]
    }
  });
});

// Manejo de botones
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData.startsWith("asistencia_si_")) {
    const cedula = callbackData.replace("asistencia_si_", "");
    const hoy = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

    const { data: existente } = await supabase
      .from("asistencias")
      .select("id")
      .eq("cedula", cedula)
      .eq("fecha", hoy);

    if (existente && existente.length > 0) {
      return ctx.reply("🔁 Ya has registrado tu asistencia para hoy.");
    }

    const { error: insertError } = await supabase
      .from("asistencia") // ✅ correcto
      .insert({
        cedula,
        fecha: hoy,
        registrado_en: new Date().toISOString()
      });

    if (insertError) {
      console.error("❌ Error al insertar asistencia:", insertError);
      return ctx.reply("🚫 Hubo un problema al registrar tu asistencia.");
    }

    return ctx.reply("✅ Asistencia registrada con éxito. ¡Gracias por participar!");
  }

  if (callbackData === "asistencia_no") {
    return ctx.reply("👍 Entendido. No se ha registrado asistencia.");
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Bot activo por webhook en puerto ${PORT}`);
});

// Detener el bot con señal
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

