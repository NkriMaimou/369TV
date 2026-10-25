import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sdkPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/anime-sdk/dist/index.js",
);

let source = await readFile(sdkPath, "utf8");

const replacements = [
  [
    "function rewriteHls(manifest, baseUrl, proxyBase, hParam) {",
    "function rewriteHls(manifest, baseUrl, proxyBase, hParam, secret) {",
  ],
  [
    '  const h = hParam ? `&h=${encodeURIComponent(hParam)}` : "";\n',
    "",
  ],
  [
    '      return `${proxyBase}?url=${encodeURIComponent(abs)}${h}`;',
    [
      '      const parts = [`url=${encodeURIComponent(abs)}`];',
      '      if (hParam) parts.push(`h=${encodeURIComponent(hParam)}`);',
      '      if (secret) parts.push(`sig=${computeProxySignature(abs, hParam, secret)}`);',
      '      return `${proxyBase}?${parts.join("&")}`;',
    ].join("\n"),
  ],
  [
    "rewriteHls(text, targetUrl, proxyBase, hParam ?? void 0)",
    "rewriteHls(text, targetUrl, proxyBase, hParam ?? void 0, proxySignSecret)",
  ],
];

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  if (!source.includes(before)) {
    throw new Error(`Cannot patch anime-sdk: expected source text not found: ${before}`);
  }
  source = source.replace(before, after);
}

if (
  !source.includes("rewriteHls(text, targetUrl, proxyBase, hParam ?? void 0, proxySignSecret)") ||
  !source.includes("computeProxySignature(abs, hParam, secret)")
) {
  throw new Error("anime-sdk HLS signature patch verification failed");
}

await writeFile(sdkPath, source);
console.log("Applied and verified anime-sdk HLS child-URL signing patch.");
