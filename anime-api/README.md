# 369TV anime API

The production anime API is already hosted at https://three69tv-anime-api.onrender.com. The React/Vite frontend defaults to this hosted API, so users do not need to run Node.js locally.

The backend implementation is `server.mjs`, using `anime-sdk`'s `startServer` with stream proxy support. The Render service must have a long random `PROXY_SECRET` environment variable set for signed proxy requests in production. Keep this value server-side and never expose it as a `VITE_*` variable.

## Deployment

Deploy backend changes through the existing Render service connected to this repository (or its configured backend root directory). Keep its start command as `npm start` / `node server.mjs`, using Node.js 20 or newer. Do not deploy a second copy of this API as a Cloudflare Pages Function unless deliberately migrating the backend.

The frontend can remain hosted on Cloudflare Pages. After the frontend changes land on `main`, allow the Pages project to redeploy, or trigger a deployment manually.

## Verification

- API base: https://three69tv-anime-api.onrender.com
- The frontend's default API URL is set in `src/animeApi.js`.
- Search, episode retrieval, stream resolution and subtitle retrieval use the backend's `/search`, `/content`, `/stream`, and `/tracks` endpoints.

Playback still depends on the stream URL and proxy behavior returned by the Anime SDK provider. If a provider returns a direct HLS playlist, the frontend must attach it to hls.js (or a browser's native HLS playback) and subtitle URLs must be attached as `<track>` elements.
