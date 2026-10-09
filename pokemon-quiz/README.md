## Pokémon Type Quiz

An interactive Pokémon type identification quiz with:
- 3 balanced questionnaires (~341 questions each)
- Knowledge level stratification (Beginner / Intermediate / Expert)
- Real-time admin dashboard (progress, accuracy, active sessions)
- Type-level accuracy analytics
- Admin cleanup tools (old / stale / incomplete / full wipe)

## Tech Stack
- Next.js 15 (App Router, Turbopack)
- React 19
- MongoDB (Mongoose ODM)
- Tailwind (v4 via PostCSS)

## Quick Start (Local)
```bash
cp .env.example .env.local   # edit values
npm install
npm run dev
# visit http://localhost:3000
```
Admin dashboard: http://localhost:3000/admin

## Required Environment Variables
```
MONGODB_URI=mongodb://localhost:27017/pokemon-quiz
ADMIN_KEY=choose-a-secure-admin-key
PORT=3000
```

## Self Hosting
See `DEPLOY_SELF_HOSTED.md` for detailed instructions (Docker, Render, Railway, Fly.io, Cloud Run, bare metal systemd).

### HTTPS Quick Start (Caddy)
To enable automatic HTTPS with zero extra config for users (no signups required):
```
docker compose -f docker-compose.https.yml up -d --build
```
Edit `Caddyfile` to set your domain first. Users only enter an optional display name—no registration flow.

### Docker (fastest)
```bash
docker compose up -d --build
```

### Production Build (manual)
```bash
npm run build
npm run start
```

## Cleanup API
Endpoint: `/api/quiz/cleanup?key=ADMIN_KEY&type=old&daysOld=30`
Types: `old | stale | incomplete | all`

## Security Notes
- Change `ADMIN_KEY` for production
- Use Atlas or secured Mongo deployment
- Optionally restrict `/admin` via reverse proxy auth layer

## License
Internal / educational use (add a LICENSE if distributing publicly).
