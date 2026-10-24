const DEFAULT_API_URL = import.meta.env.DEV ? "http://localhost:8788" : "";

export function getAnimeApiUrl() {
  return (import.meta.env?.VITE_ANIME_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

async function request(path, { signal } = {}) {
  const baseUrl = getAnimeApiUrl();
  if (!baseUrl) {
    throw new Error("Anime API is not configured. Set VITE_ANIME_API_URL in your Cloudflare Pages environment variables and redeploy.");
  }
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error("Could not reach the Anime API. Check the Render service and its CORS settings.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error || payload?.message || "";
    } catch {}
    throw new Error(detail || `Anime API returned HTTP ${response.status}`);
  }
  return response.json();
}

export function searchAnime(query, provider = "allmanga", options = {}) {
  const params = new URLSearchParams({ q: query, provider });
  return request(`/search?${params}`, options);
}

export function getAnimeEpisodes(mediaId, provider = "allmanga", options = {}) {
  const params = new URLSearchParams({ mediaId, provider });
  return request(`/content?${params}`, options);
}

export function resolveAnimeStream(unitId, provider = "allmanga", language = "sub", options = {}) {
  const params = new URLSearchParams({ unitId, provider, language });
  return request(`/stream?${params}`, options);
}

export function getAnimeTracks(unitId, provider = "allmanga", language = "sub", options = {}) {
  const params = new URLSearchParams({ unitId, provider, language });
  return request(`/tracks?${params}`, options);
}
