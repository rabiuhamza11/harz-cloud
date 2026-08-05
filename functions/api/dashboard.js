/**
 * Cloudflare Pages Function — Dashboard API
 * Returns aggregate data for Harz Business Dashboard
 * Replaces Base44 getDailyRevenueReport backend function
 */

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    // Return static data if D1 not configured
    return jsonResponse({
      status: 'ok',
      message: 'Dashboard API — D1 not configured, returning empty data',
      revenue: { total_ngn: 0, total_usd: 0, completed: 0, failed: 0, pending: 0 },
      channels: [],
      gdeg: { address: '0xdE2c45A0c25dC290aF51347f95D82EBbe51fe3C1', balance: 0, price_ngn: 15 }
    });
  }

  try {
    // Revenue summary
    const completed = await env.DB.prepare('SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = ?').bind('completed').first();
    const failed = await env.DB.prepare('SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = ?').bind('failed').first();
    const pending = await env.DB.prepare('SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = ?').bind('pending').first();
    const awaiting = await env.DB.prepare('SELECT COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = ?').bind('awaiting_approval').first();

    // By payment method
    const byMethod = await env.DB.prepare(
      'SELECT payment_method, COUNT(*) as count, SUM(amount_ngn) as total FROM orders WHERE payment_status = ? GROUP BY payment_method'
    ).bind('completed').all();

    // Recent orders
    const recent = await env.DB.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 10'
    ).all();

    const totalNGN = (completed?.total || 0) + (pending?.total || 0);
    const totalUSD = Math.round((totalNGN / 1600) * 100) / 100;

    return jsonResponse({
      status: 'ok',
      revenue: {
        total_ngn: totalNGN,
        total_usd: totalUSD,
        completed_count: completed?.count || 0,
        completed_ngn: completed?.total || 0,
        failed_count: failed?.count || 0,
        failed_ngn: failed?.total || 0,
        pending_count: pending?.count || 0,
        pending_ngn: pending?.total || 0,
        awaiting_count: awaiting?.count || 0,
        awaiting_ngn: awaiting?.total || 0
      },
      channels: byMethod.results?.map(r => ({
        method: r.payment_method,
        count: r.count,
        total_ngn: r.total
      })) || [],
      gdeg: {
        address: '0xdE2c45A0c25dC290aF51347f95D82EBbe51fe3C1',
        balance: 0,
        price_ngn: 15,
        network: 'Polygon'
      },
      recent_orders: recent.results || []
    });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
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
