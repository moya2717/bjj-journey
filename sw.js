// Offline support: the app's own files are cached on install, so it opens with no signal.
// Bump VERSION whenever you change a file, so phones pick up the new version.
const VERSION = 'bjj-journey-v1'

const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/util.js', 'js/vocab.js', 'js/catalog.js', 'js/model.js',
  'js/analysis.js', 'js/achievements.js', 'js/charts.js', 'js/sheet.js', 'js/photos.js', 'js/backup.js', 'js/examples.js',
  'js/views/overview.js', 'js/views/journal.js', 'js/views/rolls.js', 'js/views/matchups.js',
  'js/views/sequences.js', 'js/views/library.js', 'js/views/achievements.js', 'js/views/stats.js',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

// Serve from the cache first, then refresh the cached copy in the background.
// The Google font is cached the same way the first time it loads.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  const ours = url.origin === location.origin
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!ours && !font) return

  event.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: ours })
    const fresh = fetch(event.request)
      .then(response => { if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone()); return response })
      .catch(() => cached)
    return cached || fresh
  }))
})
