import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function precachePlugin(): Plugin {
  return {
    name: 'sw-precache-manifest',
    writeBundle(options, bundle) {
      const datasets = ['case_a_kepler8b', 'case_b_eclipsing_binary', 'case_c_single_dropout', 'case_d_injection']
        .map(id => `/data/${id}.json`);
      const files = Object.keys(bundle).filter(name => !name.endsWith('.map') && name !== 'sw.js').sort();
      const hash = createHash('sha256');
      for (const name of files) {
        const item = bundle[name];
        hash.update(name).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const url of datasets) hash.update(fs.readFileSync(path.join('public', url.slice(1))));
      const buildId = hash.digest('hex').slice(0, 16);
      const assets = [...new Set(['/', '/index.html', '/offline-manifest.json', ...datasets, ...files.map(name => '/' + name)])];
      const manifest = { schemaVersion: 1, buildId, cacheName: `dimminglab-build-${buildId}`, assets };
      const outDir = options.dir || 'dist';
      fs.writeFileSync(path.join(outDir, 'offline-manifest.json'), JSON.stringify(manifest, null, 2));
      fs.writeFileSync(path.join(outDir, 'sw.js'), `// Generated atomically for build ${buildId}.
const CACHE_NAME = ${JSON.stringify(manifest.cacheName)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'})))
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // Retain the prior build's hashed resources for tabs already running that build.
  event.waitUntil(caches.keys().then(keys => {
    const previous = keys.filter(key => key.startsWith('dimminglab-build-') && key !== CACHE_NAME);
    return Promise.all(previous.slice(0, Math.max(0, previous.length - 1)).map(key => caches.delete(key)));
  }).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (event.request.mode === 'navigate' || url.pathname === '/offline-manifest.json') {
      try { const response = await fetch(event.request); if (response.ok) return response; } catch {}
      return await cache.match(url.pathname === '/offline-manifest.json' ? '/offline-manifest.json' : '/index.html') || Response.error();
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    if (url.pathname.startsWith('/assets/')) {
      const previous = await caches.match(event.request);
      if (previous) return previous;
    }
    try { return await fetch(event.request); } catch { return Response.error(); }
  })());
});
`);
    },
  };
}

export default defineConfig({
  plugins: [react(), precachePlugin()],
  worker: { format: 'es' },
  server: { port: 5173, allowedHosts: ['terminal.local'] },
});
