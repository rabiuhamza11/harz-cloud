// Cloudflare Pages Function — Paystack Webhook
// Verifies signature and logs payment to D1 database

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const bodyText = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';

    // Get Paystack secret key from environment
    const secretKey = env.PAYSTACK_SECRET_KEY || '';

    // Verify HMAC SHA-512 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const bodyData = encoder.encode(bodyText);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
    );
    const signed = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
    const hashHex = Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex !== signature) {
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(bodyText);
    const eventType = event.event;
    const data = event.data;

    if (!env.DB) {
      return jsonResponse({ status: 'error', message: 'Database not configured. Set up D1 binding.' }, 500);
    }

    if (eventType === 'charge.success') {
      const amountNGN = (data.amount || 0) / 100;
      const usdRate = 1600;
      const amountUSD = Math.round((amountNGN / usdRate) * 100) / 100;
      const requiresApproval = amountNGN > 50000;

      await env.DB.prepare(
        `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, requires_approval, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.metadata?.product_name || 'Unknown Product',
        amountNGN,
        amountUSD,
        'Paystack',
        data.reference || '',
        requiresApproval ? 'awaiting_approval' : 'completed',
        data.customer?.first_name ? `${data.customer.first_name} ${data.customer.last_name || ''}`.trim() : data.customer?.email || 'Unknown',
        data.customer?.email || '',
        requiresApproval ? 1 : 0,
        requiresApproval ? 0 : 1,
        new Date().toISOString()
      ).run();

      return jsonResponse({
        status: 'success',
        message: requiresApproval ? 'Payment logged — awaiting approval' : 'Payment logged and completed',
        amount_ngn: amountNGN,
        requires_approval: requiresApproval
      });
    }

    if (eventType === 'charge.failed') {
      const amountNGN = (data.amount || 0) / 100;
      const amountUSD = Math.round((amountNGN / 1600) * 100) / 100;

      await env.DB.prepare(
        `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, failure_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.metadata?.product_name || 'Unknown Product',
        amountNGN,
        amountUSD,
        'Paystack',
        data.reference || '',
        'failed',
        data.customer?.first_name ? `${data.customer.first_name} ${data.customer.last_name || ''}`.trim() : data.customer?.email || 'Unknown',
        data.customer?.email || '',
        data.gateway_response || 'Payment failed',
        new Date().toISOString()
      ).run();

      return jsonResponse({ status: 'success', message: 'Failed payment logged' });
    }

    if (eventType === 'refund.processed' || eventType === 'refund.created') {
      return jsonResponse({
        status: 'success',
        message: 'Refund event received — escalation needed for Rabiu',
        amount_ngn: (data.amount || 0) / 100,
        escalate: true
      });
    }

    return jsonResponse({ status: 'success', message: 'Event received', event: eventType });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestGet(context) {
  return jsonResponse({ status: 'ok', message: 'Paystack webhook endpoint — Cloudflare Pages Function' });
}

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-paystack-signature'
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
