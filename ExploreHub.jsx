import React, { useEffect, useMemo, useState } from "react";

const LANGUAGES = [
  ["en", "English"], ["nl", "Dutch"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Chinese"],
  ["fr", "French"], ["de", "German"], ["es", "Spanish"], ["it", "Italian"], ["pt", "Portuguese"],
  ["hi", "Hindi"], ["ru", "Russian"], ["sv", "Swedish"], ["da", "Danish"], ["no", "Norwegian"],
  ["tr", "Turkish"], ["th", "Thai"], ["ar", "Arabic"], ["pl", "Polish"], ["id", "Indonesian"],
];
const COUNTRIES = [
  ["US", "United States"], ["NL", "Netherlands"], ["GB", "United Kingdom"], ["JP", "Japan"],
  ["KR", "South Korea"], ["IN", "India"], ["FR", "France"], ["DE", "Germany"], ["ES", "Spain"],
  ["IT", "Italy"], ["CA", "Canada"], ["AU", "Australia"], ["CN", "China"], ["TW", "Taiwan"],
  ["TH", "Thailand"], ["SE", "Sweden"], ["DK", "Denmark"], ["BR", "Brazil"], ["MX", "Mexico"],
];
const NETWORKS = [
  [213, "Netflix"], [1024, "Amazon"], [49, "HBO"], [453, "Hulu"], [2552, "Apple TV+"],
  [2739, "Disney+"], [3186, "Paramount+"], [6, "NBC"], [2, "ABC"], [16, "CBS"],
  [19, "FOX"], [71, "The CW"], [4, "BBC One"], [56, "Cartoon Network"], [174, "AMC"],
];
const MEDIA_TABS = [
  ["people", "People & crew"], ["companies", "Companies & networks"], ["keywords", "Keywords"],
  ["international", "International"], ["franchises", "Franchises"], ["artwork", "Artwork"],
];
const titleOf = (x) => x?.title || x?.name || x?.original_title || x?.original_name || "Untitled";
const yearOf = (x) => (x?.release_date || x?.first_air_date || "").slice(0, 4);
const imageUrl = (path, size = "w342") => path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
const uniqueMedia = (items) => {
  const seen = new Set();
  return (items || []).filter((x) => x?.id && ["movie", "tv"].includes(x.media_type) && !x.adult && !seen.has(`${x.media_type}:${x.id}`) && seen.add(`${x.media_type}:${x.id}`));
};

export default function ExploreHub({ tmdbFetch, choose, selected, type, initialPerson, onClearInitialPerson }) {
  const [tab, setTab] = useState("people");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [person, setPerson] = useState(null);
  const [personCredits, setPersonCredits] = useState([]);
  const [entity, setEntity] = useState(null);
  const [entityTitles, setEntityTitles] = useState([]);
  const [language, setLanguage] = useState("en");
  const [country, setCountry] = useState("US");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [mediaKind, setMediaKind] = useState("movie");
  const [sort, setSort] = useState("popularity.desc");
  const [rating, setRating] = useState("0");
  const [minVotes, setMinVotes] = useState("100");
  const [keyword, setKeyword] = useState(null);
  const [collection, setCollection] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [artLanguage, setArtLanguage] = useState("en,null");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!initialPerson?.id) return;
    setTab("people");
    openPerson(initialPerson);
    setEntity(null);
    setResults([]);
    setQuery(initialPerson.name || "");
    onClearInitialPerson?.();
  }, [initialPerson?.id]);

  useEffect(() => {
    if (tab !== "artwork" || !selected?.id) { setArtwork(null); return; }
    let live = true;
    (async () => {
      setLoading(true); setError("");
      try {
        const data = await tmdbFetch(`/${type === "tv" ? "tv" : "movie"}/${selected.id}/images?include_image_language=${encodeURIComponent(artLanguage)}`);
        if (live) setArtwork(data || {});
      } catch (e) { if (live) setError(e.message || "Could not load artwork."); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [tab, selected?.id, type, artLanguage, tmdbFetch]);

  async function runSearch(event) {
    event?.preventDefault();
    const q = query.trim();
    if (!q) { setError("Enter a search term first."); return; }
    setLoading(true); setError(""); setResults([]); setPerson(null); setEntity(null); setKeyword(null); setCollection(null); setEntityTitles([]);
    try {
      let endpoint = "/search/person";
      if (tab === "companies") endpoint = "/search/company";
      if (tab === "keywords") endpoint = "/search/keyword";
      if (tab === "franchises") endpoint = "/search/collection";
      const data = await tmdbFetch(`${endpoint}?query=${encodeURIComponent(q)}&page=1&include_adult=false`);
      setResults(data?.results || []);
      if (!data?.results?.length) setError("No matches found.");
    } catch (e) { setError(e.message || "Search failed."); }
    finally { setLoading(false); }
  }

  async function openPerson(item) {
    setLoading(true); setError(""); setPerson(item); setEntity(null); setResults([]);
    try {
      const [details, credits] = await Promise.all([
        tmdbFetch(`/person/${item.id}?language=en-US`),
        tmdbFetch(`/person/${item.id}/combined_credits?language=en-US`),
      ]);
      setPerson(details || item);
      const cast = (credits?.cast || []).map((x) => ({ ...x, media_type: x.media_type || (x.title ? "movie" : "tv"), _creditType: "Cast" }));
      const crew = (credits?.crew || []).map((x) => ({ ...x, media_type: x.media_type || (x.title ? "movie" : "tv"), _creditType: x.job || x.department || "Crew" }));
      setPersonCredits(uniqueMedia([...cast, ...crew]).sort((a,b) => Number(b.popularity || 0) - Number(a.popularity || 0)));
    } catch (e) { setError(e.message || "Could not load this person's credits."); }
    finally { setLoading(false); }
  }

  async function openCompany(item, isNetwork = false) {
    setLoading(true); setError(""); setEntity({ ...item, _entityType: isNetwork ? "network" : "company" }); setResults([]); setPerson(null); setEntityTitles([]);
    try {
      const [details, movies, shows] = await Promise.all([
        tmdbFetch(`/${isNetwork ? "network" : "company"}/${item.id}`).catch(() => item),
        tmdbFetch(`/discover/movie?with_companies=${item.id}&sort_by=popularity.desc&include_adult=false&page=1`).catch(() => ({results:[]})),
        tmdbFetch(`/discover/tv?${isNetwork ? "with_networks" : "with_companies"}=${item.id}&sort_by=popularity.desc&include_adult=false&page=1`).catch(() => ({results:[]})),
      ]);
      setEntity({ ...item, ...details, _entityType: isNetwork ? "network" : "company" });
      const all = [
        ...(movies?.results || []).map((x) => ({ ...x, media_type: "movie" })),
        ...(shows?.results || []).map((x) => ({ ...x, media_type: "tv" })),
      ].sort((a,b) => Number(b.popularity || 0) - Number(a.popularity || 0));
      setEntityTitles(uniqueMedia(all));
    } catch (e) { setError(e.message || "Could not load company titles."); }
    finally { setLoading(false); }
  }

  async function openKeyword(item) {
    setKeyword(item); setResults([]); setLoading(true); setError(""); setEntityTitles([]);
    try {
      const [movies, shows] = await Promise.all([
        tmdbFetch(`/discover/movie?with_keywords=${item.id}&sort_by=popularity.desc&include_adult=false&page=1`),
        tmdbFetch(`/discover/tv?with_keywords=${item.id}&sort_by=popularity.desc&include_adult=false&page=1`),
      ]);
      setEntityTitles(uniqueMedia([
        ...(movies?.results || []).map((x) => ({ ...x, media_type: "movie" })),
        ...(shows?.results || []).map((x) => ({ ...x, media_type: "tv" })),
      ]).sort((a,b) => Number(b.popularity || 0) - Number(a.popularity || 0)));
    } catch (e) { setError(e.message || "Could not load titles for this keyword."); }
    finally { setLoading(false); }
  }

  async function openCollection(item) {
    setCollection(item); setResults([]); setLoading(true); setError("");
    try { setCollection(await tmdbFetch(`/collection/${item.id}?language=en-US`)); }
    catch (e) { setError(e.message || "Could not load this franchise."); }
    finally { setLoading(false); }
  }

  async function discover(event) {
    event?.preventDefault();
    setLoading(true); setError(""); setEntityTitles([]); setPage(1);
    try {
      const params = new URLSearchParams({ include_adult:"false", sort_by:sort, page:"1", with_original_language:language, with_origin_country:country, watch_region:country, "vote_average.gte":rating, "vote_count.gte":minVotes });
      if (year.trim()) params.set(mediaKind === "movie" ? "primary_release_year" : "first_air_date_year", year.trim());
      if (genre) params.set("with_genres", genre);
      const data = await tmdbFetch(`/discover/${mediaKind}?${params.toString()}`);
      setEntityTitles((data?.results || []).map((x) => ({ ...x, media_type: mediaKind })));
      if (!data?.results?.length) setError("No titles match these filters.");
    } catch (e) { setError(e.message || "Discovery failed."); }
    finally { setLoading(false); }
  }

  async function loadMoreDiscover() {
    const next = page + 1; setLoading(true);
    try {
      const params = new URLSearchParams({ include_adult:"false", sort_by:sort, page:String(next), with_original_language:language, with_origin_country:country, watch_region:country, "vote_average.gte":rating, "vote_count.gte":minVotes });
      if (year.trim()) params.set(mediaKind === "movie" ? "primary_release_year" : "first_air_date_year", year.trim());
      if (genre) params.set("with_genres", genre);
      const data = await tmdbFetch(`/discover/${mediaKind}?${params.toString()}`);
      setEntityTitles((current) => [...current, ...(data?.results || []).map((x) => ({ ...x, media_type: mediaKind }))]);
      setPage(next);
    } catch (e) { setError(e.message || "Could not load more titles."); }
    finally { setLoading(false); }
  }

  const cards = useMemo(() => uniqueMedia(entityTitles), [entityTitles]);
  const renderMedia = (items) => items?.length ? <div className="explore-media-grid">{items.map((item) => {
    const kind = item.media_type === "tv" ? "tv" : "movie";
    return <button type="button" className="explore-media-card" key={`${kind}:${item.id}`} onClick={() => choose(item, kind)}>
      {imageUrl(item.poster_path) ? <img src={imageUrl(item.poster_path)} alt="" loading="lazy" /> : <span className="explore-poster-fallback">No poster</span>}
      <span className="explore-media-title">{titleOf(item)}</span><small>{yearOf(item) || "Year unknown"} · ★ {Number(item.vote_average || 0).toFixed(1)}</small>
      {item._creditType && <small>{item._creditType}</small>}
    </button>;
  })}</div> : <p className="empty-state">No titles to show yet.</p>;

  const renderResults = () => {
    if (!results.length) return null;
    return <div className="explore-result-list">{results.map((item) => <button type="button" className="explore-result" key={item.id} onClick={() => {
      if (tab === "people") openPerson(item);
      else if (tab === "companies") openCompany(item, false);
      else if (tab === "keywords") openKeyword(item);
      else if (tab === "franchises") openCollection(item);
    }}>
      {item.profile_path || item.logo_path || item.poster_path ? <img src={imageUrl(item.profile_path || item.logo_path || item.poster_path, "w185")} alt="" loading="lazy" /> : <span className="explore-result-placeholder">TMDB</span>}
      <span><strong>{titleOf(item)}</strong><small>{item.known_for_department || item.origin_country?.join(", ") || item.original_language?.toUpperCase() || item.id}</small></span><span aria-hidden="true">›</span>
    </button>)}</div>;
  };

  return <section className="explore-hub discovery-section">
    <div className="explore-heading"><div><p className="eyebrow">TMDB DISCOVERY</p><h1>Explore more</h1><p className="muted">People, production companies, networks, themes, international cinema, franchises and artwork.</p></div></div>
    <div className="explore-tabs" role="tablist" aria-label="Explore categories">{MEDIA_TABS.map(([key,label]) => <button type="button" role="tab" aria-selected={tab===key} className={tab===key?"active":""} key={key} onClick={() => { setTab(key); setResults([]); setError(""); setPerson(null); setEntity(null); setKeyword(null); setCollection(null); setEntityTitles([]); }}>{label}</button>)}</div>
    {["people","companies","keywords","franchises"].includes(tab) && <form className="explore-search" onSubmit={runSearch}><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={tab==="people"?"Search actors, directors, writers…":tab==="companies"?"Search studios and production companies…":tab==="keywords"?"Search themes: zombies, time travel, cyberpunk…":"Search a movie franchise or collection…"} aria-label="Explore search" /><button className="primary" disabled={loading}>{loading?"Loading…":"Search TMDB"}</button></form>}
    {tab==="companies" && <div className="explore-network-shortcuts"><span>Popular TV networks</span>{NETWORKS.map(([id,name])=><button type="button" key={id} onClick={()=>openCompany({id,name},true)}>{name}</button>)}</div>}
    {tab==="international" && <form className="explore-filter-form" onSubmit={discover}>
      <label>Media type<select value={mediaKind} onChange={e=>setMediaKind(e.target.value)}><option value="movie">Movies</option><option value="tv">TV shows</option></select></label>
      <label>Original language<select value={language} onChange={e=>setLanguage(e.target.value)}>{LANGUAGES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      <label>Country / region<select value={country} onChange={e=>setCountry(e.target.value)}>{COUNTRIES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      <label>Genre ID<input value={genre} onChange={e=>setGenre(e.target.value.replace(/[^0-9]/g,""))} placeholder="Optional, e.g. 27 = horror" inputMode="numeric" /></label>
      <label>Year<input value={year} onChange={e=>setYear(e.target.value.replace(/[^0-9]/g,"").slice(0,4))} placeholder="Any year" inputMode="numeric" /></label>
      <label>Minimum rating<select value={rating} onChange={e=>setRating(e.target.value)}>{["0","5","6","7","8"].map(v=><option key={v} value={v}>{v==="0"?"Any rating":`${v} / 10+`}</option>)}</select></label>
      <label>Minimum votes<select value={minVotes} onChange={e=>setMinVotes(e.target.value)}>{[["0","Any"],["50","50+"],["100","100+"],["500","500+"],["1000","1,000+"]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="popularity.desc">Most popular</option><option value="vote_average.desc">Highest rated</option><option value={mediaKind==="movie"?"primary_release_date.desc":"first_air_date.desc"}>Newest</option><option value="revenue.desc">Highest grossing (movies)</option></select></label>
      <button className="primary" disabled={loading}>{loading?"Searching…":"Discover titles"}</button>
    </form>}
    {tab==="artwork" && <div className="explore-artwork-tools"><p className="muted">{selected ? `Artwork for ${titleOf(selected)}` : "Open a movie or TV show first, then return here to browse its artwork."}</p><label>Image language<select value={artLanguage} onChange={e=>setArtLanguage(e.target.value)}>{[["en,null","English + language-neutral"],["null","Language-neutral"],["en","English"],["nl,en,null","Dutch + English + neutral"],["ja,en,null","Japanese + English + neutral"],["ko,en,null","Korean + English + neutral"],["fr,en,null","French + English + neutral"]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading && <p className="muted" role="status">Loading TMDB data…</p>}
    {renderResults()}
    {tab==="people" && person && <section className="explore-entity"><div className="explore-person-header">{person.profile_path && <img src={imageUrl(person.profile_path,"w185")} alt="" />}<div><p className="eyebrow">{person.known_for_department || "FILMMAKER"}</p><h2>{person.name}</h2><p>{person.biography || "No biography available."}</p><small>{person.birthday ? `Born ${person.birthday}` : ""}{person.place_of_birth ? ` · ${person.place_of_birth}` : ""}</small></div></div><h3>Movies and TV credits</h3>{renderMedia(personCredits)}</section>}
    {(tab==="companies" && entity || tab==="keywords" && keyword) && <section className="explore-entity"><h2>{entity?.name || keyword?.name}</h2>{entity?.logo_path && <img className="explore-company-logo" src={imageUrl(entity.logo_path,"w185")} alt="" />}<p>{entity?.description || (keyword ? `Titles tagged with “${keyword.name}”.` : entity?.origin_country || "TMDB company / network catalog")}</p>{renderMedia(cards)}</section>}
    {tab==="franchises" && collection && <section className="explore-entity"><div className="explore-person-header">{collection.poster_path && <img src={imageUrl(collection.poster_path,"w185")} alt="" />}<div><h2>{collection.name}</h2><p>{collection.overview || "Films grouped in this TMDB collection."}</p><small>{collection.parts?.length || 0} films</small></div></div><div className="explore-franchise-list">{[...(collection.parts || [])].sort((a,b)=>(a.release_date||"").localeCompare(b.release_date||"")).map(item=><button type="button" key={item.id} onClick={()=>choose({...item,media_type:"movie"},"movie")}><span>{yearOf(item)||"—"}</span><strong>{titleOf(item)}</strong><span>★ {Number(item.vote_average||0).toFixed(1)}</span></button>)}</div><h3>Release order shown · use individual title pages for details</h3>{renderMedia((collection.parts||[]).map(x=>({...x,media_type:"movie"})))}</section>}
    {tab==="international" && cards.length>0 && <section className="explore-entity"><h2>Discovery results</h2>{renderMedia(cards)}<button type="button" disabled={loading} onClick={loadMoreDiscover}>Load more</button></section>}
    {tab==="artwork" && artwork && <section className="explore-entity"><h2>Posters</h2><div className="explore-artwork-grid">{(artwork.posters||[]).map((x,i)=><figure key={x.file_path}><img src={imageUrl(x.file_path,"w342")} loading="lazy" alt={`Poster ${i+1}`} /><figcaption>{x.iso_639_1 || "Language neutral"} · {x.width}×{x.height}</figcaption></figure>)}</div><h2>Backdrops</h2><div className="explore-backdrop-grid">{(artwork.backdrops||[]).map((x,i)=><figure key={x.file_path}><img src={imageUrl(x.file_path,"w780")} loading="lazy" alt={`Backdrop ${i+1}`} /><figcaption>{x.iso_639_1 || "Language neutral"} · {x.width}×{x.height}</figcaption></figure>)}</div><h2>Logos</h2><div className="explore-artwork-grid">{(artwork.logos||[]).map((x,i)=><figure key={x.file_path}><img src={imageUrl(x.file_path,"w342")} loading="lazy" alt={`Logo ${i+1}`} /><figcaption>{x.iso_639_1 || "Language neutral"}</figcaption></figure>)}</div>{!(artwork.posters?.length||artwork.backdrops?.length||artwork.logos?.length) && <p className="empty-state">No artwork was returned for this language selection.</p>}</section>}
    {!loading && !error && !results.length && !person && !entity && !keyword && !collection && !(tab==="international" && cards.length) && !(tab==="artwork" && artwork) && <p className="empty-state explore-empty">{tab==="artwork"&&!selected?"Open a title to load its posters, backdrops and logos.":"Choose a category and search or apply filters to explore TMDB."}</p>}
  </section>;
}
