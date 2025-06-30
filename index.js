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

//Lote 2

bot.start((ctx) => {
  ctx.reply("👋 ¡Hola! Envíame tu cédula en formato `V12345678` para consultar tu ficha y registrar tu participación.", {
    parse_mode: "Markdown"
  });
});

bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");
  const hoy = new Date().toISOString().split("T")[0];

  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Cédula inválida. Ejemplo válido: V12345678");
  }

  const { data: persona, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .maybeSingle();

  if (error || !persona) {
    return ctx.reply("🧐 No encontré información para esa cédula.");
  }

  await ctx.reply(formatearRespuesta(persona));

  const { data: convocatoriaActiva } = await supabase
    .from("convocatorias")
    .select("*")
    .eq("fecha", hoy)
    .eq("activa", true)
    .maybeSingle();

  const convocatoriaId = convocatoriaActiva?.id;

  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .eq("fecha", hoy)
    .maybeSingle();

  if (convocatoriaActiva && !yaAsistio) {
    const { data: yaConfirmo } = await supabase
      .from("confirmaciones")
      .select("*")
      .eq("cedula", cedulaIngresada)
      .eq("convocatoria_id", convocatoriaId)
      .eq("confirmo", true)
      .maybeSingle();

    if (yaConfirmo) {
      await ctx.reply(`🗓️ Ya confirmaste tu participación en: *${convocatoriaActiva.titulo}*\n¿Deseas registrar tu asistencia ahora?`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Registrar asistencia ahora", callback_data: `asistir_${convocatoriaId}_${cedulaIngresada}` }]
          ]
        }
      });
    } else {
      await ctx.reply(`📢 *${convocatoriaActiva.titulo}*\n¿Confirmas tu participación?`, {
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

  // Si no ha registrado asistencia, mostrar todos los motivos
  if (!yaAsistio) {
    const motivos = [
      "Reunión Pedagógica",
      "Consejo de Sección",
      "Solicitud de Constancia",
      "Contacto con CDCE",
      "Asistencia General"
    ];

    const botones = motivos.map((m) => [
      { text: `📌 ${m}`, callback_data: `motivo_${m}_${cedulaIngresada}` }
    ]);

    return ctx.reply("Selecciona tu motivo de participación para hoy 👇", {
      reply_markup: { inline_keyboard: botones }
    });
  }

  // Si ya asistió, mostrar solo motivos que no se hayan registrado
  const motivoRegistrado = yaAsistio?.motivo;
  const motivosRestantes = [
    "Reunión Pedagógica",
    "Consejo de Sección",
    "Solicitud de Constancia",
    "Contacto con CDCE",
    "Asistencia General"
  ].filter((m) => m !== motivoRegistrado);

  if (motivosRestantes.length === 0) {
    return ctx.reply(`✅ Ya registraste tu participación con motivo: *${motivoRegistrado}*`, {
      parse_mode: "Markdown"
    });
  }

  const botonesExtra = motivosRestantes.map((m) => [
    { text: `📌 ${m}`, callback_data: `motivo_${m}_${cedulaIngresada}` }
  ]);

  return ctx.reply("¿Deseas agregar otro motivo adicional para hoy?", {
    reply_markup: { inline_keyboard: botonesExtra }
  });
});

//Lote 3

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const hoy = new Date().toISOString().split("T")[0];

  // ✅ Confirmaciones de convocatoria
  if (callbackData.startsWith("confirmar_")) {
    const [, decision, convocatoriaId, cedula] = callbackData.split("_");

    await ctx.editMessageReplyMarkup(null); // 🔐 Eliminar botones visibles

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

  // 📍 Asistencia directa tras confirmar
  if (callbackData.startsWith("asistir_")) {
    const [, convocatoriaId, cedula] = callbackData.split("_");

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id")
      .eq("cedula", cedula)
      .eq("fecha", hoy)
      .eq("convocatoria_id", convocatoriaId);

    if (yaAsistio?.length > 0) {
      await ctx.editMessageReplyMarkup(null); // 🔐 Desactiva botones si aún visibles
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

    await ctx.editMessageReplyMarkup(null); // 🔐 Oculta botones tras éxito
    return ctx.reply("✅ Asistencia registrada correctamente. ¡Gracias por tu participación!");
  }

  // 🧠 Registro de motivo con protección
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
      console.error("❌ Error al guardar motivo:", error);
      return ctx.reply("🚫 Hubo un error al registrar tu participación.");
    }

    await ctx.editMessageReplyMarkup(null); // 🔐 Ocultar botón tras selección
    return ctx.reply(`✅ Asistencia registrada con motivo: *${motivo}*`, {
      parse_mode: "Markdown"
    });
  }
});

// Lote 4

// Iniciar servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Bot desplegado y escuchando en el puerto ${PORT}`);
});

// Detención limpia del bot ante señales del sistema
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
