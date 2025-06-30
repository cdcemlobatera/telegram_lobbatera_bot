//Lote 1
const hoy = new Date().toISOString().split("T")[0];

// Buscar convocatoria activa
const { data: convocatoriaActiva } = await supabase
  .from("convocatorias")
  .select("*")
  .eq("fecha", hoy)
  .eq("activa", true)
  .maybeSingle();

if (convocatoriaActiva) {
  // Verificar si ya asistió
  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("id")
    .eq("cedula", cedulaIngresada)
    .eq("fecha", hoy)
    .eq("convocatoria_id", convocatoriaActiva.id);

  if (yaAsistio?.length > 0) {
    await ctx.reply("✅ Ya registraste tu asistencia para esta convocatoria.");
  } else {
    // Verificar si ya confirmó
    const { data: yaConfirmo } = await supabase
      .from("confirmaciones")
      .select("*")
      .eq("cedula", cedulaIngresada)
      .eq("convocatoria_id", convocatoriaActiva.id)
      .eq("confirmo", true)
      .maybeSingle();

    if (yaConfirmo) {
      // Mostrar botón para registrar asistencia directamente
      await ctx.reply(`📌 Recuerda que confirmaste asistencia a: *${convocatoriaActiva.titulo}*\n¿Deseas registrar tu presencia ahora?`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Registrar asistencia ahora",
                callback_data: `asistir_${convocatoriaActiva.id}_${cedulaIngresada}`
              }
            ]
          ]
        }
      });
    } else {
      // Mostrar confirmación de participación
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
  }
}


// lote 2

// Registro directo de asistencia si ya había confirmado
if (callbackData.startsWith("asistir_")) {
  const [, convocatoriaId, cedula] = callbackData.split("_");
  const hoy = new Date().toISOString().split("T")[0];

  // Verifica si ya asistió
  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("id")
    .eq("cedula", cedula)
    .eq("fecha", hoy)
    .eq("convocatoria_id", convocatoriaId);

  if (yaAsistio?.length > 0) {
    return ctx.reply("🔁 Ya habías registrado tu asistencia para esta convocatoria.");
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
    return ctx.reply("🚫 Hubo un error al registrar tu asistencia.");
  }

  return ctx.reply("✅ Asistencia registrada correctamente. ¡Gracias por tu participación!");
}

// lote 3

// Si aún no registró asistencia, mostrar motivos de participación
if (!yaAsistio?.length) {
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


//lote 4

if (callbackData.startsWith("motivo_")) {
  const [_, motivo, cedula] = callbackData.split("_");
  const hoy = new Date().toISOString().split("T")[0];

  if (motivo === "nulo") {
    return ctx.reply("✅ No se ha registrado participación para hoy.");
  }

  // Validar si ya registró asistencia hoy con o sin convocatoria
  const { data: yaAsistio } = await supabase
    .from("asistencia")
    .select("id, motivo")
    .eq("cedula", cedula)
    .eq("fecha", hoy);

  if (yaAsistio?.length > 0) {
    return ctx.reply(`🔁 Ya registraste tu asistencia con motivo: *${yaAsistio[0].motivo}*`, { parse_mode: "Markdown" });
  }

  // Buscar convocatoria activa (por si aplica)
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

  const { error } = await supabase.from("asistencia").insert(nuevoRegistro);
  if (error) {
    console.error("❌ Error al registrar motivo:", error);
    return ctx.reply("🚫 Ocurrió un error al guardar tu participación.");
  }

  return ctx.reply(`✅ Asistencia registrada con motivo: *${motivo}*`, { parse_mode: "Markdown" });
}
