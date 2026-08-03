# HARZ Cloud — Independent Infrastructure Backend

Self-reliant backend for HARZ Digital Services. Replaces Base44/Cloudflare dependency.

## Features
- REST API (CRUD for all entities)
- JWT Authentication
- Paystack Integration (checkout, verification, webhooks)
- Agent Chat (7 AI agents)
- Daily Backup System
- SQLite → PostgreSQL (Supabase) ready
- File Storage

## Deploy to Render (Free Tier)

1. Go to https://render.com → New → Web Service
2. Connect GitHub repo: `rabiuhamza11/harz-cloud`
3. Render will auto-detect `render.yaml`
4. Set environment variables:
   - `PAYSTACK_SECRET_KEY` — your Paystack secret key
   - `JWT_SECRET` — auto-generated
   - `HARZ_API_KEY` — `harz_cloud_live_321424`
5. Deploy!

## API Endpoints

### Health
- `GET /health` — Health check

### Auth
- `POST /auth/signup` — Register user
- `POST /auth/login` — Login user

### Entity CRUD
- `GET /api/:entity` — List records
- `GET /api/:entity/:id` — Get single record
- `POST /api/:entity` — Create record
- `PUT /api/:entity/:id` — Update record
- `DELETE /api/:entity/:id` — Delete record

### Paystack
- `POST /paystack/initialize` — Initialize checkout
- `GET /paystack/verify/:reference` — Verify payment
- `POST /paystack/webhook` — Paystack webhook

### Agent Chat
- `POST /agent/chat` — Chat with AI agent

### Backup
- `GET /backup/export` — Export all data as JSON
- `POST /backup/import` — Import data from JSON

### Status
- `GET /status` — Ecosystem status

## Authentication
All API requests require `x-api-key` header with value: `harz_cloud_live_321424`

## Local Development
```bash
npm install
node server.js
node test.js
```

## Architecture
```
HARZ Cloud
├── server.js     — Express API server
├── database.js   — SQLite/PostgreSQL layer
├── storage.js    — File storage
├── paystack.js   — Payment integration
├── backup.js     — Daily backup system
├── test.js       — Test suite
└── render.yaml   — Render deployment config
```

## Migration Plan
1. ✅ Build backend (this repo)
2. ⬜ Export Base44 entities to JSON
3. ⬜ Import JSON to HARZ Cloud
4. ⬜ Deploy to Render
5. ⬜ Deploy frontend to Netlify (backup for GitHub Pages)
6. ⬜ Set up daily backup automation
7. ⬜ Point DNS to new infrastructure
