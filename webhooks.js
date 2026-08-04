/**
 * HARZ Cloud — Connector Webhooks
 * 
 * Receives and processes webhooks from external services:
 * - Paystack (payments)
 * - Paddle (global payments)
 * - NOWPayments (crypto)
 * - Gumroad (product sales)
 * - GitHub (repo events)
 * - Vercel (deploy events)
 * - Telegram (bot updates)
 * - WhatsApp (message callbacks)
 * - Custom webhooks
 * 
 * Features:
 * - Webhook signature verification per provider
 * - Event routing to handlers
 * - Webhook registry (enable/disable)
 * - Retry on failure
 * - Event logging
 * - Auto-trigger ecosystem actions
 */

const crypto = require('crypto');

// Webhook providers config
const PROVIDERS = {
  paystack: {
    name: 'Paystack',
    secret_env: 'PAYSTACK_SECRET_KEY',
    signature_header: 'x-paystack-signature',
    signature_algorithm: 'sha512',
    verify: (body, signature, secret) => {
      const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: [
      'charge.success', 'charge.failed', 'transfer.success', 'transfer.failed',
      'refund.processed', 'subscription.create', 'subscription.disable',
      'invoice.create', 'invoice.payment_failed'
    ]
  },
  
  paddle: {
    name: 'Paddle',
    secret_env: 'PADDLE_WEBHOOK_SECRET',
    signature_header: 'paddle-signature',
    signature_algorithm: 'hmac-sha256',
    verify: (body, signature, secret) => {
      // Paddle uses alert_id + signature
      try {
        const data = JSON.parse(body);
        const expected = crypto.createHmac('sha256', secret)
          .update(data.alert_id + data.alert_name).digest('hex');
        return expected === signature;
      } catch {
        return false;
      }
    },
    events: [
      'subscription_created', 'subscription_updated', 'subscription_cancelled',
      'payment_succeeded', 'payment_failed', 'refund_created',
      'order_created', 'fulfillment_completed'
    ]
  },
  
  nowpayments: {
    name: 'NOWPayments',
    secret_env: 'NOWPAYMENTS_IPN_SECRET',
    signature_header: 'x-nowpayments-sig',
    signature_algorithm: 'sha512',
    verify: (body, signature, secret) => {
      // NOWPayments uses HMAC SHA512 sorted body
      try {
        const data = JSON.parse(body);
        const sorted = JSON.stringify(sortObject(data));
        const hash = crypto.createHmac('sha512', secret).update(sorted).digest('hex');
        return hash === signature;
      } catch {
        return false;
      }
    },
    events: [
      'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid',
      'paid', 'overpaid', 'failed', 'refunded', 'expired'
    ]
  },
  
  gumroad: {
    name: 'Gumroad',
    secret_env: null, // Gumroad uses email verification, no signature
    signature_header: null,
    verify: (body, signature, secret) => true, // No signature verification
    events: [
      'ping', 'sale', 'refund', 'dispute', 'cancellation',
      'subscription_ended', 'subscription_updated'
    ]
  },
  
  github: {
    name: 'GitHub',
    secret_env: 'GITHUB_WEBHOOK_SECRET',
    signature_header: 'x-hub-signature-256',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      const hash = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: [
      'push', 'pull_request', 'release', 'deployment', 'deployment_status',
      'page_build', 'repository_created', 'fork', 'star'
    ]
  },
  
  vercel: {
    name: 'Vercel',
    secret_env: null,
    signature_header: null,
    verify: (body, signature, secret) => true, // Vercel sends no signature
    events: [
      'deployment-ready', 'deployment-error', 'project-created'
    ]
  },
  
  telegram: {
    name: 'Telegram Bot',
    secret_env: 'TELEGRAM_BOT_TOKEN',
    signature_header: null,
    verify: (body, signature, secret) => true, // Telegram uses secret path token
    events: [
      'message', 'callback_query', 'inline_query', 'channel_post'
    ]
  },
  
  whatsapp: {
    name: 'WhatsApp Business',
    secret_env: 'WHATSAPP_VERIFY_TOKEN',
    signature_header: 'x-hub-signature-256',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      const hash = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: [
      'message_received', 'message_status', 'message_template_status'
    ]
  },
  
  custom: {
    name: 'Custom Webhook',
    secret_env: null,
    signature_header: 'x-harz-signature',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      if (!secret) return true; // Optional
      const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: ['*']
  }
};

/**
 * Sort object keys recursively (for NOWPayments)
 */
function sortObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObject(obj[key]);
    return sorted;
  }, {});
}

/**
 * Verify webhook signature
 */
function verifyWebhook(provider, rawBody, headers, secret) {
  const config = PROVIDERS[provider];
  if (!config) return { valid: false, error: 'Unknown provider' };
  
  if (!config.signature_header) {
    return { valid: true, method: 'no-signature' };
  }
  
  const signature = headers[config.signature_header] || headers[config.signature_header.toLowerCase()];
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }
  
  const isValid = config.verify(rawBody, signature, secret || '');
  return { valid: isValid, method: config.signature_algorithm };
}

/**
 * Process webhook event and trigger ecosystem actions
 */
async function processEvent(provider, event, data, Database) {
  const actions = [];
  
  switch (provider) {
    case 'paystack':
      actions.push(...handlePaystackEvent(event, data, Database));
      break;
    case 'paddle':
      actions.push(...handlePaddleEvent(event, data, Database));
      break;
    case 'nowpayments':
      actions.push(...handleNowpaymentsEvent(event, data, Database));
      break;
    case 'gumroad':
      actions.push(...handleGumroadEvent(event, data, Database));
      break;
    case 'github':
      actions.push(...handleGitHubEvent(event, data, Database));
      break;
    case 'vercel':
      actions.push(...handleVercelEvent(event, data, Database));
      break;
    case 'telegram':
      actions.push(...handleTelegramEvent(event, data, Database));
      break;
    case 'whatsapp':
      actions.push(...handleWhatsAppEvent(event, data, Database));
      break;
    default:
      actions.push({ action: 'logged', message: 'Custom webhook logged' });
  }
  
  return actions;
}

// ============ PAYSTACK HANDLER ============
function handlePaystackEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'charge.success') {
    actions.push({
      action: 'update_order',
      entity: 'harzpay_orders',
      find: { reference: data.reference },
      update: { status: 'paid', payment_status: 'success', tx_reference: data.id }
    });
    actions.push({
      action: 'send_push',
      template: 'payment_success',
      variables: { amount: '₦' + (data.amount / 100).toLocaleString() },
      user: data.customer?.email
    });
    actions.push({
      action: 'audit_log',
      event_type: 'payment_success',
      details: { reference: data.reference, amount: data.amount / 100 }
    });
  } else if (event === 'charge.failed') {
    actions.push({
      action: 'update_order',
      entity: 'harzpay_orders',
      find: { reference: data.reference },
      update: { status: 'failed', payment_status: 'failed' }
    });
    actions.push({
      action: 'audit_log',
      event_type: 'payment_failed',
      details: { reference: data.reference }
    });
  } else if (event === 'transfer.success') {
    actions.push({
      action: 'audit_log',
      event_type: 'transfer_success',
      details: { reference: data.reference, amount: data.amount / 100 }
    });
  }
  
  return actions;
}

// ============ PADDLE HANDLER ============
function handlePaddleEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'payment_succeeded' || event === 'subscription_created') {
    actions.push({
      action: 'create_order',
      entity: 'orders',
      data: {
        product_title: data.product_name || 'Paddle Product',
        buyer_email: data.customer_email || data.email,
        amount: (data.price || data.sale_gross || 0) / 100,
        currency: data.currency || 'USD',
        payment_status: 'paid',
        payment_reference: data.order_id || data.checkout_id,
        seller_email: 'harzco.business@gmail.com'
      }
    });
    actions.push({
      action: 'send_push',
      template: 'payment_success',
      variables: { amount: data.currency + ' ' + (data.price / 100 || 0) },
      user: data.customer_email
    });
    actions.push({
      action: 'audit_log',
      event_type: 'paddle_payment',
      details: { order_id: data.order_id, amount: data.sale_gross }
    });
  }
  
  return actions;
}

// ============ NOWPAYMENTS HANDLER ============
function handleNowpaymentsEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'paid' || event === 'confirmed') {
    actions.push({
      action: 'update_order',
      entity: 'harzpay_orders',
      find: { reference: data.invoice_id || data.order_id },
      update: { status: 'paid', payment_status: event }
    });
    actions.push({
      action: 'send_push',
      template: 'payment_success',
      variables: { amount: data.pay_amount + ' ' + (data.pay_currency || 'USDT') },
      user: data.order_description
    });
    actions.push({
      action: 'audit_log',
      event_type: 'crypto_payment',
      details: { invoice_id: data.invoice_id, amount: data.pay_amount, currency: data.pay_currency }
    });
  } else if (event === 'failed' || event === 'expired') {
    actions.push({
      action: 'audit_log',
      event_type: 'crypto_payment_failed',
      details: { invoice_id: data.invoice_id, status: event }
    });
  }
  
  return actions;
}

// ============ GUMROAD HANDLER ============
function handleGumroadEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'sale' || event === 'ping') {
    actions.push({
      action: 'create_order',
      entity: 'orders',
      data: {
        product_title: data.product_name || data.product_id || 'Gumroad Product',
        buyer_email: data.email || data.purchase_email,
        buyer_name: data.full_name || data.purchase_name,
        amount: parseFloat(data.price || 0),
        currency: data.currency_code || 'USD',
        seller_email: 'hamzarabiu.gumroad.com',
        payment_status: 'paid',
        payment_reference: data.purchase_id || data.order_id,
        download_url: data.url || data.download_url
      }
    });
    actions.push({
      action: 'send_push',
      template: 'new_order',
      variables: {},
      user: 'hamzarabiu390@gmail.com'
    });
    actions.push({
      action: 'audit_log',
      event_type: 'gumroad_sale',
      details: { product: data.product_name, price: data.price, email: data.email }
    });
  }
  
  return actions;
}

// ============ GITHUB HANDLER ============
function handleGitHubEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'push') {
    actions.push({
      action: 'audit_log',
      event_type: 'github_push',
      details: { repo: data.repository?.full_name, commits: data.commits?.length, branch: data.ref }
    });
  } else if (event === 'page_build') {
    const status = data.build?.status;
    actions.push({
      action: 'audit_log',
      event_type: 'github_pages_deploy',
      details: { repo: data.repository?.full_name, status, url: data.build?.page?.html_url }
    });
    if (status === 'built') {
      actions.push({
        action: 'update_deploy',
        entity: 'deploy_tasks',
        find: { github_repo: data.repository?.full_name },
        update: { deploy_status: 'success', live_url: data.build?.page?.html_url }
      });
    }
  } else if (event === 'release') {
    actions.push({
      action: 'send_push',
      template: 'new_product',
      variables: { product_title: data.release?.name, price: 'free' },
      user: 'hamzarabiu390@gmail.com'
    });
  }
  
  return actions;
}

// ============ VERCEL HANDLER ============
function handleVercelEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'deployment-ready') {
    actions.push({
      action: 'audit_log',
      event_type: 'vercel_deploy_success',
      details: { project: data.project, url: data.url, deployment: data.deploymentId }
    });
  } else if (event === 'deployment-error') {
    actions.push({
      action: 'send_push',
      template: 'platform_down',
      variables: { platform_name: data.project || 'Vercel Project' },
      user: 'hamzarabiu390@gmail.com'
    });
  }
  
  return actions;
}

// ============ TELEGRAM HANDLER ============
function handleTelegramEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'message') {
    actions.push({
      action: 'create_crm',
      entity: 'whatsapp_crm',
      data: {
        customer_phone: data.message?.from?.id?.toString() || 'telegram',
        customer_name: data.message?.from?.first_name || 'Unknown',
        message: data.message?.text || '',
        inquiry_type: 'general',
        status: 'new',
        response_sent: false
      }
    });
  }
  
  return actions;
}

// ============ WHATSAPP HANDLER ============
function handleWhatsAppEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'message_received') {
    const from = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
    const text = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
    
    if (from && text) {
      actions.push({
        action: 'create_crm',
        entity: 'whatsapp_crm',
        data: {
          customer_phone: from,
          customer_name: 'Unknown',
          message: text,
          inquiry_type: 'general',
          status: 'new',
          response_sent: false,
          platform: 'whatsapp'
        }
      });
      actions.push({
        action: 'send_push',
        template: 'crm_inquiry',
        variables: { customer_name: from, product_interest: text.substring(0, 50) },
        user: 'hamzarabiu390@gmail.com'
      });
    }
  }
  
  return actions;
}

/**
 * Execute actions from webhook processing
 */
async function executeActions(actions, Database, pushModule) {
  const results = [];
  
  for (const action of actions) {
    try {
      switch (action.action) {
        case 'update_order':
          const records = await Database.find(action.entity, action.find);
          for (const record of records) {
            await Database.update(action.entity, record.id, {
              ...action.update,
              updated_date: new Date().toISOString()
            });
          }
          results.push({ action: 'update_order', updated: records.length });
          break;
          
        case 'create_order':
          const newRecord = {
            ...action.data,
            id: crypto.randomUUID(),
            created_date: new Date().toISOString(),
            updated_date: new Date().toISOString()
          };
          await Database.insert(action.entity, newRecord);
          results.push({ action: 'create_order', id: newRecord.id });
          break;
          
        case 'create_crm':
          const crmRecord = {
            ...action.data,
            id: crypto.randomUUID(),
            created_date: new Date().toISOString()
          };
          await Database.insert(action.entity, crmRecord);
          results.push({ action: 'create_crm', id: crmRecord.id });
          break;
          
        case 'send_push':
          if (pushModule && action.user) {
            const pushResult = await pushModule.sendToUser(
              action.user, action.template, action.variables, Database
            );
            results.push({ action: 'send_push', ...pushResult });
          }
          break;
          
        case 'audit_log':
          await Database.insert('audit_log', {
            id: crypto.randomUUID(),
            event_type: action.event_type,
            details: JSON.stringify(action.details),
            created_date: new Date().toISOString(),
            agent_role: 'webhook',
            tool_name: 'webhook_connector'
          });
          results.push({ action: 'audit_log', logged: true });
          break;
          
        case 'update_deploy':
          const deploys = await Database.find(action.entity, action.find);
          for (const d of deploys) {
            await Database.update(action.entity, d.id, action.update);
          }
          results.push({ action: 'update_deploy', updated: deploys.length });
          break;
      }
    } catch (e) {
      results.push({ action: action.action, error: e.message });
    }
  }
  
  return results;
}

/**
 * List all webhook providers
 */
function listProviders() {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    has_signature: !!config.signature_header,
    events: config.events,
    endpoint: `/webhooks/${id}`
  }));
}

module.exports = {
  PROVIDERS,
  verifyWebhook,
  processEvent,
  executeActions,
  listProviders
};
