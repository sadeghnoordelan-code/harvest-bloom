/**
 * Packs the production build into one self-contained HTML file.
 *
 *   npm run build && node tools/build-preview.mjs
 *
 * Why a single file: a multi-file build cannot be opened from `file://` at all —
 * the entry is an ES module, and browsers refuse to load modules over that
 * scheme. An inline module has no such problem, so everything the page needs
 * (styles, script, pack shots, the hero film, the two typefaces) is embedded and
 * the result opens by double-clicking it, with no server and no network.
 *
 * The app source is untouched. Assets keep their real paths in the bundle, and a
 * small shim ahead of the app resolves those paths to the embedded copies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const pub = path.join(root, 'public')
const OUT = path.resolve(root, '..', 'harvest-bloom-preview.html')

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
}
const kb = (n) => `${(n / 1024).toFixed(0)} kB`
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`

const dataUri = (file) => {
  const ext = path.extname(file).toLowerCase()
  const type = MIME[ext]
  if (!type) throw new Error(`no mime type for ${file}`)
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
}

/** Every file under public/, keyed by the absolute path the app requests. */
function collectAssets(dir, prefix = '') {
  const map = {}
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const key = `${prefix}/${entry.name}`
    if (entry.isDirectory()) Object.assign(map, collectAssets(full, key))
    else if (MIME[path.extname(entry.name).toLowerCase()]) map[key] = dataUri(full)
  }
  return map
}

/** Google Fonts, fetched once and embedded so the file needs no network. */
async function inlineFonts(href) {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
  const res = await fetch(href, { headers: { 'User-Agent': ua } })
  if (!res.ok) throw new Error(`fonts css HTTP ${res.status}`)
  let css = await res.text()
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]))]
  let bytes = 0
  for (const url of urls) {
    const f = await fetch(url, { headers: { 'User-Agent': ua } })
    if (!f.ok) throw new Error(`font HTTP ${f.status} ${url}`)
    const buf = Buffer.from(await f.arrayBuffer())
    bytes += buf.length
    css = css.split(url).join(`data:font/woff2;base64,${buf.toString('base64')}`)
  }
  return { css, count: urls.length, bytes }
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const pick = (re, what) => {
  const m = html.match(re)
  if (!m) throw new Error(`could not find ${what} in dist/index.html`)
  return m[1]
}
const cssHref = pick(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/, 'the built stylesheet')
const jsSrc = pick(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/, 'the built script')
const fontsHref = pick(
  /<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/,
  'the Google Fonts link',
)

const appCss = fs.readFileSync(path.join(dist, cssHref.replace(/^\//, '')), 'utf8')
const appJs = fs.readFileSync(path.join(dist, jsSrc.replace(/^\//, '')), 'utf8')

const assets = collectAssets(pub)
const fonts = await inlineFonts(fontsHref)

const title = pick(/<title>([^<]*)<\/title>/, 'the title')
const description = pick(/<meta\s+name="description"\s+content="([^"]*)"/, 'the description')

/* The bundle keeps real paths like "/products/barberries" and appends ".webp"
   at runtime, so the rewrite has to happen when the value is used rather than by
   patching strings in the source. These four seams are every way this app names
   an asset: an <img>/<link> attribute, an image src property, a media src
   property, and the hero's fetch of the film. */
const shim = `
(function () {
  var A = window.__HB_ASSETS;
  var map = function (v) {
    return (typeof v === 'string' && Object.prototype.hasOwnProperty.call(A, v)) ? A[v] : v;
  };
  var setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (name === 'src' || name === 'href') value = map(value);
    return setAttribute.call(this, name, value);
  };
  [
    [HTMLImageElement, 'src'],
    [HTMLMediaElement, 'src'],
    [HTMLLinkElement, 'href'],
  ].forEach(function (pair) {
    var d = Object.getOwnPropertyDescriptor(pair[0].prototype, pair[1]);
    if (!d || !d.set) return;
    Object.defineProperty(pair[0].prototype, pair[1], {
      configurable: true,
      enumerable: d.enumerable,
      get: function () { return d.get.call(this); },
      set: function (v) { d.set.call(this, map(v)); },
    });
  });
  var fetch_ = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = map(input);
    return fetch_.call(this, input, init);
  };
})();
`

const out = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#FAF9F6" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="icon" type="image/webp" href="${assets['/brand/emblem.webp']}" />
    <style>
/* Typefaces, embedded so the page needs no network. */
${fonts.css}
    </style>
    <style>
${appCss}
    </style>
    <script>window.__HB_ASSETS = ${JSON.stringify(assets)};</script>
    <script>${shim}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${appJs}
    </script>
  </body>
</html>
`

fs.writeFileSync(OUT, out)

const assetBytes = Object.values(assets).reduce((n, v) => n + v.length, 0)
console.log(`packed  ${path.relative(path.resolve(root, '..'), OUT)}`)
console.log(`  html      ${mb(Buffer.byteLength(out))}`)
console.log(`  script    ${kb(appJs.length)}`)
console.log(`  styles    ${kb(appCss.length)}`)
console.log(`  fonts     ${kb(fonts.bytes)} raw, ${fonts.count} files`)
console.log(`  assets    ${mb(assetBytes)} encoded, ${Object.keys(assets).length} files`)
for (const k of Object.keys(assets).sort()) console.log(`            ${k}`)
