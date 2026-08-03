# HARZ Cloud — Deploy Guide (Hausa)

## Mataki 1: GitHub Repo
1. Je github.com/new
2. Name: harz-cloud
3. Public, Create
4. Push code daga local

## Mataki 2: Render Deploy (Kyauta)
1. Je render.com -> Sign up da GitHub
2. New -> Web Service -> Connect harz-cloud repo
3. Build: npm install
4. Start: node server.js
5. Plan: Free
6. Env vars: HARZ_API_KEY, PAYSTACK_SECRET_KEY, JWT_SECRET
7. Deploy! URL: https://harz-cloud-backend.onrender.com

## Mataki 3: Supabase (Kyauta)
1. Je app.supabase.com -> New Project
2. Name: harz-cloud, Region: Frankfurt
3. Password: (strong)
4. Ready!

## Mataki 4: Backup
Add cron job on Render: node backup.js, schedule 0 1 * * *

## Kudi: 0 Naira (duk kyauta)
