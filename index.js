require("dotenv").config();
const { Telegraf } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils");
const http = require("http");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame una cédula como `V12345678` y te mostraré la ficha del trabajador.");
});

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

bot.launch();
console.log("🚀 Bot activo en puerto 10000");

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("✅ Bot activo");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Puerto expuesto en ${PORT}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
