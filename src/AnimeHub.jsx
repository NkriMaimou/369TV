import React, { useEffect, useRef, useState } from "react";
import { getAnimeEpisodes, getAnimeTracks, resolveAnimeStream, searchAnime } from "./animeApi.js";
import "./AnimeHub.css";

const PROVIDERS = [
  ["allmanga", "AllManga (sub/dub)"],
  ["animeparadise", "AnimeParadise (subtitles)"],
  ["anikoto", "Anikoto (sub/dub)"],
  ["megaplay", "MegaPlay"],
  ["gogoanime", "Gogoanime"],
];

const titleOf = (item) => {
  const title = item?.title;
  return (typeof title === "string" ? title : title?.english || title?.romaji || item?.englishTitle || item?.romajiTitle || item?.name || item?.id || "Untitled");
};
const posterOf = (item) => item?.thumbnailUrl || item?.poster || item?.image || item?.coverImage?.large || item?.coverImage?.medium || item?.cover || "";
const mediaIdOf = (item) => item?.mediaId || item?.media_id || item?.urn || item?.id || "";
const unitIdOf = (item) => item?.unitId || item?.unit_id || item?.episodeId || item?.urn || item?.id || "";

function AnimeVideo({ stream, title }) {
  const videoRef = useRef(null);
  const source = stream?.sourceUrl || stream?.url || stream?.src || stream?.file || "";
  const isHls = Boolean(stream?.isHLS || /\.m3u8(?:$|\?)/i.test(source));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return undefined;
    let hls;
    let disposed = false;
    const attach = (HlsCtor) => {
      if (disposed) return;
      if (isHls && HlsCtor?.isSupported?.()) {
        hls = new HlsCtor({ enableWorker: true, xhrSetup: (xhr) => { xhr.withCredentials = false; } });
        hls.on(HlsCtor.Events.ERROR, (_event, data) => {
          if (data?.fatal) video.dispatchEvent(new CustomEvent("anime-stream-error", { detail: data.type || data.details }));
        });
        hls.loadSource(source);
        hls.attachMedia(video);
      } else {
        video.src = source;
      }
    };
    if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
      if (window.Hls) attach(window.Hls);
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
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [source, isHls]);

  const subtitles = Array.isArray(stream?.subtitles) ? stream.subtitles : [];
  return <div className="anime-hub-player">
    <video key={source} ref={videoRef} controls playsInline preload="metadata" crossOrigin="anonymous" aria-label={title || "Anime episode"}>
      {subtitles.map((track, index) => {
        const url = track?.url || track?.sourceUrl || track?.src;
        if (!url) return null;
        return <track key={url + index} kind="subtitles" src={url} srcLang={track.language || track.lang || "und"} label={track.label || track.language || track.lang || `Subtitle ${index + 1}`} default={Boolean(track.default)} />;
      })}
    </video>
    {stream?.quality && <small>Quality: {stream.quality}</small>}
    {subtitles.length > 0 && <p>Subtitle tracks are available in the CC menu when supported by the source.</p>}
    <p className="anime-hub-player-note">If playback fails, try another provider or episode; third-party streams can expire or be blocked by their host.</p>
  </div>;
}

export default function AnimeHub() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("allmanga");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState("sub");
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    setResults([]);
    setSelected(null);
    setEpisodes([]);
    setStream(null);
    setPlayerError("");
    setMessage("");
  }, [provider]);

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMessage("");
    setResults([]);
    setSelected(null);
    setEpisodes([]);
    setStream(null);
    try {
      const payload = await searchAnime(query.trim(), provider);
      const items = Array.isArray(payload) ? payload : payload?.results || payload?.items || payload?.animes || payload?.media || payload?.data || [];
      setResults(items);
      if (!items.length) setMessage("No anime found. Try another title or provider.");
    } catch (error) {
      const localApi = /localhost:8788/.test(error?.message || "");
      setMessage(`Anime search failed: ${error.message || "unknown API error"}.${localApi ? " If this is a hosted test website, its VITE_ANIME_API_URL must point to a publicly reachable Anime API URL; localhost points to the visitor's own computer." : " Check that the Anime API is running and reachable from this website."}`);
    } finally {
      setLoading(false);
    }
  }

  async function chooseAnime(item) {
    const mediaId = mediaIdOf(item);
    if (!mediaId) {
      setMessage("This result has no media ID. Try another provider.");
      return;
    }
    setSelected(item);
    setEpisodes([]);
    setStream(null);
    setLoading(true);
    setMessage("");
    try {
      const payload = await getAnimeEpisodes(mediaId, item.provider || provider);
      const items = Array.isArray(payload) ? payload : payload?.units || payload?.episodes || payload?.results || payload?.items || payload?.content || payload?.data || [];
      setEpisodes(items);
      if (!items.length) setMessage("No episodes were returned for this title by this provider.");
    } catch (error) {
      setMessage(error.message || "Could not load episodes.");
    } finally {
      setLoading(false);
    }
  }

  async function playEpisode(item) {
    const unitId = unitIdOf(item);
    if (!unitId) {
      setMessage("This episode has no unit ID. Go back and try another title/provider.");
      return;
    }
    setLoading(true);
    setMessage("");
    setStream(null);
    setPlayerError("");
    try {
      const [payload, tracksPayload] = await Promise.all([
        resolveAnimeStream(unitId, item.provider || selected?.provider || provider, language),
        getAnimeTracks(unitId, item.provider || selected?.provider || provider, language).catch(() => null),
      ]);
      const video = payload?.type === "video" ? payload?.streams?.[0] : payload?.streams?.[0];
      const fallback = payload?.sourceUrl || payload?.url || payload?.src || payload?.streamUrl;
      const resolved = video || (fallback ? { sourceUrl: fallback, isHLS: /\.m3u8(?:$|\?)/i.test(fallback) } : null);
      if (!resolved?.sourceUrl && !resolved?.url && !resolved?.src) {
        setMessage("The provider did not return a playable stream URL. Try another provider or episode.");
      } else {
        const tracks = Array.isArray(tracksPayload) ? tracksPayload : tracksPayload?.tracks || tracksPayload?.subtitles || tracksPayload?.captions || [];
        setStream({ ...resolved, sourceUrl: resolved.sourceUrl || resolved.url || resolved.src || resolved.file, isHLS: resolved.isHLS ?? resolved.type === "hls" ?? /\\.m3u8(?:$|\\?)/i.test(resolved.sourceUrl || resolved.url || resolved.src || resolved.file || ""), subtitles: resolved.subtitles || tracks });
      }
    } catch (error) {
      setMessage(error.message || "Could not resolve this episode.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="anime-hub" aria-labelledby="anime-hub-title">
      <header className="anime-hub-heading">
        <div>
          <p className="anime-hub-eyebrow">369 NKRI TV · ANIME SDK</p>
          <h2 id="anime-hub-title">Anime discovery</h2>
          <p>Search anime, browse episodes, and play streams from supported providers.</p>
        </div>
        <label className="anime-hub-provider">
          <span>Source</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            {PROVIDERS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
        </label>
      </header>

      <form className="anime-hub-search" onSubmit={handleSearch}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anime…" aria-label="Search anime" />
        <button type="submit" disabled={loading || !query.trim()}>{loading ? "Loading…" : "Search"}</button>
      </form>

      {message && <p className="anime-hub-message" role="status">{message}</p>}

      {results.length > 0 && !selected && (
        <div className="anime-hub-results">
          {results.map((item, index) => (
            <button className="anime-hub-card" key={mediaIdOf(item) || index} onClick={() => chooseAnime(item)} type="button" disabled={loading}>
              {posterOf(item) ? <img src={posterOf(item)} alt="" loading="lazy" /> : <span className="anime-hub-poster-fallback">ANIME</span>}
              <strong>{titleOf(item)}</strong>
              {(item.year || item.releaseYear) && <small>{item.year || item.releaseYear}</small>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="anime-hub-detail">
          <button type="button" className="anime-hub-back" onClick={() => { setSelected(null); setEpisodes([]); setStream(null); setMessage(""); }}>← Back to results</button>
          <h3>{titleOf(selected)}</h3>
          <div className="anime-hub-episode-tools">
            <label>Audio
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="sub">Sub</option>
                <option value="dub">Dub</option>
                <option value="raw">Raw</option>
              </select>
            </label>
          </div>
          {loading && <p className="anime-hub-message" role="status">Loading…</p>}
          <div className="anime-hub-episodes" role="region" aria-label="Anime episodes" tabIndex={0}>
            {episodes.map((episode, index) => (
              <button key={unitIdOf(episode) || index} type="button" onClick={() => playEpisode(episode)} disabled={loading}>
                <span>{episode.number ? `Episode ${episode.number}` : episode.title || `Episode ${index + 1}`}</span>
                <small>{episode.title && episode.number ? episode.title : "Play"}</small>
              </button>
            ))}
          </div>
          {stream && <AnimeVideo stream={stream} title={titleOf(selected)} />}
          {playerError && <p className="anime-hub-message" role="alert">Playback error: {playerError}. This provider may require its stream proxy or may be blocking browser playback. Try another provider.</p>}
        </div>
      )}
    </section>
  );
}
