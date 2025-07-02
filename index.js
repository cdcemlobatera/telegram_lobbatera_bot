// LOTE 1: Configuración base y conexión de servicios

require("dotenv").config(); // 🔐 Variables de entorno desde .env

const express = require("express");
const { Telegraf } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const { formatearRespuesta } = require("./utils"); // 📄 Función para mostrar la ficha

const app = express();
const PORT = process.env.PORT || 3000;

// 🔗 Cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🤖 Inicializa el bot con el token
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// 🔌 Webhook para Render/Railway
bot.telegram.setWebhook(`${process.env.BASE_URL}/bot`);
app.use(bot.webhookCallback("/bot"));

// 🌐 Ruta simple para verificar el estado del bot
app.get("/", (req, res) => res.send("📡 Bot educativo activo y escuchando"));

// LOTE 2: Flujo al recibir una cédula válida

bot.on("text", async (ctx) => {
  const cedulaIngresada = ctx.message.text.trim().toUpperCase().replace(/\s/g, "");
  const hoy = new Date().toISOString().split("T")[0];

  // Validar formato de cédula
  if (!/^V\d{7,8}$/.test(cedulaIngresada)) {
    return ctx.reply("⚠️ Cédula inválida. Ejemplo válido: V12345678");
  }

  // Buscar ficha personal
  const { data: persona, error } = await supabase
    .from("raclobatera")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .maybeSingle();

  if (error || !persona) {
    return ctx.reply("🧐 No encontré datos asociados a esa cédula.");
  }

  // Mostrar ficha institucional
  await ctx.reply(formatearRespuesta(persona));

  // Consultar si hay convocatoria activa
  const { data: convocatoriaActiva } = await supabase
    .from("convocatorias")
    .select("*")
    .eq("activa", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy)
    .maybeSingle();

  // Si NO hay convocatoria → mostrar menú institucional (motivos)
  if (!convocatoriaActiva) {
    await ctx.reply("📌 No hay convocatorias activas.\nPuedes registrar tu participación institucional eligiendo un motivo:", {
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
    return;
  }

  const convocatoriaId = convocatoriaActiva.id;
  const fechaConfirmacion = convocatoriaActiva.fecha_confirmacion;
  const fechaAsistencia = convocatoriaActiva.fecha_asistencia;

  // Verificar confirmación y asistencia previas
  const { data: yaConfirmo } = await supabase
    .from("confirmaciones")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .eq("convocatoria_id", convocatoriaId)
    .maybeSingle();

  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("*")
    .eq("cedula", cedulaIngresada)
    .eq("fecha", hoy)
    .eq("convocatoria_id", convocatoriaId)
    .maybeSingle();

  const yaConfirmoSi = yaConfirmo?.confirmo === true;
  const yaConfirmoNo = yaConfirmo?.confirmo === false;

  // Si ya asistió → mostrar aviso + ficha
  if (yaAsistio) {
    return ctx.reply(`✅ Ya registraste tu asistencia para *${convocatoriaActiva.titulo}*.\n\nGracias por participar 👏`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }]
        ]
      }
    });
  }

  // Si confirmó que NO irá
  if (yaConfirmoNo) {
    await ctx.reply(`📌 Has indicado que NO asistirás a *${convocatoriaActiva.titulo}*`, {
      parse_mode: "Markdown"
    });

    return ctx.reply("Si deseas registrar otra actividad institucional hoy, selecciona un motivo:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }],
          [{ text: "📌 Reunión Pedagógica", callback_data: `motivo_Reunión Pedagógica_${cedulaIngresada}` }],
          [{ text: "📚 Consejo de Sección", callback_data: `motivo_Consejo de Sección_${cedulaIngresada}` }],
          [{ text: "✍️ Solicitar Constancia", callback_data: `motivo_Solicitud de Constancia_${cedulaIngresada}` }],
          [{ text: "📞 Contactar CDCE Lobatera", callback_data: `motivo_Contacto con CDCE_${cedulaIngresada}` }],
          [{ text: "✅ Solo marcar asistencia", callback_data: `motivo_Asistencia General_${cedulaIngresada}` }]
        ]
      }
    });
  }

  // Si ya confirmó que SÍ irá
  if (yaConfirmoSi) {
    if (hoy === fechaAsistencia) {
      // ✅ Mostrar botón para registrar asistencia solo hoy
      return ctx.reply("📍 ¿Deseas registrar tu asistencia ahora?", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Registrar asistencia ahora", callback_data: `asistir_${convocatoriaId}_${cedulaIngresada}` }],
            [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }]
          ]
        }
      });
    } else {
      // ⏳ Aún no es día de asistir → ofrecer motivos alternativos
      await ctx.reply(`📌 Ya confirmaste para *${convocatoriaActiva.titulo}*.\n📅 Podrás registrar tu asistencia el *${fechaAsistencia}*`, {
        parse_mode: "Markdown"
      });

      return ctx.reply("Mientras tanto, puedes consultar tu ficha o registrar otra actividad institucional:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ Solo consultar ficha", callback_data: `solo_${cedulaIngresada}` }],
            [{ text: "📌 Reunión Pedagógica", callback_data: `motivo_Reunión Pedagógica_${cedulaIngresada}` }],
            [{ text: "📚 Consejo de Sección", callback_data: `motivo_Consejo de Sección_${cedulaIngresada}` }],
            [{ text: "✍️ Solicitar Constancia", callback_data: `motivo_Solicitud de Constancia_${cedulaIngresada}` }],
            [{ text: "📞 Contactar CDCE Lobatera", callback_data: `motivo_Contacto con CDCE_${cedulaIngresada}` }],
            [{ text: "✅ Solo marcar asistencia", callback_data: `motivo_Asistencia General_${cedulaIngresada}` }]
          ]
        }
      });
    }
  }

  // Si aún NO ha confirmado → evaluar si estamos dentro de la ventana válida
  if (hoy >= fechaConfirmacion && hoy < fechaAsistencia) {
    return ctx.reply(`📢 *${convocatoriaActiva.titulo}*\n¿Confirmas tu participación?`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Sí, asistiré", callback_data: `confirmar_si_${convocatoriaId}_${cedulaIngresada}` },
            { text: "❌ No podré", callback_data: `confirmar_no_${convocatoriaId}_${cedulaIngresada}` }
          ]
        ]
      }
    });
  } else {
    return ctx.reply(`📅 Puedes confirmar tu participación entre el *${fechaConfirmacion}* y antes del *${fechaAsistencia}*.\nHoy no está habilitado para confirmar.`, {
      parse_mode: "Markdown"
    });
  }
});

// LOTE 3: Manejo de botones de interacción

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const hoy = new Date().toISOString().split("T")[0];

  // 👉 Confirmar asistencia
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
        : "📝 Has indicado que no podrás asistir. Gracias por notificar."
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
    return ctx.reply(`👁️ Consulta realizada. No se ha registrado asistencia hoy.\n\n${formatearRespuesta(persona)}`);
  }

  // ✅ Registrar asistencia (solo si es el día exacto)
  if (callbackData.startsWith("asistir_")) {
    const [, convocatoriaId, cedula] = callbackData.split("_");

    const { data: convocatoriaActiva } = await supabase
      .from("convocatorias")
      .select("*")
      .eq("id", convocatoriaId)
      .maybeSingle();

    if (!convocatoriaActiva) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("⚠️ No se encontró información de la convocatoria.");
    }

    if (hoy !== convocatoriaActiva.fecha_asistencia) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply(`📅 Solo puedes registrar tu asistencia el *${convocatoriaActiva.fecha_asistencia}*.`, {
        parse_mode: "Markdown"
      });
    }

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id")
      .eq("cedula", cedula)
      .eq("fecha", hoy)
      .eq("convocatoria_id", convocatoriaId)
      .maybeSingle();

    if (yaAsistio) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("🔁 Ya habías registrado tu asistencia hoy.");
    }

    const nuevaAsistencia = {
      cedula,
      fecha: hoy,
      motivo: "Asistencia Confirmada",
      registrado_en: new Date().toISOString(),
      convocatoria_id: parseInt(convocatoriaId)
    };

    const { error } = await supabase.from("asistencia").insert(nuevaAsistencia);
    if (error) {
      console.error("❌ Error al registrar asistencia:", error);
      return ctx.reply("🚫 Ocurrió un error al guardar tu asistencia.");
    }

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply("✅ Asistencia registrada. ¡Gracias por participar!");
  }

  // 🧾 Registrar motivo institucional
  if (callbackData.startsWith("motivo_")) {
    const [, motivo, cedula] = callbackData.split("_");

    if (motivo === "nulo") {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply("📌 Entendido, no se registrará participación hoy.");
    }

    const { data: yaAsistio } = await supabase
      .from("asistencia")
      .select("id, motivo")
      .eq("cedula", cedula)
      .eq("fecha", hoy)
      .maybeSingle();

    if (yaAsistio) {
      await ctx.editMessageReplyMarkup(null);
      return ctx.reply(`🔁 Ya registraste hoy con el motivo: *${yaAsistio.motivo}*`, {
        parse_mode: "Markdown"
      });
    }

    const nuevaAsistencia = {
      cedula,
      fecha: hoy,
      motivo,
      registrado_en: new Date().toISOString(),
      convocatoria_id: null // Puede ajustarse si decides asociar a convocatoria
    };

    const { error } = await supabase.from("asistencia").insert(nuevaAsistencia);
    if (error) {
      console.error("❌ Error al guardar motivo:", error);
      return ctx.reply("🚫 Hubo un problema al registrar tu participación.");
    }

    await ctx.editMessageReplyMarkup(null);
    return ctx.reply(`✅ Participación registrada con motivo: *${motivo}*`, {
      parse_mode: "Markdown"
    });
  }
});

// LOTE 4: Inicio del servidor y manejo de apagado controlado

app.listen(PORT, () => {
  console.log(`🚀 Bot educativo escuchando en el puerto ${PORT}`);
});

// ⏹️ Manejo de apagado limpio (recomendado en Render/Railway)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
