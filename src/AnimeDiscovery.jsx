import React, { useEffect, useState } from "react";
import { browseAnime, searchAnime } from "./animeApi.js";

const SECTIONS = [
  { id: "trending", label: "Trending Now" },
  { id: "popular", label: "Popular Anime" },
  { id: "top", label: "Top Rated" },
  { id: "seasonal", label: "This Season" },
];

const GENRES = [
  "All", "Action", "Adventure", "Comedy", "Drama",
  "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life",
];

function titleOf(item) {
  const title = item?.title;
  if (typeof title === "string") return title;
  return title?.english || title?.userPreferred || title?.romaji || "Unknown Anime";
}

function posterOf(item) {
  return item?.cover?.large ||
    item?.cover?.medium ||
    item?.coverImage?.extraLarge ||
    item?.coverImage?.large ||
    item?.poster ||
    item?.image ||
    "";
}

function yearOf(item) {
  return item?.year || item?.seasonYear || item?.startDate?.year || "";
}

function scoreOf(item) {
  const value = Number(item?.score);
  if (!Number.isFinite(value) || item?.score == null || item?.score === "") return "";
  return value > 10 ? (value / 10).toFixed(1) : value.toFixed(1);
}

function genresOf(item) {
  const genres = item?.genres || item?.genre || [];
  return (Array.isArray(genres) ? genres : [genres])
    .map((genre) => typeof genre === "string" ? genre : genre?.name)
    .filter(Boolean);
}

function listOf(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.results || payload?.items || payload?.media || payload?.data || [];
}

export default function AnimeDiscovery({ provider, onChoose }) {
  const [catalogues, setCatalogues] = useState({});
  const [activeGenre, setActiveGenre] = useState("All");
  const [season, setSeason] = useState("FALL");
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogues() {
      setLoading(true);
      setError("");

      const requests = await Promise.allSettled([
        browseAnime("trending", { perPage: 20 }),
        browseAnime("popular", { perPage: 20 }),
        browseAnime("top", { perPage: 20 }),
        browseAnime("seasonal", { perPage: 20, season, year: seasonYear }),
      ]);

      if (cancelled) return;

      const next = {};
      requests.forEach((result, index) => {
        const key = SECTIONS[index].id;
        next[key] = result.status === "fulfilled" ? listOf(result.value) : [];
        if (result.status === "rejected") {
          console.warn(`Anime catalogue "${key}" failed:`, result.reason);
        }
      });

      setCatalogues(next);
      if (!Object.values(next).some((items) => items.length)) {
        setError("Anime catalogues could not be loaded. Check that your Anime API is reachable.");
      }
      setLoading(false);
    }

    loadCatalogues();
    return () => { cancelled = true; };
  }, [season, seasonYear]);

  async function openAnime(item) {
    const title = titleOf(item);
    setOpening(title);
    setError("");

    try {
      const results = listOf(await searchAnime(title, provider));
      if (!results.length) {
        setError(`"${title}" was not found on the selected streaming source. Try another source or search manually.`);
        return;
      }

      const normalize = (value) => String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      const match = results.find((result) =>
        normalize(result?.title?.english || result?.title?.romaji || result?.title || result?.name) === normalize(title)
      ) || results[0];

      await onChoose(match);
    } catch (err) {
      setError(err?.message || `Could not find "${title}" on the selected source.`);
    } finally {
      setOpening("");
    }
  }

  const allItems = Object.values(catalogues).flat();
  const hasGenreData = allItems.some((item) => genresOf(item).length > 0);

  return (
    <div className="anime-discovery">
      <div className="anime-discovery-intro">
        <div>
          <span className="anime-discovery-kicker">YOUR NEXT OBSESSION</span>
          <h2>Discover anime</h2>
          <p>Explore trending series, fan favourites and the latest releases.</p>
        </div>
        <div className="anime-season-select">
          <label>
            Season
            <select value={season} onChange={(event) => setSeason(event.target.value)}>
              <option value="WINTER">Winter</option>
              <option value="SPRING">Spring</option>
              <option value="SUMMER">Summer</option>
              <option value="FALL">Fall</option>
            </select>
          </label>
          <label>
            Year
            <select value={seasonYear} onChange={(event) => setSeasonYear(Number(event.target.value))}>
              {Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                <option value={year} key={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <nav className="anime-genre-tabs" aria-label="Anime genres">
        {GENRES.map((genre) => (
          <button
            type="button"
            key={genre}
            className={activeGenre === genre ? "active" : ""}
            aria-pressed={activeGenre === genre}
            disabled={genre !== "All" && !hasGenreData}
            onClick={() => setActiveGenre(genre)}
          >
            {genre}
          </button>
        ))}
      </nav>

      {loading && <p className="anime-discovery-status">Loading anime catalogues…</p>}
      {error && <p className="anime-hub-message" role="status">{error}</p>}
      {!hasGenreData && !loading && (
        <p className="anime-discovery-note">
          Genre filters require genre data from the metadata API.
        </p>
      )}

      {SECTIONS.map((section) => {
        const items = catalogues[section.id] || [];
        const filtered = activeGenre === "All"
          ? items
          : items.filter((item) => genresOf(item).some(
              (genre) => genre.toLowerCase() === activeGenre.toLowerCase()
            ));

        if (!loading && !filtered.length) return null;

        return (
          <section className="anime-discovery-section" key={section.id}>
            <div className="anime-discovery-section-heading">
              <h3>{section.label}</h3>
              <span>{filtered.length ? `${filtered.length} titles` : loading ? "Loading…" : ""}</span>
            </div>
            <div className="anime-discovery-track">
              {filtered.map((item, index) => {
                const title = titleOf(item);
                const poster = posterOf(item);
                const score = scoreOf(item);

                return (
                  <button
                    type="button"
                    className="anime-discovery-card"
                    key={item.id || `${section.id}-${title}-${index}`}
                    onClick={() => openAnime(item)}
                    disabled={Boolean(opening)}
                    title={`Open ${title}`}
                  >
                    <span className="anime-discovery-poster">
                      {poster
                        ? <img src={poster} alt="" loading="lazy" />
                        : <span className="anime-discovery-poster-fallback">ANIME</span>}
                      {score && <span className="anime-discovery-score">★ {score}</span>}
                      <span className="anime-discovery-play" aria-hidden="true">▶</span>
                    </span>
                    <span className="anime-discovery-card-title">{title}</span>
                    <span className="anime-discovery-card-meta">
                      {[yearOf(item), item.format].filter(Boolean).join(" · ") || "Anime"}
                    </span>
                    {opening === title && <span className="anime-discovery-opening">Opening…</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
