const DEFAULT_API_URL = "https://three69tv-anime-api.onrender.com";

export function getAnimeApiUrl() {
  const configured = import.meta.env?.VITE_ANIME_API_URL;
  return (configured || DEFAULT_API_URL).replace(/\/+$/, "");
}

async function request(path, { signal } = {}) {
  let response;

  try {
    response = await fetch(`${getAnimeApiUrl()}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error(
      `Could not reach the Anime API at ${getAnimeApiUrl()}. Check the API URL, browser Network tab, and CORS settings.`
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error || payload?.message || "";
    } catch {
      // The server may return a non-JSON error page.
    }
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

    
export function browseAnime(kind = "trending", options = {}) {
  const params = new URLSearchParams({
    provider: "anilist",
    kind,
    catalogType: "ANIME",
    perPage: String(options.perPage || 20),
  });
  if (options.season) params.set("season", options.season);
  if (options.year) params.set("year", String(options.year));
  if (options.genre) params.set("genre", options.genre);
  return request(`/meta/browse?${params}`, options);
}

export function getAnimeMetadata(id, options = {}) {
  const params = new URLSearchParams({ provider: "anilist", id });
  return request(`/meta/info?${params}`, options);
}
