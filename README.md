# 369 NKRI TV

369 NKRI TV is a React + Vite/Tauri movie and TV discovery app using TMDB. The Anime SDK integration is available from the app's settings/library menu as **Anime · Anime SDK**.

## Run the frontend

```bash
npm install
npm run dev
```

Set `VITE_TMDB_READ_TOKEN` in the frontend environment for TMDB discovery. For deployed anime search and playback, the frontend uses the same-origin Cloudflare Pages Function at `/api/anime`; no local process is required. Configure the Cloudflare Pages secret `PROXY_SECRET` before deploying. See [anime-api/README.md](anime-api/README.md) for deployment and verification steps. For optional local Node development, set `VITE_ANIME_API_URL=http://localhost:8788`.

## Cloudflare Anime API

The hosted API and signed HLS/subtitle proxy live in `functions/api/anime/[[path]].js` and deploy with the Pages project. Set the `PROXY_SECRET` secret in Cloudflare Pages and redeploy. Verify `/api/anime/health` on your deployed site. See [anime-api/README.md](anime-api/README.md).

## Run the Anime SDK service

Use Node.js 20 or newer:

```bash
cd anime-api
npm install
cp .env.example .env
npm run dev
```

The service exposes a health check at `http://localhost:8788/health`. See [anime-api/README.md](anime-api/README.md) for routes, environment variables, and deployment guidance.

## Existing features

The Anime SDK hub is added as a separate navigation view. The existing TMDB discovery, Explore hub, libraries, collections, and movie/TV player remain separate and are not replaced by the anime player.
