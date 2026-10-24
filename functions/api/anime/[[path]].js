import { AllmangaProvider, AnikotoProvider, AnimeParadiseProvider, FetchTransport, GogoanimeProvider, HttpClient, MegaPlayProvider } from "anime-sdk";

const allowed = new Set(["allmanga", "animeparadise", "anikoto", "megaplay", "gogoanime"]);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" };
const memo = new Map();
let sourceMap;
function sources() {
  if (sourceMap) return sourceMap;
  const http = new HttpClient({ timeoutMs: 20000, transport: new FetchTransport() });
  sourceMap = new Map([
    ["allmanga", new AllmangaProvider(http)], ["animeparadise", new AnimeParadiseProvider(http)],
    ["anikoto", new AnikotoProvider(http)], ["megaplay", new MegaPlayProvider(http)], ["gogoanime", new GogoanimeProvider(http)],
  ]);
  return sourceMap;
}
const json = (body, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
const enc = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const dec = value => { const s=value.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0)); };
async function sign(secret, text) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return enc(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(text)));
}
async function verify(secret,text,signature) {
  const expected=await sign(secret,text); if(expected.length!==signature.length)return false;
  let diff=0; for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i); return diff===0;
}
async function proxify(base,target,headers,secret,ct) {
  const h=enc(new TextEncoder().encode(JSON.stringify(headers||{})));
  const sig=await sign(secret,h ? target+"|h="+h : target);
  const u=new URL("/api/anime/proxy",base); u.searchParams.set("url",target); u.searchParams.set("h",h); u.searchParams.set("sig",sig); if(ct)u.searchParams.set("ct",ct); return u.toString();
}
async function rewriteManifest(text,playlist,base,headers,secret) {
  const lines=await Promise.all(text.split(/\r?\n/).map(async line=>{
    const trimmed=line.trim(); if(!trimmed)return line;
    if(trimmed.startsWith("#")) {
      let out=line; const matches=[...line.matchAll(/URI="([^"]+)"/g)];
      for(const m of matches) out=out.replace('URI="'+m[1]+'"','URI="'+await proxify(base,new URL(m[1],playlist).href,headers,secret)+'"');
      return out;
    }
    return proxify(base,new URL(trimmed,playlist).href,headers,secret);
  }));
  return lines.join("\n");
}
async function proxy(request,env,url) {
  const target=url.searchParams.get("url")||"", h=url.searchParams.get("h")||"", sig=url.searchParams.get("sig")||"";
  if(!env.PROXY_SECRET)return json({error:"Cloudflare secret PROXY_SECRET is not configured."},503);
  let parsed; try{parsed=new URL(target)}catch{return json({error:"Invalid stream URL."},400)}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||!sig||!await verify(env.PROXY_SECRET,h?target+"|h="+h:target,sig))return json({error:"Invalid stream proxy signature."},401);
  let upstreamHeaders={}; try{if(h)upstreamHeaders=JSON.parse(new TextDecoder().decode(dec(h)))}catch{return json({error:"Invalid proxy headers."},400)}
  const headers=new Headers(); for(const name of ["referer","user-agent","origin","accept"]) {
    const entry=Object.entries(upstreamHeaders).find(([key])=>key.toLowerCase()===name); if(entry&&typeof entry[1]==="string")headers.set(name,entry[1]);
  }
  const range=request.headers.get("Range"); if(range)headers.set("Range",range);
  let upstream; try{upstream=await fetch(target,{headers,redirect:"follow"})}catch{return json({error:"Unable to fetch upstream stream."},502)}
  const ct=url.searchParams.get("ct")||upstream.headers.get("Content-Type")||"";
  const isHls=/\.m3u8(?:$|\?)/i.test(parsed.pathname)||ct.includes("mpegurl");
  const outHeaders=new Headers({...cors,"Content-Type":isHls?"application/vnd.apple.mpegurl":ct||"application/octet-stream"});
  for(const name of ["Accept-Ranges","Content-Range","Content-Length","ETag","Last-Modified"]){const value=upstream.headers.get(name);if(value)outHeaders.set(name,value)}
  if(!upstream.ok&&upstream.status!==206)return new Response("Upstream stream failed.",{status:upstream.status,headers:outHeaders});
  if(isHls){const body=await rewriteManifest(await upstream.text(),target,new URL(request.url).origin,upstreamHeaders,env.PROXY_SECRET);return new Response(body,{status:upstream.status,headers:outHeaders})}
  return new Response(upstream.body,{status:upstream.status,headers:outHeaders});
}
async function rewriteVideo(payload,base,secret) {
  if(payload?.type!=="video"||!Array.isArray(payload.streams))return payload;
  return {...payload,streams:await Promise.all(payload.streams.map(async stream=>({...stream,
    sourceUrl:await proxify(base,stream.sourceUrl,stream.headers||{},secret),
    subtitles:await Promise.all((stream.subtitles||[]).map(async track=>({...track,url:await proxify(base,track.url,stream.headers||{},secret,"text/vtt")})))
  })))};
}
export async function onRequest({request,env}) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="GET")return json({error:"Only GET is supported."},405);
  const path=url.pathname.replace(/^\/api\/anime\/?/,"");
  if(path==="health")return json({ok:true,service:"369tv-anime-cloudflare-pages"});
  if(path==="proxy")return proxy(request,env,url);
  if(!env.PROXY_SECRET)return json({error:"Set PROXY_SECRET in Cloudflare Pages environment variables."},503);
  const id=url.searchParams.get("provider")||"allmanga",provider=sources().get(id);
  if(!allowed.has(id)||!provider)return json({error:"Unknown anime provider."},400);
  const q=url.searchParams.get("q")||"",mediaId=url.searchParams.get("mediaId")||"",unitId=url.searchParams.get("unitId")||"";
  const language=["sub","dub","raw"].includes(url.searchParams.get("language"))?url.searchParams.get("language"):"sub";
  const key=path+":"+id+":"+(q||mediaId||unitId)+":"+language, hit=memo.get(key);
  if(hit&&hit.expires>Date.now())return json(hit.value);
  try {
    let value;
    if(path==="search"){if(!q.trim())return json({error:"q is required"},400);value=await provider.search(q.trim())}
    else if(path==="content"){if(!mediaId)return json({error:"mediaId is required"},400);value=await provider.fetchContentUnits(mediaId)}
    else if(path==="stream"){if(!unitId)return json({error:"unitId is required"},400);value=await provider.resolveStream(unitId,language);value=await rewriteVideo(value,url.origin,env.PROXY_SECRET)}
    else if(path==="tracks"){if(!unitId)return json({error:"unitId is required"},400);value=provider.fetchUnitTracks?await provider.fetchUnitTracks(unitId,language):{subtitles:[],qualities:[]};if(Array.isArray(value?.subtitles))value={...value,subtitles:await Promise.all(value.subtitles.map(async t=>({...t,url:await proxify(url.origin,t.url,value.headers||{},env.PROXY_SECRET,"text/vtt")}))) }}
    else return json({error:"Not found"},404);
    if(path==="search"||path==="content")memo.set(key,{value,expires:Date.now()+120000});
    return json(value);
  } catch(error) { return json({error:error instanceof Error?error.message:"Anime provider request failed"},502) }
}
