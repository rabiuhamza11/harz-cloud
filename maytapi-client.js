/**
 * HARZ Cloud — Maytapi WhatsApp Integration
 * Maytapi lets you use ANY WhatsApp number (including 08028687857)
 * No Meta Business approval needed — works with personal WhatsApp
 * 
 * Setup: https://www.maytapi.com
 * Env vars: MAYTAPI_TOKEN, MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID
 */

const MAYTAPI_TOKEN = process.env.MAYTAPI_TOKEN || '';
const MAYTAPI_PRODUCT_ID = process.env.MAYTAPI_PRODUCT_ID || '';
const MAYTAPI_PHONE_ID = process.env.MAYTAPI_PHONE_ID || '';

const BASE_URL = `https://api.maytapi.com/api/${MAYTAPI_PRODUCT_ID}`;

async function sendMessage(toNumber, message) {
  if (!MAYTAPI_TOKEN || !MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID) {
    return { error: 'Maytapi not configured. Set MAYTAPI_TOKEN, MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID' };
  }
  
  const url = `${BASE_URL}/${MAYTAPI_PHONE_ID}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-maytapi-key': MAYTAPI_TOKEN
    },
    body: JSON.stringify({
      to_number: toNumber,
      message: message,
      type: 'text'
    })
  });
  
  return response.json();
}

async function sendMediaMessage(toNumber, mediaUrl, caption) {
  if (!MAYTAPI_TOKEN || !MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID) {
    return { error: 'Maytapi not configured' };
  }
  
  const url = `${BASE_URL}/${MAYTAPI_PHONE_ID}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-maytapi-key': MAYTAPI_TOKEN
    },
    body: JSON.stringify({
      to_number: toNumber,
      message: mediaUrl,
      type: 'media',
      message_text: caption || ''
    })
  });
  
  return response.json();
}

async function getPhones() {
  if (!MAYTAPI_TOKEN || !MAYTAPI_PRODUCT_ID) {
    return { error: 'Maytapi not configured' };
  }
  
  const url = `${BASE_URL}/listPhones`;
  const response = await fetch(url, {
    headers: { 'x-maytapi-key': MAYTAPI_TOKEN }
  });
  
  return response.json();
}

async function checkPhoneStatus() {
  if (!MAYTAPI_TOKEN || !MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID) {
    return { error: 'Maytapi not configured' };
  }
  
  const url = `${BASE_URL}/${MAYTAPI_PHONE_ID}/config`;
  const response = await fetch(url, {
    headers: { 'x-maytapi-key': MAYTAPI_TOKEN }
  });
  
  return response.json();
}

module.exports = {
  sendMessage,
  sendMediaMessage,
  getPhones,
  checkPhoneStatus,
  MAYTAPI_TOKEN,
  MAYTAPI_PRODUCT_ID,
  MAYTAPI_PHONE_ID
};
