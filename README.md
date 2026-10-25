# 369TV

## Anime API setup

The Anime section uses the Node.js API in `anime-api/`, which wraps `anime-sdk`.

### Local development

1. Start the API:

   ```sh
   cd anime-api
   npm install
   npm run dev
   ```

2. In the frontend root, set `VITE_ANIME_API_URL=http://localhost:8788` in `.env.local` (or use the existing local default).
3. Restart the Vite development server after changing environment variables.

### Production deployment (Render API + frontend host)

1. In Render, create a new Blueprint from this repository. Render reads the root `render.yaml` and creates the `369tv-anime-api` web service from `anime-api/`.
2. Wait for the service to deploy. Open its public URL and verify that `/health` returns JSON with `"ok": true`.
3. In the frontend host's environment/build settings, set `VITE_ANIME_API_URL` to that public API URL (for example, `https://369tv-anime-api.onrender.com`, without a trailing slash).
4. Trigger a new frontend deployment so Vite embeds the new value in the built site.

`VITE_ANIME_API_URL` is public configuration, not a secret. Do not put `PROXY_SECRET` or other private credentials in any `VITE_` variable. The Render Blueprint generates `PROXY_SECRET` for the API service.

If you use Cloudflare Pages for the frontend, add `VITE_ANIME_API_URL` under **Settings → Environment variables** for the production environment, then create a new deployment. Add it to Preview separately if needed.

The frontend defaults to `http://localhost:8788` only during Vite development. In production, a missing API URL is reported clearly instead of silently sending requests to the website's own origin.
