# 🤖 Bot Telegram Lobbatera – Consulta RAC

Este es un bot de Telegram que permite consultar información laboral y personal de trabajadores registrados en la base de datos `raclobatera` mediante su número de cédula.

## 🚀 ¿Qué hace?

- Recibe una cédula en formato `V12345678`
- Consulta los datos desde Supabase
- Devuelve una ficha completa del trabajador con formato claro y emojis
- Está desplegado en Render usando webhook

## 🧰 Tecnologías utilizadas

- [Telegraf](https://telegraf.js.org/) – framework para bots de Telegram
- [Supabase](https://supabase.com/) – base de datos y API REST
- [Express](https://expressjs.com/) – para el webhook del bot
- [Render](https://render.com/) – para desplegar el bot online

## 📦 Instalación local (opcional)

```bash
git clone https://github.com/cdcemlobatera/telegram_lobbatera_bot.git
cd telegram_lobbatera_bot
npm install
