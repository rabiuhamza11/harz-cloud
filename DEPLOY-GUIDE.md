# HARZ Cloud v3.3 — Render Deploy Guide

## Quick Deploy (5 Minutes)

### Step 1: Go to Render
1. Open https://dashboard.render.com
2. Sign in with your account

### Step 2: Create Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub account (if not connected)
3. Select repo: `rabiuhamza11/harz-cloud`
4. Render will auto-detect `render.yaml` settings

### Step 3: Configure
- Name: harz-cloud-backend (auto-filled)
- Region: Frankfurt (auto-filled)
- Plan: Free
- Build: npm install (auto-filled)
- Start: node server.js (auto-filled)
- Click "Create Web Service"

### Step 4: Set Environment Variables
After deploy starts, go to "Environment" tab and add:

Required (auto-generated):
- JWT_SECRET (auto-generated)
- NODE_ENV: production
- PORT: 3000

Set manually (only if you have them):
- PAYSTACK_SECRET_KEY (your Paystack secret key)
- VAPID_PUBLIC_KEY (generate: npx web-push generate-vapid-keys)
- VAPID_PRIVATE_KEY (from same command)
- SLACK_SIGNING_SECRET (from Slack app config)
- GOOGLE_WEBHOOK_SECRET (any random string)

### Step 5: Wait for Deploy
- Build takes 2-3 minutes
- Watch the logs
- When you see "HARZ Cloud v3.3 running on port 3000" → success!

### Step 6: Test
Your API URL will be:
https://harz-cloud-backend.onrender.com

Test endpoints:
- https://harz-cloud-backend.onrender.com/health
- https://harz-cloud-backend.onrender.com/api/endpoints
- https://harz-cloud-backend.onrender.com/auth/register
- https://harz-cloud-backend.onrender.com/cdn/config

### Step 7: Set Up Cron Job (Daily Backup)
1. Click "New +" → "Cron Job"
2. Select repo: rabiuhamza11/harz-cloud
3. Command: node backup.js
4. Schedule: 0 1 * * * (2 AM WAT daily)
5. Plan: Free
6. Click "Create Cron Job"

## Post-Deploy Checklist

- [ ] Health check passes: /health returns 200
- [ ] User registration works: POST /auth/register
- [ ] Login works: POST /auth/login
- [ ] RBAC roles work: GET /roles
- [ ] SSO works: POST /sso/authenticate
- [ ] Push VAPID key: GET /push/vapid-key
- [ ] CDN serving: GET /cdn/config
- [ ] Webhooks: GET /webhooks/providers
- [ ] Analytics: GET /analytics/summary
- [ ] Agents: GET /agents/list
- [ ] Memory: GET /memory/types
- [ ] Session stats: GET /session/stats

## Connect Webhooks (After Deploy)

Point these to your Render URL:

- Paystack: https://harz-cloud-backend.onrender.com/webhooks/paystack
- Paddle: https://harz-cloud-backend.onrender.com/webhooks/paddle
- Gumroad: https://harz-cloud-backend.onrender.com/webhooks/gumroad
- GitHub: https://harz-cloud-backend.onrender.com/webhooks/github
- Slack: https://harz-cloud-backend.onrender.com/webhooks/slack
- Google: https://harz-cloud-backend.onrender.com/webhooks/google
- Notion: https://harz-cloud-backend.onrender.com/webhooks/notion
- HubSpot: https://harz-cloud-backend.onrender.com/webhooks/hubspot
- Stripe: https://harz-cloud-backend.onrender.com/webhooks/stripe

## Frontend Integration

Add this to any HARZ platform (GitHub Pages, Vercel, etc.):

```javascript
const API_BASE = 'https://harz-cloud-backend.onrender.com';

// Register
fetch(API_BASE + '/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'secure123',
    full_name: 'User Name',
    role: 'user'
  })
});

// Login
fetch(API_BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'secure123'
  })
});

// Track analytics
fetch(API_BASE + '/analytics/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_type: 'page_view',
    platform: 'harzdm',
    page_url: window.location.href
  })
});

// Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);
fetch(API_BASE + '/storage/upload', {
  method: 'POST',
  headers: { 'x-auth-token': token },
  body: formData
});
```

## Free Tier Limits (Render)
- 750 hours/month (enough for 1 service 24/7)
- 512MB RAM
- Auto-sleep after 15 min inactivity
- First request after sleep takes ~30 seconds to wake

## Troubleshooting
- Build fails? Check package.json has all deps
- App crashes? Check logs in Render dashboard
- Timeouts? Free tier sleeps after 15 min
- CDN not caching? Wait for first request to populate edge
