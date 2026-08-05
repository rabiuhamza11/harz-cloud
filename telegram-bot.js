/**
 * HARZ Cloud — Telegram Bot Handler
 * Receives messages from Telegram, routes to HARZ agents, sends response back
 */

const HARZ_CLOUD_BASE = 'https://harz-cloud-backend.vercel.app';

// Telegram Bot Token (set as env var)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
  return response.json();
}

async function setTelegramWebhook() {
  const webhookUrl = `${HARZ_CLOUD_BASE}/webhooks/telegram`;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl })
  });
  return response.json();
}

async function getTelegramUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;
  const response = await fetch(url);
  return response.json();
}

module.exports = {
  sendTelegramMessage,
  setTelegramWebhook,
  getTelegramUpdates,
  BOT_TOKEN
};
