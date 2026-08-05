/**
 * HARZ Cloud — WhatsApp Configuration
 * Primary WhatsApp number for HARZ Cloud agents
 */

const WHATSAPP_CONFIG = {
  // Owner's WhatsApp number (international format)
  ownerNumber: 'whatsapp:+2348028687857',
  ownerNumberLocal: '08028687857',
  ownerNumberIntl: '+2348028687857',
  
  // Webhook URLs
  webhookUrl: 'https://harz-cloud-backend.vercel.app/webhooks/whatsapp',
  twilioWebhook: 'https://harz-cloud-backend.vercel.app/webhooks/twilio',
  
  // BSP options (no direct Meta approval needed)
  providers: {
    twilio: {
      name: 'Twilio WhatsApp API',
      setup: 'https://www.twilio.com/console/whatsapp',
      webhook: '/webhooks/twilio',
      envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER']
    },
    '360dialog': {
      name: '360dialog WhatsApp API',
      setup: 'https://www.360dialog.com',
      webhook: '/webhooks/360dialog',
      envVars: ['DIALOG_API_KEY', 'DIALOG_WHATSAPP_NUMBER']
    },
    wati: {
      name: 'WATI WhatsApp API',
      setup: 'https://www.wati.io',
      webhook: '/webhooks/wati',
      envVars: ['WATI_API_TOKEN', 'WATI_ENDPOINT']
    },
    'maytapi': {
      name: 'Maytapi WhatsApp API',
      setup: 'https://www.maytapi.com',
      webhook: '/webhooks/maytapi',
      envVars: ['MAYTAPI_TOKEN', 'MAYTAPI_PHONE_ID', 'MAYTAPI_PRODUCT_ID']
    }
  }
};

module.exports = { WHATSAPP_CONFIG };
