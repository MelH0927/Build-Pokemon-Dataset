# Self-Hosted Deployment Guide

This guide explains how to deploy the Pokémon Quiz without Vercel.

## 1. Requirements
- Node.js 20+ (if running without Docker)
- Docker + Docker Compose (recommended)
- MongoDB 6+ or Atlas cluster

## 2. Environment Variables
Create a `.env` (or `.env.production`) file:
```
MONGODB_URI=mongodb://mongo:27017/pokemon-quiz
ADMIN_KEY=change-this-admin-key
PORT=3000
```

## 3. Run with Docker (Recommended)
```
docker compose up -d --build
```
Then open: http://localhost:3000
Admin dashboard: http://localhost:3000/admin

## 4. Build & Run Manually (No Docker)
```
npm ci
npm run build
npm run start
```

## 5. Deploy to Render.com
1. New Web Service → Pick your repo
2. Build Command: `npm run build`
3. Start Command: `npm run start`
4. Add environment variables (MONGODB_URI, ADMIN_KEY)
5. Set instance type (Starter is fine)

## 6. Deploy to Railway
1. Create project → Deploy from GitHub
2. Add a Mongo plugin or external URI
3. Variables: MONGODB_URI, ADMIN_KEY
4. Railway auto-detects: Build `npm run build`, Start `npm run start`

## 7. Deploy to Fly.io
```
fly launch --no-deploy
# Edit fly.toml to expose 3000
fly secrets set MONGODB_URI=... ADMIN_KEY=...
fly deploy
```
Use a managed Mongo (e.g. Atlas) or run a Fly volume for Mongo (not HA by default).

## 8. Deploy to Google Cloud Run
```
docker build -t gcr.io/PROJECT_ID/pokemon-quiz:latest .
docker push gcr.io/PROJECT_ID/pokemon-quiz:latest
gcloud run deploy pokemon-quiz \
  --image gcr.io/PROJECT_ID/pokemon-quiz:latest \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars MONGODB_URI=...,ADMIN_KEY=...
```

## 9. Systemd Service (Bare Metal)
```
[Unit]
Description=Pokemon Quiz
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/pokemon-quiz
Environment=MONGODB_URI=mongodb://localhost:27017/pokemon-quiz
Environment=ADMIN_KEY=change-this
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

## 10. Security Notes
- Always change ADMIN_KEY
- Restrict MongoDB to private network or use Atlas IP allowlisting
- Use HTTPS via reverse proxy (Caddy, Nginx, Traefik)
- Optional: Enable basic auth in reverse proxy for `/admin`

## 11. Health Check
You can add a route (e.g. `/api/health`) if desired. A simple version:
```ts
// app/api/health/route.ts
import { NextResponse } from 'next/server';
export function GET() { return NextResponse.json({ ok: true, ts: Date.now() }); }
```

## 12. Cleaning Old Data
Admin dashboard includes cleanup tools (old data, stale, incomplete, or full wipe). These call `/api/quiz/cleanup`.

### Multiple Admin Keys
You can allow legacy and new keys simultaneously:
```
ADMIN_KEY=new-key,legacy-key,another-key
```
All keys are comma-separated, trimmed, and any one grants access.

## 13. Updating
```
git pull
npm ci
npm run build
pm2 restart pokemon-quiz   # or systemctl restart pokemon-quiz
```

## 14. Scaling
- Run behind a load balancer; ensure sticky sessions not required (stateless)
- MongoDB should be hosted separately (Atlas recommended)

---
Questions? Open an issue in your fork or extend this guide.

## 15. Enable HTTPS (No User Signup Required)

Users don't need accounts—only an optional display name. To serve the quiz securely over HTTPS:

### Option A: Caddy (Automatic Certificates)
Already included: `Caddyfile` + `docker-compose.https.yml`.
1. Point your domain DNS (A / AAAA) to the server IP.
2. Edit `Caddyfile` and replace `quiz.example.com` with your domain.
3. Run:
```
docker compose -f docker-compose.https.yml up -d --build
```
4. Visit: `https://your-domain`

### Option B: Nginx + Certbot
```
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```
Config `/etc/nginx/sites-available/pokemon-quiz`:
```
server {
  server_name quiz.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Enable + certificate:
```
sudo ln -s /etc/nginx/sites-available/pokemon-quiz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d quiz.example.com --redirect -m you@example.com --agree-tos
```

### Option C: Managed Platforms
Render / Railway / Cloud Run already terminate HTTPS automatically. Just deploy normally.

### Health Endpoint
Use `/api/health` for uptime checks.

### Privacy & Simplicity
No user registration, cookies only for app operation; only participant name (optional) is stored with session performance.

