/**
 * HARZ Cloud — Twilio WhatsApp Integration
 * Uses Twilio's WhatsApp API (Meta BSP) to send/receive WhatsApp messages
 * Twilio is an official Meta BSP — no need for direct Meta approval
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox number

function twilioAuth() {
  return 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
}

async function sendWhatsAppMessage(to, body) {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { error: 'Twilio credentials not configured' };
  }
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': twilioAuth(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      From: TWILIO_WHATSAPP_NUMBER,
      To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      Body: body
    })
  });
  
  return response.json();
}

async function sendWhatsAppTemplate(to, templateName, variables) {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { error: 'Twilio credentials not configured' };
  }
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP_NUMBER,
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  });
  
  // Use content template if provided
  if (templateName) {
    params.append('ContentSid', templateName);
    if (variables) {
      params.append('ContentVariables', JSON.stringify(variables));
    }
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': twilioAuth(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  
  return response.json();
}

async function listMessages(limit = 20) {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { error: 'Twilio credentials not configured' };
  }
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json?PageSize=${limit}`;
  const response = await fetch(url, {
    headers: { 'Authorization': twilioAuth() }
  });
  
  return response.json();
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  listMessages,
  twilioAuth
};
