// Picking moves without scrolling a 600-line list.
// The move finder: a full-screen search over every move, your recent and starred moves first,
// the rest grouped by position and type. Every single-move field in the app opens it.
// The chain builder: tap where a roll started, then the moves as they happened. Each pick moves you
// to where that move lands (the Live roll game's transitions), so the likely next moves are on screen.
import { S, cached, save } from './store.js'
import { LIBRARY_GROUPS, POSITIONS, TECH_TYPES } from './vocab.js'
import { $, byDateDesc, esc, fmtDate, today, toast } from './util.js'
import { MOVE_OUTCOMES, allTechs, rollMoves, sparred, techById, techUsage } from './model.js'
import { describe, fits, flip, key, landing, menuFor } from './sim.js'
import { homeFor, saveChain } from './views/sim.js'

// ---------- Search: every word a prefix, initials ("rnc"), squashed ("armbar"), or one typo ----------

const ALIASES = {
  'Rear naked choke': 'mata leao', 'Kimura': 'double wristlock', 'Americana': 'keylock', 'Arm triangle': 'kata gatame head and arm',
  'Triangle choke': 'sankaku', 'Straight ankle lock': 'footlock', 'Knee cut pass': 'knee slice', 'Torreando pass': 'toreando bullfighter',
  'Ezekiel choke': 'sode guruma jime', 'Headquarters': 'hq', 'Knee on belly to mount': 'kob', 'Saddle (inside sankaku)': 'honey hole 411',
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ’']/g, '')
const words = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean)

const searchIndex = () => cached('moveSearch', () => allTechs().map(t => {
  const name = words(t.name), extra = words([ALIASES[t.name], ...(t.aliases || [])].join(' '))
  return { t, name, all: [...name, ...extra], squashed: name.join(''), initials: name.map(w => w[0]).join('') }
}))

// Within one edit (a missing, extra or swapped letter), for typos like "trinagle".
function nearly(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1)
    || a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)
}

// Letters in order inside one word, starting with its first: "mnt" finds "mount".
const within = (w, x) => { let i = 0; for (const c of x) if (c === w[i]) i++; return w[0] === x[0] && i === w.length }

function matchScore(m, q) {
  const squashed = q.join('')
  if (m.squashed.startsWith(squashed)) return 6
  if (q.every(w => m.all.some(x => x.startsWith(w)))) return 5
  if (squashed.length > 1 && m.initials.startsWith(squashed)) return 4
  if (m.squashed.includes(squashed)) return 3
  // Word by word: a prefix, a typo, letters in order, or initials ("sc to mnt" finds "Side control to mount").
  if (q.every(w => m.all.some(x => x.startsWith(w) || nearly(w, x.slice(0, w.length)) || nearly(w, x) || within(w, x)) || w.length > 1 && m.initials.includes(w))) return 2
  return 0
}

export function searchMoves(text, limit = 30) {
  const q = words(text), uses = techUsage()
  if (!q.length) return []
  // A name that starts with your first word ranks above one that only contains it.
  const lead = m => m.name[0].startsWith(q[0]) || nearly(q[0], m.name[0].slice(0, q[0].length)) ? 0.5 : 0
  return searchIndex().map(m => [m.t, matchScore(m, q) && matchScore(m, q) + lead(m)]).filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1] || (uses[b[0].id] || 0) - (uses[a[0].id] || 0) || a[0].name.length - b[0].name.length)
    .slice(0, limit).map(([t]) => t)
}

// Moves from your latest logs, newest first.
const recentMoves = () => cached('recentMoves', () => {
  const ids = []
  ;[...sparred(), ...S.session].sort(byDateDesc).forEach(x => (x.kind !== 'session' ? rollMoves(x).map(m => m.techId) : [...(x.drilled || []), ...(x.reps || []).map(r => r.techId)])
    .forEach(id => { if (techById(id) && !ids.includes(id)) ids.push(id) }))
  return ids.slice(0, 10)
})

// ---------- The move finder ----------

const opt = (t, note = t.type) => `<button type="button" class="finder-opt" data-pick="${esc(t.id)}"><span>${esc(t.name)}</span><span class="small muted">${esc(note)}</span></button>`

function finderList({ near, empty, value }) {
  const all = allTechs(), starred = all.filter(t => t.starred)
  const here = near ? suggest(near, []).slice(0, 12).map(techById) : []
  const section = (title, list, note) => list.length ? `<p class="finder-sub">${esc(title)}</p>${list.map(t => opt(t, note?.(t))).join('')}` : ''
  return (empty && value ? `<button type="button" class="finder-opt clear" data-pick=""><span>${esc(empty)}</span><span class="small muted">Clear</span></button>` : '')
    + section(near ? 'Likely from ' + label(near.pos, near.role) : '', here)
    + section('Recent', recentMoves().map(techById), t => t.position)
    + section('Starred', starred, t => t.position)
    + LIBRARY_GROUPS.map(g => {
      const list = all.filter(t => t.position === g)
      return list.length ? `<details class="finder-group"><summary>${esc(g)} <span class="small muted">${list.length}</span></summary>
        ${TECH_TYPES.map(type => section(type, list.filter(t => t.type === type).sort((a, b) => a.name.localeCompare(b.name)))).join('')}</details>` : ''
    }).join('')
}

// Opens over whatever sheet is showing; picking calls onPick(id) and closes it.
export function findMove({ title = 'Pick a move', value = '', empty = '', near = null, onPick }) {
  let dlg = $('#finder')
  if (!dlg) { document.body.insertAdjacentHTML('beforeend', '<dialog id="finder" class="finder"></dialog>'); dlg = $('#finder') }
  dlg.innerHTML = `<div class="finder-wrap">
    <div class="finder-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-finder-close aria-label="Close">×</button></div>
    <div class="finder-search"><input type="search" placeholder="Search: “knee cut”, “rnc”, “dlr”" autocomplete="off" enterkeyhint="done" aria-label="Search moves"></div>
    <div class="finder-body">${finderList({ near, empty, value })}</div></div>`
  const input = $('input', dlg), body = $('.finder-body', dlg), list = body.innerHTML
  input.addEventListener('input', () => {
    const hits = searchMoves(input.value)
    body.innerHTML = !input.value.trim() ? list : hits.length ? hits.map(t => opt(t, t.position)).join('') : '<p class="muted small">No move by that name. Add your own under Game → Moves.</p>'
  })
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-pick]', body)?.click() } })
  dlg.onclick = e => {
    const pick = e.target.closest('[data-pick]')
    if (pick) { dlg.close(); onPick(pick.dataset.pick) }
    else if (e.target.closest('[data-finder-close]') || e.target === dlg) dlg.close()
  }
  dlg.showModal()
  if (matchMedia('(pointer:fine)').matches) input.focus()
}

// A single-move field: a button showing the move, over a hidden input the form reads.
export function techSelect(name, value, { empty = 'None', extra = '' } = {}) {
  const t = techById(value)
  return `<span class="tech-field"><input type="hidden" name="${name}" value="${esc(t ? t.id : '')}"><button type="button" class="tech-btn ${t ? '' : 'empty'}" data-tech-pick data-empty="${esc(empty)}" ${extra}>${esc(t?.name || empty)}</button></span>`
}

export function wireTechFields(form) {
  form.addEventListener('click', e => {
    const btn = e.target.closest('[data-tech-pick]')
    if (!btn) return
    const input = btn.previousElementSibling
    findMove({ value: input.value, empty: btn.dataset.empty, onPick: id => {
      input.value = id
      btn.textContent = techById(id)?.name || btn.dataset.empty
      btn.classList.toggle('empty', !id)
      input.dispatchEvent(new Event('change', { bubbles: true }))
    } })
  })
}

// ---------- Where moves lead, and what usually comes next ----------

const theirs = at => ({ pos: at.pos, role: flip(at.role) })

// What you (or partners, on you) did from each spot, and what followed each move: your rolls and your sequences.
const history = () => cached('chainHistory', () => {
  const at = {}, after = {}
  const bump = (table, k, id, n = 1) => { if (k && id) (table[k] ||= {})[id] = (table[k][id] || 0) + n }
  sparred().forEach(r => {
    const chain = r.chain?.length ? r.chain : rollMoves(r).map(m => ({ position: r.position, role: r.role, techId: m.techId, who: m.outcome === 'caughtBy' ? 'them' : 'me', weak: true }))
    chain.forEach((m, i) => {
      bump(at, key(m.position, m.who === 'them' ? flip(m.role) : m.role), m.techId, m.weak ? 1 : 2)
      bump(after, chain[i - 1]?.techId, m.techId)
    })
  })
  S.seq.forEach(s => s.nodes.forEach(n => {
    if (!n.techId) return
    let parent = s.nodes.find(p => p.id === n.parentId)
    while (parent && !parent.techId) parent = s.nodes.find(p => p.id === parent.parentId)
    if (parent) bump(after, parent.techId, n.techId, 2)
    else if (s.position) bump(at, key(s.position, n.who === 'them' ? flip(s.role) : s.role), n.techId, 2)
  }))
  return { at, after }
})

// Most likely moves from a spot, best first: your history here and after the last move,
// then the game's menu for the spot, then the library's moves for the position.
// Anything off the game's menu must belong to this side: after they shrimp out, you don't pass from bottom.
export function suggest(at, steps) {
  const score = {}, h = history(), uses = techUsage()
  const setups = steps.map(s => s.techId).filter(Boolean), last = setups[setups.length - 1], menu = menuFor({ ...at, setups })
  const onMenu = new Set(menu.map(m => m.id))
  const add = (id, n) => { const t = techById(id); if (t && (onMenu.has(id) || fits(t, at))) score[id] = (score[id] || 0) + n }
  Object.entries(h.at[key(at.pos, at.role)] || {}).forEach(([id, n]) => add(id, 3 * n))
  Object.entries(h.after[last] || {}).forEach(([id, n]) => add(id, 4 * n))
  menu.forEach(m => add(m.id, 2))
  allTechs().filter(t => t.position === at.pos).forEach(t => add(t.id, t.starred ? 1.5 : 0.5))
  Object.keys(score).forEach(id => { score[id] += Math.min(uses[id] || 0, 10) * 0.2 })
  return Object.keys(score).sort((a, b) => score[b] - score[a])
}

// ---------- The chain builder ----------
// State lives on the element as JSON: { pos, role, steps, ... }. A step is a move { techId, outcome }
// or a position you moved to by hand { pos, role }. Positions after each move are worked out on replay,
// so changing an outcome or removing a step re-routes the rest of the chain.

export function replay({ pos, role, steps = [] }) {
  let now = { pos, role }
  const items = steps.map((s, i) => {
    if (!s.techId) return { i, mark: true, from: now, to: now = { pos: s.pos, role: s.role } }
    const to = s.outcome === 'landed' ? landing(s.techId, now) : s.outcome === 'caughtBy' ? landing(s.techId, theirs(now)) && theirs(landing(s.techId, theirs(now))) : null
    const item = { i, techId: s.techId, outcome: s.outcome, unsure: s.conf < 0.75, from: now, to: to || now }
    now = item.to
    return item
  })
  return { items, now }
}

// A saved chain back into builder steps: a position you moved to by hand comes back as its own step.
function chainSteps(r) {
  if (!r.chain?.length) return (r.moves || []).map(m => ({ techId: m.techId, outcome: m.outcome }))
  const steps = []
  r.chain.forEach(m => {
    const now = replay({ pos: r.position, role: r.role, steps }).now
    if (m.position !== now.pos || m.role !== now.role) steps.push({ pos: m.position, role: m.role })
    steps.push({ techId: m.techId, outcome: m.outcome })
  })
  return steps
}

const label = (pos, role) => pos + (role && role !== 'Neutral' ? ` · ${role.toLowerCase()}` : '')
const OUTCOME_NEXT = { landed: 'tried', tried: 'caughtBy', caughtBy: 'landed' }

// The chain as a picture: position → move → position, landed in green, caught in red.
function flowHtml(state, edit) {
  const { items } = replay(state)
  let shown = state.pos + '|' + state.role
  const pos = at => { const k = at.pos + '|' + at.role; if (k === shown) return ''; shown = k; return `<li><span class="flow-pos">${esc(label(at.pos, at.role))}</span></li>` }
  // A move followed by a position you named shows that position, not the one the move usually lands in.
  return `<ol class="flow"><li><span class="flow-pos">${esc(label(state.pos, state.role))}</span></li>${items.map((x, n) => x.mark ? pos(x.to) : pos(x.from) + `<li><span class="flow-move o-${x.outcome} ${edit && x.unsure ? 'unsure' : ''}">${edit
    ? `<button type="button" data-ch="cycle" data-i="${x.i}" aria-label="${esc(techById(x.techId)?.name)}: ${MOVE_OUTCOMES[x.outcome]}. Tap to change">${x.outcome === 'caughtBy' ? '<b>They:</b> ' : ''}${esc(techById(x.techId)?.name)}${x.unsure ? '?' : ''} <span class="o-lbl">${MOVE_OUTCOMES[x.outcome]}</span></button><button type="button" class="x" data-ch="drop" data-i="${x.i}" aria-label="Remove">×</button>`
    : `${x.outcome === 'caughtBy' ? '<b>They:</b> ' : ''}${esc(techById(x.techId)?.name)}${x.outcome === 'tried' ? ' <span class="o-lbl">tried</span>' : ''}`}</span></li>` + (items[n + 1]?.mark ? '' : pos(x.to))).join('')}</ol>`
}

// A saved roll's chain, for the journal cards. Rolls logged before chains show nothing here.
export const rollFlow = r => r.chain?.length && r.position ? flowHtml({ pos: r.position, role: r.role, steps: chainSteps(r) }, false) : ''

const chip = (t, who) => `<button type="button" class="pick-chip ${who}" data-ch="add" data-id="${esc(t.id)}" data-who="${who}">${esc(t.name)}</button>`

function positionStep(state) {
  const pick = state.pickPos, question = state.steps.length ? 'Where did it go?' : 'Where did it start?'
  // Once a position is picked, the grid folds away so the two sides sit right under your thumb.
  if (pick) return `<p class="pick-step"><span class="step-n small-n">1</span>${question} <b>${esc(pick)}</b> <button type="button" class="link small" data-ch="repick">Change</button></p>
    <p class="pick-step"><span class="step-n small-n">2</span>Which side were you on?</p>
    <div class="role-grid">${['Top', 'Bottom'].map(r => `<button type="button" class="pos-btn role" data-ch="role" data-v="${r}"><b>${r}</b><span class="small muted">${esc(describe({ pos: pick, role: r }))}</span></button>`).join('')}</div>`
  return `<p class="pick-step"><span class="step-n small-n">1</span>${question}</p>
    <div class="pos-grid">${POSITIONS.map(p => `<button type="button" class="pos-btn ${p === state.hint ? 'hint' : ''}" data-ch="pos" data-v="${esc(p)}">${esc(p)}${p === state.hint ? ' <span class="small muted">last time</span>' : ''}</button>`).join('')}</div>
    ${state.pos ? '<div><button type="button" class="link small" data-ch="cancel">Keep the position you had</button></div>' : ''}`
}

function builderHtml(state) {
  if (!state.pos || state.picking) return positionStep(state)
  const { now } = replay(state), them = theirs(now)
  const mine = suggest(now, state.steps).map(techById), theirsList = suggest(them, state.steps).slice(0, 6).map(techById)
  const shown = state.more ? 24 : 8, myMoves = state.steps.filter(s => s.techId).length
  return `${flowHtml(state, true)}${unsureHtml(state)}
    <div class="chain-now"><span>${esc(describe(now))}.</span>
      <span class="chain-tools"><button type="button" class="link small" data-ch="change">Change position</button>${state.steps.length ? '<button type="button" class="link small" data-ch="undo">Undo</button>' : ''}</span></div>
    <p class="field-label">${state.steps.length ? 'Then you…' : 'You…'} <span class="hint">Tap to add. Tap a move above to switch landed, tried, caught by.</span></p>
    <div class="pick-chips">${mine.slice(0, shown).map(t => chip(t, 'me')).join('')}${mine.length > shown ? `<button type="button" class="pick-chip more" data-ch="more">More</button>` : ''}</div>
    ${theirsList.length ? `<p class="field-label">Or they… <span class="hint">What your partner did to you</span></p><div class="pick-chips">${theirsList.map(t => chip(t, 'them')).join('')}</div>` : ''}
    <div class="chain-search"><input type="search" data-chain-q placeholder="Search any move" autocomplete="off" enterkeyhint="done" aria-label="Search any move"><button type="button" class="btn sm ghost" data-ch="browse">Browse</button></div>
    <div class="chain-hits" data-chain-hits></div>
    ${myMoves >= 2 ? `<div>${state.saved ? '<span class="small muted">Saved to your sequences ✓</span>' : '<button type="button" class="btn sm ghost" data-ch="save-seq">Save this chain as a sequence</button>'}</div>` : ''}`
}

// Steps the describer guessed at ("trinagle", "underhook") ask once: the guess first, then up to three others.
// Tapping one settles it and teaches the describer that word.
function unsureHtml(state) {
  const rows = state.steps.map((s, i) => [s, i]).filter(([s]) => s.techId && s.conf < 0.75)
  return rows.length ? `<div class="unsure-list"><p class="field-label">Did you mean… <span class="hint">These were a guess. Tap the right move and it’s remembered.</span></p>
    ${rows.map(([s, i]) => `<div class="unsure-row"><span class="small muted">“${esc(s.phrase)}”</span><div class="pick-chips">${[s.techId, ...(s.alts || [])].slice(0, 4).map(techById).filter(Boolean).map((t, j) =>
      `<button type="button" class="pick-chip ${j ? '' : 'me'}" data-ch="swap" data-i="${i}" data-id="${esc(t.id)}">${esc(t.name)}${j ? '' : ' ✓'}</button>`).join('')}<button type="button" class="pick-chip more" data-ch="find" data-i="${i}">Find move</button></div></div>`).join('')}</div>` : ''
}

// The describer's words for your moves: a phrase you corrected → the move you meant. Kept with your settings, so backups carry it.
export function learnWord(phrase, techId) {
  if (phrase && techId && S.settings.moveWords?.[phrase] !== techId) save({ ...S.settings, moveWords: { ...S.settings.moveWords, [phrase]: techId } })
}

// prefix names the roll in a form with several ("r0_"); hint is the position to suggest first.
export function chainBuilder(prefix, r = {}, hint = '') {
  const state = { pos: r.position || '', role: r.role || '', steps: chainSteps(r), hint, date: r.date || '' }
  return `<div class="chain" data-chain="${esc(prefix)}" data-state="${esc(JSON.stringify(state))}">${builderHtml(state)}</div>`
}

const stateOf = box => JSON.parse(box.dataset.state)
function update(box, state) {
  delete state.pickPos
  box.dataset.state = JSON.stringify(state)
  box.innerHTML = builderHtml(state)
}

// A chain the describer built from your words replaces what the builder had.
export function loadChain(box, { pos, role, steps }) {
  update(box, { ...stateOf(box), pos, role, steps, picking: false, saved: false, more: false })
}

// A sequence picked elsewhere in the form sets where the chain starts, unless moves are already in.
export function setChainStart(box, pos, role) {
  const state = stateOf(box)
  if (!state.steps.length) update(box, { ...state, pos, role: pos === 'Standing' ? 'Neutral' : role || 'Top', picking: false })
}

export function readChain(box) {
  const state = stateOf(box)
  const chain = replay(state).items.filter(x => x.techId).map(x => ({ position: x.from.pos, role: x.from.role, techId: x.techId, outcome: x.outcome, who: x.outcome === 'caughtBy' ? 'them' : 'me' }))
  const seen = new Set()
  const moves = chain.filter(m => !seen.has(m.techId + m.outcome) && seen.add(m.techId + m.outcome)).map(({ techId, outcome }) => ({ techId, outcome }))
  return { position: state.pos, role: state.role, chain, moves }
}

function saveAsSequence(box, state) {
  const { chain } = readChain(box)
  const kept = chain.filter(m => m.outcome !== 'tried')
  while (kept[0]?.who === 'them') kept.shift()
  if (kept.filter(m => m.who === 'me').length < 2) { toast('Mark at least two of your moves landed to save a chain.'); return }
  const c = { from: { pos: state.pos, role: state.role }, steps: kept.map(m => ({ who: m.who, techId: m.techId, label: techById(m.techId).name })) }
  saveChain(c, homeFor(c)?.id, `From your roll on ${fmtDate(state.date || today())}`)
  update(box, { ...state, saved: true })
}

export const addChainStep = (box, techId, who) => addStep(box, stateOf(box), techId, who)

function addStep(box, state, techId, who) {
  state.steps.push({ techId, outcome: who === 'them' ? 'caughtBy' : 'landed' })
  update(box, { ...state, more: false, saved: false })
  navigator.vibrate?.(8)
}

export function wireChains(form) {
  form.addEventListener('click', e => {
    const btn = e.target.closest('[data-ch]'), box = btn?.closest('[data-chain]')
    if (!box) return
    const state = stateOf(box), v = btn.dataset.v, i = +btn.dataset.i
    switch (btn.dataset.ch) {
      case 'pos':
        if (v === 'Standing') return finishPosition(box, state, v, 'Neutral')
        box.innerHTML = builderHtml({ ...state, pickPos: v })
        box.dataset.pick = v
        return
      case 'role': return finishPosition(box, state, box.dataset.pick, v)
      case 'repick': return update(box, state)
      case 'cancel': return update(box, { ...state, picking: false })
      case 'change': return update(box, { ...state, picking: true })
      case 'undo': state.steps.pop(); return update(box, { ...state, saved: false })
      case 'drop': state.steps.splice(i, 1); return update(box, { ...state, saved: false })
      case 'cycle': state.steps[i].outcome = OUTCOME_NEXT[state.steps[i].outcome] || 'landed'; return update(box, { ...state, saved: false })
      case 'more': return update(box, { ...state, more: true })
      case 'add': return addStep(box, state, btn.dataset.id, btn.dataset.who)
      case 'browse': return findMove({ title: 'Add a move', near: replay(state).now, onPick: id => id && addStep(box, stateOf(box), id, 'me') })
      case 'save-seq': return saveAsSequence(box, state)
      case 'swap': return settle(box, state, i, btn.dataset.id)
      case 'find': return findMove({ title: `“${state.steps[i].phrase}” is…`, near: replay({ ...state, steps: state.steps.slice(0, i) }).now, onPick: id => id && settle(box, stateOf(box), i, id) })
    }
  })
  form.addEventListener('input', e => {
    if (!e.target.matches('[data-chain-q]')) return
    const hits = searchMoves(e.target.value, 8)
    e.target.closest('[data-chain]').querySelector('[data-chain-hits]').innerHTML = hits.map(t =>
      `<div class="hit"><button type="button" class="hit-main" data-ch="add" data-id="${esc(t.id)}" data-who="me"><span>${esc(t.name)}</span><span class="small muted">${esc(t.position)}</span></button><button type="button" class="mini" data-ch="add" data-id="${esc(t.id)}" data-who="them">They did</button></div>`).join('')
      || (e.target.value.trim() ? '<p class="small muted">No move by that name.</p>' : '')
  })
  // Enter adds the top match instead of submitting the form.
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.matches('[data-chain-q]')) return
    e.preventDefault()
    e.target.closest('[data-chain]').querySelector('[data-chain-hits] [data-ch]')?.click()
  })
}

// A different move, or a misspelling confirmed, is learned. Confirming a guess between moves ("triangle") isn't:
// where you are keeps deciding that one.
function settle(box, state, i, techId) {
  const s = state.steps[i]
  if (techId !== s.techId || s.conf <= 0.6) learnWord(s.phrase, techId)
  state.steps[i] = { ...state.steps[i], techId, conf: 1 }
  update(box, { ...state, saved: false })
}

function finishPosition(box, state, pos, role) {
  delete box.dataset.pick
  if (!state.pos || !state.steps.length) return update(box, { ...state, pos, role, picking: false })
  state.steps.push({ pos, role })
  update(box, { ...state, picking: false })
}

