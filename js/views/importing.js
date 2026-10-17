// Importing another app's export: preview what was found, then apply it.
// Re-importing fills in what an earlier import missed without duplicating anything
// or overwriting changes you've made since.

import { S, save, saveMany } from '../store.js'
import { esc, fmtDate, hrs, plural, slug, sum, toast, trunc } from '../util.js'
import { openSheet } from '../sheet.js'
import { allTechs, techById } from '../model.js'
import { matchMedia, readOtherApp } from '../importer.js'
import { addPhotos } from '../photos.js'

const FIELD_LABELS = { date: 'Date', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds', duration: 'Mat time', start: 'Start time', end: 'End time', type: 'Class type', rounds: 'Rolls', notes: 'Notes', techniques: 'Techniques', title: 'Title' }

function planSessions(sessions) {
  const claimed = new Set(), fresh = [], updates = []
  sessions.forEach(s => {
    const match = S.session.find(x => x.id === s.id && !claimed.has(x.id))
      || S.session.find(x => x.imported && x.date === s.date && !claimed.has(x.id))
    if (!match) { fresh.push(s); return }
    claimed.add(match.id)
    const fill = {}
    if (!match.minutes && s.minutes) fill.minutes = s.minutes
    if (!match.rounds && s.rounds) fill.rounds = s.rounds
    if (!match.time && s.time) fill.time = s.time
    if (!(match.importKeys || []).length && s.importKeys.length) fill.importKeys = s.importKeys
    if (s.notes.includes('Rolls:\n') && !(match.notes || '').includes('Rolls:\n')) fill.notes = [match.notes, s.notes.slice(s.notes.indexOf('Rolls:\n'))].filter(Boolean).join('\n')
    if (Object.keys(fill).length) updates.push({ ...match, ...fill })
  })
  return { fresh, updates, unchanged: sessions.length - fresh.length - updates.length }
}

// Moves from the export: notes and links go onto matching library moves, the rest become your own moves.
function planTechniques(techniques) {
  return techniques.map(t => {
    if (t.match) {
      const own = S.tech.find(x => x.id === t.match.id) || { id: t.match.id, kind: 'tech' }
      return { ...own, notes: own.notes || t.notes, link: own.link || t.link, starred: true, importKeys: t.keys }
    }
    const id = 'tech_imp_' + slug(t.name)
    const own = S.tech.find(x => x.id === id) || {}
    return { ...own, id, kind: 'tech', name: t.name, position: t.position || 'Other', type: t.type || 'Transition', notes: own.notes || t.notes, link: own.link || t.link, starred: true, importKeys: t.keys }
  })
}

export async function previewImport(files) {
  let found
  try { found = await readOtherApp(files) }
  catch { toast('Couldn’t read that. Choose the CSV or JSON export, or a .zip of the folder.'); return }
  const { sessions, skipped, columns, headers, techniques, media, otherFiles } = found
  const names = files.map(f => f.name).join(', ')

  if (!sessions.length && !techniques.length && !media.length) {
    openSheet('Nothing to import yet', `
      <p>I couldn’t find training dates, moves or photos in <strong>${esc(names)}</strong>.</p>
      ${headers.length ? `<p class="hint">Columns found: ${esc(headers.join(', '))}</p>` : '<p class="hint">The file looks empty, or it isn’t CSV, JSON or a .zip.</p>'}
      <p class="hint">If the app exports a spreadsheet (.xlsx) or PDF, save it as CSV instead.</p>`)
    return
  }

  const { fresh, updates, unchanged } = planSessions(sessions)
  const techRecords = planTechniques(techniques)
  const sessionsAfter = [...S.session.map(s => updates.find(u => u.id === s.id) || s), ...fresh]
  const techsAfter = [...allTechs().map(t => ({ ...t, ...(techRecords.find(r => r.id === t.id) || {}) })), ...techRecords.filter(r => !techById(r.id))]
  const plan = matchMedia(media, sessionsAfter, techsAfter)
  const alreadyIn = rec => m => (rec?.mediaNames || []).includes(m.name)
  const newPhotos = [...plan.sessions].reduce((n, [id, list]) => n + list.filter(m => !alreadyIn(sessionsAfter.find(s => s.id === id))(m)).length, 0)
  const techPhotos = [...plan.techs].reduce((n, [id, list]) => n + list.filter(m => !alreadyIn(techsAfter.find(t => t.id === id))(m)).length, 0)
  if (plan.profile && (S.profile.mediaNames || []).includes(plan.profile.name)) plan.profile = null

  const dates = sessions.map(s => s.date).sort()
  const total = fresh.length + updates.length
  const anything = total || techRecords.length || newPhotos || techPhotos || plan.profile

  openSheet('Import from another app', `
    ${sessions.length ? `<p>Found <strong>${plural(sessions.length, 'session')}</strong>, ${fmtDate(dates[0])} ${dates[0].slice(0, 4)} to ${fmtDate(dates.at(-1))} ${dates.at(-1).slice(0, 4)}:
      <strong>${hrs(sum(sessions, 'minutes'))} mat hours</strong> and <strong>${plural(sum(sessions, 'rounds'), 'roll')}</strong>.</p>
      <p>${[fresh.length && `${plural(fresh.length, 'new session')} to add`, updates.length && `${plural(updates.length, 'earlier import')} to fill in`, unchanged && `${unchanged} already complete`].filter(Boolean).join(', ')}.
      ${skipped.length ? `${plural(skipped.length, 'row')} had no date and will be left out.` : ''}</p>` : ''}
    ${techniques.length ? `<p><strong>${plural(techniques.length, 'move')}</strong>: ${techniques.filter(t => t.match).length} match moves in your library, ${techniques.filter(t => !t.match).length} will be added as your own.</p>` : ''}
    ${media.length ? `<p><strong>${plural(media.length, 'photo')}</strong>: ${[newPhotos && `${newPhotos} for journal entries`, techPhotos && `${techPhotos} for moves`, plan.profile && 'a profile photo', plan.unmatched.length && `${plan.unmatched.length} with no matching entry (left out)`].filter(Boolean).join(', ') || 'all already imported'}.</p>
      ${plan.unmatched.length ? `<details class="more"><summary>Photos left out</summary><div><p class="hint">${esc(plan.unmatched.slice(0, 30).map(m => m.name).join(', '))}${plan.unmatched.length > 30 ? '…' : ''}</p></div></details>` : ''}` : ''}
    ${otherFiles.length ? `<p class="hint">${plural(otherFiles.length, 'other file')} (like videos) can’t be imported and will be skipped.</p>` : ''}
    ${Object.keys(columns).length ? `<details class="more"><summary>How the columns were read</summary><div>
      <dl class="refl">${Object.entries(columns).map(([k, h]) => `<dt>${FIELD_LABELS[k] || k}</dt><dd>from “${esc(h)}”</dd>`).join('')}</dl>
      <p class="hint">All columns: ${esc(headers.join(', '))}</p></div></details>` : ''}
    <p class="hint">Tip: to bring in myBJJ’s Media folder, compress it in the Files app (press and hold → Compress) and choose the .zip together with the data export.</p>`, {
    submitLabel: anything ? 'Import' : 'Nothing new to import',
    onSubmit: async () => {
      if (!anything) return
      toast('Importing…')
      const records = new Map([...updates, ...fresh, ...techRecords].map(r => [r.id, r]))
      const recordFor = (id, fallback) => records.get(id) || { ...fallback() }

      let done = 0
      for (const [id, list] of plan.sessions) {
        const rec = recordFor(id, () => sessionsAfter.find(s => s.id === id))
        const todo = list.filter(m => !alreadyIn(rec)(m))
        if (!todo.length) continue
        const ids = await addPhotos(await Promise.all(todo.map(m => m.blob())))
        records.set(id, { ...rec, photos: [...(rec.photos || []), ...ids], mediaNames: [...(rec.mediaNames || []), ...todo.map(m => m.name)] })
        done += ids.length
        toast(`Importing photos… ${done} of ${newPhotos}`)
      }
      for (const [id, list] of plan.techs) {
        const rec = recordFor(id, () => S.tech.find(t => t.id === id) || { id, kind: 'tech' })
        const todo = list.filter(m => !alreadyIn(rec)(m))
        if (!todo.length) continue
        const ids = await addPhotos(await Promise.all(todo.map(m => m.blob())))
        records.set(id, { ...rec, photos: [...(rec.photos || []), ...ids], mediaNames: [...(rec.mediaNames || []), ...todo.map(m => m.name)] })
      }
      if (plan.profile && !(S.profile.mediaNames || []).includes(plan.profile.name)) {
        const [photo] = await addPhotos([await plan.profile.blob()])
        if (photo) await save({ ...S.profile, photo, mediaNames: [...(S.profile.mediaNames || []), plan.profile.name] })
      }
      await saveMany([...records.values()])
      toast(['Import finished', total && plural(total, 'session'), techRecords.length && plural(techRecords.length, 'move'), done && plural(done, 'photo')].filter(Boolean).join(' · '))
    },
  })
}
