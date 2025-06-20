const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Telegram
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/bot${process.env.TELEGRAM_TOKEN}`);

// Webhook endpoint
app.post(`/bot${process.env.TELEGRAM_TOKEN}`, express.json(), (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Ping para monitoreo
app.get("/ping", (req, res) => {
  const now = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
  res.send(`✅ Bot activo - ${now}`);
});

// Manejo de mensajes
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const cedula = msg.text;

  if (!cedula) return;

  const respuesta = await buscarCedula(cedula);
  bot.sendMessage(chatId, respuesta, { parse_mode: "Markdown" });
});

// Función de búsqueda
async function buscarCedula(cedula) {
  try {
    const cedulaLimpia = cedula.trim().toUpperCase().replace(/\s+/g, "");
    
console.log("🔎 Buscando:", cedulaLimpia);
    
    const { data, error } = await supabase
      .from("raclobatera")
      .select("*")
      .eq("cedula", cedulaLimpia)
      .maybeSingle();
    
console.log("📦 Resultado:", data);
console.log("🐞 Error:", error);

    if (error || !data) {
      console.warn("🧐 No encontrado:", cedulaLimpia, error?.message);
      return "🧐 No encontré información para esa cédula.";
    }

    return `
🆔 *Cédula:* ${data.cedula}

👤 *Nombre:* ${data.nombres_apelllidos_rep || "No registrado"}
👫 *Sexo:* ${data.sexo || "No especificado"}
💼 *Cargo:* ${data.cargo || "No registrado"} | *PBD:* ${data.tipo_pbd || "N/A"}

🏫 *Plantel:* ${data.nombre_plantel || "Desconocido"}
📍 *Código DEA:* ${data.codigo_dea || "N/A"}

🗳️ *Centro de Votación:* ${data.cv || "No registrado"}
📌 *Código CV:* ${data.cod_cv || "N/A"}

🗓️ *Fecha de Ingreso:* ${data.fecha_ingreso || "No disponible"}
⏳ *Tiempo de Servicio:* ${data.a_servicio || 0} años, ${data.m_servicio || 0} meses

📚 *Horas Académicas:* ${data.horas_academicas || 0}
🗂️ *Horas Administrativas:* ${data.horas_adm || 0}

📌 *Situación Laboral:* ${data.situacion_trabajador || "No especificada"}
📝 *Observación:* ${data.observacion || "Sin observaciones"}
`;
  } catch (err) {
    console.error("❌ Error al consultar:", err);
    return "❌ Ocurrió un error al procesar la cédula.";
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Bot activo en puerto ${PORT}`);
});
