-- Harz Cloud D1 Database Schema
-- Replaces Base44 Order entity + Harz Exchange data
-- Deploy: npx wrangler d1 execute harz-cloud-db --file=migrations/001_init.sql

-- Orders table (replaces Base44 Order entity)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT DEFAULT 'Unknown Product',
  amount_ngn REAL DEFAULT 0,
  amount_usd REAL DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'pending',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  affiliate_id TEXT,
  affiliate_commission REAL DEFAULT 0,
  requires_approval INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  retry_attempted INTEGER DEFAULT 0,
  suspicious_flag INTEGER DEFAULT 0,
  failure_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT UNIQUE,
  ngn_balance REAL DEFAULT 0,
  usdt_balance REAL DEFAULT 0,
  btc_balance REAL DEFAULT 0,
  eth_balance REAL DEFAULT 0,
  bnb_balance REAL DEFAULT 0,
  gdeg_balance REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Exchange orders
CREATE TABLE IF NOT EXISTS exchange_orders (
  id TEXT PRIMARY KEY,
  order_type TEXT,
  pair TEXT,
  price REAL,
  amount REAL,
  total REAL,
  status TEXT DEFAULT 'open',
  user_email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- P2P listings
CREATE TABLE IF NOT EXISTS p2p_listings (
  ad_id TEXT PRIMARY KEY,
  trade_type TEXT,
  crypto_symbol TEXT,
  fiat_currency TEXT DEFAULT 'NGN',
  price_per_unit REAL,
  crypto_amount REAL,
  min_order REAL,
  max_order REAL,
  payment_methods TEXT,
  user_email TEXT,
  user_name TEXT,
  user_phone TEXT,
  user_rating INTEGER DEFAULT 5,
  verification_level TEXT,
  trades_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- P2P trades
CREATE TABLE IF NOT EXISTS p2p_trades (
  trade_id TEXT PRIMARY KEY,
  ad_id TEXT,
  crypto_amount REAL,
  fiat_amount REAL,
  payment_method TEXT,
  buyer_email TEXT,
  buyer_name TEXT,
  buyer_phone TEXT,
  seller_email TEXT,
  seller_name TEXT,
  status TEXT DEFAULT 'pending_payment',
  escrow_status TEXT DEFAULT 'holding',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Users (replaces Base44 User entity)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  kyc_level TEXT DEFAULT 'none',
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT,
  platform TEXT,
  page_url TEXT,
  user_email TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insert default wallet
INSERT OR IGNORE INTO wallets (user_email, ngn_balance, usdt_balance, btc_balance, eth_balance, bnb_balance, gdeg_balance)
VALUES ('harzco.business@gmail.com', 1250000, 845.50, 0.0125, 1.8, 3.2, 15000);

-- Insert default P2P listings
INSERT OR IGNORE INTO p2p_listings (ad_id, trade_type, crypto_symbol, fiat_currency, price_per_unit, crypto_amount, min_order, max_order, payment_methods, user_name, user_phone, user_rating, verification_level, trades_count, status)
VALUES
  ('P2P-001', 'sell', 'USDT', 'NGN', 1615, 500, 16150, 807500, 'Bank Transfer,Paystack', 'Harz Digital Services', '08028687857', 5, 'KYC L3', 127, 'active'),
  ('P2P-002', 'buy', 'USDT', 'NGN', 1598, 1000, 15980, 1598000, 'Bank Transfer', 'Harz Digital Services', '08028687857', 5, 'KYC L3', 127, 'active'),
  ('P2P-003', 'sell', 'BTC', 'NGN', 24180000, 0.05, 1209000, 1209000, 'Bank Transfer,Paystack,USDT', 'Harz Digital Services', '08028687857', 5, 'KYC L3', 127, 'active'),
  ('P2P-004', 'sell', 'GDEG', 'NGN', 15, 10000, 1500, 150000, 'Bank Transfer,Paystack,USDT', 'Harz Digital Services', '08028687857', 5, 'KYC L3', 89, 'active'),
  ('P2P-005', 'sell', 'ETH', 'NGN', 1830000, 2, 183000, 3660000, 'Bank Transfer,Paystack', 'Harz Digital Services', '08028687857', 5, 'KYC L3', 127, 'active'),
  ('P2P-006', 'sell', 'BNB', 'NGN', 1455000, 5, 145500, 7275000, 'Bank Transfer,Paystack', 'Harz Digital Services', '08028687857', 5, 'KYC L3', 127, 'active');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_p2p_status ON p2p_listings(status);
CREATE INDEX IF NOT EXISTS idx_trades_status ON p2p_trades(status);
