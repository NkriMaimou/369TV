import React, { useMemo, useState } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import "./AnimeVideoPlayer.css";

function normalizeSubtitle(track, index) {
  if (typeof track === "string") return { src: track, label: `Subtitle ${index + 1}`, language: "und" };
  const src = track?.url || track?.src || track?.file || track?.sourceUrl || track?.source;
  if (typeof src !== "string" || !/^https?:\/\//i.test(src)) return null;
  return {
    src,
    label: track?.label || track?.language || track?.lang || `Subtitle ${index + 1}`,
    language: track?.languageCode || track?.srclang || track?.lang || track?.language || "und",
    default: Boolean(track?.default || track?.isDefault),
  };
}

export default function AnimeVideoPlayer({ source, title }) {
  const [playerError, setPlayerError] = useState("");
  const src = source?.sourceUrl;
  const isHls = Boolean(source?.isHLS || /\.m3u8(?:$|[?#])/i.test(src || ""));
  const subtitles = useMemo(
    () => (Array.isArray(source?.subtitles) ? source.subtitles.map(normalizeSubtitle).filter(Boolean) : []),
    [source?.subtitles],
  );

  if (!src) return null;

  const tracks = subtitles.map((track, index) => (
    <track key={track.src + index} kind="subtitles" src={track.src} srcLang={track.language} label={track.label} default={track.default || (index === 0 && subtitles.length === 1)} />
  ));

  return (
    <section className="anime-sdk-player" aria-label={title || "Anime video player"}>
      <div className="anime-sdk-player__heading">
        <span className="anime-sdk-player__eyebrow">NOW PLAYING</span>
        <strong>{title || "Anime episode"}</strong>
        <span className="anime-sdk-player__quality">{source?.quality || "Adaptive quality"}</span>
      </div>
      <div className="anime-sdk-player__frame">
        <VideoPlayer>
          <VideoSkin className="anime-sdk-player__skin">
            {isHls ? (
              <HlsJsVideo key={src} src={src} playsInline preload="metadata" crossOrigin="anonymous"
                onError={() => setPlayerError("This stream could not be played. The source may be offline or may block cross-origin playback.")}>
                {tracks}
              </HlsJsVideo>
            ) : (
              <Video key={src} src={src} playsInline preload="metadata" controls crossOrigin="anonymous"
                onError={() => setPlayerError("This stream could not be played by the browser.")}>
                {tracks}
              </Video>
            )}
          </VideoSkin>
        </VideoPlayer>
      </div>
      {playerError && <p className="anime-sdk-player__error" role="alert">{playerError}</p>}
      {Array.isArray(source?.subtitles) && source.subtitles.length > 0 && subtitles.length === 0 && (
        <p className="anime-sdk-player__note">The provider reported subtitle tracks but did not return direct subtitle URLs. Embedded HLS subtitles can still appear if present in the stream.</p>
      )}
    </section>
  );
}
