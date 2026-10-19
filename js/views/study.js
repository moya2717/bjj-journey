// Study: the daily review deck, video study notes, and fixes for what keeps going wrong.
import { S, save, saveMany, remove } from '../store.js'
import { UI } from '../ui.js'
import { REASONS } from '../vocab.js'
import { $, $$, byDateDesc, daysAgo, esc, fmtDate, hrs, newId, plural, sum, toast, today, trunc } from '../util.js'
import { field, openSheet, techSelect } from '../sheet.js'
import { techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { FIXES } from '../fixes.js'
import { cardPrompt, deck, dueCards, followUps, intervalLabel, nextDue, schedule } from '../srs.js'
import { hydratePhotos } from '../photos.js'
import { masteryButton } from './library.js'

export function view() {
  return `<div class="page-head"><div><h1>Study</h1><p class="lede">A few minutes a day: recall your moves, keep notes from what you watch, and fix what keeps going wrong.</p></div>
    <div class="head-actions"><button class="btn ghost" data-act="new-study">Log video study</button></div></div>
    <div class="stat-grid">
      <section class="panel wide">${UI.review ? reviewCard() : reviewIntro()}</section>
      ${videoPanel()}
      ${fixesPanel()}
    </div>`
}

export function mount(root) {
  hydratePhotos(root)
}

// ---------- Review deck ----------

function reviewIntro() {
  const due = dueCards(), size = deck().length, next = nextDue()
  const reviewedToday = (S.settings.reviewLog || []).filter(d => d === today()).length
  if (!size) return `<h2>Review deck</h2><p class="muted">Moves join your deck once you’ve seen them: star a move under Game → Moves, add it to a sequence, or log drilling it.</p>`
  return `<h2>Review deck</h2>
    <div class="figures">
      <div class="figure"><div class="big">${due.length}</div><div class="lbl">cards due today</div></div>
      <div class="figure"><div class="big">${size}</div><div class="lbl">moves in your deck</div></div>
      <div class="figure"><div class="big">${reviewedToday}</div><div class="lbl">reviewed today</div></div>
    </div>
    <p class="small muted" style="margin:8px 0 12px;max-width:70ch">Say the answer out loud or picture it before you flip the card. Grading honestly is what makes the schedule work.</p>
    ${due.length ? `<button class="btn" data-act="review-start">Start review</button>` : `<p>You’re done for today.${next ? ` Next card is due ${fmtDate(next)}.` : ''}</p>`}`
}

function reviewCard() {
  const r = UI.review, t = techById(r.queue[r.i])
  if (!t) { UI.review = null; return reviewIntro() }
  const follow = followUps(t)
  const grades = [['again', 'Forgot'], ['hard', 'Hard'], ['good', 'Got it'], ['easy', 'Easy']]
  return `<div class="quiz-head"><span class="small muted">Card ${r.i + 1} of ${r.queue.length}</span><button class="btn sm ghost" data-act="review-stop">Stop</button></div>
    <div class="meter mat quiz-progress"><span style="width:${r.i / r.queue.length * 100}%"></span></div>
    <p class="tag pos quiz-context">${esc(t.position)} · ${esc(t.type)}${t.srs ? '' : ' · new card'}</p>
    <h2 class="quiz-prompt">${esc(t.name)}</h2>
    <p>${esc(cardPrompt(t))}</p>
    ${!r.shown ? `<div class="row-actions" style="margin-top:16px"><button class="btn" data-act="review-show">Show my notes</button></div>` : `
      <div class="review-back">
        <h3>Your notes</h3>
        ${t.notes ? `<p style="white-space:pre-line">${esc(t.notes)}</p>` : `<p class="muted">No notes yet. Write your key details so next time you have something to check against.</p>`}
        ${follow.length ? `<h3>In your sequences</h3><ul class="small" style="margin:0;padding-left:18px">${follow.map(f => `<li>${f.who === 'them' ? 'They: ' : 'You: '}${esc(f.label)} <span class="muted">(${esc(f.seq)})</span></li>`).join('')}</ul>` : ''}
        ${(t.photos || []).length ? `<div class="photos">${t.photos.slice(0, 4).map(id => `<button data-act="view-photo" data-id="${id}" aria-label="Open photo"><img data-photo="${id}" alt=""></button>`).join('')}</div>` : ''}
        <div class="row-actions">
          <a class="btn sm ghost" href="${esc(t.link || videoSearch(t.name))}" target="_blank" rel="noopener noreferrer">${t.link ? 'My link' : 'Find videos'}</a>
          <button class="btn sm ghost" data-act="edit-tech" data-id="${esc(t.id)}">Edit notes</button>
          ${masteryButton(t)}
        </div>
      </div>
      <p class="small muted" style="margin-top:14px">How well did you remember it?</p>
      <div class="grade-row">${grades.map(([g, label]) => `<button class="grade ${g}" data-act="review-grade" data-grade="${g}"><span>${label}</span><span class="small">${intervalLabel(schedule(t.srs, g).interval)}</span></button>`).join('')}</div>
      <button class="link small" style="margin-top:10px" data-act="review-remove">Take this move out of my deck</button>`}`
}

// ---------- Video study ----------

const toSeconds = stamp => String(stamp).split(':').map(Number).reduce((t, n) => t * 60 + (n || 0), 0)

// YouTube links jump straight to the moment the note was taken.
function atTime(url, stamp) {
  if (!url || !stamp || !/youtu\.?be/.test(url)) return url
  return url + (url.includes('?') ? '&' : '?') + 't=' + toSeconds(stamp) + 's'
}

function videoCard(v) {
  return `<article class="res-item">
    <div class="entry-top"><a class="res-name" href="${esc(v.url || '#')}" target="_blank" rel="noopener noreferrer">${esc(v.title)}${v.url ? ' <span aria-hidden="true">↗</span>' : ''}</a><span class="small muted">${fmtDate(v.date)}${v.minutes ? ` · ${v.minutes} min` : ''}</span></div>
    ${(v.notes || []).length ? `<ul class="video-notes">${v.notes.map(n => `<li>${n.time ? `<a href="${esc(atTime(v.url, n.time))}" target="_blank" rel="noopener noreferrer" class="stamp">${esc(n.time)}</a>` : ''} ${esc(n.text)}${n.techId && techById(n.techId) ? ` <span class="tag">${esc(techById(n.techId).name)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    <div><button class="mini" data-act="edit-study" data-id="${v.id}">Edit</button></div>
  </article>`
}

function videoPanel() {
  const month = S.study.filter(v => v.date >= daysAgo(29))
  return `<section class="panel wide"><div class="history-head"><h2 style="margin:0">Video study</h2><button class="btn sm ghost" data-act="new-study">Log video study</button></div>
    <p class="small muted" style="margin:6px 0 12px">${hrs(sum(month, 'minutes'))} hours of study in the last 30 days. Notes tied to a move are added to that move’s notes under Game → Moves.</p>
    ${S.study.length ? `<div class="res-grid">${[...S.study].sort(byDateDesc).slice(0, 12).map(videoCard).join('')}</div>` : '<p class="muted">Log an instructional or match you watched, with timestamped notes like “4:32 knee shield counter”.</p>'}
  </section>`
}

function noteRow(i, n = { time: '', text: '', techId: '' }) {
  return `<div class="note-row" data-note="${i}">
    <input type="text" name="n${i}_time" value="${esc(n.time)}" placeholder="4:32" inputmode="numeric" aria-label="Timestamp">
    <input type="text" name="n${i}_text" value="${esc(n.text)}" placeholder="What you learned" aria-label="Note">
    ${techSelect(`n${i}_tech`, n.techId, { empty: 'Move (optional)', extra: 'aria-label="Move"' })}
    <button type="button" class="mini" data-remove-note>Remove</button>
  </div>`
}

function studyForm(id) {
  const v = id ? S.study.find(x => x.id === id) : { date: today(), title: '', url: '', minutes: 30, notes: [] }
  if (!v) return
  let rows = (v.notes || []).length
  openSheet(id ? 'Edit video study' : 'Log video study', `
    ${field('What you watched', `<input type="text" name="title" id="v-title" value="${esc(v.title)}" placeholder="Half guard instructional, volume 2" required>`)}
    ${field('Link (optional)', `<input type="url" name="url" id="v-url" value="${esc(v.url)}" placeholder="https://youtube.com/…" inputmode="url">`)}
    <div class="grid2">${field('Date', `<input type="date" name="date" id="v-date" value="${esc(v.date)}">`)}${field('Minutes', `<input type="number" name="minutes" id="v-min" min="0" max="600" step="5" inputmode="numeric" value="${esc(v.minutes)}">`)}</div>
    <div><h3>Notes</h3><p class="hint">Add a timestamp to jump back to that moment. Pick a move to copy the note to it.</p></div>
    <div class="stack" id="v-notes">${(v.notes || []).map((n, i) => noteRow(i, n)).join('') || noteRow(rows++)}</div>
    <div><button type="button" class="btn sm ghost" id="v-add">+ Add note</button></div>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Save study',
    onDelete: id ? () => remove(v) : null,
    onMount: form => {
      $('#v-add', form).addEventListener('click', () => $('#v-notes', form).insertAdjacentHTML('beforeend', noteRow(rows++)))
      form.addEventListener('click', e => { const b = e.target.closest('[data-remove-note]'); if (b) b.closest('[data-note]').remove() })
    },
    onSubmit: (fd, form) => {
      const title = fd.get('title').trim()
      if (!title) { $('#form-error').textContent = 'Name what you watched.'; return false }
      const url = fd.get('url').trim()
      if (url && !/^https?:\/\//i.test(url)) { $('#form-error').textContent = 'Links start with https://'; return false }
      const notes = $$('[data-note]', form).map(row => {
        const k = row.dataset.note
        return { time: fd.get(`n${k}_time`).trim(), text: fd.get(`n${k}_text`).trim(), techId: fd.get(`n${k}_tech`) }
      }).filter(n => n.text)
      // Copy move notes into the Library, once.
      const techUpdates = notes.filter(n => n.techId).map(n => {
        const t = techById(n.techId), own = S.tech.find(x => x.id === n.techId) || { id: n.techId, kind: 'tech' }
        const line = `• ${n.time ? n.time + ' ' : ''}${n.text} (${trunc(title, 40)})`
        return (t.notes || '').includes(n.text) ? null : { ...own, notes: [t.notes, line].filter(Boolean).join('\n') }
      }).filter(Boolean)
      saveMany([{ ...(id ? v : {}), id: id || newId('study'), kind: 'study', title, url, date: fd.get('date') || today(), minutes: +fd.get('minutes') || 0, notes }, ...techUpdates])
      toast(techUpdates.length ? `Saved, and added notes to ${plural(techUpdates.length, 'move')}` : 'Study saved')
    },
  })
}

// ---------- Mistakes and fixes ----------

function fixBody(reason) {
  const f = FIXES[reason]
  return `<p style="margin:8px 0">${esc(f.summary)}</p>
    <h3>Common errors</h3><ul class="small fix-list">${f.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
    <h3>Cues to fix it</h3><ul class="small fix-list">${f.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <h3>Drill</h3><p class="small">${esc(f.drill)}</p>`
}

function fixesPanel() {
  const counts = {}
  S.roll.filter(r => r.date >= daysAgo(59)).forEach(r => (r.reasons || []).forEach(x => counts[x] = (counts[x] || 0) + 1))
  const order = [...REASONS].sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
  return `<section class="panel wide"><h2>Mistakes and fixes</h2>
    <p class="small muted" style="margin:-6px 0 12px;max-width:70ch">The causes you tick when a roll goes wrong, most frequent first. Each one has the usual errors behind it, cues to fix it and a drill.</p>
    <div class="stack">${order.map(reason => `<details class="map-card">
      <summary><span class="map-title">${esc(reason)}</span><span class="small muted">${counts[reason] ? `ticked ${plural(counts[reason], 'time')} in the last 60 days` : 'not ticked recently'}</span></summary>
      ${fixBody(reason)}</details>`).join('')}</div>
  </section>`
}

export const actions = {
  'review-start': () => { UI.review = { queue: dueCards().map(t => t.id), i: 0, shown: false }; scrollTo(0, 0) },
  'review-show': () => { UI.review.shown = true },
  'review-stop': () => { UI.review = null },
  'review-grade': el => {
    const r = UI.review, t = techById(r.queue[r.i])
    const own = S.tech.find(x => x.id === t.id) || { id: t.id, kind: 'tech' }
    const updates = [{ ...own, srs: schedule(t.srs, el.dataset.grade) }]
    const day = S.settings.srsDay?.date === today() ? S.settings.srsDay : { date: today(), newCount: 0 }
    updates.push({ ...S.settings, srsDay: t.srs ? day : { ...day, newCount: day.newCount + 1 }, reviewLog: [...(S.settings.reviewLog || []), today()].slice(-5000) })
    r.i++
    r.shown = false
    if (r.i >= r.queue.length) { UI.review = null; toast(`Review done: ${plural(r.queue.length, 'card')}`) }
    saveMany(updates)
  },
  'review-remove': () => {
    const r = UI.review, t = techById(r.queue[r.i]), own = S.tech.find(x => x.id === t.id) || { id: t.id, kind: 'tech' }
    r.queue.splice(r.i, 1)
    r.shown = false
    if (r.i >= r.queue.length) UI.review = null
    save({ ...own, deck: false })
    toast(`${t.name} removed from your deck`)
  },
  'new-study': () => studyForm(),
  'edit-study': el => studyForm(el.dataset.id),
  'fix': el => openSheet(el.dataset.reason, fixBody(el.dataset.reason)),
}
