// Compete: prepare for the next tournament, then log every match afterward.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { PLACES } from '../vocab.js'
import { $, $$, byDateAsc, daysAgo, esc, fmtDate, fmtDateLong, newId, parseD, pct, plural, posRole, rate, today } from '../util.js'
import { field, openSheet, radioChips, techSelect } from '../sheet.js'
import { ageDivision, currentRank, seqById, techById } from '../model.js'
import { badSpots, hardestMatchup } from '../analysis.js'
import { POINTS } from '../resources.js'

const PREP = [
  ['registered', 'Registered and paid'],
  ['division', 'Division and weight class confirmed'],
  ['weight', 'Weight on target (with the gi on, for gi events)'],
  ['kit', 'Gi or no-gi kit checked against the rules'],
  ['rules', 'Read the rules for my belt, including illegal moves'],
  ['plan', 'Game plan set and drilled'],
  ['travel', 'Travel and check-in time sorted'],
  ['bag', 'Bag packed: kit, ID, water, snacks, tape'],
]

const SLOTS = [['standing', 'Standing', 'Neutral'], ['top', 'Top', 'Top'], ['bottom', 'Bottom', 'Bottom']]
const METHODS = ['Submission', 'Points', 'Advantages', 'Penalties', 'Referee decision', 'Disqualification']

// IBJJF adult match length in minutes by belt. Events can differ, so the page says so.
const MATCH_MINUTES = { White: 5, Blue: 6, Purple: 7, Brown: 8, Black: 10 }

const saveProfile = patch => save({ ...S.profile, ...patch, id: 'profile_main', kind: 'profile', example: false })
const saveTournament = t => saveProfile({ tournaments: S.profile.tournaments.some(x => x.id === t.id) ? S.profile.tournaments.map(x => x.id === t.id ? t : x) : [...S.profile.tournaments, t] })
const tournamentById = id => S.profile.tournaments.find(t => t.id === id)

// With matches logged, the record comes from them; otherwise from the numbers you entered.
export function recordOf(t) {
  const m = t.matches || []
  if (!m.length) return { wins: +t.wins || 0, losses: +t.losses || 0, subs: +t.subs || 0 }
  return { wins: m.filter(x => x.result === 'Win').length, losses: m.filter(x => x.result === 'Loss').length, subs: m.filter(x => x.result === 'Win' && x.method === 'Submission').length }
}

const seqRate = s => rate(S.roll.filter(r => r.seqId === s.id))
const seqRolls = s => S.roll.filter(r => r.seqId === s.id).length

function bestSequence(role) {
  return S.seq.filter(s => (s.role || 'Neutral') === role).sort((a, b) => (seqRate(b) ?? -1) - (seqRate(a) ?? -1) || seqRolls(b) - seqRolls(a))[0]
}

export function view() {
  const tournaments = [...S.profile.tournaments].sort(byDateAsc)
  const next = tournaments.find(t => t.date >= today())
  const past = tournaments.filter(t => t.date < today()).reverse()
  return `<div class="page-head"><div><h1>Compete</h1><p class="lede">Prepare for your next tournament with a countdown, a checklist and an A-game plan. Afterward, log every match.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-comp">Add tournament</button></div></div>
    <div class="stat-grid">
      ${next ? prepPanel(next) : `<section class="panel wide"><h2>No tournament coming up</h2><p class="muted" style="margin-bottom:12px">Add the next event you’re entering. You get a countdown, a prep checklist and a game plan built from your sequences.</p><button class="btn" data-act="new-comp">Add tournament</button></section>`}
      ${rulesPanel()}
      ${pastPanel(past)}
    </div>`
}

export function mount(root) {
  $$('[data-plan-slot]', root).forEach(sel => sel.addEventListener('change', () => {
    const t = tournamentById(sel.dataset.comp)
    saveTournament({ ...t, plan: { ...(t.plan || {}), [sel.dataset.planSlot]: sel.value } })
  }))
}

function prepPanel(t) {
  const days = Math.round((parseD(t.date) - parseD(today())) / 864e5)
  const done = PREP.filter(([k]) => t.prep?.[k]).length
  const spots = badSpots(daysAgo(59)).groups.slice(0, 2), hard = hardestMatchup(S.roll.filter(r => r.date >= daysAgo(89)))
  return `<section class="panel wide">
    <div class="countdown"><div class="big">${days === 0 ? 'Today' : days}</div><div><p class="lbl">${days === 0 ? '' : days === 1 ? 'day to go' : 'days to go'}</p>
      <h2>${esc(t.name)}</h2><p class="muted">${fmtDateLong(t.date)}${t.division ? ` · ${esc(t.division)}` : ''}</p>
      <div class="row-actions"><button class="btn sm ghost" data-act="edit-comp" data-id="${t.id}">Edit</button></div></div></div>

    <div class="trend-grid" style="margin-top:16px">
      <div><h3>Prep checklist <span class="small muted">${done} of ${PREP.length}</span></h3>
        <ul class="checklist">${PREP.map(([k, label]) => `<li style="grid-template-columns:32px minmax(0,1fr)">
          <button class="check ${t.prep?.[k] ? 'on' : ''}" data-act="prep-check" data-comp="${t.id}" data-key="${k}" aria-pressed="${!!t.prep?.[k]}" aria-label="${esc(label)}">${t.prep?.[k] ? '✓' : ''}</button>
          <span class="check-name">${esc(label)}</span></li>`).join('')}</ul></div>

      <div><h3>A-game plan</h3><p class="small muted">One sequence for each phase of the match. Drill these, not new moves, in the last weeks.</p>
        ${SLOTS.map(([slot, label, role]) => planSlot(t, slot, label, role)).join('')}
        ${spots.length || hard ? `<h3 style="margin-top:14px">Sharpen before the event</h3><ul class="small fix-list">
          ${spots.map(g => `<li>${posRole(g.position, g.role)}: ${plural(g.n, 'breakdown')} in the last 60 days</li>`).join('')}
          ${hard ? `<li>Against ${esc(hard.label)} partners: ${pct(hard.rate)} success, against ${pct(hard.others)} with everyone else</li>` : ''}</ul>` : ''}
      </div>
    </div>
  </section>`
}

function planSlot(t, slot, label, role) {
  const chosen = seqById(t.plan?.[slot]) || null, suggested = !chosen && bestSequence(role)
  const shown = chosen || suggested
  const options = [{ value: '', label: suggested ? `Suggested: ${suggested.name}` : 'Pick a sequence' }, ...S.seq.map(s => ({ value: s.id, label: s.name + (seqRolls(s) ? ` (${pct(seqRate(s))})` : '') }))]
  const first = shown?.nodes.find(n => !n.parentId), reactions = shown && first ? shown.nodes.filter(n => n.parentId === first.id) : []
  return `<div class="plan-slot"><label class="field"><span class="field-label">${label}</span>
      <select data-plan-slot="${slot}" data-comp="${t.id}">${options.map(o => `<option value="${esc(o.value)}" ${o.value === (t.plan?.[slot] || '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
    ${shown ? `<p class="small" style="margin-top:6px"><strong>${esc(first?.label || shown.name)}</strong>${reactions.length ? ` → answers for ${reactions.map(r => esc(r.label.toLowerCase())).join('; ')}` : ''}</p>
      <div class="row-actions"><button class="btn sm ghost" data-act="open-seq" data-id="${shown.id}">Open</button><button class="btn sm ghost" data-act="plan-quiz" data-id="${shown.id}">Quiz me on it</button></div>` : ''}
  </div>`
}

function rulesPanel() {
  const belt = currentRank().belt
  return `<section class="panel"><h2>Rules for your division</h2>
    <p>As an adult ${belt.toLowerCase()} belt, IBJJF matches usually last <strong>${MATCH_MINUTES[belt]} minutes</strong>.${ageDivision(S.profile.birthday) ? ` Your age division is <strong>${ageDivision(S.profile.birthday).label}</strong>; masters matches are often shorter.` : ' Add your birthday to your profile to see your age division.'}</p>
    <div class="table-scroll" style="margin-top:10px"><table><thead><tr><th scope="col">Position</th><th scope="col">Points</th></tr></thead>
      <tbody>${POINTS.table.map(([what, pts]) => `<tr><td>${esc(what)}</td><td>${pts}</td></tr>`).join('')}</tbody></table></div>
    <ul class="small fix-list" style="margin-top:10px">${POINTS.notes.map(n => `<li>${esc(n)}</li>`).join('')}
      <li>Some submissions, especially leg locks, are illegal at lower belts. Check the illegal techniques table for your belt.</li>
      <li>At IBJJF gi events you weigh in wearing your gi, right before your first match.</li></ul>
    <p class="small muted">Rules change and other organizations differ. Check your event’s rules, and <a href="https://ibjjf.com/" target="_blank" rel="noopener noreferrer">ibjjf.com</a> for the current IBJJF rule book.</p>
  </section>`
}

function pastPanel(past) {
  const all = past.map(recordOf), wins = all.reduce((n, r) => n + r.wins, 0), losses = all.reduce((n, r) => n + r.losses, 0)
  return `<section class="panel"><h2>Past events</h2>
    ${past.length ? `<p class="muted" style="margin-bottom:10px">${plural(past.length, 'event')} · ${wins}–${losses} in matches</p>
      <div class="stack">${past.map(eventCard).join('')}</div>` : '<p class="muted">Tournaments you’ve entered show up here, with each match you log.</p>'}
  </section>`
}

function eventCard(t) {
  const rec = recordOf(t)
  return `<article class="res-item">
    <div class="entry-top"><strong>${esc(t.name)}</strong><span class="medal ${t.place && t.place !== 'No medal' ? esc(t.place.toLowerCase()) : ''}">${esc(t.place || 'No medal')}</span></div>
    <p class="small muted">${fmtDate(t.date)} ${t.date.slice(0, 4)}${t.division ? ` · ${esc(t.division)}` : ''} · ${rec.wins}–${rec.losses}</p>
    ${(t.matches || []).length ? `<ul class="match-list">${t.matches.map((m, i) => `<li><span class="result ${m.result === 'Win' ? 'worked' : m.result === 'Loss' ? 'broke' : 'partial'}">${esc(m.result)}</span>
      <span>${esc(m.method)}${m.method === 'Submission' && techById(m.techId) ? `: ${esc(techById(m.techId).name)}` : ''}${m.mine || m.theirs ? ` (${+m.mine || 0}–${+m.theirs || 0})` : ''}${m.opponent ? ` vs ${esc(m.opponent)}` : ''}</span>
      <button class="mini" data-act="edit-match" data-comp="${t.id}" data-i="${i}">Edit</button>
      ${m.notes ? `<p class="small muted" style="grid-column:1/-1">${esc(m.notes)}</p>` : ''}</li>`).join('')}</ul>` : ''}
    ${t.notes ? `<p class="small">${esc(t.notes)}</p>` : ''}
    <div class="row-actions"><button class="btn sm ghost" data-act="new-match" data-comp="${t.id}">Log a match</button><button class="btn sm ghost" data-act="edit-comp" data-id="${t.id}">Edit event</button></div>
  </article>`
}

// ---------- Forms ----------

function tournamentForm(id) {
  const t = id ? tournamentById(id) : { date: today(), name: '', division: '', place: 'No medal', wins: 0, losses: 0, subs: 0, notes: '' }
  if (!t) return
  const hasMatches = (t.matches || []).length
  openSheet(id ? 'Edit tournament' : 'Add a tournament', `
    <div class="grid2">${field('Date', `<input type="date" name="date" id="tc-date" value="${esc(t.date)}" required>`)}${field('Event', `<input type="text" name="name" id="tc-name" value="${esc(t.name)}" placeholder="Fall Open" required>`)}</div>
    ${field('Division', `<input type="text" name="division" id="tc-div" value="${esc(t.division)}" placeholder="${esc(ageDivision(S.profile.birthday)?.label || 'Adult')} ${esc(currentRank().belt)} Gi, ${esc(S.profile.weightClass || 'middleweight')}">`)}
    <p class="hint">Results are for after the event. For an upcoming event, leave them and use the prep checklist.</p>
    <fieldset><legend>Result</legend>${radioChips('place', PLACES, t.place)}</fieldset>
    ${hasMatches ? `<p class="hint">Your record comes from the ${plural(hasMatches, 'match', 'matches')} you’ve logged.</p>` : `<div class="grid3">
      ${field('Matches won', `<input type="number" name="wins" id="tc-w" min="0" max="20" inputmode="numeric" value="${esc(t.wins)}">`)}
      ${field('Matches lost', `<input type="number" name="losses" id="tc-l" min="0" max="20" inputmode="numeric" value="${esc(t.losses)}">`)}
      ${field('Wins by submission', `<input type="number" name="subs" id="tc-s" min="0" max="20" inputmode="numeric" value="${esc(t.subs)}">`)}</div>`}
    ${field('What you learned', `<textarea name="notes" id="tc-notes" rows="3" placeholder="Nerves, what worked, what to drill before the next one">${esc(t.notes)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Add tournament',
    onDelete: id ? () => saveProfile({ tournaments: S.profile.tournaments.filter(x => x.id !== id) }) : null,
    onSubmit: fd => {
      const name = fd.get('name').trim()
      if (!name || !fd.get('date')) { $('#form-error').textContent = 'Add the event name and date.'; return false }
      const rec = { ...t, id: id || newId('comp'), date: fd.get('date'), name, division: fd.get('division').trim(), place: fd.get('place') || 'No medal', notes: fd.get('notes').trim() }
      if (!hasMatches) Object.assign(rec, { wins: +fd.get('wins') || 0, losses: +fd.get('losses') || 0, subs: +fd.get('subs') || 0 })
      saveTournament(rec)
    },
  })
}

function matchForm(compId, index) {
  const t = tournamentById(compId)
  if (!t) return
  const editing = index != null && t.matches?.[index]
  const m = editing || { opponent: '', result: 'Win', method: 'Points', mine: '', theirs: '', techId: '', notes: '' }
  openSheet(editing ? 'Edit match' : `Log a match: ${t.name}`, `
    ${field('Opponent (optional)', `<input type="text" name="opponent" id="m-opp" value="${esc(m.opponent)}" placeholder="Name or team">`)}
    <fieldset><legend>Result</legend>${radioChips('result', ['Win', 'Loss', 'Draw'], m.result)}</fieldset>
    <fieldset><legend>How it ended</legend>${radioChips('method', METHODS, m.method)}</fieldset>
    <div class="grid2">${field('Your points', `<input type="number" name="mine" id="m-mine" min="0" max="99" inputmode="numeric" value="${esc(m.mine)}">`)}${field('Their points', `<input type="number" name="theirs" id="m-theirs" min="0" max="99" inputmode="numeric" value="${esc(m.theirs)}">`)}</div>
    ${field('Submission (if it ended in one)', techSelect('techId', m.techId, { empty: 'None' }))}
    ${field('What happened', `<textarea name="notes" id="m-notes" rows="3" placeholder="How the points were scored, where it was won or lost">${esc(m.notes)}</textarea>`)}`, {
    submitLabel: editing ? 'Save match' : 'Add match',
    onDelete: editing ? () => saveTournament(withRecord({ ...t, matches: t.matches.filter((_, i) => i !== index) })) : null,
    onSubmit: fd => {
      const match = { opponent: fd.get('opponent').trim(), result: fd.get('result') || 'Win', method: fd.get('method') || 'Points', mine: fd.get('mine'), theirs: fd.get('theirs'), techId: fd.get('techId'), notes: fd.get('notes').trim() }
      const matches = editing ? t.matches.map((x, i) => i === index ? match : x) : [...(t.matches || []), match]
      saveTournament(withRecord({ ...t, matches }))
    },
  })
}

// Keeps the stored record in step with the logged matches, for everything else that reads it.
const withRecord = t => ({ ...t, ...recordOf(t) })

export const actions = {
  'new-comp': () => tournamentForm(),
  'edit-comp': el => tournamentForm(el.dataset.id),
  'new-match': el => matchForm(el.dataset.comp),
  'edit-match': el => matchForm(el.dataset.comp, +el.dataset.i),
  'prep-check': el => {
    const t = tournamentById(el.dataset.comp)
    saveTournament({ ...t, prep: { ...(t.prep || {}), [el.dataset.key]: !t.prep?.[el.dataset.key] } })
  },
  'plan-quiz': el => { UI.view = 'sequences'; UI.quiz = { phase: 'setup', topic: 'seq:' + el.dataset.id, length: 10 }; scrollTo(0, 0) },
}
