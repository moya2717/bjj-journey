import { S, allPhotos, allRecords, putPhotos, save, saveMany } from './store.js'
import { today } from './util.js'
import { isZip, makeZip, readZip } from './zip.js'

// A backup is a .zip: backup.json with every record, plus each photo as a real image file.
// Settings travel as a record too, so the words you taught the roll describer (settings.moveWords) come along.
// Restoring also reads older backups (one JSON file with photos inside) and exports from the
// earlier claude.ai version of the journal.

const KINDS = ['session', 'roll', 'round', 'tech', 'seq', 'goal', 'link', 'activity', 'study', 'injury', 'settings', 'profile']
const extension = blob => ({ 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp', 'image/gif': 'gif' }[blob.type] || 'jpg')
const MIME = { png: 'image/png', heic: 'image/heic', webp: 'image/webp', gif: 'image/gif', jpg: 'image/jpeg' }

export async function exportBackup() {
  const photos = await allPhotos()
  const index = photos.map(p => ({ id: p.id, addedAt: p.addedAt, file: `photos/${p.id}.${extension(p.blob)}` }))
  const json = JSON.stringify({ app: 'losmoya-bjj-journey', version: 3, exportedAt: new Date().toISOString(), records: allRecords(), photos: index })
  const zip = await makeZip([
    { name: 'backup.json', blob: new Blob([json], { type: 'application/json' }) },
    ...photos.map((p, i) => ({ name: index[i].file, blob: p.blob })),
  ])
  const file = new File([zip], `bjj-journey-backup-${today()}.zip`, { type: 'application/zip' })

  // On iPhone the share sheet lets you "Save to Files", AirDrop or email the backup.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'BJJ Journey backup' }) }
    catch (e) { if (e.name === 'AbortError') return false; throw e }
  } else {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  await save({ ...S.settings, lastBackup: today() })
  return true
}

const fromDataURL = url => fetch(url).then(r => r.blob())

async function readBackup(file) {
  if (!isZip(file)) {
    const data = JSON.parse(await file.text())
    const photos = await Promise.all((data.photos || []).filter(p => p.data).map(async p => ({ id: p.id, addedAt: p.addedAt, blob: await fromDataURL(p.data) })))
    return { data, photos }
  }
  const entries = await readZip(file)
  const manifest = entries.find(e => e.name === 'backup.json')
  if (!manifest) throw new Error('No backup.json in this zip')
  const data = JSON.parse(await (await manifest.blob()).text())
  const byPath = Object.fromEntries(entries.map(e => [e.path, e]))
  const photos = []
  for (const p of data.photos || []) {
    const entry = byPath[p.file]
    if (entry) photos.push({ id: p.id, addedAt: p.addedAt, blob: new Blob([await entry.blob()], { type: MIME[p.file.split('.').pop()] || 'image/jpeg' }) })
  }
  return { data, photos }
}

export async function importBackup(file) {
  const { data, photos } = await readBackup(file)
  const records = (Array.isArray(data) ? data : data.records || []).filter(r => r?.id && KINDS.includes(r.kind))
  if (photos.length) await putPhotos(photos)
  await saveMany(records)
  return { records: records.length, photos: photos.length }
}
