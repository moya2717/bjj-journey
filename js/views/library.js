import { S, save, remove } from '../store.js'
import { UI } from '../ui.js'
import { LIBRARY_GROUPS, POSITIONS, TECH_TYPES } from '../vocab.js'
import { $, esc, newId, pct, toast, trunc } from '../util.js'
import { field, selectEl, openSheet } from '../sheet.js'
import { MASTERY, allTechs, isCustom, masteryOf, masteryPips, myTechs, rollMoves, sparred, techById } from '../model.js'
import { FLOW, fromRolls, kindFrom, movesFrom, movesInto, moverTerms, needs, posLabel, setsUp, theirsInto } from '../flow.js'
import { attackerOf, describe, flip } from '../sim.js'
import { videoSearch } from '../catalog.js'
import { hydratePhotos } from '../photos.js'
import { techStats } from '../analysis.js'
import { moreButton } from './hub.js'
import { videosSection } from './videos.js'

export function view() {
  const page = stack().at(-1)
  if (page) return page.move ? movePage(techById(page.move)) : posPage(page.pos)
  const scope = UI.libScope === 'mine' && !myTechs().length ? 'all' : UI.libScope
  return `<div class="page-head"><div><h1>Moves</h1><p class="lede">Every common move, ready to pick when you log. Star the ones you’re working on, add your own details and video links, or add moves that aren’t here.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-tech">Add a move</button></div></div>
    <div class="lib-tools">
      <label class="field search"><span class="field-label">Search moves</span><input type="search" id="lib-search" value="${esc(UI.libQ)}" placeholder="Try “armbar” or “sweep”"></label>
      <div class="seg" role="group" aria-label="Which moves">
        <button data-act="lib-scope" data-scope="mine" aria-pressed="${scope === 'mine'}">My moves</button>
        <button data-act="lib-scope" data-scope="all" aria-pressed="${scope === 'all'}">All moves</button>
      </div>
    </div>
    <div class="pos-filter sticky-chips" role="group" aria-label="Filter by position">
      <button class="pill" data-act="lib-group" data-group="" aria-pressed="${!UI.libGroup}">All positions</button>
      ${LIBRARY_GROUPS.map(g => `<button class="pill" data-act="lib-group" data-group="${esc(g)}" aria-pressed="${UI.libGroup === g}">${esc(g)}</button>`).join('')}
    </div>
    <div id="lib-list">${list(scope)}</div>`
}

export function mount(root) {
  $('#lib-search')?.addEventListener('input', e => {
    UI.libQ = e.target.value
    UI.more.moves = 0
    $('#lib-list').innerHTML = list(UI.libScope === 'mine' && !myTechs().length ? 'all' : UI.libScope)
    hydratePhotos(root)
  })
  hydratePhotos(root)
}

function list(scope) {
  const q = UI.libQ.trim().toLowerCase()
  const moves = (scope === 'mine' ? myTechs() : allTechs())
    .filter(t => !UI.libGroup || t.position === UI.libGroup)
    .filter(t => !q || [t.name, t.type, t.position, t.notes].join(' ').toLowerCase().includes(q))
  if (!moves.length) return scope === 'mine' && !q
    ? '<div class="empty-state"><h2>No moves here yet</h2><p>Star moves in “All moves”, or log them in your training. They collect here.</p></div>'
    : '<p class="muted">No moves match. Try another word, or add it as a new move.</p>'
  // The first six, in position order; "Show more" adds six more.
  const ordered = LIBRARY_GROUPS.flatMap(g => moves.filter(t => t.position === g).sort((a, b) => a.name.localeCompare(b.name)))
  const shown = ordered.slice(0, UI.more.moves || 6)
  return LIBRARY_GROUPS.filter(g => shown.some(t => t.position === g)).map(g => `<section class="pos-group"><h2>${esc(g)}</h2><div class="tech-grid">
    ${shown.filter(t => t.position === g).map(card).join('')}</div></section>`).join('') + moreButton('moves', ordered.length, 6)
}

function card(t) {
  const st = techStats(t.id), used = st.n || st.drilled || st.reps
  return `<article class="tech ${t.starred ? 'mine' : ''}">
    <div class="tech-top"><h3><button class="tech-open" data-act="lib-open" data-move="${esc(t.id)}">${esc(t.name)}</button></h3><button class="star" data-act="star" data-id="${esc(t.id)}" aria-pressed="${!!t.starred}" aria-label="${t.starred ? 'Unstar' : 'Star'} ${esc(t.name)}">★</button></div>
    <span class="tech-type">${esc(t.type)}${isCustom(t) ? ' · added by you' : ''}</span>
    ${masteryButton(t)}
    ${(t.photos || []).length ? `<div class="photos">${t.photos.slice(0, 4).map(id => `<button data-act="view-photo" data-id="${id}" aria-label="Open photo"><img data-photo="${id}" alt="${esc(t.name)}"></button>`).join('')}</div>` : ''}
    ${used ? `<div class="tech-stats"><span>Drilled <b>${st.drilled}</b></span><span>Rolls <b>${st.n}</b></span><span>Success <b>${pct(st.rate)}</b></span>${st.reps ? `<span>Reps <b>${st.reps.toLocaleString()}</b></span>` : ''}</div>` : ''}
    ${st.n ? `<div class="meter good"><span style="width:${Math.max(4, (st.rate || 0) * 100)}%"></span></div>` : ''}
    ${t.notes ? `<p class="small">${esc(trunc(t.notes, 160))}</p>` : ''}
    <div class="row-actions">
      ${/^https?:\/\//i.test(t.link || '')
        ? `<a class="btn sm ghost" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">My link</a>`
        : `<a class="btn sm ghost" href="${esc(videoSearch(t.name))}" target="_blank" rel="noopener noreferrer">Find videos</a>`}
      <button class="btn sm ghost" data-act="edit-tech" data-id="${esc(t.id)}">${t.notes || t.link ? 'Edit' : 'Add notes or link'}</button>
    </div>
  </article>`
}

// Tapping steps your own rating up a level. Levels your logs already prove can't be undone by hand.
export function masteryButton(t) {
  const { level } = masteryOf(t)
  return `<button class="mastery" data-act="mastery" data-id="${esc(t.id)}" aria-label="Mastery: ${MASTERY[level]}. Tap to raise">${masteryPips(level)}<span>${MASTERY[level]}</span></button>`
}

function techForm(id) {
  const t = id ? techById(id) : { name: '', position: UI.libGroup || 'Half guard', type: 'Pass', notes: '', link: '', starred: true }
  if (!t) return
  const custom = !id || isCustom(t), own = S.tech.find(x => x.id === id)
  openSheet(id ? t.name : 'Add a move', `
    ${custom ? field('Name', `<input type="text" name="name" id="t-name" value="${esc(t.name)}" placeholder="Knee cut to back take" required>`) : ''}
    ${custom ? `<div class="grid2">${field('Position', selectEl('position', LIBRARY_GROUPS, t.position))}${field('Type', selectEl('type', TECH_TYPES, t.type))}</div>` : `<p class="hint">${esc(t.position)} · ${esc(t.type)}</p>`}
    ${field('Key details', `<textarea name="notes" id="t-notes" rows="4" placeholder="The two or three details that make it work for you">${esc(t.notes)}</textarea>`)}
    ${field('Video or reference link', `<input type="url" name="link" id="t-link" value="${esc(t.link)}" placeholder="https://youtube.com/…" inputmode="url">`)}
    <div class="chips"><label class="chip"><input type="checkbox" name="starred" ${t.starred ? 'checked' : ''}><span>★ In my moves</span></label></div>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Add move',
    deleteLabel: custom ? 'Delete move' : 'Clear my notes',
    onDelete: own ? () => remove(own) : null,
    onSubmit: fd => {
      const name = custom ? fd.get('name').trim() : t.name
      if (!name) { $('#form-error').textContent = 'Give the move a name.'; return false }
      const link = fd.get('link').trim()
      if (link && !/^https?:\/\//i.test(link)) { $('#form-error').textContent = 'Links start with https://'; return false }
      const rec = { ...(own || {}), id: id || newId('tech'), kind: 'tech', notes: fd.get('notes').trim(), link, starred: fd.has('starred') }
      if (custom) Object.assign(rec, { name, position: fd.get('position'), type: fd.get('type') })
      save(rec)
      toast(id ? 'Move saved' : 'Move added to your library')
    },
  })
}

// ---------- Move and position pages ----------
// Pages stack up as you tap from move to position to move; Back steps down one. The stack lives in
// UI.sub, so tapping the Moves tab again returns to the list.
const stack = () => UI.sub.library || []
const nameOf = p => p.move ? techById(p.move)?.name || 'Move' : posLabel(p.pos)
const moveChip = id => `<button class="flow-chip" data-act="lib-open" data-move="${esc(id)}">${esc(techById(id).name)}</button>`
const posChip = k => `<button class="flow-chip pos" data-act="lib-open" data-pos="${esc(k)}">${esc(posLabel(k))}</button>`
// The first n moves; the rest open the position page they come from.
const chips = (ids, n = 6, k = '') => {
  const list = [...new Set(ids)].filter(techById), left = list.length - n
  return `<div class="flow-chips">${list.slice(0, n).map(moveChip).join('')}${left > 0 ? (k ? `<button class="flow-chip more" data-act="lib-open" data-pos="${esc(k)}">+${left} more</button>` : `<span class="flow-chip more">+${left}</span>`) : ''}</div>`
}
const pageHead = title => `<div class="sub-head"><button class="btn sm ghost" data-act="lib-back">‹ ${esc(stack().length > 1 ? trunc(nameOf(stack().at(-2)), 18) : stack()[0]?.from === 'skills' ? 'Skill tree' : 'Moves')}</button><h1>${esc(title)}</h1></div>`
const isFinish = (t, r) => r.stays && t.type === 'Submission'
// Your moves that get you to these positions, then your partner's that put you there. n each, or fewer when both show.
function howHere(keys, n, skip = '') {
  const mine = keys.flatMap(movesInto).filter(id => id !== skip), theirs = keys.flatMap(theirsInto).filter(id => id !== skip), m = mine.length && theirs.length ? Math.ceil(n * 2 / 3) : n
  return (mine.length ? `<p class="flow-sub">Your moves that get you there</p>${chips(mine, m, keys[0])}` : '')
    + (theirs.length ? `<p class="flow-sub">Their moves that put you there</p>${chips(theirs, m, keys[0])}` : '')
}
const home = pos => pos === 'Standing' ? 'Standing|Neutral' : pos + '|' + attackerOf(pos)

function movePage(t) {
  if (!t) return pageHead('Move not found')
  const rows = FLOW[t.id] || [], mine = fromRolls(t.id), froms = [...new Set(rows.map(r => r.from))]
  const used = sparred().flatMap(rollMoves).filter(m => m.techId === t.id), n = o => used.filter(m => m.outcome === o).length
  return `${pageHead(t.name)}
    <div class="mv-meta"><span class="tech-type">${esc(t.position)} · ${esc(t.type)}${isCustom(t) ? ' · added by you' : ''}</span>
      <button class="star" data-act="star" data-id="${esc(t.id)}" aria-pressed="${!!t.starred}" aria-label="${t.starred ? 'Unstar' : 'Star'} ${esc(t.name)}">★</button></div>
    <div class="mv-meta">${masteryButton(t)}<span class="tech-stats"><span>Landed <b>${n('landed')}</b></span><span>Tried <b>${n('tried')}</b></span><span>Caught you <b>${n('caughtBy')}</b></span></span></div>
    ${t.type === 'Movement' ? '<p class="hint">A solo drill: it isn’t done from a position.</p>' : `
    <section class="flow-card"><h2>Comes from</h2>
      ${froms.length ? `<div class="flow-chips">${froms.map(posChip).join('')}</div>`
        : t.flow ? `<div class="flow-chips">${posChip(t.flow.from)}</div><p class="hint">Your map, from your rolls.</p>`
        : `<p class="hint">Not mapped yet.${POSITIONS.includes(t.position) ? ` Filed under</p><div class="flow-chips">${posChip(home(t.position))}</div>` : '</p>'}`}
      ${needs(t.name).length ? `<p class="flow-sub">Once you’ve done</p>${chips(needs(t.name))}` : ''}
      ${froms.length <= 3 ? howHere(froms, 6, t.id) : ""}
    </section>
    <section class="flow-card"><h2>Leads to</h2>${leadsTo(t, rows, mine)}</section>`}
    <section class="flow-card"><h2>From your rolls</h2>${mine.length ? `<ul class="flow-rolls">${mine.map(r => rollRow(r, rows.filter(x => x.lands))).join('')}</ul>` : '<p class="hint">Not in a roll yet. Log a roll move by move and it shows up here.</p>'}</section>
    ${(t.photos || []).length ? `<div class="photos">${t.photos.slice(0, 4).map(id => `<button data-act="view-photo" data-id="${id}" aria-label="Open photo"><img data-photo="${id}" alt="${esc(t.name)}"></button>`).join('')}</div>` : ''}
    ${t.notes ? `<p class="small mv-notes">${esc(t.notes)}</p>` : ''}
    <div class="row-actions">
      ${/^https?:\/\//i.test(t.link || '') ? `<a class="btn sm ghost" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">My link</a>` : ''}
      <button class="btn sm ghost" data-act="edit-tech" data-id="${esc(t.id)}">Edit</button>
    </div>
    ${videosSection({ techId: t.id, pos: t.position })}`
}

// Where it lands from each start (starts that agree share a line), then the moves from its usual landing.
function leadsTo(t, rows, mine) {
  const groups = []
  rows.forEach(r => {
    const sig = JSON.stringify([r.lands, r.stays])
    const g = groups.find(g => g.sig === sig)
    if (g) g.from.push(r.from)
    else groups.push({ sig, from: [r.from], lands: r.lands, stays: r.stays })
  })
  const sometimes = list => list.length ? `<p class="flow-line"><span class="flow-tag">Sometimes</span>${list.map(posChip).join('')}</p>` : ''
  const parts = groups.map(g => (groups.length > 1 && !(g.stays && g.from.length > 1 && !g.lands?.length) ? `<p class="flow-sub">From ${esc(g.from.map(posLabel).join(', '))}</p>` : '') + (
    !g.lands ? unmapped(t, mine)
    : g.stays ? `<p class="flow-line">${isFinish(t, g) ? 'Ends the roll when they tap.' : g.from.length > 1 ? 'Keeps you where you are.' : `Keeps you in ${posChip(g.from[0])}`}</p>${sometimes(g.lands)}`
    : `<p class="flow-line">${g.lands.length > 1 ? '<span class="flow-tag">Usually</span>' : ''}${posChip(g.lands[0])}</p>${sometimes(g.lands.slice(1))}`))
  if (!rows.length) parts.push(unmapped(t, mine))
  const first = groups.find(g => g.lands && !isFinish(t, g) && (!g.stays || g.from.length === 1)), at = first ? (first.stays ? first.from[0] : first.lands[0]) : t.flow?.to
  const next = at ? [...setsUp(t.name), ...movesFrom(at)].filter(id => id !== t.id) : []
  return parts.join('') + (next.length ? `<p class="flow-sub">${first?.stays ? 'Then from here' : 'Then from there'}</p>${chips(next, 6, at)}` : '')
}

function unmapped(t, mine) {
  if (t.flow) return `<p class="flow-line">${posChip(t.flow.from)}<span aria-hidden="true">→</span><span class="sr">to</span>${posChip(t.flow.to)}</p><p class="hint">Your map, from your rolls.</p>`
  const logged = mine.some(r => r.to)
  return `<p class="hint">Not mapped yet: we’d rather say so than guess.</p>
    <button class="btn sm ghost" data-act="lib-map" data-id="${esc(t.id)}" ${logged ? '' : 'disabled'}>Set from my rolls</button>
    ${logged ? '' : '<p class="hint">Log it in a roll, move by move, to set this.</p>'}`
}

// One transition you logged, flagged when the map doesn't list it for that start.
function rollRow(r, mapped) {
  const m = moverTerms(r), gen = mapped.find(x => x.from === m.from)
  const off = m.to && mapped.length && (!gen || !(gen.stays ? [m.from, ...gen.lands] : gen.lands).includes(m.to))
  return `<li><span class="flow-path">${r.theirs ? "You in " : ""}${esc(posLabel(r.from))} <span aria-hidden="true">→</span><span class="sr">to</span> ${r.to ? esc(r.to === r.from ? 'stayed' : posLabel(r.to)) : '<span class="muted">not logged</span>'}</span>
    <span class="tags">${r.landed ? `<span class="tag good">landed ${r.landed}</span>` : ''}${r.tried ? `<span class="tag">tried ${r.tried}</span>` : ''}${r.caughtBy ? `<span class="tag bad">caught you ${r.caughtBy}</span>` : ''}${off ? '<span class="tag pos">not on the map</span>' : ''}</span></li>`
}

function posPage(k) {
  const [pos, role] = k.split('|'), ids = movesFrom(k)
  const group = (label, i) => ids.some(id => kindFrom(id, k) === i) ? `<p class="flow-sub">${label}</p>${chips(ids.filter(id => kindFrom(id, k) === i), 99)}` : ''
  return `${pageHead(posLabel(k))}
    <p class="hint">${esc(describe({ pos, role }))}.</p>
    ${pos !== 'Standing' ? `<div class="flow-chips"><span class="flow-tag">Their side</span>${posChip(pos + '|' + flip(role))}</div>` : ''}
    <section class="flow-card"><h2>Moves from here</h2>${ids.length ? group('Move on', 0) + group('Finish', 1) + group('Hold and set up', 2) : '<p class="hint">None mapped yet.</p>'}</section>
    <section class="flow-card"><h2>How you get here</h2>${howHere([k], 99) || '<p class="hint">Nothing mapped lands here.</p>'}</section>
    ${videosSection({ pos })}`
}

export const actions = {
  'lib-open': el => { UI.sub.library = [...stack(), el.dataset.move ? { move: el.dataset.move } : { pos: el.dataset.pos }]; scrollTo(0, 0) },
  // A move opened from the skill tree goes back there.
  'lib-back': () => { if (stack().length === 1 && stack()[0].from) UI.view = stack()[0].from; UI.sub.library = stack().slice(0, -1); scrollTo(0, 0) },
  // An unmapped move takes its start and landing from the transition you logged most.
  'lib-map': el => {
    const m = fromRolls(el.dataset.id).filter(r => r.to).map(moverTerms)[0], own = S.tech.find(x => x.id === el.dataset.id)
    if (!m) return false
    save({ ...(own || { id: el.dataset.id, kind: 'tech', starred: true }), flow: m })
    toast('Mapped from your rolls')
  },
  'new-tech': () => techForm(),
  'edit-tech': el => techForm(el.dataset.id),
  'star': el => {
    const t = techById(el.dataset.id), own = S.tech.find(x => x.id === t.id)
    save({ ...(own || { id: t.id, kind: 'tech' }), starred: !t.starred })
  },
  'mastery': el => {
    const t = techById(el.dataset.id), own = S.tech.find(x => x.id === t.id) || { id: t.id, kind: 'tech' }
    const next = masteryOf(t).level >= 4 ? 0 : masteryOf(t).level + 1
    const rec = { ...own, mastery: next, starred: own.starred ?? true }
    delete rec.learned
    save(rec)
  },
  'lib-scope': el => { UI.libScope = el.dataset.scope; UI.more.moves = 0 },
  'lib-group': el => { UI.libGroup = el.dataset.group; UI.more.moves = 0 },
}
