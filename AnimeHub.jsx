import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AnimeHub.css";

const API_BASE = (import.meta.env.VITE_ANIME_API_URL || "http://localhost:8788").replace(/\/$/, "");
const PROVIDERS = [
  ["allmanga", "Allmanga"], ["animeparadise", "AnimeParadise"],
  ["gogoanime", "Gogoanime"], ["anikoto", "Anikoto"], ["megaplay", "MegaPlay"],
];

async function api(path, signal) {
  const response = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Anime API returned HTTP ${response.status}`);
  return response.json();
}
function listFrom(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}
function labelOf(item) {
  return item?.title || item?.name || item?.englishTitle || item?.romajiTitle || item?.id || "Untitled anime";
}
function imageOf(item) {
  return item?.poster || item?.image || item?.cover || item?.coverImage || item?.thumbnail || item?.posterUrl || "";
}
function idOf(item) {
  return item?.mediaId || item?.id || item?.urn || item?.media_id || "";
}
function episodeIdOf(item) {
  return item?.unitId || item?.episodeId || item?.id || item?.urn || item?.unit_id || "";
}
function findStreamUrl(payload) {
  const candidates = [
    payload?.url, payload?.src, payload?.file, payload?.streamUrl, payload?.stream_url,
    payload?.source?.url, payload?.source?.src, payload?.data?.url,
    ...(Array.isArray(payload?.sources) ? payload.sources.map((x) => x?.url || x?.src || x?.file) : []),
    ...(Array.isArray(payload?.streams) ? payload.streams.map((x) => x?.url || x?.src || x?.file) : []),
    ...(Array.isArray(payload?.data?.sources) ? payload.data.sources.map((x) => x?.url || x?.src || x?.file) : []),
  ];
  return candidates.find((x) => typeof x === "string" && /^https?:\/\//i.test(x)) || "";
}

function AnimeVideoPlayer({ stream, tracks, title, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const source = useMemo(() => findStreamUrl(stream), [stream]);
  const subtitleTracks = useMemo(() => {
    const raw = listFrom(tracks, ["tracks", "subtitles", "captions"]);
    return raw.filter((t) => t && (t.url || t.src || t.file)).map((t, i) => ({
      ...t, src: t.url || t.src || t.file, label: t.label || t.lang || t.language || `Subtitle ${i + 1}`,
    }));
  }, [tracks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return undefined;
    let disposed = false;
    let hls;
    const isHls = /\.m3u8(?:$|\?)/i.test(source);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    const attach = (Hls) => {
      if (disposed) return;
      if (isHls && Hls?.isSupported?.()) {
        hls = new Hls({ enableWorker: true, backBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(source);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data?.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        });
      } else if (!isHls || nativeHls) {
        video.src = source;
      } else {
        video.src = source;
      }
    };
    if (isHls && !nativeHls) {
      const Hls = window.Hls;
      if (Hls) attach(Hls);
      else {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.6.15/dist/hls.min.js";
        script.async = true;
        script.onload = () => attach(window.Hls);
        script.onerror = () => { if (!disposed) video.src = source; };
        document.head.appendChild(script);
      }
    } else attach(window.Hls);
    return () => {
      disposed = true;
      if (hls) hls.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [source]);

  return <section className="anime-video-panel" aria-label="Anime video player">
    <div className="anime-video-top"><div><span className="anime-eyebrow">369 NKRI TV · ANIME PLAYER</span><h2>{title || "Anime episode"}</h2></div><button type="button" className="anime-quiet-button" onClick={onClose}>Close player</button></div>
    {source ? <video ref={videoRef} className="anime-video" controls playsInline autoPlay crossOrigin="anonymous">
      {subtitleTracks.map((track, i) => <track key={track.src + i} kind="subtitles" src={track.src} srcLang={track.srclang || track.lang || "und"} label={track.label} default={Boolean(track.default)} />)}
    </video> : <div className="anime-player-error">The API did not return a playable stream URL for this episode.</div>}
    {subtitleTracks.length > 0 && <p className="anime-player-hint">Subtitles are available in the video player’s subtitle/CC menu.</p>}
    <p className="anime-player-hint">Playback depends on the selected provider and its current stream availability.</p>
  </section>;
}

export default function AnimeHub() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("allmanga");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodeBusy, setEpisodeBusy] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [stream, setStream] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [streamBusy, setStreamBusy] = useState(false);
  const [status, setStatus] = useState("");

  const search = useCallback(async (event) => {
    event?.preventDefault();
    const term = query.trim();
    if (!term) { setError("Enter an anime title to search."); return; }
    setBusy(true); setError(""); setSelected(null); setPlaying(null); setStream(null);
    try {
      const data = await api(`/search?q=${encodeURIComponent(term)}&provider=${encodeURIComponent(provider)}`);
      setResults(listFrom(data, ["results", "items", "animes", "media"]));
      if (!listFrom(data, ["results", "items", "animes", "media"]).length) setStatus("No titles were returned. Try another provider or title.");
      else setStatus("");
    } catch (e) { setError(`Could not search anime. ${e.message}. Check that the Anime API is running and VITE_ANIME_API_URL is configured.`); }
    finally { setBusy(false); }
  }, [query, provider]);

  const openAnime = useCallback(async (item) => {
    const mediaId = idOf(item);
    if (!mediaId) { setError("This result has no media ID, so its episodes cannot be loaded."); return; }
    setSelected(item); setEpisodes([]); setPlaying(null); setStream(null); setError(""); setEpisodeBusy(true);
    try {
      const data = await api(`/content?mediaId=${encodeURIComponent(mediaId)}&provider=${encodeURIComponent(item.provider || provider)}`);
      setEpisodes(listFrom(data, ["episodes", "units", "results", "items", "content"]));
      if (!listFrom(data, ["episodes", "units", "results", "items", "content"]).length) setStatus("The provider returned no episodes for this title.");
      else setStatus("");
    } catch (e) { setError(`Could not load episodes: ${e.message}`); }
    finally { setEpisodeBusy(false); }
  }, [provider]);

  const playEpisode = useCallback(async (episode) => {
    const unitId = episodeIdOf(episode);
    if (!unitId) { setError("This episode has no unit ID."); return; }
    setPlaying(episode); setStream(null); setTracks(null); setStreamBusy(true); setError("");
    try {
      const p = episode.provider || selected?.provider || provider;
      const [streamResult, trackResult] = await Promise.all([
        api(`/stream?unitId=${encodeURIComponent(unitId)}&provider=${encodeURIComponent(p)}`),
        api(`/tracks?unitId=${encodeURIComponent(unitId)}&provider=${encodeURIComponent(p)}`).catch(() => null),
      ]);
      setStream(streamResult); setTracks(trackResult);
      if (!findStreamUrl(streamResult)) setError("The provider response did not include a recognizable stream URL.");
    } catch (e) { setError(`Could not load this episode: ${e.message}`); }
    finally { setStreamBusy(false); }
  }, [provider, selected]);

  return <main className="anime-hub">
    <header className="anime-hub-heading"><div><span className="anime-eyebrow">369 NKRI TV</span><h1>Anime</h1><p>Search anime, browse episodes, and play streams through the Anime SDK.</p></div><span className="anime-sdk-pill">Anime SDK</span></header>
    <form className="anime-search-form" onSubmit={search}>
      <label className="anime-search-field"><span className="sr-only">Search anime</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anime titles…" /></label>
      <select aria-label="Anime provider" value={provider} onChange={(e) => setProvider(e.target.value)}>{PROVIDERS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <button type="submit" disabled={busy}>{busy ? "Searching…" : "Search"}</button>
    </form>
    {error && <div className="anime-alert" role="alert">{error}</div>}
    {status && !error && <p className="anime-status">{status}</p>}
    {playing && <div className="anime-player-wrap">{streamBusy ? <div className="anime-loading">Resolving episode stream…</div> : stream ? <AnimeVideoPlayer stream={stream} tracks={tracks} title={`${labelOf(selected)} · ${labelOf(playing)}`} onClose={() => { setPlaying(null); setStream(null); }} /> : null}</div>}
    {selected && <section className="anime-episodes">
      <div className="anime-section-heading"><div><span className="anime-eyebrow">SELECTED TITLE</span><h2>{labelOf(selected)}</h2></div><button type="button" className="anime-quiet-button" onClick={() => { setSelected(null); setEpisodes([]); setPlaying(null); setStream(null); }}>Back to results</button></div>
      {episodeBusy ? <p className="anime-loading">Loading episodes…</p> : episodes.length ? <div className="anime-episode-list">{episodes.map((ep, i) => <button type="button" className={playing && episodeIdOf(playing) === episodeIdOf(ep) ? "anime-episode active" : "anime-episode"} key={episodeIdOf(ep) || i} onClick={() => playEpisode(ep)}><span className="anime-episode-number">{String(i + 1).padStart(2, "0")}</span><span>{labelOf(ep) === episodeIdOf(ep) ? `Episode ${ep.number || i + 1}` : labelOf(ep)}</span><span className="anime-episode-play">▶</span></button>)}</div> : <p className="anime-status">Choose a title to load its episodes.</p>}
    </section>}
    {!selected && results.length > 0 && <section className="anime-results"><div className="anime-section-heading"><div><span className="anime-eyebrow">SEARCH RESULTS</span><h2>{results.length} title{results.length === 1 ? "" : "s"}</h2></div></div><div className="anime-card-grid">{results.map((item, i) => <button type="button" className="anime-card" key={idOf(item) || i} onClick={() => openAnime(item)}><div className="anime-card-poster">{imageOf(item) ? <img src={imageOf(item)} alt="" loading="lazy" /> : <div className="anime-poster-placeholder">369<br />ANIME</div>}</div><span className="anime-card-title">{labelOf(item)}</span><span className="anime-card-meta">{item.year || item.releaseDate || item.type || "Anime"}</span></button>)}</div></section>}
    {!selected && results.length === 0 && !busy && !error && <section className="anime-empty"><span className="anime-empty-icon">アニメ</span><h2>Find your next anime</h2><p>Search by title to see available providers and episodes.</p></section>}
  </main>;
}
