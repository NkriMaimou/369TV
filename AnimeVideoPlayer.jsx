import React, { useEffect, useMemo, useRef, useState } from "react";

const HLS_CDN = "https://cdn.jsdelivr.net/npm/hls.js@1.6.15/dist/hls.min.js";
let hlsLoader;

function loadHls() {
  if (typeof window === "undefined") return Promise.reject(new Error("Video playback is unavailable."));
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsLoader) {
    hlsLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-anime-hlsjs="true"]');
      const script = existing || document.createElement("script");
      const cleanup = () => {
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };
      const onLoad = () => {
        cleanup();
        if (window.Hls) resolve(window.Hls);
        else reject(new Error("The HLS playback engine loaded incorrectly."));
      };
      const onError = () => {
        cleanup();
        hlsLoader = null;
        reject(new Error("Could not load the HLS playback engine. Check your connection and try again."));
      };
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (!existing) {
        script.src = HLS_CDN;
        script.async = true;
        script.dataset.animeHlsjs = "true";
        document.head.appendChild(script);
      } else if (script.dataset.loaded === "true" && window.Hls) {
        cleanup();
        resolve(window.Hls);
      }
    });
  }
  return hlsLoader;
}

function subtitleSource(track) {
  if (typeof track === "string") return track;
  return track?.url || track?.src || track?.file || track?.sourceUrl || track?.source || track?.uri || "";
}

function normalizeSubtitle(track, index) {
  const src = subtitleSource(track);
  if (typeof src !== "string" || !/^https?:\/\//i.test(src)) return null;
  const lang = typeof track === "object" && track
    ? track.languageCode || track.srclang || track.lang || track.language || "und"
    : "und";
  return {
    src,
    lang: String(lang),
    label: typeof track === "object" && track
      ? String(track.label || track.language || track.lang || `Subtitle ${index + 1}`)
      : `Subtitle ${index + 1}`,
    default: Boolean(track?.default || track?.isDefault),
  };
}

export default function AnimeVideoPlayer({ source, title }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Preparing stream…");
  const src = source?.sourceUrl || source?.url || source?.src || source?.file || source?.streamUrl || source?.manifestUrl || "";
  const isHls = Boolean(source?.isHLS || source?.isHls || String(source?.type || "").toLowerCase() === "hls" ||
    /mpegurl/i.test(source?.mimeType || "") || /\.m3u8(?:$|[?#])/i.test(src));
  const subtitles = useMemo(() => {
    const tracks = source?.subtitles || source?.tracks || source?.captions || [];
    return Array.isArray(tracks) ? tracks.map(normalizeSubtitle).filter(Boolean) : [];
  }, [source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;
    let cancelled = false;
    setError("");
    setStatus("Preparing stream…");
    video.pause();
    video.removeAttribute("src");
    video.load();

    const onVideoError = () => {
      if (!cancelled && video.error) {
        const codes = {
          1: "Playback was interrupted.",
          2: "A network error stopped the stream. The source may be offline or blocking playback.",
          3: "The browser could not decode this video stream.",
          4: "This video format or source is not supported by the browser.",
        };
        setError(codes[video.error.code] || "The video could not be played.");
        setStatus("");
      }
    };
    const onLoaded = () => {
      if (!cancelled) { setError(""); setStatus(""); }
    };
    const onPlaying = () => { if (!cancelled) { setError(""); setStatus(""); } };
    video.addEventListener("error", onVideoError);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("playing", onPlaying);

    async function attach() {
      try {
        if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          video.load();
          return;
        }
        if (isHls) {
          const Hls = await loadHls();
          if (cancelled) return;
          if (!Hls.isSupported()) throw new Error("This browser does not support HLS playback.");
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 });
          hlsRef.current = hls;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (cancelled || !data?.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setError("The HLS stream could not be loaded. The source may be offline or may block cross-origin requests.");
              setStatus("");
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              setStatus("Recovering video decoder…");
              hls.recoverMediaError();
            } else {
              setError(data.details ? `HLS playback failed: ${String(data.details).replaceAll("_", " ")}.` : "HLS playback failed.");
              setStatus("");
              hls.destroy();
              hlsRef.current = null;
            }
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) setStatus("");
          });
        } else {
          video.src = src;
          video.load();
        }
      } catch (e) {
        if (!cancelled) { setError(e?.message || "Could not start video playback."); setStatus(""); }
      }
    }
    attach();

    return () => {
      cancelled = true;
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("playing", onPlaying);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, isHls]);

  if (!src) return <p className="anime-hub-message" role="status">The provider did not return a playable video URL.</p>;

  return (
    <div className="anime-hub-player anime-sdk-player">
      {title && <strong className="anime-sdk-player-title">{title}</strong>}
      {source?.quality && <small className="anime-sdk-player-quality">Quality: {source.quality}</small>}
      <video ref={videoRef} controls playsInline preload="metadata" crossOrigin="anonymous" aria-label={title || "Anime episode player"}>
        {subtitles.map((track, index) => (
          <track key={track.src + index} kind="subtitles" src={track.src} srcLang={track.lang} label={track.label}
            default={track.default || (index === 0 && subtitles.length === 1)} />
        ))}
      </video>
      {status && <p className="anime-sdk-player-status" role="status">{status}</p>}
      {error && <p className="anime-sdk-player-error" role="alert">{error}</p>}
      {source?.subtitles?.length > 0 && subtitles.length === 0 &&
        <p className="anime-sdk-player-note">Subtitle tracks were reported, but the provider did not supply direct subtitle URLs the browser can load.</p>}
    </div>
  );
}
