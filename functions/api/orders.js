// Cloudflare Pages Function — Orders API
// CRUD for orders in D1 — replaces Base44 Order entity

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DB) {
    return jsonResponse({ status: 'ok', orders: [], message: 'D1 not configured — returning empty' });
  }

  try {
    const status = url.searchParams.get('status');
    const method = url.searchParams.get('payment_method');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = 'SELECT * FROM orders';
    let conditions = [];
    let binds = [];

    if (status) { conditions.push('payment_status = ?'); binds.push(status); }
    if (method) { conditions.push('payment_method = ?'); binds.push(method); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    binds.push(limit, offset);

    const stmt = env.DB.prepare(query);
    const result = await stmt.bind(...binds).all();

    return jsonResponse({ status: 'ok', orders: result.results, count: result.results.length });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return jsonResponse({ status: 'error', message: 'Database not configured' }, 500);
  }

  try {
    const body = await request.json();
    const amountNGN = parseFloat(body.amount_ngn || 0);
    const amountUSD = body.amount_usd ? parseFloat(body.amount_usd) : Math.round((amountNGN / 1600) * 100) / 100;
    const requiresApproval = amountNGN > 50000;

    const result = await env.DB.prepare(
      `INSERT INTO orders (product_name, amount_ngn, amount_usd, payment_method, payment_reference, payment_status, customer_name, customer_email, requires_approval, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.product_name || 'Unknown',
      amountNGN,
      amountUSD,
      body.payment_method || 'Unknown',
      body.payment_reference || '',
      body.payment_status || (requiresApproval ? 'awaiting_approval' : 'pending'),
      body.customer_name || '',
      body.customer_email || '',
      requiresApproval ? 1 : 0,
      requiresApproval ? 0 : 0,
      new Date().toISOString()
    ).run();

    return jsonResponse({ status: 'ok', message: 'Order created', id: result.meta.last_row_id });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
