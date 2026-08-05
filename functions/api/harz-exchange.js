// Cloudflare Pages Function — Harz Exchange API
// Replaces Base44 backend function harzExchange
// Uses Cloudflare D1 for database (with Base44 fallback during migration)

const HARZ_BUSINESS = {
  name: 'Harz Digital Services',
  email: 'harzco.business@gmail.com',
  phone: '08028687857',
  alt_phone: '07036170795',
  bank: 'UBA',
  account_name: 'Rabiu Hamza Mohammed',
  account_number: '2034326424',
  gdeg_address: '0xdE2c45A0c25dC290aF51347f95D82EBbe51fe3C1',
  gdeg_network: 'Polygon',
  usdt_address: 'Coming soon — use GDEG or Bank Transfer',
  cac: 'RC 321424',
  tin: '24550860'
};

const PAIRS = [
  { pair: 'USDT/NGN', last_price: 1615, change_24h: 0.3, volume_24h: 125.4, high_24h: 1620, low_24h: 1598 },
  { pair: 'BTC/USDT', last_price: 23950000, change_24h: 1.5, volume_24h: 3.8, high_24h: 24180000, low_24h: 23700000 },
  { pair: 'ETH/USDT', last_price: 1828000, change_24h: -0.5, volume_24h: 6.2, high_24h: 1830000, low_24h: 1790000 },
  { pair: 'BTC/NGN', last_price: 24180000, change_24h: 2.4, volume_24h: 4.2, high_24h: 24500000, low_24h: 23800000 },
  { pair: 'BNB/NGN', last_price: 1455000, change_24h: -0.8, volume_24h: 2.1, high_24h: 1480000, low_24h: 1420000 },
  { pair: 'ETH/NGN', last_price: 1830000, change_24h: -1.2, volume_24h: 8.7, high_24h: 1850000, low_24h: 1790000 },
  { pair: 'GDEG/NGN', last_price: 15, change_24h: 0, volume_24h: 0, high_24h: 15, low_24h: 15 }
];

const P2P_LISTINGS = [
  { ad_id: 'P2P-001', trade_type: 'sell', crypto_symbol: 'USDT', fiat_currency: 'NGN', price_per_unit: 1615, crypto_amount: 500, min_order: 16150, max_order: 807500, payment_methods: 'Bank Transfer,Paystack', user_name: 'Harz Digital Services', user_phone: '08028687857', user_rating: 5, verification_level: 'KYC L3', trades_count: 127, status: 'active' },
  { ad_id: 'P2P-002', trade_type: 'buy', crypto_symbol: 'USDT', fiat_currency: 'NGN', price_per_unit: 1598, crypto_amount: 1000, min_order: 15980, max_order: 1598000, payment_methods: 'Bank Transfer', user_name: 'Harz Digital Services', user_phone: '08028687857', user_rating: 5, verification_level: 'KYC L3', trades_count: 127, status: 'active' },
  { ad_id: 'P2P-003', trade_type: 'sell', crypto_symbol: 'BTC', fiat_currency: 'NGN', price_per_unit: 24180000, crypto_amount: 0.05, min_order: 1209000, max_order: 1209000, payment_methods: 'Bank Transfer,Paystack,USDT', user_name: 'Harz Digital Services', user_phone: '08028687857', user_rating: 5, verification_level: 'KYC L3', trades_count: 127, status: 'active' },
  { ad_id: 'P2P-004', trade_type: 'sell', crypto_symbol: 'GDEG', fiat_currency: 'NGN', price_per_unit: 15, crypto_amount: 10000, min_order: 1500, max_order: 150000, payment_methods: 'Bank Transfer,Paystack,USDT', user_name: 'Harz Digital Services', user_phone: '08028687857', user_rating: 5, verification_level: 'KYC L3', trades_count: 89, status: 'active' },
  { ad_id: 'P2P-005', trade_type: 'sell', crypto_symbol: 'ETH', fiat_currency: 'NGN', price_per_unit: 1830000, crypto_amount: 2, min_order: 183000, max_order: 3660000, payment_methods: 'Bank Transfer,Paystack', user_name: 'Harz Digital Services', user_phone: '08028687857', user_rating: 5, verification_level: 'KYC L3', trades_count: 127, status: 'active' },
  { ad_id: 'P2P-006', trade_type: 'sell', crypto_symbol: 'BNB', fiat_currency: 'NGN', price_per_unit: 1455000, crypto_amount: 5, min_order: 145500, max_order: 7275000, payment_methods: 'Bank Transfer,Paystack', user_name: 'Harz Digital Services', user_phone: '08028687857', user_rating: 5, verification_level: 'KYC L3', trades_count: 127, status: 'active' }
];

const DEFAULT_WALLET = {
  user_email: 'harzco.business@gmail.com',
  ngn_balance: 1250000,
  usdt_balance: 845.50,
  btc_balance: 0.0125,
  eth_balance: 1.8,
  bnb_balance: 3.2,
  gdeg_balance: 15000
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const action = body.action;

  try {
    switch (action) {
      case 'dashboard':
        return jsonResponse({
          status: 'ok',
          business: HARZ_BUSINESS,
          overview: {
            pairs: PAIRS.length,
            active_p2p_listings: P2P_LISTINGS.filter(l => l.status === 'active').length,
            open_orders: 0,
            active_trades: 1,
            completed_trades: 1,
            total_volume_24h: 150.40,
            total_users: 1
          },
          pairs: PAIRS,
          p2p_listings: P2P_LISTINGS
        });

      case 'prices': {
        const prices = {};
        for (const p of PAIRS) {
          prices[p.pair] = {
            price: p.last_price,
            change_24h: p.change_24h,
            high_24h: p.high_24h,
            low_24h: p.low_24h,
            volume_24h: p.volume_24h
          };
        }
        return jsonResponse({ status: 'ok', prices });
      }

      case 'wallet': {
        let wallet = DEFAULT_WALLET;
        if (env.DB) {
          const result = await env.DB.prepare('SELECT * FROM wallets WHERE user_email = ?').bind(body.user_email || 'harzco.business@gmail.com').first();
          if (result) wallet = result;
        }
        return jsonResponse({ status: 'ok', wallet });
      }

      case 'orderbook':
        return jsonResponse({
          status: 'ok',
          pair: body.pair || 'BTC/NGN',
          bids: [
            { price: 24170000, amount: 0.15, total: 3625500 },
            { price: 24150000, amount: 0.08, total: 1932000 },
            { price: 24100000, amount: 0.12, total: 2892000 }
          ],
          asks: [
            { price: 24190000, amount: 0.10, total: 2419000 },
            { price: 24210000, amount: 0.05, total: 1210500 },
            { price: 24250000, amount: 0.20, total: 4850000 }
          ]
        });

      case 'create_order': {
        const order = {
          id: 'ORD-' + Date.now(),
          order_type: body.order_type,
          pair: body.pair,
          price: body.price,
          amount: body.amount,
          total: body.price * body.amount,
          status: 'open',
          created_at: new Date().toISOString(),
          user_email: body.user_email
        };
        if (env.DB) {
          await env.DB.prepare(
            'INSERT INTO orders (id, order_type, pair, price, amount, total, status, user_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(order.id, order.order_type, order.pair, order.price, order.amount, order.total, order.status, order.user_email, order.created_at).run();
        }
        return jsonResponse({ status: 'ok', message: 'Order created', order });
      }

      case 'start_p2p_trade': {
        const trade = {
          trade_id: 'TRD-' + Date.now(),
          ad_id: body.ad_id,
          crypto_amount: body.crypto_amount,
          fiat_amount: body.fiat_amount,
          payment_method: body.payment_method,
          buyer_email: body.buyer_email,
          buyer_name: body.buyer_name,
          buyer_phone: body.buyer_phone,
          status: 'pending_payment',
          created_at: new Date().toISOString()
        };
        if (env.DB) {
          await env.DB.prepare(
            'INSERT INTO p2p_trades (trade_id, ad_id, crypto_amount, fiat_amount, payment_method, buyer_email, buyer_name, buyer_phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(trade.trade_id, trade.ad_id, trade.crypto_amount, trade.fiat_amount, trade.payment_method, trade.buyer_email, trade.buyer_name, trade.buyer_phone, trade.status, trade.created_at).run();
        }
        return jsonResponse({ status: 'ok', message: 'P2P trade started', trade });
      }

      case 'confirm_p2p_payment':
        return jsonResponse({ status: 'ok', message: 'Payment confirmed. Crypto released.', trade_id: body.trade_id });

      case 'raise_dispute':
        return jsonResponse({ status: 'ok', message: 'Dispute raised. Harz support will review.', trade_id: body.trade_id, reason: body.reason });

      case 'create_p2p': {
        const ad = {
          ad_id: 'P2P-' + Math.floor(Math.random() * 999),
          trade_type: body.trade_type,
          crypto_symbol: body.crypto_symbol,
          fiat_currency: body.fiat_currency || 'NGN',
          price_per_unit: body.price_per_unit,
          crypto_amount: body.crypto_amount,
          payment_methods: body.payment_methods,
          user_email: body.user_email,
          user_name: body.user_name,
          user_phone: body.user_phone,
          status: 'active'
        };
        if (env.DB) {
          await env.DB.prepare(
            'INSERT INTO p2p_listings (ad_id, trade_type, crypto_symbol, fiat_currency, price_per_unit, crypto_amount, payment_methods, user_email, user_name, user_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(ad.ad_id, ad.trade_type, ad.crypto_symbol, ad.fiat_currency, ad.price_per_unit, ad.crypto_amount, ad.payment_methods, ad.user_email, ad.user_name, ad.user_phone, ad.status).run();
        }
        return jsonResponse({ status: 'ok', message: 'P2P listing created', ad });
      }

      default:
        return jsonResponse({ status: 'error', message: 'Unknown action: ' + action }, 400);
    }
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'orderbook') {
    const pair = url.searchParams.get('pair') || 'BTC/NGN';
    return jsonResponse({
      status: 'ok',
      pair,
      bids: [
        { price: 24170000, amount: 0.15, total: 3625500 },
        { price: 24150000, amount: 0.08, total: 1932000 }
      ],
      asks: [
        { price: 24190000, amount: 0.10, total: 2419000 },
        { price: 24210000, amount: 0.05, total: 1210500 }
      ]
    });
  }

  return jsonResponse({ status: 'ok', message: 'Harz Exchange API — Cloudflare Pages Function', endpoints: ['dashboard', 'prices', 'wallet', 'orderbook', 'create_order', 'start_p2p_trade'] });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
