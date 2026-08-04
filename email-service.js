/**
 * HARZ Cloud — Email Service
 * Sends transactional emails via free providers
 * Supports: Resend, SendGrid (free 100/day), Nodemailer SMTP
 */
const crypto = require('crypto');

const TEMPLATES = {
  welcome: {
    subject: 'Welcome to HARZ Digital Services',
    body: `Hello {name},\n\nWelcome to HARZ ecosystem! Your account is ready.\n\nLogin at: https://harzdm.vercel.app\n\nHARZ Digital Services`
  },
  password_reset: {
    subject: 'HARZ Cloud — Password Reset',
    body: `Hello {name},\n\nYour password reset code is: {code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, ignore this email.\n\nHARZ Digital Services`
  },
  email_verification: {
    subject: 'HARZ Cloud — Verify Your Email',
    body: `Hello {name},\n\nYour verification code is: {code}\n\nEnter this code to verify your email address.\n\nHARZ Digital Services`
  },
  order_confirmation: {
    subject: 'HARZ — Order Confirmation #{order_id}',
    body: `Hello {name},\n\nYour order has been confirmed!\n\nProduct: {product}\nAmount: {amount}\nDownload: {download_url}\n\nThank you for your purchase!\n\nHARZ Digital Services`
  },
  payment_received: {
    subject: 'HARZ — Payment Received',
    body: `Hello {name},\n\nWe received your payment of {amount}.\n\nPayment method: {method}\nReference: {reference}\n\nYour product is ready: {download_url}\n\nHARZ Digital Services`
  },
  daily_report: {
    subject: 'HARZ Daily Report — {date}',
    body: `HARZ Ecosystem Daily Report\n\nDate: {date}\nTotal inquiries: {inquiries}\nOrders: {orders}\nRevenue: {revenue}\nNew customers: {new_customers}\n\nHARZ Digital Services`
  },
  security_alert: {
    subject: 'HARZ Security Alert — {alert_type}',
    body: `SECURITY ALERT\n\nType: {alert_type}\nDetails: {details}\nTime: {timestamp}\n\nIf this is suspicious, change your password immediately.\n\nHARZ Security Team`
  },
  agent_message: {
    subject: 'HARZ Agent — {agent_name}',
    body: `{message}\n\nFrom: {agent_name}\nHARZ Digital Services`
  }
};

async function sendEmail(to, templateName, variables = {}, Database) {
  const template = TEMPLATES[templateName];
  if (!template) {
    return { success: false, error: 'Unknown template: ' + templateName };
  }
  
  let subject = template.subject;
  let body = template.body;
  
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(`{${key}}`, value);
    body = body.replace(`{${key}}`, value);
  }
  
  // Log email to database
  const emailLog = {
    id: crypto.randomUUID(),
    to_email: to,
    subject,
    body: body.substring(0, 1000),
    template: templateName,
    status: 'queued',
    created_date: new Date().toISOString()
  };
  
  if (Database) {
    await Database.insert('email_log', emailLog);
  }
  
  // Try Resend API (free 100/day)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + resendKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HARZ <noreply@harz.digital>',
          to: [to],
          subject,
          text: body
        })
      });
      
      if (response.ok) {
        if (Database) await Database.update('email_log', emailLog.id, { status: 'sent' });
        return { success: true, provider: 'resend', to, subject };
      }
    } catch (e) {
      console.error('Resend failed:', e.message);
    }
  }
  
  // Fallback: log for manual send
  if (Database) await Database.update('email_log', emailLog.id, { status: 'logged' });
  
  return { 
    success: true, 
    provider: 'logged',
    to, subject, 
    message: 'Email logged — configure RESEND_API_KEY for auto-send'
  };
}

function listTemplates() {
  return Object.keys(TEMPLATES).map(name => ({
    name,
    subject: TEMPLATES[name].subject,
    variables: (TEMPLATES[name].body.match(/\{(\w+)\}/g) || []).map(v => v.replace(/[{}]/g, ''))
  }));
}

module.exports = { sendEmail, listTemplates, TEMPLATES };
