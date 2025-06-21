function calcularTiempo(fecha) {
  const hoy = new Date();
  const ingreso = new Date(fecha);
  let anos = hoy.getFullYear() - ingreso.getFullYear();
  let meses = hoy.getMonth() - ingreso.getMonth();
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  return { anos, meses };
}

function formatearRespuesta(data) {
  const genero = data.sexo === "F" ? "FEMENINO" : data.sexo === "M" ? "MASCULINO" : "NO ESPECIFICADO";
  const tipoPersonal = {
    D: "DOCENTE",
    A: "ADMINISTRATIVO",
    O: "APOYO",
    C: "COCINERA"
  }[data.tipopbd] || "NO ESPECIFICADO";

  const { anos, meses } = calcularTiempo(data.fechaingreso);

  return `
🆔 Cédula: ${data.cedula}

👤 Nombre: ${data.nombresapellidosrep}
👫 Género: ${genero}
💼 Cargo: ${data.cargo} | Tipo de Personal: ${tipoPersonal}
🔢 Código de Cargo: ${data.codigorac}

🗓️ Fecha de Ingreso: ${data.fechaingreso}
⏳ Tiempo de Servicio: ${anos} años, ${meses} meses
📊 Meses de Servicio Declarados: ${data.mservicio}

🏫 Plantel: ${data.nombreplantel}
📌 Código DEA: ${data.codigodea}
🏢 Dependencia: ${data.codigodependencia}

📌 Situación Laboral: ${data.situaciontrabajador}
📝 Observación: ${data.observacion}

🗳️ Centro de Votación: ${data.centrovotacion}
🔖 Código CENVOT: ${data.codcenvot}
`.trim();
}

module.exports = { formatearRespuesta, calcularTiempo };
