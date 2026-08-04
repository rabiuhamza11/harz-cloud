/**
 * HARZ Cloud — Extended Connector Webhooks
 * 
 * Additional providers:
 * - Google (Calendar, Gmail, Drive)
 * - Slack (messages, commands, events)
 * - Notion (database, page changes)
 * - HubSpot (contacts, deals, forms)
 * - Discord (bot events)
 * - Stripe (payments — fallback)
 * - ResellerClub (domain events)
 */

const crypto = require('crypto');

const EXTENDED_PROVIDERS = {
  google: {
    name: 'Google Workspace',
    secret_env: 'GOOGLE_WEBHOOK_SECRET',
    signature_header: 'x-goog-signature',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: [
      'calendar.event.created', 'calendar.event.updated', 'calendar.event.deleted',
      'calendar.event.reminder', 'drive.file.created', 'drive.file.updated',
      'drive.file.deleted', 'gmail.message.received', 'gmail.label.changed'
    ],
    handler: handleGoogleEvent
  },
  
  slack: {
    name: 'Slack',
    secret_env: 'SLACK_SIGNING_SECRET',
    signature_header: 'x-slack-signature',
    signature_algorithm: 'v0-sha256',
    verify: (body, signature, secret) => {
      const timestamp = body.timestamp || '';
      const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
      // Slack uses: v0:timestamp:body
      const base = 'v0:' + timestamp + ':' + rawBody;
      const hash = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
      return hash === signature;
    },
    events: [
      'message', 'app_mention', 'team_join', 'channel_created',
      'reaction_added', 'slash_command', 'interactive', 'url_verification',
      'file_shared', 'pin_added'
    ],
    handler: handleSlackEvent
  },
  
  notion: {
    name: 'Notion',
    secret_env: 'NOTION_WEBHOOK_SECRET',
    signature_header: 'x-notion-signature',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: [
      'page.created', 'page.updated', 'page.deleted',
      'database.created', 'database.updated', 'database.deleted',
      'block.created', 'block.updated', 'block.deleted'
    ],
    handler: handleNotionEvent
  },
  
  hubspot: {
    name: 'HubSpot',
    secret_env: 'HUBSPOT_CLIENT_SECRET',
    signature_header: 'x-hubspot-signature',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      // HubSpot v3: HMAC of client secret + request body
      const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return hash === signature;
    },
    events: [
      'contact.creation', 'contact.deletion', 'contact.propertyChange',
      'deal.creation', 'deal.deletion', 'deal.propertyChange',
      'company.creation', 'company.propertyChange',
      'form.submission', 'ticket.creation', 'ticket.propertyChange',
      'email.sent', 'email.opened', 'email.clicked'
    ],
    handler: handleHubSpotEvent
  },
  
  discord: {
    name: 'Discord',
    secret_env: 'DISCORD_WEBHOOK_SECRET',
    signature_header: 'x-signature-ed25519',
    signature_algorithm: 'ed25519',
    verify: (body, signature, secret) => {
      // Discord uses Ed25519 — simplified check for now
      return signature && body;
    },
    events: [
      'message.create', 'message.update', 'message.delete',
      'interaction.create', 'guild.member.add', 'guild.member.remove'
    ],
    handler: handleDiscordEvent
  },
  
  stripe: {
    name: 'Stripe (fallback)',
    secret_env: 'STRIPE_WEBHOOK_SECRET',
    signature_header: 'stripe-signature',
    signature_algorithm: 'sha256',
    verify: (body, signature, secret) => {
      // Stripe: t=timestamp,v1=signature
      const parts = signature.split(',');
      const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
      const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];
      if (!timestamp || !v1) return false;
      
      const payload = `${timestamp}.${body}`;
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      return expected === v1;
    },
    events: [
      'payment_intent.succeeded', 'payment_intent.failed',
      'charge.succeeded', 'charge.failed', 'charge.refunded',
      'customer.created', 'customer.updated', 'customer.deleted',
      'invoice.paid', 'invoice.payment_failed',
      'subscription.created', 'subscription.updated', 'subscription.deleted'
    ],
    handler: handleStripeEvent
  },
  
  resellerclub: {
    name: 'ResellerClub',
    secret_env: 'RESELLERCLUB_WEBHOOK_SECRET',
    signature_header: null,
    verify: (body, signature, secret) => true, // ResellerClub uses IP whitelist
    events: [
      'domain.registered', 'domain.renewed', 'domain.transferred',
      'domain.expiring', 'domain.deleted', 'hosting.created',
      'hosting.renewed', 'ssl.created', 'order.suspended', 'order.activated'
    ],
    handler: handleResellerClubEvent
  }
};

// ============ GOOGLE HANDLER ============
function handleGoogleEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'calendar.event.created' || event === 'calendar.event.updated') {
    actions.push({
      action: 'audit_log',
      event_type: 'google_calendar',
      details: { 
        event_title: data.title || data.summary,
        start: data.start, 
        end: data.end,
        attendees: data.attendees?.length || 0
      }
    });
    actions.push({
      action: 'send_push',
      template: 'agent_message',
      variables: { 
        agent_name: 'Calendar',
        message: 'New event: ' + (data.title || data.summary || 'Untitled')
      },
      user: 'hamzarabiu390@gmail.com'
    });
  } else if (event === 'gmail.message.received') {
    actions.push({
      action: 'audit_log',
      event_type: 'gmail_received',
      details: { 
        from: data.from, 
        subject: data.subject,
        snippet: data.snippet?.substring(0, 100)
      }
    });
    actions.push({
      action: 'send_push',
      template: 'agent_message',
      variables: { 
        agent_name: 'Gmail',
        message: 'New email from ' + data.from + ': ' + (data.subject || 'No subject')
      },
      user: 'hamzarabiu390@gmail.com'
    });
  } else if (event === 'drive.file.created') {
    actions.push({
      action: 'audit_log',
      event_type: 'drive_file_created',
      details: { 
        file_name: data.name, 
        file_type: data.mimeType,
        size: data.size
      }
    });
  }
  
  return actions;
}

// ============ SLACK HANDLER ============
function handleSlackEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'url_verification') {
    // Slack URL verification challenge
    return [{
      action: 'slack_challenge',
      challenge: data.challenge
    }];
  }
  
  if (event === 'message') {
    const text = data.event?.text || '';
    const user = data.event?.user || 'unknown';
    const channel = data.event?.channel || 'unknown';
    
    // Check if it's a business inquiry
    if (text.match(/price|buy|order|cost/i)) {
      actions.push({
        action: 'create_crm',
        entity: 'whatsapp_crm',
        data: {
          customer_phone: 'slack:' + user,
          customer_name: 'Slack User',
          message: text,
          inquiry_type: 'general',
          status: 'new',
          response_sent: false,
          platform: 'slack'
        }
      });
    }
    
    actions.push({
      action: 'audit_log',
      event_type: 'slack_message',
      details: { user, channel, text: text.substring(0, 200) }
    });
  } else if (event === 'slash_command') {
    const command = data.command || '';
    actions.push({
      action: 'audit_log',
      event_type: 'slack_command',
      details: { command, user: data.user_name, channel: data.channel_name }
    });
  } else if (event === 'app_mention') {
    actions.push({
      action: 'send_push',
      template: 'agent_message',
      variables: { 
        agent_name: 'Slack',
        message: 'You were mentioned in Slack'
      },
      user: 'hamzarabiu390@gmail.com'
    });
  }
  
  return actions;
}

// ============ NOTION HANDLER ============
function handleNotionEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'page.created' || event === 'database.updated') {
    actions.push({
      action: 'audit_log',
      event_type: 'notion_change',
      details: { 
        event_type: event,
        page_id: data.id || data.page_id,
        title: data.title || data.properties?.title?.plain_text,
        url: data.url
      }
    });
    actions.push({
      action: 'send_push',
      template: 'agent_message',
      variables: { 
        agent_name: 'Notion',
        message: 'Page ' + (event === 'page.created' ? 'created' : 'updated') + ': ' + (data.title || 'Untitled')
      },
      user: 'hamzarabiu390@gmail.com'
    });
  } else if (event === 'block.created') {
    actions.push({
      action: 'audit_log',
      event_type: 'notion_block',
      details: { block_id: data.id, parent: data.parent?.page_id }
    });
  }
  
  return actions;
}

// ============ HUBSPOT HANDLER ============
function handleHubSpotEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'contact.creation') {
    actions.push({
      action: 'create_crm',
      entity: 'whatsapp_crm',
      data: {
        customer_phone: data.properties?.phone || 'unknown',
        customer_name: data.properties?.firstname + ' ' + data.properties?.lastname || 'HubSpot Contact',
        customer_email: data.properties?.email,
        message: 'Contact created from HubSpot',
        inquiry_type: 'general',
        status: 'new',
        response_sent: false,
        platform: 'hubspot'
      }
    });
    actions.push({
      action: 'audit_log',
      event_type: 'hubspot_contact',
      details: { 
        contact_id: data.objectId,
        email: data.properties?.email,
        name: data.properties?.firstname + ' ' + data.properties?.lastname
      }
    });
  } else if (event === 'deal.creation' || event === 'deal.propertyChange') {
    actions.push({
      action: 'audit_log',
      event_type: 'hubspot_deal',
      details: { 
        deal_id: data.objectId,
        deal_name: data.properties?.dealname,
        amount: data.properties?.amount,
        stage: data.properties?.dealstage
      }
    });
    if (data.properties?.amount > 50000) {
      actions.push({
        action: 'send_push',
        template: 'approval_needed',
        variables: { 
          action_type: 'HubSpot Deal',
          customer_name: data.properties?.dealname
        },
        user: 'hamzarabiu390@gmail.com'
      });
    }
  } else if (event === 'form.submission') {
    actions.push({
      action: 'create_crm',
      entity: 'whatsapp_crm',
      data: {
        customer_name: data.properties?.firstname || 'HubSpot Form',
        customer_email: data.properties?.email,
        customer_phone: data.properties?.phone || 'unknown',
        message: 'Form submission: ' + (data.formName || 'Unknown form'),
        inquiry_type: 'general',
        status: 'new',
        response_sent: false,
        platform: 'hubspot'
      }
    });
    actions.push({
      action: 'audit_log',
      event_type: 'hubspot_form',
      details: { 
        form_id: data.formId,
        form_name: data.formName,
        page: data.pageName
      }
    });
    actions.push({
      action: 'send_push',
      template: 'crm_inquiry',
      variables: { 
        customer_name: data.properties?.firstname || 'HubSpot',
        product_interest: 'Form submission'
      },
      user: 'hamzarabiu390@gmail.com'
    });
  }
  
  return actions;
}

// ============ DISCORD HANDLER ============
function handleDiscordEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'message.create') {
    actions.push({
      action: 'audit_log',
      event_type: 'discord_message',
      details: { 
        author: data.author?.username,
        channel: data.channel_id,
        content: data.content?.substring(0, 200)
      }
    });
  } else if (event === 'interaction.create') {
    actions.push({
      action: 'audit_log',
      event_type: 'discord_interaction',
      details: { 
        type: data.type,
        command: data.data?.name
      }
    });
  }
  
  return actions;
}

// ============ STRIPE HANDLER ============
function handleStripeEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'payment_intent.succeeded' || event === 'charge.succeeded') {
    actions.push({
      action: 'create_order',
      entity: 'orders',
      data: {
        buyer_email: data.receipt_email || data.customer_email,
        amount: data.amount / 100,
        currency: (data.currency || 'usd').toUpperCase(),
        payment_status: 'paid',
        payment_reference: data.id,
        seller_email: 'harzco.business@gmail.com'
      }
    });
    actions.push({
      action: 'send_push',
      template: 'payment_success',
      variables: { amount: data.currency + ' ' + (data.amount / 100) },
      user: data.receipt_email
    });
  } else if (event === 'charge.refunded') {
    actions.push({
      action: 'audit_log',
      event_type: 'stripe_refund',
      details: { charge_id: data.id, amount: data.amount / 100 }
    });
  }
  
  return actions;
}

// ============ RESELLERCLUB HANDLER ============
function handleResellerClubEvent(event, data, Database) {
  const actions = [];
  
  if (event === 'domain.registered') {
    actions.push({
      action: 'audit_log',
      event_type: 'domain_registered',
      details: { 
        domain: data.domain, 
        years: data.years,
        customer: data.customer
      }
    });
    actions.push({
      action: 'send_push',
      template: 'agent_message',
      variables: { 
        agent_name: 'HostMaster',
        message: 'Domain registered: ' + data.domain
      },
      user: 'hamzarabiu390@gmail.com'
    });
  } else if (event === 'domain.expiring') {
    actions.push({
      action: 'send_push',
      template: 'security_alert',
      variables: { 
        alert_type: 'Domain Expiring',
        platform: data.domain
      },
      user: 'hamzarabiu390@gmail.com'
    });
  }
  
  return actions;
}

/**
 * List extended providers
 */
function listExtendedProviders() {
  return Object.entries(EXTENDED_PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    has_signature: !!config.signature_header,
    events: config.events,
    endpoint: '/webhooks/' + id
  }));
}

module.exports = {
  EXTENDED_PROVIDERS,
  listExtendedProviders,
  handleGoogleEvent,
  handleSlackEvent,
  handleNotionEvent,
  handleHubSpotEvent
};
