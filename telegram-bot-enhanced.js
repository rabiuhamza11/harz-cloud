/**
 * HARZ Cloud — Enhanced Telegram Bot Handler
 * Receives messages from Telegram, processes commands, routes to HARZ agents
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HARZ_API_KEY = process.env.HARZ_API_KEY || 'harz_cloud_live_321424';
const HARZ_BASE = process.env.HARZ_CLOUD_BASE || 'https://harz-cloud-backend.onrender.com';

// Bot commands
const COMMANDS = {
  start: 'Welcome to HARZ Cloud Bot! 🚀\n\nCommands:\n/balance — Check wallet balance\n/platforms — List ecosystem platforms\n/agents — List AI agents\n/status — System status\n/pay — Make a payment\n/send — Send money\n/help — Get help',
  
  balance: async (chatId) => {
    try {
      const r = await fetch(`${HARZ_BASE}/api/wallet`, { headers: { 'x-api-key': HARZ_API_KEY } });
      const d = await r.json();
      return `💳 *HARZ Wallet Balance*\n\n🇳🇬 NGN: ₦${(d.ngnBalance || d.ngn_balance || 0).toLocaleString()}\n🇺🇸 USD: $${(d.usdBalance || d.usd_balance || 0).toLocaleString()}\n₮ USDT: ${(d.usdtBalance || d.usdt_balance || 0).toLocaleString()} ₮\n⚡ GDEG: ${(d.gdegBalance || d.gdeg_balance || 0).toLocaleString()}`;
    } catch(e) {
      return '⚠️ Could not fetch wallet balance. Service may be offline.';
    }
  },
  
  platforms: async () => {
    try {
      const r = await fetch(`${HARZ_BASE}/api/platforms`, { headers: { 'x-api-key': HARZ_API_KEY } });
      const d = await r.json();
      const platforms = d.platforms || [];
      const live = platforms.filter(p => p.status === 'Live' || p.status === 'Active').length;
      let msg = `🌐 *HARZ Ecosystem Platforms*\n\nTotal: ${platforms.length} | Live: ${live}\n\n`;
      platforms.slice(0, 15).forEach((p, i) => {
        msg += `${i+1}. ${p.icon || '🌐'} ${p.name || 'Unknown'} — ${p.status || '—'}\n`;
      });
      if (platforms.length > 15) msg += `\n...and ${platforms.length - 15} more`;
      return msg;
    } catch(e) {
      return '⚠️ Could not fetch platforms.';
    }
  },
  
  agents: async () => {
    try {
      const r = await fetch(`${HARZ_BASE}/agents/list`, { headers: { 'x-api-key': HARZ_API_KEY } });
      const d = await r.json();
      const agents = d.agents || d.list || [];
      let msg = `🤖 *HARZ AI Agents*\n\n`;
      if (agents.length === 0) {
        msg += 'No agents found. Use /agents/deploy to create one.';
      } else {
        agents.forEach((a, i) => {
          msg += `${i+1}. ${a.icon || '🤖'} ${a.name || 'Agent'} — ${a.status || 'active'}\n   Tasks: ${a.tasks_completed || 0} | Success: ${a.success_rate || 100}%\n`;
        });
      }
      return msg;
    } catch(e) {
      return '⚠️ Could not fetch agents list.';
    }
  },
  
  status: async () => {
    try {
      const r = await fetch(`${HARZ_BASE}/health`);
      const d = await r.json();
      let msg = `⚡ *HARZ Cloud Status*\n\n`;
      msg += `Status: ${d.status || 'unknown'}\n`;
      msg += `Version: v${d.version || '?'}\n`;
      msg += `Uptime: ${Math.round((d.uptime || 0) / 60)} minutes\n`;
      msg += `Features: ${(d.features || []).length} modules\n`;
      return msg;
    } catch(e) {
      return '⚠️ HARZ Cloud is offline.';
    }
  },
  
  pay: '💳 *Make a Payment*\n\nTo make a payment:\n1. Open HarzPay app\n2. Click "Pay Merchant"\n3. Enter amount and recipient\n4. Choose payment method (Paystack, Bank, USDT)\n\n🔗 https://rabiuhamza11.github.io/harz-portfolio/harzpay.html',
  
  send: '💸 *Send Money*\n\nTo send money:\n1. Open HarzPay app\n2. Click "Send Money"\n3. Enter recipient details\n4. Confirm and send\n\n🔗 https://rabiuhamza11.github.io/harz-portfolio/harzpay.html',
  
  help: '🤖 *HARZ Cloud Bot Commands*\n\n/start — Welcome message\n/balance — Wallet balance\n/platforms — List platforms\n/agents — List AI agents\n/status — System status\n/pay — Make a payment\n/send — Send money\n/help — This help message\n\n🌐 HARZ Cloud: https://harz-cloud-backend.onrender.com\n💳 HarzPay: https://rabiuhamza11.github.io/harz-portfolio/harzpay.html\n📦 HarzGit: https://rabiuhamza11.github.io/harz-portfolio/harzgit.html'
};

async function handleTelegramUpdate(update) {
  if (!update.message || !update.message.text) return { ok: true };
  
  const chatId = update.message.chat.id;
  const text = update.message.text;
  const command = text.split(' ')[0].replace('/', '').toLowerCase();
  
  let response;
  
  if (COMMANDS[command]) {
    if (typeof COMMANDS[command] === 'function') {
      response = await COMMANDS[command](chatId);
    } else {
      response = COMMANDS[command];
    }
  } else {
    response = `Unknown command: /${command}\n\nType /help to see available commands.`;
  }
  
  // Send response back to Telegram
  if (BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: response,
          parse_mode: 'Markdown'
        })
      });
    } catch(e) {
      console.error('Telegram send error:', e.message);
    }
  }
  
  return { ok: true, command, response };
}

module.exports = { handleTelegramUpdate, COMMANDS };
