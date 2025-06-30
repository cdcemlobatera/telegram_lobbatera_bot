require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { Telegraf } = require("telegraf");
const { formatearRespuesta } = require("./utils");

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Webhook de Telegram
bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`);
app.use(bot.webhookCallback("/bot"));

// Ruta básica
app.get("/", (req, res) => res.send("✅ Bot activo desde Render"));

//Lote 2

// Comando /start
bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame una cédula como `V12345678` para ver la ficha del trabajador y registrar asistencia.", {
    parse_mode: "Markdown"
  });
});

// Manejo de cédula (mensaje de texto)
bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");

  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Por favor envía una cédula válida. Ejemplo: V12345678");
  }

  // Buscar ficha institucional
  const { data, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .maybeSingle();

  if (error || !data) {
    return ctx.reply("🧐 No encontré información para esa cédula.");
  }

  const ficha = formatearRespuesta(data);
  await ctx.reply(ficha);

  const hoy = new Date().toISOString().split("T")[0];

  // Buscar convocatoria activa
  const { data: convocatoriaActiva } = await supabase
    .from("convocatorias")
    .select("*")
    .eq("fecha", hoy)
    .eq("activa", true)
    .maybeSingle();

  if (convocatoriaActiva) {
    const { id: convocatoriaId, titulo } = convocatoriaActiva;

    // ¿Ya asistió?
    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id")
      .eq("cedula", cedulaIngresada)
      .eq("fecha", hoy)
      .eq("convocatoria_id", convocatoriaId);

    if (yaAsistio?.length > 0) {
      await ctx.reply("📌 Ya registraste tu asistencia para esta convocatoria.");
    } else {
      // ¿Ya confirmó?
      const { data: yaConfirmo } = await supabase
        .from("confirmaciones")
        .select("*")
        .eq("cedula", cedulaIngresada)
        .eq("convocatoria_id", convocatoriaId)
        .eq("confirmo", true)
        .maybeSingle();

      if (yaConfirmo) {
        await ctx.reply(`🗓️ Confirmaste tu participación en: *${titulo}*\n¿Quieres registrar tu asistencia ahora?`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Registrar asistencia ahora", callback_data: `asistir_${convocatoriaId}_${cedulaIngresada}` }]
            ]
          }
        });
      } else {
        await ctx.reply(`📢 *${titulo}*\n¿Confirmas tu participación?`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Asistiré", callback_data: `confirmar_si_${convocatoriaId}_${cedulaIngresada}` },
                { text: "❌ No podré", callback_data: `confirmar_no_${convocatoriaId}_${cedulaIngresada}` }
              ]
            ]
          }
        });
      }
    }
  }

  // Motivos solo si no registró asistencia hoy
  if (!convocatoriaActiva || !yaAsistio?.length) {
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
  }
});

// lote 3

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const hoy = new Date().toISOString().split("T")[0];

  // 🟢 Confirmaciones
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

  // 🟨 Registro directo de asistencia tras confirmar
  if (callbackData.startsWith("asistir_")) {
    const [, convocatoriaId, cedula] = callbackData.split("_");

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id")
      .eq("cedula", cedula)
      .eq("fecha", hoy)
      .eq("convocatoria_id", convocatoriaId);

    if (yaAsistio?.length > 0) {
      return ctx.reply("🔁 Ya registraste tu asistencia para esta convocatoria.");
    }

    const nuevoRegistro = {
      cedula,
      fecha: hoy,
      registrado_en: new Date().toISOString(),
      motivo: "Asistencia Confirmada",
      convocatoria_id: parseInt(convocatoriaId)
    };

    const { error } = await supabase.from("asistencia").insert(nuevoRegistro);
    if (error) {
      console.error("❌ Error al guardar asistencia:", error);
      return ctx.reply("🚫 Ocurrió un error al registrar tu asistencia.");
    }

    return ctx.reply("✅ Asistencia registrada correctamente. ¡Gracias por tu participación!");
  }

  // 📌 Registro con motivo de participación
  if (callbackData.startsWith("motivo_")) {
    const [_, motivo, cedula] = callbackData.split("_");

    if (motivo === "nulo") {
      return ctx.reply("✅ No se ha registrado participación para hoy.");
    }

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id, motivo")
      .eq("cedula", cedula)
      .eq("fecha", hoy);

    if (yaAsistio?.length > 0) {
      return ctx.reply(`🔁 Ya registraste tu asistencia con motivo: *${yaAsistio[0].motivo}*`, {
        parse_mode: "Markdown"
      });
    }

    const { data: convocatoria } = await supabase
      .from("convocatorias")
      .select("id")
      .eq("fecha", hoy)
      .eq("activa", true)
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
      console.error("❌ Error al registrar motivo:", error);
      return ctx.reply("🚫 Hubo un problema al guardar tu participación.");
    }

    return ctx.reply(`✅ Asistencia registrada con motivo: *${motivo}*`, {
      parse_mode: "Markdown"
    });
  }
});

// lote 4

// Inicia el servidor (Render detecta el puerto desde process.env.PORT)
app.listen(PORT, () => {
  console.log(`🚀 Bot en marcha por webhook en puerto ${PORT}`);
});

// Detención limpia del bot en caso de apagado o reinicio
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
