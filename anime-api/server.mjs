import {
  AnilistMeta,
  AnikotoProvider,
  AnimeParadiseProvider,
  AllmangaProvider,
  GogoanimeProvider,
  HttpClient,
  MegaPlayProvider,
  startServer,
} from "anime-sdk";

const port = Number.parseInt(process.env.PORT || "8788", 10);
const isProduction = process.env.NODE_ENV === "production";
const proxySecret = process.env.PROXY_SECRET;

if (isProduction && !proxySecret) {
  throw new Error("PROXY_SECRET must be set in production because the stream proxy is public-facing.");
}

const http = new HttpClient({ timeoutMs: 25_000 });
const providers = [
  new AllmangaProvider(http),
  new AnimeParadiseProvider(http),
  new GogoanimeProvider(http),
  new AnikotoProvider(http),
  new MegaPlayProvider(http),
];

const cacheStore = new Map();
const cache = {
  async get(key) {
    const entry = cacheStore.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      cacheStore.delete(key);
      return undefined;
    }
    return entry.value;
  },
  async set(key, value) {
    // Avoid caching stream URLs, which may be signed and short-lived.
    if (key.startsWith("stream:") || key.startsWith("tracks:")) return;
    cacheStore.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    if (cacheStore.size > 1000) {
      const oldestKey = cacheStore.keys().next().value;
      if (oldestKey) cacheStore.delete(oldestKey);
    }
  },
};

const server = startServer({
  providers,
  metaProviders: [new AnilistMeta(http)],
  port,
  proxy: true,
  ...(proxySecret ? { proxySignSecret: proxySecret } : {}),
                           ...(process.env.API_TOKEN ? { auth: { token: process.env.API_TOKEN } } : {}),
                           cache,
});

server.on("listening", () => {
  console.log(`369TV anime API listening on port ${port}`);
  console.log(`Providers: ${providers.map((provider) => provider.id).join(", ")}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
