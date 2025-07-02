// 📆 Calcula la antigüedad en años y meses desde la fecha de ingreso
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

// 📝 Formatea la ficha institucional con datos del personal
function formatearRespuesta(data) {
  const genero = data.sexo === "F"
    ? "FEMENINO"
    : data.sexo === "M"
    ? "MASCULINO"
    : "NO ESPECIFICADO";

  const tipoPersonal = {
    D: "DOCENTE",
    A: "ADMINISTRATIVO",
    O: "APOYO",
    C: "COCINERA"
  }[data.tipopbd] || "NO ESPECIFICADO";

  const { anos, meses } = calcularTiempo(data.fechaingreso);

  const fechaFormateada = data.fechaingreso
    ? new Date(data.fechaingreso).toLocaleDateString("es-VE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
    : "NA";

  return `
🆔 Cédula: ${data.cedula}
👤 Nombre: ${data.nombresapellidosrep}
👫 Género: ${genero}

🔢 Código de Cargo: ${data.codigorac}
💼 Cargo: ${data.cargo} | Tipo de Personal: ${tipoPersonal}

🗓️ Fecha de Ingreso: ${fechaFormateada}
⏳ Tiempo de Servicio: ${anos} años, ${meses} meses

📌 Código DEA: ${data.codigodea}
🏢 Dependencia: ${data.codigodependencia}
🏫 Plantel donde labora: ${data.nombreplantel}

📌 Situación Laboral: ${data.situaciontrabajador}

🕰️ Horas Académicas: ${data.horasacademicas}
⏱️ Horas Administrativas: ${data.horasadm}

📝 Observación: ${data.observacion}

🔖 Código Centro de Votación: ${data.codcenvot}
🗳️ Ejerce el voto en: ${data.centrovotacion}
`.trim();
}

// ⏱️ Devuelve la fecha y hora local de Caracas como [fecha, hora]
function obtenerFechaHoraVzla() {
  const fechaHora = new Date().toLocaleString('es-VE', {
    timeZone: 'America/Caracas'
  });
  return fechaHora.split(', ');
}

// 🧩 Exportar funciones utilitarias
module.exports = {
  formatearRespuesta,
  calcularTiempo,
  obtenerFechaHoraVzla
};
