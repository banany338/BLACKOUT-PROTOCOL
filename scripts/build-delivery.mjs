import { build } from 'vite';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Build a self-contained planner for file://. No server, CDN or runtime imports.
const result = await build({
  logLevel: 'warn',
  build: {
    write: false,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const output = (Array.isArray(result) ? result[0] : result).output;
const script = output
  .filter((item) => item.type === 'chunk')
  .map((item) => item.code)
  .join('\n');
const styles = output
  .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
  .map((item) => item.source)
  .join('\n');
const favicon = await readFile('public/favicon.svg', 'utf8');
const portable = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>BLACKOUT PROTOCOL — Portable workspace</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${styles.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
await mkdir('dist/portable', { recursive: true });
await writeFile('dist/portable/BLACKOUT-PROTOCOL.html', portable);
// Also offer the same file from an installed local/static web build.
await writeFile('dist/client/BLACKOUT-PROTOCOL.html', portable);

async function files(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    items.map((i) => (i.isDirectory() ? files(path.join(dir, i.name)) : path.join(dir, i.name))),
  );
  return paths.flat();
}
const assets = (await files('dist/client'))
  .filter((file) => file !== 'dist/client/sw.js' && !file.endsWith('BLACKOUT-PROTOCOL.html'))
  .sort();
const fingerprint = createHash('sha256');
for (const file of assets) fingerprint.update(await readFile(file));
const cache = `blackout-static-${fingerprint.digest('hex').slice(0, 16)}`;
const urls = assets.map(
  (file) => '/' + path.relative('dist/client', file).split(path.sep).join('/'),
);
const worker = `const CACHE=${JSON.stringify(cache)}, ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('blackout-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));
  else if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});`;
await writeFile('dist/client/sw.js', worker);
console.log(
  `Portable workspace: dist/portable/BLACKOUT-PROTOCOL.html (${Math.round(Buffer.byteLength(portable) / 1024)} KB)`,
);
console.log(`Offline web cache: ${assets.length} static files, ${cache}`);
