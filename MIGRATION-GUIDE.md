# Harz Cloud — Migration to Cloudflare

## What Changed

This migration moves Harz ecosystem from multiple platforms to **Cloudflare Pages** only.

### Before
- Frontend: GitHub Pages (rabiuhamza11.github.io)
- Backend: Render (harz-cloud-backend.onrender.com)
- Database: JSON files on Render
- Webhooks: Base44 (zola-ae5f482f.base44.app)
- Dashboard: Vercel

### After (Cloudflare Only)
- Frontend: Cloudflare Pages (harz-cloud.pages.dev)
- Backend: Cloudflare Pages Functions (/api/*)
- Database: Cloudflare D1 (SQLite)
- Webhooks: Cloudflare Pages Functions
- Dashboard: Cloudflare Pages

## Setup Steps

### 1. Create D1 Database
```bash
npx wrangler d1 create harz-cloud-db
# Copy the database_id from the output
# Update wrangler.toml with the real database_id
```

### 2. Run Migrations
```bash
npx wrangler d1 execute harz-cloud-db --file=migrations/001_init.sql
```

### 3. Set Environment Variables in Cloudflare Dashboard
- Pages > harz-cloud > Settings > Environment Variables
- PAYSTACK_SECRET_KEY = your_paystack_secret_key
- GDEG_WALLET_ADDRESS = 0xdE2c45A0c25dC290aF51347f95D82EBbe51fe3C1
- HARZ_BUSINESS_EMAIL = harzco.business@gmail.com
- USD_TO_NGN_RATE = 1600

### 4. Bind D1 to Pages
- Pages > harz-cloud > Settings > Functions > D1 Bindings
- Variable name: DB
- D1 database: harz-cloud-db

### 5. Update Paystack Webhook URL
- Paystack Dashboard > Settings > Webhooks
- New URL: https://harz-cloud.pages.dev/api/paystack-webhook

## File Structure
```
harz-cloud/
├── public/                     # Static files (served by Cloudflare Pages)
│   ├── harz-exchange.html      # Harz Exchange frontend
│   └── gdeg-dashboard.html     # GDEG Business Dashboard
├── functions/                  # Cloudflare Pages Functions (API)
│   └── api/
│       ├── harz-exchange.js    # Exchange API (dashboard, prices, wallet, orders, P2P)
│       ├── paystack-webhook.js # Paystack payment webhook
│       └── dashboard.js        # Revenue dashboard data API
├── migrations/
│   └── 001_init.sql            # D1 database schema
└── wrangler.toml               # Cloudflare configuration
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/harz-exchange | POST | Exchange API (dashboard, prices, wallet, orders, P2P) |
| /api/paystack-webhook | POST | Paystack webhook receiver |
| /api/dashboard | GET | Revenue dashboard data |
