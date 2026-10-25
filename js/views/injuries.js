// Injuries: a body map of what hurts now and what has healed, and how training changed around each one.
import { S, save, saveMany, remove } from '../store.js'
import { UI } from '../ui.js'
import { RESULTS } from '../vocab.js'
import { $, byDateDesc, esc, fmtDate, newId, plural, posRole, toast, today } from '../util.js'
import { chipsEl, field, openSheet, selectEl } from '../sheet.js'
import { BODY_PARTS, CENTER_PARTS, MODS, SEVERITY, SEVERITY_HINT, SIDES, activeInjuries, bodyMap, duration, injuryName, isActive, wireBodyMap } from '../body.js'


export function view() {
  const active = activeInjuries(), past = S.injury.filter(i => !isActive(i)).sort((a, b) => b.endDate.localeCompare(a.endDate))
  return `<div class="page-head"><div><h1>Injuries</h1><p class="lede">Tap where it hurts to log it. Active injuries show in red, healed ones fade. Note what you changed in training, and tag sessions you train around it.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-injury">Log an injury</button></div></div>
    <div class="injury-layout">
      <section class="panel body-panel"><h2 class="sr">Body map</h2>${bodyMap()}
        <p class="legend"><span><i class="key active"></i>Active</span><span><i class="key past"></i>Healed</span><span><i class="key"></i>Tap to log</span></p></section>
      <div class="stack">
        <h2 class="section-title">Active ${active.length ? `<span class="muted">${active.length}</span>` : ''}</h2>
        ${active.length ? active.map(card).join('') : '<p class="muted">Nothing active. Train well.</p>'}
        ${past.length ? `<h2 class="section-title">Healed</h2>${past.map(card).join('')}` : ''}
      </div>
    </div>
    <p class="small muted" style="margin-top:18px;max-width:70ch">This is a log, not medical advice. If something isn’t getting better, or you’re unsure how to train around it, check with a doctor or physio.</p>`
}

export function mount(root) { wireBodyMap(root) }

function causeText(i) {
  const s = S.session.find(x => x.id === i.cause), r = S.roll.find(x => x.id === i.cause)
  if (r) return `a roll on ${fmtDate(r.date)}: ${posRole(r.position, r.role)}`
  if (s) return `${esc(s.type)} on ${fmtDate(s.date)}`
  return ''
}

const HISTORY = { started: 'started', healed: 'healed', reopened: 'flared up again' }
const historyStep = h => h.status === 'changed' ? `${fmtDate(h.date)} ${SEVERITY[h.severity].toLowerCase()}`
  : `${fmtDate(h.date)} ${HISTORY[h.status] || h.status}${h.status !== 'healed' && h.severity ? ' (' + SEVERITY[h.severity].toLowerCase() + ')' : ''}`
const historyLine = i => (i.history || []).length > 1 ? `<p class="small muted">${i.history.map(historyStep).join(' → ')}</p>` : ''

function card(i) {
  const sev = i.severity || 1, cause = causeText(i), from = S.roll.find(r => r.id === i.cause)?.date || S.session.find(s => s.id === i.cause)?.date
  const around = S.session.filter(s => (s.injuryIds || []).includes(i.id)).length
  return `<article class="injury-card ${isActive(i) ? 'is-active s' + sev : 'is-past'}">
    <div class="entry-top"><h3>${esc(injuryName(i))}</h3><span class="tag ${isActive(i) ? 'bad' : ''}">${SEVERITY[sev]}</span></div>
    <p class="small"><strong>${esc(duration(i))}</strong> <span class="muted">· ${fmtDate(i.startDate)}${i.endDate ? ' – ' + fmtDate(i.endDate) : ' – now'}</span></p>
    ${i.description ? `<p class="small" style="max-width:70ch">${esc(i.description)}</p>` : ''}
    ${(i.mods || []).length || i.modNotes ? `<div class="mods"><p class="small muted">Training changes</p>
      ${(i.mods || []).length ? `<div class="tags">${i.mods.map(m => `<span class="tag pos">${esc(m)}</span>`).join('')}</div>` : ''}
      ${i.modNotes ? `<p class="small">${esc(i.modNotes)}</p>` : ''}</div>` : ''}
    ${cause ? `<p class="small muted">From <button class="link" data-act="injury-cause" data-date="${from}">${cause}</button></p>` : ''}
    ${around ? `<p class="small muted">Trained around it in ${plural(around, 'session')}</p>` : ''}
    ${historyLine(i)}
    <div class="row-actions">
      ${isActive(i) ? `<button class="btn sm ghost" data-act="heal-injury" data-id="${i.id}">Mark healed today</button>` : ''}
      <button class="btn sm ghost" data-act="edit-injury" data-id="${i.id}">Edit</button>
    </div></article>`
}

// Recent sessions and their rolls, so you can say which one it came from.
function causeOptions(current) {
  const sessions = [...S.session].sort(byDateDesc).slice(0, 30)
  const linked = S.session.find(s => s.id === current) || S.session.find(s => s.id === S.roll.find(r => r.id === current)?.sessionId)
  if (linked && !sessions.includes(linked)) sessions.push(linked)
  const options = [{ value: '', label: 'Not from training, or not sure' }]
  sessions.forEach(s => {
    options.push({ value: s.id, label: `${fmtDate(s.date)} · ${s.type}` })
    S.roll.filter(r => r.sessionId === s.id).forEach(r => options.push({ value: r.id, label: `   ↳ Roll${r.position ? ': ' + r.position + (r.role && r.role !== 'Neutral' ? ', ' + r.role.toLowerCase() : '') : ''} · ${RESULTS[r.result]?.label || ''}` }))
  })
  return options
}

const sideChips = side => `<div class="chips">${Object.entries(SIDES).map(([v, l]) => `<label class="chip"><input type="radio" name="side" value="${v}" ${v === side ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`
const severityChips = sev => `<div class="chips">${[1, 2, 3].map(n => `<label class="chip sev s${n}"><input type="radio" name="severity" value="${n}" ${n === sev ? 'checked' : ''}><span>${SEVERITY[n]} <span class="chip-hint">· ${SEVERITY_HINT[n].toLowerCase()}</span></span></label>`).join('')}</div>`

function injuryForm(id, preset = {}) {
  const i = id ? S.injury.find(x => x.id === id) : { bodyPart: preset.part || 'Knee', side: preset.side || 'L', severity: 1, startDate: today(), endDate: '', description: '', cause: '', mods: [], modNotes: '' }
  if (!i) return
  const custom = (i.mods || []).filter(m => !MODS.includes(m))
  openSheet(id ? 'Edit injury' : 'Log an injury', `
    <div class="grid2">
      ${field('Where', selectEl('bodyPart', BODY_PARTS, i.bodyPart, 'id="in-part"'))}
      <fieldset data-side ${CENTER_PARTS.includes(i.bodyPart) ? 'hidden' : ''}><legend>Side</legend>${sideChips(i.side || 'L')}</fieldset>
    </div>
    <fieldset><legend>How bad</legend>${severityChips(i.severity || 1)}</fieldset>
    ${field('What happened', `<textarea name="description" id="in-desc" rows="2" placeholder="Tweaked it defending a heel hook; sore when I bend it">${esc(i.description)}</textarea>`)}
    <div class="grid2">
      ${field('Started', `<input type="date" name="startDate" id="in-start" value="${esc(i.startDate)}" required>`)}
      ${field('Healed on', `<input type="date" name="endDate" id="in-end" value="${esc(i.endDate)}">`)}
    </div>
    <p class="hint" style="margin-top:-6px">Leave “Healed on” empty while it’s still bothering you.</p>
    ${field('Did it happen in training?', selectEl('cause', causeOptions(i.cause), i.cause, 'id="in-cause"'))}
    <fieldset><legend>How you’re training around it <span class="hint">Pick any</span></legend>${chipsEl('mods', [...MODS, ...custom], i.mods || [])}</fieldset>
    ${field('Other changes', `<textarea name="modNotes" id="in-mods" rows="2" placeholder="Rolling only with people I trust; physio exercises before class">${esc(i.modNotes)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Save injury',
    onDelete: id ? () => {
      remove(i)
      // Sessions tagged with it drop the tag, so nothing points at a missing injury.
      const tagged = S.session.filter(s => (s.injuryIds || []).includes(id))
      if (tagged.length) saveMany(tagged.map(s => ({ ...s, injuryIds: s.injuryIds.filter(x => x !== id) })))
    } : null,
    onMount: form => form.elements.bodyPart.addEventListener('change', e => { $('[data-side]', form).hidden = CENTER_PARTS.includes(e.target.value) }),
    onSubmit: fd => {
      const startDate = fd.get('startDate'), endDate = fd.get('endDate') || '', severity = +fd.get('severity') || 1
      if (!startDate) { $('#form-error').textContent = 'Add the day it started.'; return false }
      if (endDate && endDate < startDate) { $('#form-error').textContent = 'It can’t heal before it started.'; return false }
      const bodyPart = fd.get('bodyPart')
      const rec = {
        ...(id ? i : {}), id: id || newId('injury'), kind: 'injury', bodyPart, side: CENTER_PARTS.includes(bodyPart) ? '' : fd.get('side') || 'both',
        severity, description: fd.get('description').trim(), startDate, endDate, cause: fd.get('cause') || '',
        mods: fd.getAll('mods'), modNotes: fd.get('modNotes').trim(),
      }
      rec.history = historyAfter(id ? i : null, rec)
      save(rec)
      toast(id ? 'Injury saved' : endDate ? 'Injury logged' : 'Injury logged. Take care of it.')
    },
  })
}

// A short status history: when it started, changed severity, healed or flared up again.
function historyAfter(before, after) {
  const history = [...(before?.history || [])]
  if (!before) return [{ date: after.startDate, status: 'started', severity: after.severity }, ...(after.endDate ? [{ date: after.endDate, status: 'healed' }] : [])]
  if (!before.endDate && after.endDate) history.push({ date: after.endDate, status: 'healed' })
  else if (before.endDate && !after.endDate) history.push({ date: today(), status: 'reopened', severity: after.severity })
  else if (before.severity !== after.severity && !after.endDate) {
    // Several changes on one day keep only the last.
    const last = history[history.length - 1]
    if (last?.status === 'changed' && last.date === today()) history.pop()
    history.push({ date: today(), status: 'changed', severity: after.severity })
  }
  if (history[0]?.status === 'started') history[0] = { ...history[0], date: after.startDate }
  return history
}

// Tapping the map opens what's active there, or starts a new injury in that spot.
function atSpot(part, side) {
  return activeInjuries().find(i => i.bodyPart === part && (CENTER_PARTS.includes(part) || i.side === side || i.side === 'both' || !i.side))
}

export const actions = {
  'new-injury': () => injuryForm(),
  'edit-injury': el => injuryForm(el.dataset.id),
  'body-part': el => { const hit = atSpot(el.dataset.part, el.dataset.side); injuryForm(hit?.id, { part: el.dataset.part, side: el.dataset.side }) },
  'heal-injury': el => {
    const i = S.injury.find(x => x.id === el.dataset.id)
    if (!i) return
    const rec = { ...i, endDate: today() < i.startDate ? i.startDate : today() }
    save({ ...rec, history: historyAfter(i, rec) })
    toast(`${injuryName(i)} marked healed`)
  },
  'injury-cause': el => { UI.view = 'journal'; UI.calDay = el.dataset.date; UI.calMonth = el.dataset.date.slice(0, 7); scrollTo(0, 0) },
}
