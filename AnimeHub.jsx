import React, { useEffect, useState } from "react";
import { getAnimeEpisodes, resolveAnimeStream, searchAnime } from "./animeApi.js";
import AnimeVideoPlayer from "./AnimeVideoPlayer.jsx";
import "./AnimeHub.css";

const PROVIDERS = [
  ["allmanga", "AllManga (sub/dub)"],
  ["animeparadise", "AnimeParadise (subtitles)"],
  ["anikoto", "Anikoto (sub/dub)"],
  ["megaplay", "MegaPlay"],
  ["gogoanime", "Gogoanime"],
];
const titleOf = (item) => item?.title?.english || item?.title?.romaji || item?.title || item?.name || item?.id || "Untitled";
const posterOf = (item) => item?.thumbnailUrl || item?.poster || item?.image || item?.coverImage?.large || item?.coverImage?.medium || "";

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

  useEffect(() => {
    setResults([]);
    setSelected(null);
    setEpisodes([]);
    setStream(null);
    setMessage("");
  }, [provider]);

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMessage("");
    setSelected(null);
    setEpisodes([]);
    setStream(null);
    try {
      const payload = await searchAnime(query.trim(), provider);
      const items = Array.isArray(payload) ? payload : payload?.results || payload?.items || [];
      setResults(items);
      if (!items.length) setMessage("No anime found. Try another title or provider.");
    } catch (error) {
      setMessage(error.message || "Anime search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseAnime(item) {
    setSelected(item);
    setEpisodes([]);
    setStream(null);
    setLoading(true);
    setMessage("");
    try {
      const payload = await getAnimeEpisodes(item.id, provider);
      const items = Array.isArray(payload) ? payload : payload?.units || payload?.episodes || payload?.results || [];
      setEpisodes(items);
      if (!items.length) setMessage("No episodes were returned for this title.");
    } catch (error) {
      setMessage(error.message || "Could not load episodes.");
    } finally {
      setLoading(false);
    }
  }

  async function playEpisode(item) {
    setLoading(true);
    setMessage("");
    setStream(null);
    try {
      const payload = await resolveAnimeStream(item.id, provider, language);
      setStream(payload);
      const video = payload?.type === "video" ? payload.streams?.[0] : payload?.streams?.[0];
      if (!video?.sourceUrl) setMessage("The provider did not return a playable video stream.");
    } catch (error) {
      setMessage(error.message || "Could not resolve this episode.");
    } finally {
      setLoading(false);
    }
  }

  const playableStream = stream?.type === "video" ? stream.streams?.[0] : stream?.streams?.[0];

  return (
    <section className="anime-hub" aria-labelledby="anime-hub-title">
      <header className="anime-hub-heading">
        <div>
          <p className="anime-hub-eyebrow">ANIME</p>
          <h2 id="anime-hub-title">Anime discovery</h2>
          <p>Search across multiple anime providers and select an episode to resolve playback.</p>
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
            <button className="anime-hub-card" key={item.id || index} onClick={() => chooseAnime(item)} type="button">
              {posterOf(item) ? <img src={posterOf(item)} alt="" loading="lazy" /> : <span className="anime-hub-poster-fallback">ANIME</span>}
              <strong>{titleOf(item)}</strong>
              {item.year && <small>{item.year}</small>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="anime-hub-detail">
          <button type="button" className="anime-hub-back" onClick={() => { setSelected(null); setEpisodes([]); setStream(null); }}>← Back to results</button>
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
          <div className="anime-hub-episodes">
            {episodes.map((episode, index) => (
              <button key={episode.id || index} type="button" onClick={() => playEpisode(episode)} disabled={loading}>
                <span>{episode.number ? `Episode ${episode.number}` : episode.title || `Episode ${index + 1}`}</span>
                <small>{episode.title && episode.number ? episode.title : "Play"}</small>
              </button>
            ))}
          </div>
          {loading && <p className="anime-hub-message" role="status">Resolving stream…</p>}
          {playableStream?.sourceUrl && (
            <AnimeVideoPlayer key={playableStream.sourceUrl} source={playableStream} title={`${titleOf(selected)} · ${playableStream.title || "Episode"}`} />
          )}
        </div>
      )}
    </section>
  );
}
