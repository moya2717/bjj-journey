// Study: scenario review, video study notes, and fixes for what keeps going wrong.
import { S, saveMany, remove } from '../store.js'
import { UI } from '../ui.js'
import { REASONS } from '../vocab.js'
import { $, $$, byDateDesc, daysAgo, esc, fmtDate, hrs, newId, plural, sum, toast, today, trunc } from '../util.js'
import { field, openSheet, techSelect } from '../sheet.js'
import { techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { FIXES } from '../fixes.js'
import { ANSWERS, PER_WEEK, scenarioLog, thisWeek } from '../scenarios.js'
import { hydratePhotos } from '../photos.js'
import { masteryButton } from './library.js'

export function view() {
  return `<div class="page-head"><div><h1>Study</h1><p class="lede">Think through the rounds that went wrong, keep notes from what you watch, and fix what keeps going wrong.</p></div>
    <div class="head-actions"><button class="btn ghost" data-act="new-study">Log video study</button></div></div>
    <div class="stat-grid">
      <section class="panel wide">${UI.scenario ? scenarioCard() : scenarioIntro()}</section>
      ${videoPanel()}
      ${fixesPanel()}
    </div>`
}

export function mount(root) {
  hydratePhotos(root)
}

// ---------- Scenario review ----------

function scenarioIntro() {
  const { done, left } = thisWeek()
  const head = `<h2>Scenario review</h2><p class="small muted" style="margin:-6px 0 12px;max-width:70ch">Up to ${PER_WEEK} situations a week from your own rolls. Picture what you’d do, then check it against your notes and fixes.</p>`
  if (!S.roll.length) return head + '<p class="muted">Log a few rolls, especially the ones that went wrong. Your scenarios are built from them.</p>'
  return head + `<div class="figures">
      <div class="figure"><div class="big">${left.length}</div><div class="lbl">left this week</div></div>
      <div class="figure"><div class="big">${done}</div><div class="lbl">done this week</div></div>
    </div>
    ${left.length ? `<button class="btn" data-act="scenario-start">Start scenarios</button>`
      : `<p>${done ? 'That’s this week done. New scenarios come on Monday.' : 'Nothing to review right now. Rolls that break down and experiments you plan turn into scenarios.'}</p>`}`
}

function scenarioCard() {
  const r = UI.scenario, sc = r.queue[r.i]
  if (!sc) { UI.scenario = null; return scenarioIntro() }
  const fix = sc.fix, move = techById(sc.focus.techId)
  return `<div class="quiz-head"><span class="small muted">Scenario ${r.i + 1} of ${r.queue.length}</span><button class="btn sm ghost" data-act="scenario-stop">Stop</button></div>
    <div class="meter mat quiz-progress"><span style="width:${r.i / r.queue.length * 100}%"></span></div>
    <p class="tag pos quiz-context">${esc(sc.tag)}</p>
    <h2 class="quiz-prompt">${esc(sc.prompt)}</h2>
    ${!r.shown ? `<p class="small muted">Picture it or say it out loud first.</p><div class="row-actions" style="margin-top:12px"><button class="btn" data-act="scenario-show">Show my notes and fixes</button></div>` : `
      <div class="review-back">
        ${sc.what ? `<h3>What happened</h3><p class="quote">“${esc(sc.what)}”</p>` : ''}
        ${sc.tryNext ? `<h3>Your plan</h3><p>${esc(sc.tryNext.text)} <span class="tag ${sc.tryNext.status === 'worked' ? 'good' : sc.tryNext.status === 'failed' ? 'bad' : ''}">${sc.tryNext.status === 'open' ? 'not tested yet' : sc.tryNext.status === 'worked' ? 'worked' : 'didn’t work'}</span></p>` : ''}
        ${sc.notes ? `<h3>Your note on this step</h3><p>${esc(sc.notes)}</p>` : ''}
        ${fix ? `<h3>Fix: ${esc(fix.reason)}</h3><ul class="small fix-list">${fix.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul><p class="small"><b>Drill:</b> ${esc(fix.drill)}</p>` : ''}
        ${sc.next ? `<h3>What comes next</h3><p class="small muted">${esc(sc.next.from)}</p><ul class="small fix-list">${sc.next.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${move ? `<div class="row-actions">
          <a class="btn sm ghost" href="${esc(move.link || videoSearch(move.name))}" target="_blank" rel="noopener noreferrer">${move.link ? 'My link' : 'Find videos'}</a>
          <button class="btn sm ghost" data-act="edit-tech" data-id="${esc(move.id)}">${esc(move.name)}: notes</button>
          ${masteryButton(move)}</div>` : ''}
      </div>
      <p class="small muted" style="margin-top:14px">How did your answer hold up?</p>
      <div class="grade-row three">${Object.entries(ANSWERS).map(([k, label]) => `<button class="grade ${k}" data-act="scenario-answer" data-answer="${k}"><span>${label}</span><span class="small">${{ got: 'I had it', drill: 'Plan it next class', coach: 'Add a coach question' }[k]}</span></button>`).join('')}</div>`}`
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
  'scenario-start': () => { UI.scenario = { queue: thisWeek().left, i: 0, shown: false }; scrollTo(0, 0) },
  'scenario-show': () => { UI.scenario.shown = true },
  'scenario-stop': () => { UI.scenario = null },
  // Need to drill plans it for your next session; Ask coach adds the question to your latest session.
  'scenario-answer': el => {
    const r = UI.scenario, sc = r.queue[r.i], answer = el.dataset.answer
    const settings = { ...S.settings, scenarioLog: [...scenarioLog(), { date: today(), id: sc.id, answer }].slice(-2000) }
    const updates = [settings]
    if (answer === 'drill') settings.nextPlan = sc.focus
    if (answer === 'coach') {
      const last = [...S.session].sort(byDateDesc)[0]
      if (last) updates.push({ ...last, coachQ: last.coachQ && !last.coachAnswered ? `${last.coachQ} · ${sc.coachQ}` : sc.coachQ, coachAsked: false, coachAnswered: false })
      else settings.nextPlan = { text: `Ask coach: ${sc.coachQ}`, techId: '', seqId: '' }
    }
    r.i++
    r.shown = false
    if (r.i >= r.queue.length) UI.scenario = null
    saveMany(updates)
    toast(answer === 'drill' ? 'Planned for your next session' : answer === 'coach' ? 'Added to your coach questions' : UI.scenario ? 'Nice. Next one.' : 'Scenarios done for now')
  },
  'new-study': () => studyForm(),
  'edit-study': el => studyForm(el.dataset.id),
  'fix': el => openSheet(el.dataset.reason, fixBody(el.dataset.reason)),
}
