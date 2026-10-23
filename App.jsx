import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const TMDB = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/";
const TMDB_CACHE_TTL = 5 * 60 * 1000;
const tmdbCache = new Map();
const SERVERS = [
  ["auto", "Automatic"], ["lamda", "Lamda"], ["primesrc", "PrimeSRC"],
  ["sigma", "Sigma"], ["alfa", "Alfa"], ["beta", "Beta"], ["gama", "Gama"],
  ["catflix", "Catflix"], ["hexa", "Hexa"], ["delta", "Delta"],
];
const BASE_LIBRARY_TABS = ["search", "watchlist", "favorites", "history"];
const LIBRARY_TAB_LABELS = { search: "Discover", watchlist: "Watchlist", favorites: "Favorites", history: "Continue Watching" };
const STREAMING_PROVIDERS = [
  { id: 8, name: "Netflix", className: "netflix", mark: "N" },
  { id: 9, name: "Prime Video", className: "prime", mark: "prime" },
  { id: 337, name: "Disney+", className: "disney", mark: "Disney+" },
  { id: 1899, name: "Max", className: "max", mark: "max" },
  { id: 350, name: "Apple TV+", className: "apple", mark: "tv+" },
  { id: 531, name: "Paramount+", className: "paramount", mark: "P+" },
];

const STORE = {
  history: "369-nkri-tv-history",
  favorites: "369-nkri-tv-favorites",
  watchlist: "369-nkri-tv-watchlist",
  statuses: "369-nkri-tv-statuses",
  watchedEpisodes: "369-nkri-tv-watched-episodes",
  sourcePrefs: "369-nkri-tv-source-preferences",
  subtitleSources: "369-nkri-tv-subtitle-sources",
  sourceFailures: "369-nkri-tv-source-failures",
  collections: "369-nkri-tv-custom-collections",
};
const readStore = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch { return fallback; }
};
const mediaName = (item) => item?.title || item?.name || "Untitled";
const mediaDate = (item) => (item?.release_date || item?.first_air_date || "").slice(0, 4);
const mediaKey = (type, id) => `${type}:${id}`;
const posterUrl = (path, size = "w342") => path ? `${IMAGE}${size}${path}` : "";
const yearText = (item) => mediaDate(item) || "Year unknown";

async function tmdbFetch(path, signal) {
  if (signal?.aborted) throw new DOMException("The request was aborted", "AbortError");
  const cached = tmdbCache.get(path);
  if (cached && Date.now() - cached.savedAt < TMDB_CACHE_TTL) return cached.data;
  if (cached) tmdbCache.delete(path);
  const response = await fetch(`${TMDB}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}`);
  const data = await response.json();
  tmdbCache.set(path, { data, savedAt: Date.now() });
  if (tmdbCache.size > 160) tmdbCache.delete(tmdbCache.keys().next().value);
  return data;
}
async function safeFetch(path, signal) {
  try { return await tmdbFetch(path, signal); }
  catch (error) { if (error.name === "AbortError") throw error; return null; }
}
function Poster({ item, size = "w342", className = "", label }) {
  const src = posterUrl(item?.poster_path, size);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  if (!src || imageFailed) return <div className={`${className} poster-placeholder`} role="img" aria-label={label || `Poster unavailable for ${mediaName(item)}`}>NO POSTER</div>;
  return <img key={src} className={`${className} poster-loading`} src={src} alt={label || `Poster for ${mediaName(item)}`} loading="lazy" decoding="async" onLoad={(event) => event.currentTarget.classList.remove("poster-loading")} onError={() => setImageFailed(true)} />;
}

function ShelfSkeleton({ count = 6, genre = false }) {
  return <div className={`${genre ? "genre-results-track" : "discovery-track"} skeleton-track`} role="status" aria-label="Loading titles">
    {Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index} aria-hidden="true"><div className="skeleton-poster" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}
  </div>;
}

export default function App() {
  const searchInput = useRef(null);
  const playerSectionRef = useRef(null);
  const libraryScrollYRef = useRef(0);
  const shelfScrollPositionsRef = useRef({});
  const [hasScrolled, setHasScrolled] = useState(false);
  useEffect(() => {
    const updateScrollState = () => setHasScrolled(window.scrollY > 36);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);
  const [type, setType] = useState("movie");
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState(() => { const v = readStore("369-nkri-tv-recent-searches", []); return Array.isArray(v) ? v.slice(0, 8) : []; });
  const [openPosterActions, setOpenPosterActions] = useState(null);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [server, setServer] = useState("auto");
  const [showPlayer, setShowPlayer] = useState(false);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [credits, setCredits] = useState({ cast: [], crew: [] });
  const [selectedCastMember, setSelectedCastMember] = useState(null);
  const [castFilmography, setCastFilmography] = useState([]);
  const [castFilmographyLoading, setCastFilmographyLoading] = useState(false);
  const [castFilmographyError, setCastFilmographyError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [personalizedRecs, setPersonalizedRecs] = useState([]);
  const [collection, setCollection] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTvShows, setTrendingTvShows] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [featuredDirection, setFeaturedDirection] = useState(1);
  const [featuredDragX, setFeaturedDragX] = useState(0);
  const [featuredIsDragging, setFeaturedIsDragging] = useState(false);
  const [shelfPages, setShelfPages] = useState({ now: 1, movies: 1, tv: 1, genre: 3, recommendations: 1 });
  const [shelfLoading, setShelfLoading] = useState({});
  const shelfLoadingRef = useRef({});
  const shelfExhaustedRef = useRef({});
  const [history, setHistory] = useState(() => {
    const value = readStore(STORE.history, { movie: [], tv: [] });
    return { movie: Array.isArray(value.movie) ? value.movie : [], tv: Array.isArray(value.tv) ? value.tv : [] };
  });
  const [favorites, setFavorites] = useState(() => { const v = readStore(STORE.favorites, []); return Array.isArray(v) ? v : []; });
  const [watchlist, setWatchlist] = useState(() => { const v = readStore(STORE.watchlist, []); return Array.isArray(v) ? v : []; });
  const [statuses, setStatuses] = useState(() => { const v = readStore(STORE.statuses, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [watchedEpisodes, setWatchedEpisodes] = useState(() => { const v = readStore(STORE.watchedEpisodes, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [sourcePrefs, setSourcePrefs] = useState(() => { const v = readStore(STORE.sourcePrefs, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [subtitleSources, setSubtitleSources] = useState(() => { const v = readStore(STORE.subtitleSources, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [focusedResultIndex, setFocusedResultIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState("search");
  const [genreOptions, setGenreOptions] = useState([]);
  const [homeGenre, setHomeGenre] = useState("all");
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [homeProvider, setHomeProvider] = useState("all");
  const [providerTitles, setProviderTitles] = useState([]);
  const [providerTitlesLoading, setProviderTitlesLoading] = useState(false);
  const [providerTitlesError, setProviderTitlesError] = useState("");
  const heroTouchStart = useRef(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [genreTitles, setGenreTitles] = useState([]);
  const [genreTitlesLoading, setGenreTitlesLoading] = useState(false);
  const [genreTitlesError, setGenreTitlesError] = useState("");
  const [filterGenre, setFilterGenre] = useState("all");
  const [filterYear, setFilterYear] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [sourceFailures, setSourceFailures] = useState(() => { const v = readStore(STORE.sourceFailures, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [customCollections, setCustomCollections] = useState(() => { const v = readStore(STORE.collections, []); return Array.isArray(v) ? v : []; });
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionTarget, setCollectionTarget] = useState("");
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [placementCollectionId, setPlacementCollectionId] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const [navOrder, setNavOrder] = useState(() => {
    const saved = readStore("369-nkri-tv-library-nav-order", null);
    const valid = Array.isArray(saved) ? saved.filter((key) => BASE_LIBRARY_TABS.includes(key) || (typeof key === "string" && key.startsWith("collection:"))) : [];
    return [...BASE_LIBRARY_TABS.filter((key) => !valid.includes(key)), ...valid.filter((key) => BASE_LIBRARY_TABS.includes(key) || customCollections.some((item) => key === `collection:${item.id}`))];
  });
  const orderedNavKeys = [...navOrder.filter((key) => BASE_LIBRARY_TABS.includes(key) || (typeof key === "string" && key.startsWith("collection:") && customCollections.some((item) => key === `collection:${item.id}`))), ...BASE_LIBRARY_TABS.filter((key) => !navOrder.includes(key)), ...customCollections.map((item) => `collection:${item.id}`).filter((key) => !navOrder.includes(key))];

  useEffect(() => {
    if (!settingsMenuOpen) return;
    const closeMenu = (event) => {
      if (event.type === "keydown" && event.key === "Escape") setSettingsMenuOpen(false);
      if (event.type === "pointerdown" && !event.target.closest?.(".settings-menu-wrap")) setSettingsMenuOpen(false);
    };
    document.addEventListener("keydown", closeMenu);
    document.addEventListener("pointerdown", closeMenu);
    return () => { document.removeEventListener("keydown", closeMenu); document.removeEventListener("pointerdown", closeMenu); };
  }, [settingsMenuOpen]);

  useEffect(() => { for (const [key, value] of [["369-nkri-tv-recent-searches", recentSearches], [STORE.history, history], [STORE.favorites, favorites], [STORE.watchlist, watchlist], [STORE.statuses, statuses], [STORE.watchedEpisodes, watchedEpisodes], [STORE.sourcePrefs, sourcePrefs], [STORE.subtitleSources, subtitleSources], [STORE.sourceFailures, sourceFailures], [STORE.collections, customCollections], ["369-nkri-tv-library-nav-order", navOrder]]) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} } }, [recentSearches, history, favorites, watchlist, statuses, watchedEpisodes, sourcePrefs, subtitleSources, sourceFailures, customCollections, navOrder]);

  useEffect(() => {
    if (!TOKEN) { setFeaturedLoading(false); return; }
    const controller = new AbortController();
    (async () => {
      setFeaturedLoading(true);
      const paths = [
        ["now", "/movie/now_playing?language=en-US&page=1"],
        ["movies", "/trending/movie/day?language=en-US"],
        ["tv", "/trending/tv/day?language=en-US"],
      ];
      try {
        const values = await Promise.all(paths.map(async ([key, path]) => [key, await safeFetch(path, controller.signal)]));
        if (controller.signal.aborted) return;
        for (const [key, data] of values) {
          const items = data?.results || [];
          if (key === "now") setNowPlayingMovies(items);
          if (key === "movies") setTrendingMovies(items);
          if (key === "tv") setTrendingTvShows(items);
        }
      } catch {}
      finally { if (!controller.signal.aborted) setFeaturedLoading(false); }
    })();
    return () => controller.abort();
  }, []);

  const title = mediaName(selected);
  const featuredItems = useMemo(() => {
    const candidates = [
      ...trendingMovies.map((item) => ({ ...item, _mediaType: "movie" })),
      ...trendingTvShows.map((item) => ({ ...item, _mediaType: "tv" })),
      ...nowPlayingMovies.map((item) => ({ ...item, _mediaType: "movie" })),
    ];
    const seen = new Set();
    return candidates.filter((item) => {
      if (!item.backdrop_path) return false;
      const key = `${item._mediaType}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [trendingMovies, trendingTvShows, nowPlayingMovies]);
  const activeFeaturedIndex = featuredItems.length ? featuredIndex % featuredItems.length : 0;
  const featuredTitle = featuredItems[activeFeaturedIndex] || null;
  const featuredType = featuredTitle?._mediaType || "movie";
  const showFeaturedCarousel = activeTab === "search" && !showPlayer && !query.trim() && homeGenre === "all" && homeProvider === "all";

  const changeFeatured = useCallback((direction) => {
    if (featuredItems.length < 2) return;
    setFeaturedDirection(direction < 0 ? -1 : 1);
    setFeaturedIndex((current) => (current + (direction < 0 ? -1 : 1) + featuredItems.length) % featuredItems.length);
  }, [featuredItems.length]);

  // Rotate the featured title every 10 seconds while the homepage hero is visible.
  useEffect(() => {
    if (!showFeaturedCarousel || featuredItems.length < 2) return;
    const timer = window.setInterval(() => changeFeatured(1), 10000);
    return () => window.clearInterval(timer);
  }, [changeFeatured, showFeaturedCarousel]);
  const continueItems = useMemo(() => [
    ...history.movie.map((item) => ({ ...item, _mediaType: "movie" })),
    ...history.tv.map((item) => ({ ...item, _mediaType: "tv" })),
  ].sort((a, b) => Number(b._lastOpenedAt || 0) - Number(a._lastOpenedAt || 0)).slice(0, 12), [history]);
  const titleKey = selected ? mediaKey(type, selected.id) : "";
  const filteredResults = useMemo(() => {
    const filtered = results.filter((item) => {
      const itemYear = Number(mediaDate(item));
      return (filterGenre === "all" || (item.genre_ids || []).includes(Number(filterGenre)))
        && (!filterYear || itemYear === Number(filterYear))
        && Number(item.vote_average || 0) >= Number(minRating || 0);
    });
    if (sortBy === "rating") filtered.sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));
    else if (sortBy === "year-new") filtered.sort((a, b) => Number(mediaDate(b) || 0) - Number(mediaDate(a) || 0));
    else if (sortBy === "year-old") filtered.sort((a, b) => Number(mediaDate(a) || 0) - Number(mediaDate(b) || 0));
    else if (sortBy === "title") filtered.sort((a, b) => mediaName(a).localeCompare(mediaName(b)));
    else if (sortBy === "popularity") filtered.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
    return filtered;
  }, [results, filterGenre, filterYear, minRating, sortBy]);

  const playerUrl = selected
    ? `https://vidnest.fun/${type === "movie" ? `movie/${selected.id}` : `tv/${selected.id}/${season}/${episode}`}${server !== "auto" ? `?server=${encodeURIComponent(server)}` : ""}`
    : "";

  const isFavorite = useCallback((item, itemType = type) => favorites.some((x) => x.id === item.id && x._mediaType === itemType), [favorites, type]);
  const isInWatchlist = useCallback((item, itemType = type) => watchlist.some((x) => x.id === item.id && x._mediaType === itemType), [watchlist]);
  const statusFor = (item, itemType = type) => statuses[mediaKey(itemType, item.id)] || "planned";
  const episodeKey = (showId, seasonNo, episodeNo) => `${showId}:${seasonNo}:${episodeNo}`;

  function toggleFavorite(item, itemType = type) {
    setFavorites((current) => current.some((x) => x.id === item.id && x._mediaType === itemType)
      ? current.filter((x) => !(x.id === item.id && x._mediaType === itemType))
      : [{ ...item, _mediaType: itemType }, ...current].slice(0, 100));
  }
  function toggleWatchlist(item, itemType = type) {
    const key = mediaKey(itemType, item.id);
    setWatchlist((current) => current.some((x) => x.id === item.id && x._mediaType === itemType)
      ? current.filter((x) => !(x.id === item.id && x._mediaType === itemType))
      : [{ ...item, _mediaType: itemType, _addedAt: Date.now() }, ...current].slice(0, 200));
    setStatuses((current) => current[key] ? current : { ...current, [key]: "planned" });
  }
  function setItemStatus(item, itemType, status) {
    setStatuses((current) => ({ ...current, [mediaKey(itemType, item.id)]: status }));
    if (status !== "completed" && !isInWatchlist(item, itemType)) {
      setWatchlist((current) => [{ ...item, _mediaType: itemType, _addedAt: Date.now() }, ...current].slice(0, 200));
    }
  }
  function removeFromHistory(historyType, id) {
    setHistory((current) => ({ ...current, [historyType]: current[historyType].filter((x) => x.id !== id) }));
  }
  function updateHistory(item, itemType, extra = {}) {
    setHistory((current) => {
      const old = current[itemType].find((x) => x.id === item.id) || {};
      return { ...current, [itemType]: [{ ...old, ...item, ...extra, _mediaType: itemType, _lastOpenedAt: Date.now() }, ...current[itemType].filter((x) => x.id !== item.id)].slice(0, 30) };
    });
  }
  function choose(item, itemType = type, resume = true) {
    if (!showPlayer) {
      libraryScrollYRef.current = window.scrollY;
      shelfScrollPositionsRef.current = Object.fromEntries(
        Array.from(document.querySelectorAll(".discovery-track[id], .genre-results-track[id]"))
          .map((track) => [track.id, track.scrollLeft])
      );
    }
    const saved = history[itemType]?.find((x) => x.id === item.id);
    setType(itemType);
    setSelected(item);
    setSeason(itemType === "tv" && resume && saved?._lastSeason != null ? String(saved._lastSeason) : "1");
    setEpisode(itemType === "tv" && resume && saved?._lastEpisode != null ? String(saved._lastEpisode) : "1");
    setServer(sourcePrefs[mediaKey(itemType, item.id)] || "auto");
    setCollectionTarget(customCollections[0]?.id || "");
    setResults([]);
    setFocusedResultIndex(-1);
    setShowPlayer(true);
    setPlaybackStarted(false);
    setError("");
    setSeasons([]);
    setEpisodes([]);
    setDetails(null);
    setCredits({ cast: [], crew: [] });
    setSelectedCastMember(null);
    setCastFilmography([]);
    setCastFilmographyError("");
    setRecommendations([]);
    setSimilar([]);
    setCollection(null);
    setTrailer(null);
    setShowTrailer(false);
    updateHistory(item, itemType, itemType === "tv" ? { _lastSeason: Number(saved?._lastSeason || 1), _lastEpisode: Number(saved?._lastEpisode || 1) } : {});
  }
  function backToSearch() {
    setShowPlayer(false); setPlaybackStarted(false); setSelected(null); setDetails(null); setSeasons([]); setEpisodes([]); setError("");
    requestAnimationFrame(() => {
      window.scrollTo(0, libraryScrollYRef.current);
      for (const [id, left] of Object.entries(shelfScrollPositionsRef.current)) {
        const track = document.getElementById(id);
        if (track) track.scrollLeft = left;
      }
      searchInput.current?.focus({ preventScroll: true });
    });
  }
  async function search(event) {
    event?.preventDefault();
    if (!TOKEN) { setError("TMDB token missing. Check .env.local and restart Vite."); return; }
    if (!query.trim()) { setError("Enter a movie or TV show name."); return; }
    const submittedQuery = query.trim();
    setRecentSearches((current) => [submittedQuery, ...current.filter((x) => x.toLowerCase() !== submittedQuery.toLowerCase())].slice(0, 8));
    setLoading(true); setError("");
    try {
      const data = await tmdbFetch(`/search/${type}?query=${encodeURIComponent(submittedQuery)}&include_adult=false&language=en-US&page=1`);
      setResults(data.results || []);
      if (!data.results?.length) setError("No matching titles found.");
    } catch (e) { setError(e.message || "Search failed."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (showPlayer) return;
    if (trimmed.length < 2) { setResults([]); setFocusedResultIndex(-1); setLoading(false); setError(""); return; }
    if (!TOKEN) { setError("TMDB token missing. Check .env.local and restart Vite."); return; }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tmdbFetch(`/search/${type}?query=${encodeURIComponent(trimmed)}&include_adult=false&language=en-US&page=1`, controller.signal);
        if (!controller.signal.aborted) setResults(data.results || []);
      } catch (e) {
        if (e.name !== "AbortError" && !controller.signal.aborted) { setError(e.message || "Search failed."); setResults([]); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, type, showPlayer]);

  useEffect(() => {
    if (!TOKEN) return;
    const controller = new AbortController();
    safeFetch(`/genre/${type}/list?language=en-US`, controller.signal).then((data) => {
      if (!controller.signal.aborted) setGenreOptions(data?.genres || []);
    }).catch(() => {});
    return () => controller.abort();
  }, [type]);

  // Load titles available from the selected streaming provider in the Netherlands.
  useEffect(() => {
    if (homeProvider === "all" || !TOKEN) {
      setProviderTitles([]);
      setProviderTitlesLoading(false);
      setProviderTitlesError("");
      return;
    }
    const controller = new AbortController();
    setProviderTitlesLoading(true);
    setProviderTitlesError("");
    (async () => {
      try {
        const pages = await Promise.all([1, 2].map((page) =>
          tmdbFetch(`/discover/${type}?with_watch_providers=${encodeURIComponent(homeProvider)}&watch_region=NL&sort_by=popularity.desc&include_adult=false&language=en-US&page=${page}`, controller.signal)
        ));
        if (!controller.signal.aborted) {
          const unique = new Map();
          pages.forEach((data) => (data?.results || []).forEach((item) => unique.set(item.id, item)));
          setProviderTitles(Array.from(unique.values()));
          if (!unique.size) setProviderTitlesError("No titles were returned for this provider in the Netherlands.");
        }
      } catch (e) {
        if (e.name !== "AbortError" && !controller.signal.aborted) {
          setProviderTitles([]);
          setProviderTitlesError("Could not load this provider. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setProviderTitlesLoading(false);
      }
    })();
    return () => controller.abort();
  }, [homeProvider, type]);

  // Close either filter menu when users tap/click outside it or press Escape.
  useEffect(() => {
    if (!genreMenuOpen && !providerMenuOpen) return;
    const closeFilterMenus = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        setGenreMenuOpen(false);
        setProviderMenuOpen(false);
      }
      if (event.type === "pointerdown") {
        if (!event.target.closest?.(".genre-menu-wrap")) setGenreMenuOpen(false);
        if (!event.target.closest?.(".provider-menu-wrap")) setProviderMenuOpen(false);
      }
    };
    document.addEventListener("keydown", closeFilterMenus);
    document.addEventListener("pointerdown", closeFilterMenus);
    return () => {
      document.removeEventListener("keydown", closeFilterMenus);
      document.removeEventListener("pointerdown", closeFilterMenus);
    };
  }, [genreMenuOpen, providerMenuOpen]);

  // Discover a full genre shelf before the standard homepage shelves.
  useEffect(() => {
    if (homeGenre === "all" || !TOKEN) {
      setGenreTitles([]);
      setGenreTitlesLoading(false);
      setGenreTitlesError("");
      return;
    }
    const controller = new AbortController();
    shelfLoadingRef.current.genre = false;
    shelfExhaustedRef.current.genre = false;
    setShelfPages((previous) => ({ ...previous, genre: 3 }));
    (async () => {
      setGenreTitlesLoading(true);
      setGenreTitlesError("");
      try {
        // Fetch three TMDB pages so the genre shelf has plenty of titles to scroll through.
        const pages = await Promise.all([1, 2, 3].map((page) =>
          tmdbFetch(`/discover/${type}?with_genres=${encodeURIComponent(homeGenre)}&sort_by=popularity.desc&include_adult=false&language=en-US&page=${page}`, controller.signal)
        ));
        if (!controller.signal.aborted) {
          const unique = new Map();
          pages.forEach((data) => (data?.results || []).forEach((item) => unique.set(item.id, item)));
          setGenreTitles(Array.from(unique.values()));
        }
      } catch (e) {
        if (e.name !== "AbortError" && !controller.signal.aborted) { setGenreTitles([]); setGenreTitlesError("Could not load this genre. Please try again."); }
      } finally { if (!controller.signal.aborted) setGenreTitlesLoading(false); }
    })();
    return () => controller.abort();
  }, [homeGenre, type]);

  // Load a selected cast member's combined movie + TV filmography from TMDB.
  useEffect(() => {
    if (!selectedCastMember || !TOKEN) {
      setCastFilmography([]);
      setCastFilmographyLoading(false);
      setCastFilmographyError("");
      return;
    }
    const controller = new AbortController();
    setCastFilmography([]);
    setCastFilmographyLoading(true);
    setCastFilmographyError("");
    (async () => {
      try {
        const data = await tmdbFetch(`/person/${selectedCastMember.id}/combined_credits?language=en-US`, controller.signal);
        if (controller.signal.aborted) return;
        const unique = new Map();
        (data?.cast || []).forEach((item) => {
          if (!item.id || !item.media_type || !["movie", "tv"].includes(item.media_type) || item.adult) return;
          const key = `${item.media_type}:${item.id}`;
          const previous = unique.get(key);
          if (!previous || Number(item.popularity || 0) > Number(previous.popularity || 0)) unique.set(key, item);
        });
        setCastFilmography(Array.from(unique.values()).sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0)));
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) setCastFilmographyError("Could not load this cast member’s filmography. Please try again.");
      } finally {
        if (!controller.signal.aborted) setCastFilmographyLoading(false);
      }
    })();
    return () => controller.abort();
  }, [selectedCastMember]);

  // Details, cast/crew, recommendations, similar titles, trailers and collections.
  useEffect(() => {
    if (!selected || !TOKEN) return;
    const controller = new AbortController();
    (async () => {
      const base = `/${type}/${selected.id}`;
      try {
        const [detailData, creditData, recData, similarData, videoData] = await Promise.all([
          safeFetch(`${base}?language=en-US`, controller.signal),
          safeFetch(`${base}/credits?language=en-US`, controller.signal),
          safeFetch(`${base}/recommendations?language=en-US&page=1`, controller.signal),
          safeFetch(`${base}/similar?language=en-US&page=1`, controller.signal),
          safeFetch(`${base}/videos?language=en-US`, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setDetails(detailData);
        setCredits({ cast: creditData?.cast || [], crew: creditData?.crew || [] });
        setRecommendations((recData?.results || []).slice(0, 12));
        setSimilar((similarData?.results || []).slice(0, 12));
        const videos = videoData?.results || [];
        setTrailer(videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
          videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
          videos.find((v) => v.site === "YouTube" && v.type === "Teaser") || null);
        if (type === "movie" && detailData?.belongs_to_collection?.id) {
          const collectionData = await safeFetch(`/collection/${detailData.belongs_to_collection.id}?language=en-US`, controller.signal);
          if (!controller.signal.aborted) setCollection(collectionData);
        } else if (type === "movie") setCollection(null);
      } catch {}
    })();
    return () => controller.abort();
  }, [selected, type]);

  // Load seasons and episodes for the selected TV show.
  useEffect(() => {
    if (!selected || type !== "tv" || !TOKEN) return;
    const controller = new AbortController();
    (async () => {
      try {
        const data = await tmdbFetch(`/tv/${selected.id}?language=en-US`, controller.signal);
        if (controller.signal.aborted) return;
        const list = (data.seasons || []).filter((s) => s.season_number >= 0);
        setSeasons(list);
        const savedSeason = history.tv.find((x) => x.id === selected.id)?._lastSeason;
        if (savedSeason != null && list.some((x) => x.season_number === Number(savedSeason))) setSeason(String(savedSeason));
      } catch (e) { if (e.name !== "AbortError") setError(`Could not load seasons: ${e.message}`); }
    })();
    return () => controller.abort();
  }, [selected, type]);

  useEffect(() => {
    if (!selected || type !== "tv" || !TOKEN || season === "") { setEpisodes([]); return; }
    const controller = new AbortController();
    (async () => {
      setEpisodesLoading(true); setEpisodes([]); setError("");
      try {
        const data = await tmdbFetch(`/tv/${selected.id}/season/${encodeURIComponent(season)}?language=en-US`, controller.signal);
        if (controller.signal.aborted) return;
        const list = data.episodes || [];
        setEpisodes(list);
        const savedEpisode = history.tv.find((x) => x.id === selected.id)?._lastEpisode;
        if (list.length) {
          const desired = list.some((x) => x.episode_number === Number(savedEpisode)) ? String(savedEpisode) : String(list[0].episode_number);
          setEpisode(desired);
        } else setError("No episodes are listed for this season.");
      } catch (e) { if (e.name !== "AbortError") setError(`Could not load episodes: ${e.message}`); }
      finally { if (!controller.signal.aborted) setEpisodesLoading(false); }
    })();
    return () => controller.abort();
  }, [selected, type, season]);

  useEffect(() => {
    if (!selected || type !== "tv") return;
    updateHistory(selected, "tv", { _lastSeason: Number(season || 1), _lastEpisode: Number(episode || 1) });
  }, [season, episode, selected, type]);

  useEffect(() => {
    if (!showPlayer || !playbackStarted) return;
    const frame = requestAnimationFrame(() => playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [showPlayer, playbackStarted, selected]);

  useEffect(() => {
    if (!showPlayer) return;
    const handler = (event) => {
      if (event.key === "Escape" || event.key === "Backspace") {
        if (showTrailer) { setShowTrailer(false); return; }
        event.preventDefault(); backToSearch();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showPlayer, showTrailer]);

  const localRecommendations = useMemo(() => {
    const pool = [...favorites.map((x) => ({ ...x, _mediaType: x._mediaType || "movie" })), ...history.movie.map((x) => ({ ...x, _mediaType: "movie" })), ...history.tv.map((x) => ({ ...x, _mediaType: "tv" }))];
    const seen = new Set();
    return pool.filter((x) => { const k = mediaKey(x._mediaType, x.id); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
  }, [favorites, history]);

  useEffect(() => {
    if (!TOKEN || !localRecommendations.length) { setPersonalizedRecs([]); return; }
    const controller = new AbortController();
    (async () => {
      const seeds = localRecommendations.slice(0, 4);
      try {
        const groups = await Promise.all(seeds.map(async (item) => {
          const kind = item._mediaType === "tv" ? "tv" : "movie";
          const data = await safeFetch(`/${kind}/${item.id}/recommendations?language=en-US&page=1`, controller.signal);
          return (data?.results || []).map((result) => ({ ...result, _mediaType: kind }));
        }));
        if (controller.signal.aborted) return;
        const excluded = new Set([
          ...favorites.map((item) => mediaKey(item._mediaType === "tv" ? "tv" : "movie", item.id)),
          ...history.movie.map((item) => mediaKey("movie", item.id)),
          ...history.tv.map((item) => mediaKey("tv", item.id)),
        ]);
        const seen = new Set();
        const merged = groups.flat().filter((item) => {
          const key = mediaKey(item._mediaType, item.id);
          if (excluded.has(key) || seen.has(key)) return false;
          seen.add(key); return true;
        }).sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0)).slice(0, 14);
        setPersonalizedRecs(merged);
      } catch {}
    })();
    return () => controller.abort();
  }, [localRecommendations, favorites, history]);

  function markEpisodeWatched(ep = episode, seasonNo = season) {
    const key = episodeKey(selected.id, seasonNo, ep);
    setWatchedEpisodes((current) => ({ ...current, [key]: !current[key] }));
  }
  function goNextEpisode() {
    if (type !== "tv" || !episodes.length) return;
    const index = episodes.findIndex((x) => x.episode_number === Number(episode));
    if (index >= 0 && index < episodes.length - 1) {
      const next = episodes[index + 1];
      setWatchedEpisodes((current) => ({ ...current, [episodeKey(selected.id, season, episode)]: true }));
      setEpisode(String(next.episode_number));
      setPlaybackStarted(false);
      return;
    }
    const currentSeasonIndex = seasons.findIndex((x) => String(x.season_number) === String(season));
    const nextSeason = seasons[currentSeasonIndex + 1];
    if (nextSeason) {
      setWatchedEpisodes((current) => ({ ...current, [episodeKey(selected.id, season, episode)]: true }));
      setSeason(String(nextSeason.season_number));
      setPlaybackStarted(false);
    }
  }
  function chooseServer(value) {
    setServer(value);
    if (selected) setSourcePrefs((current) => ({ ...current, [titleKey]: value }));
  }
  function markSubtitleSource() {
    if (!selected || server === "auto") return;
    setSubtitleSources((current) => {
      const list = current[titleKey] || [];
      return { ...current, [titleKey]: list.includes(server) ? list.filter((x) => x !== server) : [...list, server] };
    });
  }
  function trySubtitleSource(markCurrentFailed = false) {
    if (!selected) return;
    const failed = sourceFailures[titleKey] || [];
    const updatedFailed = markCurrentFailed && server !== "auto" ? [...new Set([...failed, server])] : failed;
    if (markCurrentFailed && server !== "auto") setSourceFailures((current) => ({ ...current, [titleKey]: updatedFailed }));
    const reported = subtitleSources[titleKey] || [];
    const order = [...reported, ...SERVERS.map(([key]) => key).filter((key) => key !== "auto")];
    const next = order.find((key) => key !== server && !updatedFailed.includes(key))
      || SERVERS.map(([key]) => key).find((key) => key !== "auto" && key !== server && !updatedFailed.includes(key))
      || "auto";
    chooseServer(next);
  }
  function resetFailedSources() {
    if (!selected) return;
    setSourceFailures((current) => ({ ...current, [titleKey]: [] }));
  }
  function createCollection(event) {
    event?.preventDefault();
    const name = collectionDraft.trim();
    if (!name) return;
    const duplicate = customCollections.some((list) => list.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { setError("A collection with that name already exists."); return; }
    const id = `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const navKey = `collection:${id}`;
    setCustomCollections((current) => [...current, { id, name, items: [] }]);
    setNavOrder((current) => [...current.filter((key) => key !== navKey), navKey]);
    setCollectionTarget(id);
    setActiveTab(navKey);
    setPlacementCollectionId(null);
    setSettingsMenuOpen(false);
    setCollectionDraft("");
    setCollectionModalOpen(false);
    setError("");
  }
  function reorderNavigation(dragKey, targetIndex) {
    if (!dragKey || dragKey === "__slot__" || !orderedNavKeys.includes(dragKey)) return;
    const originalIndex = orderedNavKeys.indexOf(dragKey);
    const next = orderedNavKeys.filter((key) => key !== dragKey);
    const adjustedIndex = originalIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertion = Math.max(0, Math.min(adjustedIndex, next.length));
    next.splice(insertion, 0, dragKey);
    setNavOrder(next);
    setPlacementCollectionId(null);
    setDragOverTab(null);
  }
  function deleteCollection(collectionId) {
    const list = customCollections.find((item) => item.id === collectionId);
    if (!list || !window.confirm(`Delete collection “${list.name}” and its saved list?`)) return;
    setCustomCollections((current) => current.filter((item) => item.id !== collectionId));
    setNavOrder((current) => current.filter((key) => key !== `collection:${collectionId}`));
    if (collectionTarget === collectionId) setCollectionTarget("");
    setActiveTab("search");
    setPlacementCollectionId(null);
  }
  function addToCollection(item, itemType, collectionId) {
    if (!collectionId) { setError("Create or select a collection first."); return; }
    setCustomCollections((current) => current.map((list) => {
      if (list.id !== collectionId) return list;
      if (list.items.some((entry) => entry.id === item.id && entry._mediaType === itemType)) return list;
      return { ...list, items: [...list.items, { ...item, _mediaType: itemType }] };
    }));
    setError("");
  }
  function removeCollectionItem(collectionId, item, itemType) {
    setCustomCollections((current) => current.map((list) => list.id === collectionId
      ? { ...list, items: list.items.filter((entry) => !(entry.id === item.id && entry._mediaType === itemType)) }
      : list));
  }

  // Keep keyboard/remote navigation available across visible controls and search results.
  useEffect(() => {
    function handleArrowNavigation(event) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      if (target?.closest?.(".genre-dropdown") || tag === "select" || tag === "textarea" || target?.isContentEditable) return;
      if (target === searchInput.current && event.key === "ArrowDown" && filteredResults.length) {
        event.preventDefault();
        const next = focusedResultIndex < filteredResults.length - 1 ? focusedResultIndex + 1 : 0;
        setFocusedResultIndex(next);
        requestAnimationFrame(() => document.querySelector(`[data-search-result-index="${next}"]`)?.focus());
        return;
      }
      if (tag === "input" && target !== searchInput.current) return;
      const controls = Array.from(document.querySelectorAll(
        ".app button:not(:disabled), .app input:not(:disabled), .app select:not(:disabled), .app a[href], .app [tabindex]:not([tabindex='-1'])"
      )).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      });
      if (!controls.length) return;
      const current = controls.indexOf(document.activeElement);
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      const next = current < 0 ? 0 : (current + (forward ? 1 : -1) + controls.length) % controls.length;
      event.preventDefault();
      controls[next]?.focus();
    }
    document.addEventListener("keydown", handleArrowNavigation);
    return () => document.removeEventListener("keydown", handleArrowNavigation);
  }, [results, filteredResults, focusedResultIndex]);

  function shelfId(title) {
    return `shelf-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  }

  async function loadMoreShelf(shelfKey) {
    if (!TOKEN || !shelfKey || shelfLoadingRef.current[shelfKey] || shelfExhaustedRef.current[shelfKey]) return;

    const currentPage = shelfPages[shelfKey] || (shelfKey === "genre" ? 3 : 1);
    const nextPage = currentPage + 1;
    shelfLoadingRef.current[shelfKey] = true;
    setShelfLoading((previous) => ({ ...previous, [shelfKey]: true }));

    try {
      let data = null;

      if (shelfKey === "now") {
        data = await safeFetch(`/movie/now_playing?language=en-US&page=${nextPage}`);
      } else if (shelfKey === "movies") {
        data = await safeFetch(`/trending/movie/day?language=en-US&page=${nextPage}`);
      } else if (shelfKey === "tv") {
        data = await safeFetch(`/trending/tv/day?language=en-US&page=${nextPage}`);
      } else if (shelfKey === "genre" && homeGenre !== "all") {
        data = await safeFetch(`/discover/${type}?with_genres=${encodeURIComponent(homeGenre)}&sort_by=popularity.desc&include_adult=false&language=en-US&page=${nextPage}`);
      } else if (shelfKey === "recommendations") {
        const seeds = localRecommendations.slice(0, 4);
        const groups = await Promise.all(seeds.map(async (item) => {
          const kind = item._mediaType === "tv" || item.media_type === "tv" ? "tv" : "movie";
          const result = await safeFetch(`/${kind}/${item.id}/recommendations?language=en-US&page=${nextPage}`);
          return (result?.results || []).map((entry) => ({ ...entry, _mediaType: kind }));
        }));
        data = { results: groups.flat() };
      }

      // A failed request is retryable; only a successful empty response marks the shelf exhausted.
      if (!data) return;
      const incoming = data.results || [];
      if (!incoming.length) {
        shelfExhaustedRef.current[shelfKey] = true;
        return;
      }

      const setter = {
        now: setNowPlayingMovies,
        movies: setTrendingMovies,
        tv: setTrendingTvShows,
        genre: setGenreTitles,
        recommendations: setPersonalizedRecs,
      }[shelfKey];

      if (setter) {
        setter((previous) => {
          const kindFor = (item) => {
            if (item._mediaType === "tv" || item.media_type === "tv" || shelfKey === "tv") return "tv";
            if (shelfKey === "genre") return type === "tv" ? "tv" : "movie";
            return "movie";
          };
          const seen = new Set(previous.map((item) => `${kindFor(item)}:${item.id}`));
          const uniqueAdditions = [];

          for (const item of incoming) {
            const key = `${kindFor(item)}:${item.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueAdditions.push(item);
          }

          if (uniqueAdditions.length === 0) {
            // Advance the page even when it contained only duplicates, so the next scroll can continue.
            return previous;
          }
          return [...previous, ...uniqueAdditions];
        });
      }

      setShelfPages((previous) => ({ ...previous, [shelfKey]: nextPage }));
    } catch (error) {
      console.warn(`Could not load more titles for ${shelfKey}`, error);
    } finally {
      shelfLoadingRef.current[shelfKey] = false;
      setShelfLoading((previous) => ({ ...previous, [shelfKey]: false }));
    }
  }

  function handleShelfScroll(event, shelfKey) {
    const track = event.currentTarget;
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 220) {
      loadMoreShelf(shelfKey);
    }
  }

  function shelfControls(title, count, shelfKey = null) {
    const id = shelfId(title);
    const scrollShelf = (direction) => {
      const track = document.getElementById(id);
      if (!track) return;
      const distance = Math.max(280, Math.round(track.clientWidth * 0.8));
      track.scrollBy({ left: direction * distance, behavior: "smooth" });
      if (direction > 0 && track.scrollLeft + track.clientWidth >= track.scrollWidth - 350 && shelfKey) {
        loadMoreShelf(shelfKey);
      }
    };
    return <div className="shelf-controls">
      <button type="button" className="shelf-arrow" aria-label={`Scroll ${title} left`} title="Scroll left" onClick={() => scrollShelf(-1)} disabled={count === 0}>&lt;</button>
      <button type="button" className="shelf-arrow" aria-label={`Scroll ${title} right`} title={shelfLoading[shelfKey] ? "Loading more titles…" : "Scroll right"} onClick={() => scrollShelf(1)} disabled={count === 0}>&gt;</button>
    </div>;
  }

  function renderPosterActions(item, itemType) {
    const favorite = isFavorite(item, itemType);
    const inWatchlist = isInWatchlist(item, itemType);
    const actionKey = `${itemType}-${item.id}`;
    const actionsOpen = openPosterActions === actionKey;
    return <>
      <button
        type="button"
        className={`poster-actions-toggle${actionsOpen ? " active" : ""}`}
        aria-label={`${actionsOpen ? "Close" : "Open"} options for ${mediaName(item)}`}
        aria-expanded={actionsOpen}
        onClick={(event) => { event.stopPropagation(); setOpenPosterActions((current) => current === actionKey ? null : actionKey); }}
      >⋯</button>
      <div className={`poster-actions-overlay${actionsOpen ? " is-open" : ""}`} aria-label={`Actions for ${mediaName(item)}`}>
        <button type="button" className="poster-action-play" onClick={(event) => { event.stopPropagation(); setOpenPosterActions(null); choose(item, itemType); setPlaybackStarted(true); }}>▶ Play</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); setOpenPosterActions(null); choose(item, itemType); }}>Details</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); toggleWatchlist(item, itemType); }}>{inWatchlist ? "✓ In Watchlist" : "+ Watchlist"}</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(item, itemType); }}>{favorite ? "★ Favorited" : "☆ Favorite"}</button>
      </div>
    </>;
  }

  function renderShelf(shelfTitle, items, itemType, shelfKey = null) {
    const id = shelfId(shelfTitle);
    return <section className="discovery-section" key={shelfTitle}>
      <div className="section-heading"><h2>{shelfTitle}</h2>{shelfControls(shelfTitle, items.length, shelfKey)}</div>
      {items.length ? <div className="discovery-track" id={id} onScroll={shelfKey ? (event) => handleShelfScroll(event, shelfKey) : undefined}>{items.map((item) => {
        const favorite = isFavorite(item, itemType);
        return <article className="discovery-card" key={`${shelfTitle}-${item.id}`}>
          <button className={`discovery-favorite${favorite ? " active" : ""}`} aria-label={favorite ? "Remove favorite" : "Add favorite"} onClick={() => toggleFavorite(item, itemType)}>{favorite ? "★" : "☆"}</button>
          <button className="poster-button" onClick={() => choose(item, itemType)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>
          {renderPosterActions(item, itemType)}
        </article>;
      })}</div> : featuredLoading ? <ShelfSkeleton count={6} /> : <div className="empty-state">Titles are unavailable right now.</div>}
    </section>;
  }

  function renderGenreGrid(shelfTitle, items, itemType, shelfKey = "genre") {
    const id = shelfId(shelfTitle);
    return <section className="discovery-section genre-results-section" key={shelfTitle}>
      <div className="section-heading"><div><h2>{shelfTitle}</h2><span className="muted">Popular titles in this genre</span></div>{shelfControls(shelfTitle, items.length, shelfKey)}</div>
      {items.length ? <div className="genre-results-track" id={id} onScroll={(event) => handleShelfScroll(event, shelfKey)}>{items.map((item) => {
        const favorite = isFavorite(item, itemType);
        return <article className="discovery-card genre-result-card" key={`${shelfTitle}-${item.id}`}>
          <button className={`discovery-favorite${favorite ? " active" : ""}`} aria-label={favorite ? "Remove favorite" : "Add favorite"} onClick={() => toggleFavorite(item, itemType)}>{favorite ? "★" : "☆"}</button>
          <button className="poster-button" onClick={() => choose(item, itemType)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>
          {renderPosterActions(item, itemType)}
        </article>;
      })}</div> : <div className="empty-state">No titles found for this genre.</div>}
      {shelfLoading[shelfKey] && <p className="genre-loading-more">Loading more titles…</p>}
    </section>;
  }

  function renderContinueShelf() {
    return <section className="discovery-section continue-shelf">
      <div className="section-heading"><h2>Continue Watching</h2>{shelfControls("Continue Watching", continueItems.length)}</div>
      {continueItems.length ? <div className="discovery-track" id={shelfId("Continue Watching")}>{continueItems.map((item) => {
        const kind = item._mediaType === "tv" ? "tv" : "movie";
        return <article className="discovery-card" key={`continue-${kind}-${item.id}`}>
          <button className="poster-button" onClick={() => choose(item, kind)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{kind === "tv" ? `Resume S${item._lastSeason || 1} E${item._lastEpisode || 1}` : `Movie · ${yearText(item)}`}</small><span className="continue-note">{kind === "tv" ? "Resume from your last selected episode" : "Reopen this title"}</span></span></button>
          {renderPosterActions(item, kind)}
          <button className="remove-chip continue-remove" onClick={() => removeFromHistory(kind, item.id)}>Remove</button>
        </article>;
      })}</div> : <div className="empty-state">Open a movie or show to see it here. Episode resume is saved for TV shows; exact video-time resume depends on VidNest exposing playback progress.</div>}
    </section>;
  }

  return <main className="app">
    <header className={`topbar${hasScrolled ? " is-scrolled" : ""}${showPlayer ? " player-topbar" : ""}${showFeaturedCarousel && featuredTitle ? " home-overlay-header" : ""}`}>
      <button type="button" className="brand" aria-label="369 NKRI TV home" onClick={() => { setActiveTab("search"); setQuery(""); setResults([]); setError(""); setShowTrailer(false); backToSearch(); }}><span className="brand-number">369</span><span className="brand-wordmark"><strong>NKRI</strong><small>TV</small></span></button>
      {!showPlayer && <div className="header-search">
        <div className="search-header-controls"><div className="tabs media-tabs">
          <div className="provider-menu-wrap">
            <button type="button" className={`provider-toggle${providerMenuOpen || homeProvider !== "all" ? " active" : ""}`} aria-haspopup="listbox" aria-expanded={providerMenuOpen} aria-controls="home-provider-dropdown" onClick={() => { setProviderMenuOpen((open) => !open); setGenreMenuOpen(false); }}>{homeProvider === "all" ? "Provider" : (STREAMING_PROVIDERS.find((provider) => String(provider.id) === String(homeProvider))?.name || "Provider")} <span aria-hidden="true">▾</span></button>
            {providerMenuOpen && <div id="home-provider-dropdown" className="provider-dropdown" role="listbox" aria-label="Choose a streaming provider"><button type="button" role="option" aria-selected={homeProvider === "all"} className={homeProvider === "all" ? "active" : ""} onClick={() => { setHomeProvider("all"); setHomeGenre("all"); setQuery(""); setResults([]); setError(""); setActiveTab("search"); setProviderMenuOpen(false); }}>All Providers</button>{STREAMING_PROVIDERS.map((provider) => <button type="button" role="option" key={provider.id} aria-selected={String(homeProvider) === String(provider.id)} className={String(homeProvider) === String(provider.id) ? "active" : ""} onClick={() => { setHomeProvider(String(provider.id)); setHomeGenre("all"); setQuery(""); setResults([]); setError(""); setActiveTab("search"); setProviderMenuOpen(false); }}>{provider.name}</button>)}</div>}
          </div>
          <div className="genre-menu-wrap">
            <button type="button" className={`genre-toggle${genreMenuOpen || homeGenre !== "all" ? " active" : ""}`} aria-haspopup="listbox" aria-expanded={genreMenuOpen} aria-controls="home-genre-dropdown" onClick={() => { setGenreMenuOpen((open) => !open); setProviderMenuOpen(false); }}>Genre{homeGenre !== "all" ? `: ${genreOptions.find((genre) => String(genre.id) === String(homeGenre))?.name || "Selected"}` : ""} <span aria-hidden="true">▾</span></button>
            {genreMenuOpen && <div id="home-genre-dropdown" className="genre-dropdown" role="listbox" aria-label="Choose a genre"><button type="button" role="option" aria-selected={homeGenre === "all"} className={homeGenre === "all" ? "active" : ""} onClick={() => { setHomeGenre("all"); setHomeProvider("all"); setQuery(""); setResults([]); setActiveTab("search"); setGenreMenuOpen(false); }}>All Genres</button>{genreOptions.map((genre) => <button type="button" role="option" key={genre.id} aria-selected={String(homeGenre) === String(genre.id)} className={String(homeGenre) === String(genre.id) ? "active" : ""} onClick={() => { setHomeGenre(String(genre.id)); setHomeProvider("all"); setQuery(""); setResults([]); setActiveTab("search"); setError(""); setGenreMenuOpen(false); }}>{genre.name}</button>)}</div>}
          </div>
          <button type="button" className={type === "movie" ? "active" : ""} onClick={() => { setType("movie"); setResults([]); setError(""); }}>Movies</button>
          <button type="button" className={type === "tv" ? "active" : ""} onClick={() => { setType("tv"); setResults([]); setError(""); }}>TV Shows</button>
        </div></div>
        <form className="searchrow" onSubmit={search}>
          <input ref={searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={type === "movie" ? "Search movie titles..." : "Search TV show titles..."} aria-label="Search title" autoComplete="off" />
          <button className="primary search-submit" aria-label={loading ? "Searching" : "Search"} title={loading ? "Searching" : "Search"} disabled={loading}><span className="search-button-text">{loading ? "Searching…" : "Search"}</span><span className="search-button-icon" aria-hidden="true">{loading ? "…" : "⌕"}</span></button>
          <div className="settings-menu-wrap">
            <button type="button" className={`settings-menu-trigger${settingsMenuOpen ? " active" : ""}`} aria-label="Open library menu" aria-haspopup="menu" aria-expanded={settingsMenuOpen} title="Library menu" onClick={() => setSettingsMenuOpen((open) => !open)}><span className="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button>
            {settingsMenuOpen && <div className="settings-menu" role="menu" aria-label="Library navigation">
              {BASE_LIBRARY_TABS.map((key) => {
                const label = key === "watchlist" ? `Watchlist (${watchlist.length})` : key === "favorites" ? `Favorites (${favorites.length})` : LIBRARY_TAB_LABELS[key];
                return <button type="button" role="menuitem" key={key} className={`settings-menu-item${activeTab === key ? " active" : ""}`} onClick={() => { setActiveTab(key); setSettingsMenuOpen(false); }}>{label}</button>;
              })}
              {customCollections.length > 0 && <div className="settings-menu-divider" role="separator" />}
              {customCollections.map((list) => <button type="button" role="menuitem" key={list.id} className={`settings-menu-item collection-menu-item${activeTab === `collection:${list.id}` ? " active" : ""}`} onClick={() => { setActiveTab(`collection:${list.id}`); setSettingsMenuOpen(false); }}>{list.name}<span>{list.items.length}</span></button>)}
              <div className="settings-menu-divider" role="separator" />
              <button type="button" role="menuitem" className="settings-menu-item settings-create-item" onClick={() => { setCollectionDraft(""); setError(""); setSettingsMenuOpen(false); setCollectionModalOpen(true); }}><span className="settings-create-plus" aria-hidden="true">+</span> Create collection</button>
            </div>}
          </div>
        </form>
      </div>}
      <div className="topbar-actions">{showPlayer && <button onClick={backToSearch}>Back to library</button>}{!showPlayer && activeTab.startsWith("collection:") && <button type="button" className="collection-delete-top" aria-label="Delete this collection" title="Delete this collection" onClick={() => deleteCollection(activeTab.slice("collection:".length))}>×</button>}</div>
    </header>

    {!showPlayer && <>
      {collectionModalOpen && <div className="collection-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCollectionModalOpen(false); }}><section className="collection-modal" role="dialog" aria-modal="true" aria-labelledby="new-collection-title"><button type="button" className="collection-modal-close" aria-label="Close" onClick={() => setCollectionModalOpen(false)}>×</button><h2 id="new-collection-title">New collection</h2><p>Name your collection to add it to the library menu.</p><form className="collection-create" onSubmit={createCollection}><input autoFocus value={collectionDraft} onChange={(event) => setCollectionDraft(event.target.value)} placeholder="Collection name" aria-label="Collection name" maxLength={60} required /><div className="collection-modal-actions"><button type="button" onClick={() => setCollectionModalOpen(false)}>Cancel</button><button className="primary" type="submit">Create</button></div></form>{error && <p className="error">{error}</p>}</section></div>}

      {activeTab === "search" && <>
        <section className="panel home-panel">
          {query.trim().length >= 2 && !showPlayer && results.length > 0 && <div className="autocomplete-panel" aria-label="Quick search suggestions"><div className="autocomplete-heading">Quick matches <span>{results.length} found</span></div>{results.slice(0, 5).map((item) => <button type="button" className="autocomplete-item" key={`suggest-${type}-${item.id}`} onClick={() => choose(item, type)}><Poster item={item} size="w92" className="autocomplete-poster" /><span><strong>{mediaName(item)}</strong><small>{yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span><span className="autocomplete-open">Open ›</span></button>)}<button type="button" className="autocomplete-all" onClick={search}>See all search results →</button></div>}
          {recentSearches.length > 0 && !query.trim() && homeGenre === "all" && !showFeaturedCarousel && <div className="recent-searches"><span>Recent searches</span>{recentSearches.slice(0, 5).map((term) => <button type="button" key={term} onClick={() => setQuery(term)}>{term}</button>)}<button type="button" className="clear-recents" onClick={() => setRecentSearches([])}>Clear</button></div>}
        {featuredTitle && showFeaturedCarousel && <section
          key={`${featuredType}-${featuredTitle.id}`}
          className={`cinematic-hero hero-fullbleed hero-slide-enter ${featuredDirection < 0 ? "hero-slide-previous" : "hero-slide-next"}${featuredIsDragging ? " hero-is-dragging" : ""}`}
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(7,8,13,.97) 0%, rgba(7,8,13,.82) 42%, rgba(7,8,13,.18) 100%), linear-gradient(0deg, #090a0f 0%, transparent 40%), url("${IMAGE}original${featuredTitle.backdrop_path}")`,
            "--hero-drag-x": `${featuredDragX}px`,
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.target.closest?.("button, a, input, select, textarea")) { heroTouchStart.current = null; return; }
            heroTouchStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, width: event.currentTarget.getBoundingClientRect().width };
            setFeaturedIsDragging(true);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = heroTouchStart.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;
            if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && Math.abs(deltaY) > 8) return;
            // Render the exact horizontal pointer delta: no easing, scaling, or resistance while dragging.
            setFeaturedDragX(deltaX);
          }}
          onPointerUp={(event) => {
            const start = heroTouchStart.current;
            heroTouchStart.current = null;
            setFeaturedIsDragging(false);
            if (!start || start.pointerId !== event.pointerId || featuredItems.length < 2) {
              setFeaturedDragX(0);
              return;
            }
            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;
            const threshold = Math.max(48, start.width * 0.12);
            if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
              setFeaturedDragX(0);
              changeFeatured(deltaX < 0 ? 1 : -1);
            } else {
              setFeaturedDragX(0);
            }
          }}
          onLostPointerCapture={() => {
            if (heroTouchStart.current) {
              heroTouchStart.current = null;
              setFeaturedIsDragging(false);
              setFeaturedDragX(0);
            }
          }}
          onPointerCancel={() => { heroTouchStart.current = null; setFeaturedIsDragging(false); setFeaturedDragX(0); }}
          aria-roledescription="carousel"
          aria-label="Featured movies and TV shows"
        >
          <div className="cinematic-copy"><p className="eyebrow">FEATURED {featuredType === "tv" ? "SERIES" : "MOVIE"}</p><h1>{mediaName(featuredTitle)}</h1><div className="cinematic-meta"><span>★ {Number(featuredTitle.vote_average || 0).toFixed(1)} / 10</span><span>{yearText(featuredTitle)}</span><span>{featuredType === "tv" ? "TV Series" : "Movie"}</span></div><p className="cinematic-overview">{featuredTitle.overview || "Discover your next favorite on 369 NKRI TV."}</p><div className="cinematic-actions"><button className="primary" onClick={() => { choose(featuredTitle, featuredType); setPlaybackStarted(true); }}>▶ Play now</button><button className="hero-secondary" onClick={() => choose(featuredTitle, featuredType)}>More details</button></div></div>
          {featuredItems.length > 1 && <div className="hero-carousel-controls" aria-label="Featured title controls">
            <button type="button" className="hero-carousel-arrow" aria-label="Previous featured title" onClick={() => changeFeatured(-1)}>‹</button>
            <span className="hero-slide-count" aria-live="polite">{activeFeaturedIndex + 1} / {featuredItems.length}</span>
            <button type="button" className="hero-carousel-arrow" aria-label="Next featured title" onClick={() => changeFeatured(1)}>›</button>
          </div>}
        </section>}
          {results.length > 0 && <section className="search-results"><div className="section-heading"><h2>Search results</h2><span className="muted">{filteredResults.length} of {results.length} titles</span></div><div className="discovery-filters" aria-label="Advanced discovery filters"><label>Genre<select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}><option value="all">All genres</option>{genreOptions.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></label><label>Release year<input inputMode="numeric" pattern="[0-9]*" placeholder="Any year" value={filterYear} onChange={(e) => setFilterYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} /></label><label>Minimum rating<select value={minRating} onChange={(e) => setMinRating(e.target.value)}><option value="0">Any rating</option><option value="5">5+ / 10</option><option value="6">6+ / 10</option><option value="7">7+ / 10</option><option value="8">8+ / 10</option></select></label><label>Sort by<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="relevance">Default order</option><option value="popularity">Popularity</option><option value="rating">Highest rating</option><option value="year-new">Newest year</option><option value="year-old">Oldest year</option><option value="title">Title A–Z</option></select></label><button onClick={() => { setFilterGenre("all"); setFilterYear(""); setMinRating("0"); setSortBy("relevance"); }}>Reset filters</button><button type="button" onClick={() => { if (filteredResults.length) choose(filteredResults[Math.floor(Math.random() * filteredResults.length)], type); }} disabled={!filteredResults.length}>🎲 Surprise me</button></div><div className="results-list">{filteredResults.map((item, index) => <article className="result-row" key={item.id}><button className="result" data-search-result-index={index} onClick={() => choose(item, type)}><Poster item={item} size="w185" className="result-poster" /><span className="result-info"><strong>{mediaName(item)}</strong><small>{yearText(item)} · TMDB {item.id} · ★ {Number(item.vote_average || 0).toFixed(1)}</small><span>{item.overview || "No description available."}</span></span></button><button className={`small-icon${isFavorite(item, type) ? " active" : ""}`} title="Toggle favorite" onClick={() => toggleFavorite(item, type)}>{isFavorite(item, type) ? "★" : "☆"}</button><button className={`small-icon${isInWatchlist(item, type) ? " active" : ""}`} title="Toggle watchlist" onClick={() => toggleWatchlist(item, type)}>{isInWatchlist(item, type) ? "✓" : "+"}</button></article>)}</div>{filteredResults.length === 0 && <div className="empty-state">No titles match these filters. Try changing or resetting them.</div>}</section>}
        {error && <p className="error">{error}</p>}
        {homeProvider !== "all" ? (providerTitlesLoading ? <section className="discovery-section provider-results-section"><div className="section-heading"><h2>{STREAMING_PROVIDERS.find((provider) => String(provider.id) === String(homeProvider))?.name || "Provider"} {type === "movie" ? "Movies" : "TV Shows"}</h2></div><ShelfSkeleton count={8} genre /></section> : providerTitlesError ? <section className="discovery-section provider-results-section"><div className="section-heading"><h2>{STREAMING_PROVIDERS.find((provider) => String(provider.id) === String(homeProvider))?.name || "Provider"} {type === "movie" ? "Movies" : "TV Shows"}</h2></div><div className="empty-state">{providerTitlesError}</div></section> : renderGenreGrid(`${STREAMING_PROVIDERS.find((provider) => String(provider.id) === String(homeProvider))?.name || "Provider"} ${type === "movie" ? "Movies" : "TV Shows"}`, providerTitles, type, "provider")) : <>
          {homeGenre !== "all" && (genreTitlesLoading ? <section className="discovery-section genre-results-section"><div className="section-heading"><h2>{genreOptions.find((genre) => String(genre.id) === String(homeGenre))?.name || "Selected Genre"} {type === "movie" ? "Movies" : "TV Shows"}</h2></div><ShelfSkeleton count={8} genre /></section> : genreTitlesError ? <section className="discovery-section genre-results-section"><div className="section-heading"><h2>{genreOptions.find((genre) => String(genre.id) === String(homeGenre))?.name || "Selected Genre"} {type === "movie" ? "Movies" : "TV Shows"}</h2></div><div className="empty-state">{genreTitlesError}</div></section> : renderGenreGrid(`${genreOptions.find((genre) => String(genre.id) === String(homeGenre))?.name || "Selected Genre"} ${type === "movie" ? "Movies" : "TV Shows"}`, genreTitles, type, "genre"))}
          {renderShelf("Now Playing", nowPlayingMovies, "movie", "now")}
          {renderContinueShelf()}
          {renderShelf("Trending Movies", trendingMovies, "movie", "movies")}
          {renderShelf("Trending TV Shows", trendingTvShows, "tv", "tv")}
          <section className="discovery-section"><div className="section-heading"><h2>Recommended from your library</h2>{shelfControls("Recommended from your library", personalizedRecs.length, "recommendations")}</div>{personalizedRecs.length ? <div className="discovery-track" id={shelfId("Recommended from your library")} onScroll={(event) => handleShelfScroll(event, "recommendations")}>{personalizedRecs.map((item) => <article className="discovery-card" key={`personal-${item._mediaType}-${item.id}`}><button className="poster-button" onClick={() => choose(item, item._mediaType)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{item._mediaType === "tv" ? "TV show" : "Movie"} · {yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>{renderPosterActions(item, item._mediaType)}</article>)}</div> : <div className="empty-state">{localRecommendations.length ? "Finding recommendations from your saved titles…" : "Add favorites or open titles to build personalized recommendations."}</div>}</section>
        </>}
        </section>
      </>}
      {activeTab === "watchlist" && <LibraryGrid title="Your Watchlist" items={watchlist} empty="Save movies and shows with + to watch them later." onOpen={(item) => choose(item, item._mediaType || "movie")} onRemove={(item) => toggleWatchlist(item, item._mediaType || "movie")} statuses={statuses} onStatus={setItemStatus} renderActions={renderPosterActions} />}
      {activeTab === "favorites" && <LibraryGrid title="Favorites" items={favorites} empty="Use ☆ on a title to save it here." onOpen={(item) => choose(item, item._mediaType || "movie")} onRemove={(item) => toggleFavorite(item, item._mediaType || "movie")} renderActions={renderPosterActions} />}
      {activeTab === "history" && <section className="discovery-section"><h2>Continue Watching</h2>{[["movie", "Movies"], ["tv", "TV Shows"]].map(([kind, label]) => <div className="library-group" key={kind}><h3>{label}</h3><div className="discovery-track">{history[kind].length ? history[kind].map((item) => <article className="discovery-card" key={`${kind}-${item.id}`}><button className="poster-button" onClick={() => choose(item, kind)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{kind === "tv" ? `Resume S${item._lastSeason || 1} E${item._lastEpisode || 1}` : "Movie"} · {yearText(item)}</small></span></button>{renderPosterActions(item, kind)}<button className="remove-chip" onClick={() => removeFromHistory(kind, item.id)}>Remove</button></article>) : <p className="empty-state">Nothing here yet.</p>}</div></div>)}</section>}
      {activeTab.startsWith("collection:") && (() => { const list = customCollections.find((item) => `collection:${item.id}` === activeTab); if (!list) return <section className="discovery-section"><p className="empty-state">This collection no longer exists.</p></section>; return <section className="discovery-section"><div className="section-heading"><div><h2>{list.name}</h2><span className="muted">{list.items.length} titles</span></div></div>{list.items.length ? <div className="library-grid">{list.items.map((item) => { const kind = item._mediaType === "tv" ? "tv" : "movie"; return <article className="library-card" key={`${kind}:${item.id}`}><button className="poster-button" onClick={() => choose(item, kind)}><Poster item={item} className="library-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{kind === "tv" ? "TV show" : "Movie"} · {yearText(item)}</small></span></button>{renderPosterActions(item, kind)}<div className="library-card-actions"><button className="remove-chip" onClick={() => removeCollectionItem(list.id, item, kind)}>Remove from collection</button></div></article>; })}</div> : <p className="empty-state">Open a movie or TV show and use “Add to collection” to add it here.</p>}</section>; })()}
    </>}

    {showPlayer && selected && <section className="player-page">
      <section className="title-hero" style={{ backgroundImage: details?.backdrop_path ? `linear-gradient(90deg, #090a0f 12%, rgba(9,10,15,.82) 55%, rgba(9,10,15,.45)), url(${IMAGE}w1280${details.backdrop_path})` : undefined }}>
        <Poster item={details || selected} size="w342" className="detail-poster" />
        <div className="title-summary"><p className="eyebrow">{type === "movie" ? "MOVIE" : "TV SERIES"} · TMDB {selected.id}</p><h1>{mediaName(details || selected)}</h1>{!details && <p className="detail-loading-label" role="status">Loading full title details…</p>}<div className="meta-line"><span>★ {Number((details || selected).vote_average || 0).toFixed(1)}/10</span><span>{(details || selected).release_date || (details || selected).first_air_date || "Release date unknown"}</span>{details?.runtime && <span>{details.runtime} min</span>}{!details?.runtime && details?.episode_run_time?.[0] && <span>{details.episode_run_time[0]} min / episode</span>}{details?.number_of_seasons && <span>{details.number_of_seasons} seasons</span>}{details?.number_of_episodes && <span>{details.number_of_episodes} episodes</span>}</div><p>{details?.overview || selected.overview || "Loading title information…"}</p><div className="genre-row">{(details?.genres || []).map((g) => <span key={g.id}>{g.name}</span>)}</div><div className="title-actions"><button className="primary" onClick={() => playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>↓ Go to player</button>{trailer && <button onClick={() => setShowTrailer(true)}>▶ Trailer</button>}<button className={isFavorite(selected, type) ? "active" : ""} onClick={() => toggleFavorite(selected, type)}>{isFavorite(selected, type) ? "★ Favorited" : "☆ Favorite"}</button><button className={isInWatchlist(selected, type) ? "active" : ""} onClick={() => toggleWatchlist(selected, type)}>{isInWatchlist(selected, type) ? "✓ In Watchlist" : "+ Watchlist"}</button>{customCollections.length > 0 && <><select aria-label="Choose collection" value={collectionTarget} onChange={(e) => setCollectionTarget(e.target.value)}>{customCollections.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select><button onClick={() => addToCollection(selected, type, collectionTarget)}>Add to collection</button></>}<select aria-label="Watch status" value={statusFor(selected, type)} onChange={(e) => setItemStatus(selected, type, e.target.value)}><option value="planned">Planned</option><option value="watching">Watching</option><option value="completed">Completed</option></select></div></div>
      </section>

      <div className="playback-layout"><section className="playback-main"><div className="embedded-player" ref={playerSectionRef}><div className="embedded-player-heading"><strong>Player ready: {title}{type === "tv" ? ` · S${season} E${episode}` : ""}</strong></div><div className="player-frame"><iframe key={playerUrl} src={playerUrl} title={`VidNest player: ${title}`} allow="fullscreen; picture-in-picture; encrypted-media; remote-playback" allowFullScreen /></div></div>
        <div className="player-settings"><label htmlFor="server">VidNest server</label><select id="server" value={server} onChange={(e) => chooseServer(e.target.value)}>{SERVERS.map(([value, label]) => <option key={value} value={value}>{label}{value !== "auto" && subtitleSources[titleKey]?.includes(value) ? " · subtitles reported working" : ""}</option>)}</select><div className="source-tools"><button onClick={markSubtitleSource} disabled={server === "auto"}>{subtitleSources[titleKey]?.includes(server) ? "✓ Subtitles reported working" : "Mark subtitles as working"}</button><button onClick={() => trySubtitleSource(false)}>Try another source</button><button onClick={() => trySubtitleSource(true)} disabled={server === "auto"}>Source failed — switch</button><button onClick={resetFailedSources} disabled={!(sourceFailures[titleKey] || []).length}>Reset failed sources</button></div><p className="muted">Your chosen source is remembered for this title. Sources marked as failed are skipped during fallback until reset. Subtitle reports are saved locally; actual subtitle availability cannot be verified by this app.</p></div>
      </section>
      {type === "tv" && <section className="episode-selector"><div className="section-heading"><h2>Episode guide</h2><span className="muted">{episodesLoading ? "Loading…" : `${episodes.length} episodes`}</span></div><label htmlFor="season">Season</label><select id="season" value={season} onChange={(e) => { setPlaybackStarted(false); setSeason(e.target.value); }}>{seasons.map((s) => <option key={s.season_number} value={String(s.season_number)}>{s.name || `Season ${s.season_number}`} {s.episode_count != null ? `(${s.episode_count})` : ""}</option>)}</select><div className="episode-list">{episodes.map((ep) => { const watched = Boolean(watchedEpisodes[episodeKey(selected.id, season, ep.episode_number)]); const active = String(ep.episode_number) === episode; return <article className={`episode-item${active ? " active" : ""}${watched ? " watched" : ""}`} key={ep.id || ep.episode_number}><button className="episode-main" onClick={() => { setPlaybackStarted(false); setEpisode(String(ep.episode_number)); }}><span className="episode-still-wrap">{ep.still_path ? <img className="episode-still" src={`${IMAGE}w185${ep.still_path}`} alt="" loading="lazy" /> : <span className="episode-still episode-no-image">E{ep.episode_number}</span>}</span><span className="episode-info"><strong>E{String(ep.episode_number).padStart(2, "0")} · {ep.name || "Untitled episode"}</strong><small>{ep.air_date || "Air date unknown"}{ep.runtime ? ` · ${ep.runtime} min` : ""}{watched ? " · Watched" : ""}</small><span>{ep.overview || "No episode description available."}</span></span></button><button className={`small-icon watched-toggle${watched ? " active" : ""}`} title={watched ? "Mark unwatched" : "Mark watched"} onClick={() => setWatchedEpisodes((current) => ({ ...current, [episodeKey(selected.id, season, ep.episode_number)]: !current[episodeKey(selected.id, season, ep.episode_number)] }))}>{watched ? "✓" : "○"}</button></article>; })}</div><button className="primary next-episode" onClick={goNextEpisode} disabled={!episodes.length}>Mark watched & select next episode →</button></section>}
      </div>

      <section className="details-grid">
        <article className="info-panel"><h2>Cast & crew</h2><p className="muted cast-hint">Select a cast member to explore their other movies and TV shows.</p><div className="people-list">{credits.cast.slice(0, 10).map((person) => <button type="button" className={`person person-button${selectedCastMember?.id === person.id ? " selected" : ""}`} key={person.id} onClick={() => { setSelectedCastMember(person); }} aria-pressed={selectedCastMember?.id === person.id} title={`Explore titles featuring ${person.name}`}>{person.profile_path ? <img src={`${IMAGE}w185${person.profile_path}`} alt="" loading="lazy" decoding="async" /> : <div className="person-placeholder">?</div>}<span><strong>{person.name}</strong><small>{person.character || "Cast"}</small></span><span className="person-open-indicator" aria-hidden="true">›</span></button>)}{!credits.cast.length && <p className="muted">{details ? "Cast information is unavailable for this title." : "Loading cast and crew…"}</p>}</div><p className="muted">Director: {credits.crew.find((p) => p.job === "Director")?.name || credits.crew.find((p) => p.department === "Directing")?.name || "Not listed by TMDB"}</p></article>
        <article className="info-panel"><h2>Title information</h2><dl className="facts"><dt>Status</dt><dd>{details?.status || "—"}</dd><dt>Original title</dt><dd>{details?.original_title || details?.original_name || "—"}</dd><dt>Original language</dt><dd>{details?.original_language?.toUpperCase() || "—"}</dd><dt>Rating</dt><dd>{details?.vote_average ? `${Number(details.vote_average).toFixed(1)} / 10 (${details.vote_count || 0} votes)` : "—"}</dd><dt>Genres</dt><dd>{details?.genres?.map((g) => g.name).join(", ") || "—"}</dd><dt>Tagline</dt><dd>{details?.tagline || "—"}</dd></dl></article>
      </section>

      {selectedCastMember && <section className="discovery-section cast-filmography-section"><div className="section-heading cast-filmography-heading"><div><p className="eyebrow">CAST MEMBER</p><h2>More with {selectedCastMember.name}</h2><span className="muted">Movies and TV shows featuring this cast member · TMDB</span></div><button type="button" onClick={() => setSelectedCastMember(null)}>Close ×</button></div>{castFilmographyLoading ? <ShelfSkeleton count={6} /> : castFilmographyError ? <div className="empty-state" role="alert">{castFilmographyError}</div> : castFilmography.length ? <div className="discovery-track cast-filmography-track">{castFilmography.map((item) => { const itemType = item.media_type === "tv" ? "tv" : "movie"; return <article className="discovery-card" key={`${itemType}:${item.id}`}><button className="poster-button" onClick={() => choose(item, itemType)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{itemType === "tv" ? "TV show" : "Movie"} · {yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>{renderPosterActions(item, itemType)}</article>; })}</div> : <div className="empty-state">No movie or TV credits were found for {selectedCastMember.name}.</div>}</section>}

      {collection?.parts?.length > 0 && <section className="discovery-section"><div className="section-heading"><h2>{collection.name}</h2><span className="muted">Collection / franchise</span></div><div className="discovery-track">{[...collection.parts].sort((a, b) => (a.release_date || "").localeCompare(b.release_date || "")).map((item) => <article className="discovery-card" key={item.id}><button className="poster-button" onClick={() => choose(item, "movie")}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>{renderPosterActions(item, "movie")}</article>)}</div></section>}
      {recommendations.length > 0 && <section className="discovery-section"><div className="section-heading"><h2>Recommended for you</h2><span className="muted">TMDB recommendations</span></div><div className="discovery-track">{recommendations.map((item) => <article className="discovery-card" key={item.id}><button className="poster-button" onClick={() => choose(item, type)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>{renderPosterActions(item, type)}</article>)}</div></section>}
      {similar.length > 0 && <section className="discovery-section"><div className="section-heading"><h2>More like this</h2><span className="muted">Similar titles</span></div><div className="discovery-track">{similar.map((item) => <article className="discovery-card" key={item.id}><button className="poster-button" onClick={() => choose(item, type)}><Poster item={item} className="discovery-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{yearText(item)} · ★ {Number(item.vote_average || 0).toFixed(1)}</small></span></button>{renderPosterActions(item, type)}</article>)}</div></section>}
      {error && <p className="error">{error}</p>}
    </section>}

    {showTrailer && trailer && <div className="modal-backdrop" role="presentation" onClick={() => setShowTrailer(false)}><section className="trailer-modal" role="dialog" aria-modal="true" aria-label={`${title} trailer`} onClick={(e) => e.stopPropagation()}><div className="section-heading"><h2>{title} · Trailer</h2><button onClick={() => setShowTrailer(false)}>Close ×</button></div><div className="trailer-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div><p className="muted">{trailer.name || "Trailer"} · YouTube</p></section></div>}
  </main>;
}

function LibraryGrid({ title, items, empty, onOpen, onRemove, statuses, onStatus, renderActions }) {
  return <section className="discovery-section"><div className="section-heading"><h2>{title}</h2><span className="muted">{items.length} saved</span></div>{items.length ? <div className="library-grid">{items.map((item) => { const kind = item._mediaType === "tv" ? "tv" : "movie"; const key = `${kind}:${item.id}`; return <article className="library-card" key={key}><button className="poster-button" onClick={() => onOpen(item)}><Poster item={item} className="library-poster" /><span className="card-info"><strong>{mediaName(item)}</strong><small>{kind === "tv" ? "TV show" : "Movie"} · {yearText(item)}</small></span></button>{renderActions?.(item, kind)}<div className="library-card-actions">{onStatus && <select aria-label={`Status for ${mediaName(item)}`} value={statuses?.[key] || "planned"} onChange={(e) => onStatus(item, kind, e.target.value)}><option value="planned">Planned</option><option value="watching">Watching</option><option value="completed">Completed</option></select>}<button className="remove-chip" onClick={() => onRemove(item)}>Remove</button></div></article>; })}</div> : <div className="empty-state">{empty}</div>}</section>;
}
