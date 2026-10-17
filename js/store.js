// Everything is kept on this device in IndexedDB: one store of records, one of photos.
// The whole journal is loaded into memory at launch; every change writes through.

const DB_NAME = 'bjj-journey'
const KINDS = ['session', 'roll', 'tech', 'seq', 'goal', 'link', 'activity', 'study']

export const S = emptyState()

export function emptyState() {
  return {
    session: [], roll: [], tech: [], seq: [], goal: [], link: [], activity: [], study: [],
    settings: { id: 'settings_main', kind: 'settings', weeklyTarget: 3 },
    profile: emptyProfile(),
  }
}

export function emptyProfile() {
  return { id: 'profile_main', kind: 'profile', name: '', gym: '', startDate: '', promotions: [], tournaments: [] }
}

const listeners = []
export const onChange = fn => listeners.push(fn)
const changed = () => { version++; listeners.forEach(fn => fn()) }

// Derived data (move lookups, usage counts, achievements) is computed once per change to the
// journal and reused until the next save. One rule, no invalidation to think about.
let version = 0, cacheVersion = -1, cache = new Map()
export function cached(key, compute) {
  if (cacheVersion !== version) { cache = new Map(); cacheVersion = version }
  if (!cache.has(key)) cache.set(key, compute())
  return cache.get(key)
}

let db
const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
const finished = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error) })
const table = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name)

export async function load() {
  const open = indexedDB.open(DB_NAME, 1)
  open.onupgradeneeded = () => {
    open.result.createObjectStore('records', { keyPath: 'id' })
    open.result.createObjectStore('photos', { keyPath: 'id' })
  }
  db = await request(open)
  replaceAll(await request(table('records').getAll()))
  navigator.storage?.persist?.()
}

export function allRecords() {
  return [...KINDS.flatMap(k => S[k]), S.settings, ...(S.profile.createdAt ? [S.profile] : [])]
}

function apply(rec) {
  if (rec.kind === 'settings') S.settings = { ...S.settings, ...rec }
  else if (rec.kind === 'profile') S.profile = { ...emptyProfile(), ...rec }
  else if (KINDS.includes(rec.kind)) {
    const list = S[rec.kind], i = list.findIndex(x => x.id === rec.id)
    if (i >= 0) list[i] = rec
    else list.push(rec)
  }
}

function unapply(rec) {
  if (rec.kind === 'profile') S.profile = emptyProfile()
  else if (KINDS.includes(rec.kind)) S[rec.kind] = S[rec.kind].filter(x => x.id !== rec.id)
}

function replaceAll(records) {
  version++
  Object.assign(S, emptyState())
  records.forEach(apply)
}

function stamp(rec) {
  rec.updatedAt = Date.now()
  rec.createdAt ||= rec.updatedAt
  return rec
}

export const save = rec => saveMany([rec])

export async function saveMany(recs) {
  const records = table('records', 'readwrite')
  recs.forEach(rec => { apply(stamp(rec)); records.put(structuredClone(rec)) })
  changed()
  await finished(records.transaction)
}

export const remove = rec => removeMany([rec])

export async function removeMany(recs) {
  const records = table('records', 'readwrite')
  recs.forEach(rec => { unapply(rec); records.delete(rec.id) })
  changed()
  await finished(records.transaction)
}

// Photos are stored as Blobs, referenced from sessions by id.
export async function putPhotos(photos) {
  const store = table('photos', 'readwrite')
  photos.forEach(p => store.put(p))
  await finished(store.transaction)
}
export const getPhoto = id => request(table('photos').get(id))
export const allPhotos = () => request(table('photos').getAll())
export async function deletePhotos(ids) {
  const store = table('photos', 'readwrite')
  ids.forEach(id => store.delete(id))
  await finished(store.transaction)
}

export async function eraseEverything() {
  const tx = db.transaction(['records', 'photos'], 'readwrite')
  tx.objectStore('records').clear()
  tx.objectStore('photos').clear()
  await finished(tx)
  replaceAll([])
  changed()
}
