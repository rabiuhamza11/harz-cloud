// Cloudflare Pages Function — Revenue Report
// Replaces Base44 getDailyRevenueReport backend function
// Returns daily/weekly/monthly revenue summary

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'today';

  if (!env.DB) {
    return jsonResponse({
      status: 'ok',
      period: period,
      message: 'D1 not configured — no data available',
      revenue: { total_ngn: 0, total_usd: 0, completed: 0, failed: 0, pending: 0 },
      by_channel: [],
      by_product: []
    });
  }

  try {
    let dateFilter = '';
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (period === 'today') {
      dateFilter = `AND date(created_at) = '${today}'`;
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      dateFilter = `AND date(created_at) >= '${weekAgo}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      dateFilter = `AND date(created_at) >= '${monthAgo}'`;
    }

    // Revenue by status
    const completed = await env.DB.prepare(`SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = 'completed' ${dateFilter}`).first();
    const failed = await env.DB.prepare(`SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = 'failed' ${dateFilter}`).first();
    const pending = await env.DB.prepare(`SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status IN ('pending', 'awaiting_approval') ${dateFilter}`).first();

    // By channel
    const byChannel = await env.DB.prepare(
      `SELECT payment_method, COUNT(*) as count, SUM(amount_ngn) as total_ngn, SUM(amount_usd) as total_usd
       FROM orders WHERE payment_status = 'completed' ${dateFilter}
       GROUP BY payment_method ORDER BY total_ngn DESC`
    ).all();

    // By product
    const byProduct = await env.DB.prepare(
      `SELECT product_name, COUNT(*) as count, SUM(amount_ngn) as total_ngn
       FROM orders WHERE payment_status = 'completed' ${dateFilter}
       GROUP BY product_name ORDER BY total_ngn DESC LIMIT 10`
    ).all();

    // Awaiting approval
    const awaiting = await env.DB.prepare(
      `SELECT * FROM orders WHERE payment_status = 'awaiting_approval' ${dateFilter} ORDER BY amount_ngn DESC`
    ).all();

    const totalNGN = completed?.total || 0;
    const totalUSD = Math.round((totalNGN / 1600) * 100) / 100;

    return jsonResponse({
      status: 'ok',
      period: period,
      date: today,
      revenue: {
        total_ngn: totalNGN,
        total_usd: totalUSD,
        completed_count: completed?.count || 0,
        completed_ngn: completed?.total || 0,
        failed_count: failed?.count || 0,
        failed_ngn: failed?.total || 0,
        pending_count: pending?.count || 0,
        pending_ngn: pending?.total || 0
      },
      by_channel: byChannel.results || [],
      by_product: byProduct.results || [],
      awaiting_approval: awaiting.results || [],
      exchange_rate: 1600
    });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
