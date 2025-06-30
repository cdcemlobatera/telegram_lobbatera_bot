# 🤖 Bot Telegram Lobbatera – Consulta y Registro de Participación

Este es un bot de Telegram que permite consultar información laboral y personal de trabajadores registrados en la base de datos **raclobatera**, así como registrar su participación diaria seleccionando un motivo correspondiente. Diseñado como herramienta de gestión para el CDCE Lobatera, su objetivo es facilitar procesos administrativos con interacción accesible y eficiente.

---

## 🚀 ¿Qué hace?

- Recibe una cédula venezolana en formato `V12345678`
- Consulta los datos personales y laborales del trabajador desde Supabase
- Devuelve una ficha clara y estructurada con emojis descriptivos
- Pregunta por el motivo de participación diaria (ej. reunión, constancia, contacto, etc.)
- Registra la respuesta en una tabla de Supabase (`asistencia`)
- Está desplegado en **Render** usando un webhook configurado

---

## 🧰 Tecnologías utilizadas

| Herramienta   | Función                                        |
|---------------|------------------------------------------------|
| [Telegraf](https://telegraf.js.org) | Framework para bots de Telegram |
| [Supabase](https://supabase.com)    | Base de datos (PostgreSQL + API REST) |
| [Express](https://expressjs.com)    | Servidor web para el webhook del bot |
| Dotenv        | Gestión segura de variables de entorno         |
| Render        | Despliegue y hosting del bot                   |

---

## 📦 Instalación local

```bash
git clone https://github.com/cdcemlobatera/telegram_lobbatera_bot.git
cd telegram_lobbatera_bot
cp .env.ejemplo .env
npm install
npm start
