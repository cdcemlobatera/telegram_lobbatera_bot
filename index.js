require("dotenv").config();
const { Telegraf } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils");

// Inicializar Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Comando /start
bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame una cédula como `V12345678` y te mostraré la ficha del trabajador.");
});

// Escuchar mensajes de texto
bot.on("text", async (ctx) => {
  const cedula = ctx.message.text.trim().toUpperCase();

  // Validar formato
  if (!/^V\d{7,8}$/.test(cedula)) {
    return ctx.reply("⚠️ Por favor envía una cédula válida. Ejemplo: `V12345678`");
  }

  try {
    console.log("🔎 Buscando:", cedula);

    const { data, error } = await supabase
      .from("raclobatera")
      .select("*")
      .ilike("cedula", cedula)
      .limit(1);

    if (error) {
      console.error("❌ Error Supabase:", error);
      return ctx.reply("🚨 Ocurrió un error al consultar la base de datos.");
    }

    if (!data || data.length === 0) {
      return ctx.reply("🧐 No encontré información para esa cédula.");
    }

    const respuesta = formatearRespuesta(data[0]);
    ctx.reply(respuesta);
  } catch (err) {
    console.error("❌ Error general:", err);
    ctx.reply("⚠️ Algo salió mal. Intenta de nuevo más tarde.");
  }
});

// Iniciar bot
bot.launch();
console.log("🚀 Bot activo en puerto 10000");

// Manejo de cierre
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
