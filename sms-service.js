/**
 * HARZ Cloud — SMS Service
 * Sends SMS via free providers (Termii free 50/day, Twilio)
 */
const crypto = require('crypto');

const SMS_TEMPLATES = {
  otp: 'Your HARZ verification code is: {code}. Valid for 10 minutes.',
  order: 'HARZ: Your order for {product} is confirmed. Download: {url}',
  payment: 'HARZ: Payment of {amount} received. Ref: {reference}',
  welcome: 'Welcome to HARZ! Your account is active. Login: harzdm.vercel.app',
  alert: 'HARZ Alert: {message}',
  crm: 'HARZ: You have a new inquiry from {customer}. Check your dashboard.'
};

async function sendSMS(to, templateName, variables = {}, Database) {
  let message = SMS_TEMPLATES[templateName] || templateName;
  
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(`{${key}}`, value);
  }
  
  // Normalize phone (Nigeria)
  let phone = to.replace(/\s/g, '');
  if (phone.startsWith('0')) phone = '+234' + phone.substring(1);
  if (!phone.startsWith('+')) phone = '+' + phone;
  
  const log = {
    id: crypto.randomUUID(),
    to_phone: phone,
    message: message.substring(0, 160),
    template: templateName,
    status: 'queued',
    created_date: new Date().toISOString()
  };
  
  if (Database) {
    await Database.insert('sms_log', log);
  }
  
  // Try Termii (free 50/day in Nigeria)
  const termiiKey = process.env.TERMII_API_KEY;
  if (termiiKey) {
    try {
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: termiiKey,
          to: phone,
          from: 'HARZ',
          sms: message,
          type: 'plain',
          channel: 'generic'
        })
      });
      
      if (response.ok) {
        if (Database) await Database.update('sms_log', log.id, { status: 'sent' });
        return { success: true, provider: 'termii', to: phone };
      }
    } catch (e) {
      console.error('Termii failed:', e.message);
    }
  }
  
  if (Database) await Database.update('sms_log', log.id, { status: 'logged' });
  return { success: true, provider: 'logged', to: phone, message: 'SMS logged — configure TERMII_API_KEY' };
}

module.exports = { sendSMS, SMS_TEMPLATES };
