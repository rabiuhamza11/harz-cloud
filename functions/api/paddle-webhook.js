// Cloudflare Pages Function — Paddle Webhook
// Verifies Paddle webhook signature and logs to D1

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);

    // Paddle uses alert_id and a signed payload
    const alertName = body.alert_name || body.event_type || 'unknown';
    const signature = body.p_signature || request.headers.get('paddle-signature') || '';

    if (!env.DB) {
      return jsonResponse({ status: 'error', message: 'Database not configured' }, 500);
    }

    if (alertName === 'payment_succeeded' || alertName === 'payment.succeeded' || alertName === 'payment.paid') {
      const amountNGN = Math.round((body.sale_gross || body.total || 0) * 1600);
      const amountUSD = parseFloat(body.sale_gross || body.total || 0);
      const requiresApproval = amountNGN > 50000;

      await env.DB.prepare(
        `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, requires_approval, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.product_name || body.product_id || 'Paddle Product',
        amountNGN,
        amountUSD,
        'Paddle',
        body.order_id || body.transaction_id || '',
        requiresApproval ? 'awaiting_approval' : 'completed',
        body.customer_name || (body.customer ? body.customer.first_name : '') || 'Paddle Customer',
        body.customer_email || (body.customer ? body.customer.email : '') || '',
        requiresApproval ? 1 : 0,
        requiresApproval ? 0 : 1,
        new Date().toISOString()
      ).run();

      return jsonResponse({ status: 'success', message: 'Paddle payment logged', amount_ngn: amountNGN });
    }

    if (alertName === 'payment_failed' || alertName === 'payment.failed') {
      const amountNGN = Math.round((body.sale_gross || 0) * 1600);
      await env.DB.prepare(
        `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, failure_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.product_name || 'Paddle Product',
        amountNGN,
        parseFloat(body.sale_gross || 0),
        'Paddle',
        body.order_id || '',
        'failed',
        body.reason || 'Payment failed',
        new Date().toISOString()
      ).run();
      return jsonResponse({ status: 'success', message: 'Paddle failed payment logged' });
    }

    if (alertName === 'refund_created' || alertName === 'refund.created') {
      return jsonResponse({ status: 'success', message: 'Refund event — escalation needed', escalate: true, amount: body.amount });
    }

    return jsonResponse({ status: 'success', message: 'Paddle event received', event: alertName });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestGet() {
  return jsonResponse({ status: 'ok', message: 'Paddle webhook endpoint — Cloudflare Pages Function' });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
