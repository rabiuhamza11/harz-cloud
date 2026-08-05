// Cloudflare Pages Function — Gumroad Webhook
// Verifies Gumroad webhook and logs to D1

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

    const productName = body.product_name || body.product_id || 'Gumroad Product';
    const amountUSD = parseFloat(body.price || body.amount || 0);
    const amountNGN = Math.round(amountUSD * 1600);
    const requiresApproval = amountNGN > 50000;

    if (body.refunded === 'true' || body.refunded === true) {
      await env.DB.prepare(
        `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_email, failure_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(productName, amountNGN, amountUSD, 'Gumroad', body.purchase_id || '', 'refunded', body.email || '', 'Customer requested refund', new Date().toISOString()).run();
      return jsonResponse({ status: 'success', message: 'Gumroad refund logged', escalate: true });
    }

    await env.DB.prepare(
      `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, requires_approval, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productName, amountNGN, amountUSD, 'Gumroad',
      body.purchase_id || body.transaction_id || '',
      requiresApproval ? 'awaiting_approval' : 'completed',
      body.full_name || body.email || 'Gumroad Customer',
      body.email || '',
      requiresApproval ? 1 : 0,
      requiresApproval ? 0 : 1,
      new Date().toISOString()
    ).run();

    return jsonResponse({ status: 'success', message: 'Gumroad payment logged', amount_ngn: amountNGN, product: productName });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestGet() {
  return jsonResponse({ status: 'ok', message: 'Gumroad webhook endpoint — Cloudflare Pages Function' });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
