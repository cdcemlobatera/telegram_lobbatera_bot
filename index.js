import express from "express";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// 🔐 Conectar a Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ Ruta de prueba
app.get("/ping", (req, res) => {
  res.send("✅ Bot activo - " + new Date().toLocaleString("es-VE"));
});

// 🎯 Webhook de Telegram
app.post("/webhook", async (req, res) => {
  const mensaje = req.body.message?.text;
  const chatId = req.body.message?.chat?.id;

  if (!mensaje || !chatId) return res.sendStatus(200);

  const respuesta = await buscarCedula(mensaje.trim());
  await enviarMensajeTelegram(chatId, respuesta);
  res.sendStatus(200);
});

// 🔎 Buscar en Supabase
async function buscarCedula(cedula) {
  try {
    const cedulaLimpia = cedula.trim().toUpperCase().replace(/\s+/g, "");

    const { data, error } = await supabase
      .from("raclobatera")
      .select("*")
      .eq("cedula", cedulaLimpia)
      .single();

    if (error || !data) {
      console.warn("🧐 No se encontró:", cedulaLimpia, error?.message);
      return "🧐 No encontré información para esa cédula.";
    }

    // Aquí va tu formato de respuesta con los datos encontrados

    const genero = data.sexo === "F" ? "👩 FEMENINO" :
                   data.sexo === "M" ? "👨 MASCULINO" : "⚧️ No definido";

    const tipo = {
      D: "DOCENTE", A: "ADMINISTRATIVO", O: "APOYO", C: "COCINERA"
    }[data.tipo_personal] || "Por definir";

    return `👤 ${data.nombre_apellido}
    	👩‍💼 ${tipo} - ${genero}
    	📌 Código RAC: ${data.codigo_rac || "N/D"}
    	💼 Cargo: ${data.cargo || "N/D"}
    	📅 Ingreso: ${data.fecha_ingreso || "Por definir"}
    	📊 Servicio: ${data.a_servicio || 0} año(s), ${data.m_servicio || 0} mes(es)
    	🏫 Plantel: ${data.nombre_plantel || "N/D"}
    	📌 CV: ${data.cv || "Sin registro"}
    	🗒️ Observación: ${data.observacion || "Sin detalles"}`;
        } catch (err) {
          console.error("❌ Error al consultar:", err);
          return "❌ Ocurrió un error al procesar la cédula.";
        }
    }

    return `👤 ${data.nombre_apellido}\n📌 Cargo: ${data.cargo}\n🏫 Plantel: ${data.plantel}`;
  } catch (err) {
    console.error("❌ Error al consultar:", err);
    return "❌ Ocurrió un error al procesar la cédula.";
  }
}

  catch (err) {
    console.error("❌ Error al consultar:", err);
    return "❌ Ocurrió un error al procesar la cédula.";
  }
}

// 📤 Enviar respuesta por Telegram
async function enviarMensajeTelegram(chatId, texto) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
}

// 🚀 Activar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Bot activo en puerto", PORT);
});
