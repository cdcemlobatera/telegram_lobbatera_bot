require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils");
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.send('✅ Bot activo y escuchando desde Express');
});

// Tu código de Telegraf debe estar después de esto
const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Opcional: elimina o comenta esta línea si da error mientras pruebas
// await bot.telegram.setWebhook(`${process.env.BASE_URL}/bot${process.env.TELEGRAM_TOKEN}`);

// Si usas webhook:
app.use(bot.webhookCallback(`/bot${process.env.TELEGRAM_TOKEN}`));

// Inicia Express
app.listen(port, () => {
  console.log(`🚀 Bot activo en puerto ${port}`);
});

// Inicializar Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Webhook path y configuración
app.use(bot.webhookCallback("/bot"));
bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`); // Asegúrate de definir BASE_URL en .env

// Comando /start
bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame una cédula como `V12345678` y te mostraré la ficha del trabajador.");
});

// Manejo de mensajes
bot.on("text", async (ctx) => {
  try {
    const cedulaIngresada = ctx.message.text.trim().toUpperCase();
    const cedulaLimpiada = cedulaIngresada.replace(/\s/g, "");

    if (!/^V\d{7,8}$/.test(cedulaLimpiada)) {
      return ctx.reply("⚠️ Por favor envía una cédula válida. Ejemplo: `V12345678`");
    }

    const { data, error } = await supabase
      .from("raclobatera")
      .select("*")
      .eq("cedula", cedulaLimpiada)
      .limit(1);

    if (error) {
      console.error("❌ Error Supabase:", error);
      return ctx.reply("🚨 Error al consultar la base de datos.");
    }

    if (!data || data.length === 0) {
      return ctx.reply("🧐 No encontré información para esa cédula.");
    }

    const respuesta = formatearRespuesta(data[0]);
    ctx.reply(respuesta);
  } catch (err) {
    console.error("❌ Error inesperado:", err);
    ctx.reply("⚠️ Ocurrió un error inesperado. Revisa los logs.");
  }
});

// Servidor web (Render requiere que se escuche en este puerto)
const PORT = process.env.PORT || 10000;
app.get("/", (req, res) => res.send("✅ Bot activo"));
app.listen(PORT, () => {
  console.log(`🚀 Bot activo por webhook en puerto ${PORT}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
