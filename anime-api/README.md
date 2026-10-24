# 369TV anime API

The production anime API is implemented as a Cloudflare Pages Function in `/functions/api/anime/[[path]].js`. That lets the React/Vite website and anime API run on the same Cloudflare Pages domain, with no always-on Node server or local process required.

The original `server.mjs` is retained for Node-compatible hosting and local development only.

## Cloudflare Pages deployment

1. In Cloudflare, open **Workers & Pages** and select the Pages project connected to `NkriMaimou/369TV-backup`.
2. Confirm the project builds from the repository root, using build command `npm run build` and output directory `dist`.
3. Under **Settings → Functions → Compatibility flags**, enable `nodejs_compat` for production and preview if required by the package bundle.
4. Under **Settings → Variables and Secrets**, add `PROXY_SECRET` as a **secret** for both production and preview. Use a long random value (at least 32 random bytes); never commit it to Git or expose it as a `VITE_*` variable.
5. Save settings and trigger a new deployment from the latest `main` commit.

Cloudflare Pages connected to GitHub automatically builds and deploys commits. The GitHub code changes alone do not prove a successful Cloudflare deployment; check the Pages deployment log after it runs.

## Verify after deployment

Replace `YOUR-PAGES-DOMAIN` with the actual domain of your Pages project:

- `https://YOUR-PAGES-DOMAIN/api/anime/health` should return JSON with `ok: true`.
- `https://YOUR-PAGES-DOMAIN/api/anime/search?q=Frieren&provider=allmanga` should return search results.
- Select a result and episode in 369 NKRI TV to test stream resolution and playback. The Cloudflare Function signs proxy URLs and rewrites HLS playlists so segment and subtitle requests can pass through the same origin.

The frontend now defaults to the same-origin `/api/anime` endpoint. Do not set `VITE_ANIME_API_URL` to `localhost` for a hosted website.

## Supported API routes

- `GET /api/anime/health`
- `GET /api/anime/search?q=Frieren&provider=allmanga`
- `GET /api/anime/content?mediaId=allmanga%3A<media-id>&provider=allmanga`
- `GET /api/anime/stream?unitId=allmanga%3A<unit-id>&provider=allmanga`
- `GET /api/anime/tracks?unitId=allmanga%3A<unit-id>&provider=allmanga`
- `GET /api/anime/proxy?url=<signed-target>&h=<signed-headers>&sig=<signature>` (signed stream proxy only)

Use the exact URN IDs returned by the SDK; the provider prefix is part of each ID.

## Security and limitations

- The stream proxy accepts only signed HTTPS targets; the HMAC secret stays server-side in Cloudflare.
- The Worker is not a media host: it proxies provider responses, and availability depends on third-party provider uptime, access rules, and stream expiry.
- Cloudflare execution time and response limits still apply. Long-running downloads are not part of this Pages Function.
- If a provider blocks Cloudflare egress or requires unsupported browser/session behavior, playback may still fail for that provider.
- The original Node server requires Node.js 20 or newer and is not needed for the Cloudflare Pages setup.
