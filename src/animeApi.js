const DEFAULT_API_URL = "/api/anime";

export function getAnimeApiUrl() {
  return (import.meta.env?.VITE_ANIME_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

async function request(path, { signal } = {}) {
  const response = await fetch(`${getAnimeApiUrl()}${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
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
