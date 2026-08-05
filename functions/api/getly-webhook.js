// Cloudflare Pages Function — Getly Webhook
// Logs Getly payment events to D1

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    if (!env.DB) {
      return jsonResponse({ status: 'error', message: 'Database not configured' }, 500);
    }

    const amountNGN = parseFloat(body.amount || body.value || 0);
    const amountUSD = Math.round((amountNGN / 1600) * 100) / 100;
    const status = body.status || 'completed';
    const requiresApproval = amountNGN > 50000;

    await env.DB.prepare(
      `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, requires_approval, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.product || body.description || 'Getly Product',
      amountNGN,
      amountUSD,
      'Getly',
      body.reference || body.transaction_id || '',
      status === 'success' ? (requiresApproval ? 'awaiting_approval' : 'completed') : 'failed',
      body.customer_name || body.name || 'Getly Customer',
      body.customer_email || body.email || '',
      requiresApproval ? 1 : 0,
      requiresApproval ? 0 : 1,
      new Date().toISOString()
    ).run();

    return jsonResponse({ status: 'success', message: 'Getly payment logged', amount_ngn: amountNGN });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestGet() {
  return jsonResponse({ status: 'ok', message: 'Getly webhook endpoint — Cloudflare Pages Function' });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
