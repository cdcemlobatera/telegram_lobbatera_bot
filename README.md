# 🤖 Bot Telegram Lobbatera – Consulta RAC + Registro de Asistencias

Este es un bot de Telegram que permite consultar información laboral y personal de trabajadores registrados en la base de datos **raclobatera**, y además registrar su asistencia diaria mediante el número de cédula nacional (formato `V12345678`).

---

## 🚀 ¿Qué hace?

- Recibe una cédula venezolana en formato `V12345678`
- Consulta los datos del trabajador desde Supabase (`raclobatera`)
- Devuelve una ficha clara y detallada, usando emojis y estructura legible
- Pregunta si desea registrar su asistencia del día
- Si confirma, guarda la **cédula + fecha** en la tabla `asistencia`
- Está desplegado en **Render** utilizando `webhook`

---

## 🧰 Tecnologías utilizadas

| Herramienta   | Función                                        |
|---------------|-------------------------------------------------|
| [Telegraf](https://telegraf.js.org) | Framework para bots de Telegram |
| [Supabase](https://supabase.com) | Base de datos (PostgreSQL + API REST) |
| [Express](https://expressjs.com) | Webhook listener para el bot      |
| [Render](https://render.com) | Hosting y despliegue online        |
| Dotenv        | Manejo seguro de variables de entorno          |

---

## 🧪 Estructura actual

### Tablas en Supabase

#### `raclobatera`
Contiene la data laboral y personal de los trabajadores activos o históricos.

#### `asistencia`
Registra los eventos diarios de asistencia por cédula.

| Campo           | Tipo             | Descripción                         |
|-----------------|------------------|-------------------------------------|
| `id`            | integer (PK)     | Autoincremental                     |
| `cedula`        | text             | Cédula del trabajador               |
| `fecha`         | date             | Fecha del registro (yyyy-mm-dd)     |
| `registrado_en` | timestamptz      | Timestamp completo de la inscripción |

---

## 📦 Instalación local (opcional)

```bash
git clone https://github.com/cdcemlobatera/telegram_lobbatera_bot.git
cd telegram_lobbatera_bot
npm install
