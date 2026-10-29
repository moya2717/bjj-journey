// Offline support: the app's own files are cached on install, so it opens with no signal.
// Bump VERSION whenever you change a file, so phones pick up the new version.
const VERSION = 'bjj-journey-v33'

const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/util.js', 'js/vocab.js', 'js/catalog.js', 'js/model.js',
  'js/analysis.js', 'js/goals.js', 'js/charts.js', 'js/sheet.js', 'js/photos.js', 'js/backup.js', 'js/examples.js',
  'js/views/overview.js', 'js/views/journal.js', 'js/views/rolls.js', 'js/views/matchups.js',
  'js/views/sequences.js', 'js/views/library.js', 'js/views/resources.js', 'js/views/goals.js', 'js/views/stats.js',
  'js/maps.js', 'js/resources.js', 'js/importer.js', 'js/quiz.js', 'js/views/quiz.js', 'js/zip.js', 'js/views/importing.js', 'js/fixes.js', 'js/views/study.js', 'js/views/compete.js', 'js/sim.js', 'js/views/sim.js', 'js/body.js', 'js/views/injuries.js', 'js/load.js', 'js/views/athlete.js', 'js/loop.js', 'js/views/review.js', 'js/picker.js', 'js/scenarios.js', 'js/views/hub.js', 'js/parse.js', 'js/describe.js', 'js/gameplan.js', 'js/views/gameplan.js', 'js/flow.js',
]

// Each version is installed as a whole, straight from the server (skipping the browser's own
// 10-minute cache), so a phone never runs a mix of old and new files.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

// The app's own files come from this version's cache; only a new version changes them.
// The Google font is cached the first time it loads and refreshed in the background.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  const ours = url.origin === location.origin
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!ours && !font) return

  event.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: ours })
    if (ours) return cached || fetch(event.request)
    const fresh = fetch(event.request)
      .then(response => { if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone()); return response })
      .catch(() => cached)
    return cached || fresh
  }))
})
