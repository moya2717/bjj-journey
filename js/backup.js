import { S, allPhotos, allRecords, putPhotos, save, saveMany } from './store.js'
import { today } from './util.js'

// A backup is one JSON file: every record, plus photos as data URLs.
// It also reads exports from the earlier claude.ai version of the journal.

const KINDS = ['session', 'roll', 'tech', 'seq', 'goal', 'link', 'activity', 'settings', 'profile']

const toDataURL = blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob) })
const fromDataURL = url => fetch(url).then(r => r.blob())

export async function exportBackup() {
  const photos = await Promise.all((await allPhotos()).map(async p => ({ id: p.id, addedAt: p.addedAt, data: await toDataURL(p.blob) })))
  const json = JSON.stringify({ app: 'losmoya-bjj-journey', version: 2, exportedAt: new Date().toISOString(), records: allRecords(), photos })
  const file = new File([json], `bjj-journey-backup-${today()}.json`, { type: 'application/json' })

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

export async function importBackup(file) {
  const data = JSON.parse(await file.text())
  const records = (Array.isArray(data) ? data : data.records || []).filter(r => r?.id && KINDS.includes(r.kind))
  const photos = await Promise.all((data.photos || []).map(async p => ({ id: p.id, addedAt: p.addedAt, blob: await fromDataURL(p.data) })))
  if (photos.length) await putPhotos(photos)
  await saveMany(records)
  return { records: records.length, photos: photos.length }
}
