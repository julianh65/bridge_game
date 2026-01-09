# Deployment Guide

This project ships as two parts:
- PartyKit realtime server (rooms, state, sync)
- Vite web frontend (static site)

## Accounts
- PartyKit account (server deploys)
- Vercel account (frontend hosting)
- GitHub account (recommended for Vercel auto-builds)

## PartyKit server deploy
From the repo root:
```bash
npx partykit@latest login
npx partykit@latest deploy
```
Copy the host printed by the CLI (no protocol).

## Vercel frontend deploy
1) Push the repo to GitHub (if you have not already).
2) In Vercel, create a new project from the repo.
3) Configure:
   - Build command: `npm run build:web`
   - Output directory: `apps/web/dist`
   - Environment variable: `VITE_PARTYKIT_HOST=<your-partykit-host>`
4) Deploy.

## Updating / redeploying
One-line checklist: `git push` (frontend) + `npx partykit@latest deploy` (server).

### PartyKit server
Run after any server or engine changes:
```bash
npx partykit@latest deploy
```

### Vercel frontend
- If Vercel is connected to GitHub: push to the tracked branch and Vercel rebuilds.
- If you deploy manually: run `npm run build:web` and re-upload `apps/web/dist`.

### If you changed shared packages
Changes in `packages/engine` or `packages/shared` affect both server and web.
Redeploy both the PartyKit server and the frontend.
