# 369TV anime API

A separate Node.js backend for the 369TV frontend, powered by [anime-sdk](https://github.com/hexxt-git/anime-sdk). It is kept separate from Cloudflare Pages because the SDK's built-in HTTP server uses Node's `http.Server`.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

From this directory:

```bash
npm install
cp .env.example .env
npm run dev
```

The API will listen on `http://localhost:8788` by default. Check `http://localhost:8788/health`.

Available SDK routes include:

- `GET /search?q=Frieren&provider=allmanga`
- `GET /content?mediaId=allmanga%3A<media-id>&provider=allmanga`
- `GET /stream?unitId=allmanga%3A<unit-id>&provider=allmanga`
- `GET /tracks?unitId=allmanga%3A<unit-id>&provider=allmanga`
- `GET /meta/search?q=Frieren`
- `GET /meta/browse?type=trending`

Use the exact URN IDs returned by the API; the provider prefix is part of the ID.

## Frontend connection

Set `VITE_ANIME_API_URL=http://localhost:8788` in the frontend's local `.env`. The frontend helper lives at `../src/animeApi.js` only if you choose to move/copy it into your actual frontend source tree; this repository currently has no package.json or Vite entry configuration, so the new `AnimeHub.jsx` is supplied as a standalone integration component and is not wired into `App.jsx`.

For a deployed frontend, point `VITE_ANIME_API_URL` at the public URL of this Node service. Deploy `anime-api` to a Node-compatible host (for example, Render or Railway); do not deploy this server as a Cloudflare Pages Function.

## Deployment environment

Configure `NODE_ENV=production` and a strong random `PROXY_SECRET` on the backend host. The server refuses to start in production without the secret because the stream proxy must not be left as an unsigned public relay. Set `PORT` only if your host requires it.

If you enable `API_TOKEN`, keep in mind that a secret embedded in a public browser app is not secret. Use it only for private/testing deployments or put authenticated access behind a server-side gateway.

## Security and operational notes

- This service resolves URLs from third-party providers; it does not host a media catalogue or store video files.
- Keep the SDK updated and monitor provider availability; third-party sites can change.
- The in-memory cache is intentionally short-lived and is cleared when the process restarts.
- The SDK's built-in proxy is enabled for browser playback. Do not expose an unsigned proxy in production.
