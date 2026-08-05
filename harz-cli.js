#!/usr/bin/env node
/**
 * HARZ Cloud CLI — Command Line Interface
 * Usage: node harz-cli.js [command] [options]
 * 
 * Commands:
 *   status          Check HARZ Cloud status
 *   deploy          Trigger a new deployment
 *   platforms       List all platforms
 *   agents          List AI agents
 *   wallet          Check wallet balance
 *   endpoints       List API endpoints
 *   logs            View system logs
 *   help            Show help
 */

const HARZ_BASE = process.env.HARZ_CLOUD_BASE || 'https://harz-cloud-backend.onrender.com';
const HARZ_API_KEY = process.env.HARZ_API_KEY || 'harz_cloud_live_321424';

const args = process.argv.slice(2);
const command = args[0] || 'help';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
  gray: '\x1b[90m'
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

async function fetchJSON(url, headers = {}) {
  try {
    const r = await fetch(url, { headers: { 'x-api-key': HARZ_API_KEY, ...headers }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch(e) {
    return { error: e.message };
  }
}

const commands = {
  async status() {
    console.log(c('cyan', '⚡ HARZ Cloud Status'));
    console.log(c('gray', '━'.repeat(40)));
    const d = await fetchJSON(`${HARZ_BASE}/health`);
    if (d.error) { console.log(c('red', '✗ Offline: ') + d.error); return; }
    console.log(c('green', '● Status: ') + d.status);
    console.log(c('blue', '  Version: ') + 'v' + d.version);
    console.log(c('blue', '  Uptime: ') + Math.round(d.uptime / 60) + ' minutes');
    console.log(c('blue', '  Modules: ') + (d.features?.length || 0));
    console.log(c('blue', '  URL: ') + HARZ_BASE);
  },

  async platforms() {
    console.log(c('cyan', '🌐 HARZ Ecosystem Platforms'));
    console.log(c('gray', '━'.repeat(40)));
    const d = await fetchJSON(`${HARZ_BASE}/api/platforms`);
    if (d.error) { console.log(c('red', '✗ ') + d.error); return; }
    const platforms = d.platforms || d;
    if (Array.isArray(platforms)) {
      platforms.forEach((p, i) => {
        const status = p.status === 'Live' || p.status === 'Active' ? c('green', '●') : c('yellow', '○');
        console.log(`${status} ${p.name || 'Unknown'} — ${p.status || '—'}`);
      });
      console.log(c('gray', '\n') + `Total: ${platforms.length} platforms`);
    }
  },

  async agents() {
    console.log(c('cyan', '🤖 HARZ AI Agents'));
    console.log(c('gray', '━'.repeat(40)));
    const d = await fetchJSON(`${HARZ_BASE}/agents/list`);
    if (d.error) { console.log(c('red', '✗ ') + d.error); return; }
    const agents = d.agents || d.list || [];
    if (agents.length === 0) { console.log(c('yellow', 'No agents found')); return; }
    agents.forEach(a => {
      console.log(c('green', '● ') + (a.name || 'Agent') + ' — ' + (a.status || 'active'));
      console.log(c('gray', '  Tasks: ') + (a.tasks_completed || 0) + ' | Success: ' + (a.success_rate || 100) + '%');
    });
  },

  async wallet() {
    console.log(c('cyan', '💳 HARZ Wallet Balance'));
    console.log(c('gray', '━'.repeat(40)));
    const d = await fetchJSON(`${HARZ_BASE}/api/wallet`);
    if (d.error) { console.log(c('red', '✗ ') + d.error); return; }
    console.log(c('green', '  NGN: ₦') + (d.ngnBalance || d.ngn_balance || 0).toLocaleString());
    console.log(c('blue', '  USD: $') + (d.usdBalance || d.usd_balance || 0).toLocaleString());
    console.log(c('yellow', '  USDT: ') + (d.usdtBalance || d.usdt_balance || 0) + ' ₮');
    console.log(c('blue', '  GDEG: ') + (d.gdegBalance || d.gdeg_balance || 0) + ' ⚡');
  },

  async endpoints() {
    console.log(c('cyan', '🔌 HARZ Cloud API Endpoints'));
    console.log(c('gray', '━'.repeat(40)));
    const d = await fetchJSON(`${HARZ_BASE}/api/endpoints`);
    if (d.error) {
      console.log(c('yellow', 'Showing static endpoint list:'));
      console.log('  Auth: /auth/signup, /auth/login, /auth/verify');
      console.log('  RBAC: /rbac/roles, /rbac/my-permissions');
      console.log('  SSO: /sso/login, /sso/authenticate, /sso/verify');
      console.log('  Push: /push/subscribe, /push/send, /push/broadcast');
      console.log('  Webhooks: /webhooks/:provider, /webhooks/register');
      console.log('  Agents: /agents/list, /agents/delegate, /agents/pipeline');
      console.log('  Memory: /memory/store, /memory/retrieve, /memory/search');
      console.log('  Analytics: /analytics/track, /analytics/summary');
      console.log('  Storage: /storage/upload, /cdn/:filename');
      console.log('  DeployForge: /deployforge/deploy/:provider');
      console.log(c('gray', '  ...and 280+ more endpoints'));
      return;
    }
    const endpoints = d.endpoints || d.list || [];
    console.log(`Total: ${endpoints.length} endpoints`);
  },

  async deploy() {
    console.log(c('cyan', '🚀 Triggering Render Deploy'));
    console.log(c('gray', '━'.repeat(40)));
    // Try deploy hook
    const hook = process.env.RENDER_DEPLOY_HOOK;
    if (hook) {
      try {
        const r = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10000) });
        console.log(c('green', '✓ Deploy triggered via hook'));
      } catch(e) {
        console.log(c('red', '✗ Hook failed: ') + e.message);
      }
    } else {
      console.log(c('yellow', '⚠ RENDER_DEPLOY_HOOK not set'));
      console.log('To trigger deploy:');
      console.log('1. Go to dashboard.render.com → harz-cloud-backend');
      console.log('2. Click "Manual Deploy" → "Deploy latest commit"');
      console.log('3. Or set RENDER_DEPLOY_HOOK env var with a deploy hook URL');
    }
  },

  async logs() {
    console.log(c('cyan', '📋 HARZ Cloud Logs'));
    console.log(c('gray', '━'.repeat(40)));
    const d = await fetchJSON(`${HARZ_BASE}/api/logs?limit=10`);
    if (d.error) { console.log(c('red', '✗ ') + d.error); return; }
    const logs = d.logs || d.list || [];
    if (logs.length === 0) { console.log(c('yellow', 'No logs available')); return; }
    logs.forEach(l => {
      const level = l.level || 'info';
      const color = level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'green';
      console.log(c(color, `[${level.toUpperCase()}]`) + ' ' + (l.message || l.msg || ''));
    });
  },

  help() {
    console.log(c('cyan', c('bold', '⚡ HARZ Cloud CLI')));
    console.log(c('gray', '━'.repeat(40)));
    console.log('Usage: node harz-cli.js [command]');
    console.log('');
    console.log(c('bold', 'Commands:'));
    console.log('  ' + c('green', 'status') + '      Check HARZ Cloud status');
    console.log('  ' + c('green', 'platforms') + '   List all ecosystem platforms');
    console.log('  ' + c('green', 'agents') + '      List AI agents');
    console.log('  ' + c('green', 'wallet') + '      Check wallet balance');
    console.log('  ' + c('green', 'endpoints') + '   List API endpoints');
    console.log('  ' + c('green', 'deploy') + '      Trigger a new deployment');
    console.log('  ' + c('green', 'logs') + '        View system logs');
    console.log('  ' + c('green', 'help') + '        Show this help message');
    console.log('');
    console.log(c('bold', 'Environment Variables:'));
    console.log('  HARZ_CLOUD_BASE   API base URL (default: ' + HARZ_BASE + ')');
    console.log('  HARZ_API_KEY      API key (default: ' + HARZ_API_KEY + ')');
    console.log('  RENDER_DEPLOY_HOOK  Deploy hook URL for triggering deploys');
    console.log('');
    console.log(c('gray', 'HARZ Cloud v20.0 — 292 endpoints, 40+ modules'));
    console.log(c('gray', 'Owner: Rabiu Hamza Mohammed'));
  }
};

// Run command
if (commands[command]) {
  commands[command]();
} else {
  console.log(c('red', 'Unknown command: ') + command);
  commands.help();
}
