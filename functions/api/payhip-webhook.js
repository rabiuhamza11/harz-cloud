// Cloudflare Pages Function — Payhip Webhook
// Logs Payhip payment events to D1

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const body = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value;
    }

    if (!env.DB) {
      return jsonResponse({ status: 'error', message: 'Database not configured' }, 500);
    }

    const productName = body.product_name || body.product || 'Payhip Product';
    const amountUSD = parseFloat(body.total || body.price || 0);
    const amountNGN = Math.round(amountUSD * 1600);
    const requiresApproval = amountNGN > 50000;
    const event = body.event || body.type || 'sale';

    if (event === 'refund' || event === 'refunded') {
      await env.DB.prepare(
        `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_email, failure_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(productName, amountNGN, amountUSD, 'Payhip', body.transaction_id || body.order_id || '', 'refunded', body.email || '', 'Refund processed', new Date().toISOString()).run();
      return jsonResponse({ status: 'success', message: 'Payhip refund logged', escalate: true });
    }

    await env.DB.prepare(
      `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, requires_approval, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productName, amountNGN, amountUSD, 'Payhip',
      body.transaction_id || body.order_id || '',
      requiresApproval ? 'awaiting_approval' : 'completed',
      body.customer_name || body.name || 'Payhip Customer',
      body.email || '',
      requiresApproval ? 1 : 0,
      requiresApproval ? 0 : 1,
      new Date().toISOString()
    ).run();

    return jsonResponse({ status: 'success', message: 'Payhip payment logged', amount_ngn: amountNGN, product: productName });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestGet() {
  return jsonResponse({ status: 'ok', message: 'Payhip webhook endpoint — Cloudflare Pages Function' });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
