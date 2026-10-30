// Skill tree: your moves as a night sky of positions. Dark until you log a move; live successes raise
// it white → blue → purple → brown → black. Pinch or drag to explore, tap a position to open it, and
// zoom in to tap a single move. Your BJJ level sits on top.
import { UI } from '../ui.js'
import { esc, fmtDate, pct, plural } from '../util.js'
import { isSimple } from '../model.js'
import { MAT_HOURS, PROBLEM, THRESHOLDS, TIERS, bjjLevel, skillTree } from '../skills.js'
import { more, subHead, subOf } from './hub.js'

// Where each position's constellation sits: standing on top, guards on the left, pins on the right,
// legs and the back at the bottom. viewBox units.
const W = 1000, H = 1040
const SPOTS = {
  'Standing': [500, 105], 'Front headlock': [800, 150], 'Solo drills': [130, 110], 'Other': [130, 260],
  'Closed guard': [300, 330], 'Half guard': [530, 360], 'Turtle': [860, 350], 'Butterfly guard': [110, 470],
  'Open guard': [320, 570], 'Side control': [720, 540], 'De La Riva': [120, 680], 'X-guard': [460, 720],
  'Knee on belly': [660, 730], 'Mount': [880, 660], 'Reverse De La Riva': [290, 790], 'Spider / lasso': [110, 900],
  'Lapel guards': [290, 960], 'Leg entanglement': [510, 920], 'North-south': [720, 900], 'Back': [890, 900],
}
const SHORT = { 'Reverse De La Riva': 'Reverse DLR', 'De La Riva': 'De La Riva', 'Leg entanglement': 'Leg locks', 'Butterfly guard': 'Butterfly', 'Spider / lasso': 'Spider', 'Front headlock': 'Headlock', 'Lapel guards': 'Lapel', 'Solo drills': 'Solo' }
const GAP = 7.5 // spacing of the spiral each constellation's moves sit on
// Zoomed in this far, a tap opens a single move instead of its position.
const NODE_ZOOM = 2.5

// Moves on a sunflower spiral around the center: brightest in the middle.
const golden = Math.PI * (3 - Math.sqrt(5))
const spiral = (b, [cx, cy]) => [...b.nodes].sort((x, y) => y.tier - x.tier || y.wins - x.wins).map((n, i) =>
  ({ n, x: cx + GAP * Math.sqrt(i + 0.5) * Math.cos(i * golden), y: cy + GAP * Math.sqrt(i + 0.5) * Math.sin(i * golden) }))
const radius = b => GAP * Math.sqrt(b.nodes.length) + 6

let cam = { x: 0, y: 0, k: 1 }
const camera = () => `translate(${cam.x.toFixed(1)} ${cam.y.toFixed(1)}) scale(${cam.k.toFixed(3)})`

function sky(tree) {
  const spot = name => SPOTS[name] || [W / 2, H / 2]
  const links = tree.links.map(l => {
    const [x1, y1] = spot(l.a), [x2, y2] = spot(l.b)
    return `<line class="st-link ${l.lit ? 'lit' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="--w:${Math.min(5, 1 + l.lit)}"/>`
  }).join('')
  const stars = tree.branches.map(b => {
    const [cx, cy] = spot(b.name), pts = spiral(b, [cx, cy]), r = radius(b)
    const dot = ({ n, x, y }) => `<circle class="st-star t${n.tier}${n.caught >= PROBLEM ? ' problem' : ''}" data-act="st-node" data-id="${esc(n.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${n.tier ? 4.4 : 3}"><title>${esc(n.t.name)}: ${TIERS[n.tier]}</title></circle>`
    return `<g class="st-con" data-act="st-branch" data-b="${esc(b.name)}">
      <circle class="st-halo t${b.top}" cx="${cx}" cy="${cy}" r="${r}" style="--p:${b.pct.toFixed(2)}"/>
      <g class="st-dark">${pts.filter(p => !p.n.tier).map(dot).join('')}</g><g class="st-lit">${pts.filter(p => p.n.tier).map(dot).join('')}</g>
      <text class="st-label" x="${cx}" y="${cy + r}" dy="1em">${esc(SHORT[b.name] || b.name)}</text>
      <text class="st-pct" x="${cx}" y="${cy + r}" dy="2.4em">${pct(b.pct)}</text></g>`
  }).join('')
  return `<div class="st-sky-wrap"><svg class="st-sky" id="st-sky" style="--k:${cam.k}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Skill tree map: ${tree.lit} of ${tree.nodes.length} moves explored. The list below has every position.">
      <g id="st-cam" transform="${camera()}">${links}${stars}</g></svg>
    <div class="st-zoom" role="group" aria-label="Zoom the map"><button class="btn sm ghost" data-act="st-zoom" data-z="1.6" aria-label="Zoom in">+</button><button class="btn sm ghost" data-act="st-zoom" data-z="0.625" aria-label="Zoom out">−</button><button class="btn sm ghost" data-act="st-zoom" data-z="0" aria-label="Show the whole map">⤢</button></div>
    <p class="st-tip small muted">Drag or pinch to explore. Tap a position to open it; zoom in to tap a move.</p></div>`
}

const legend = () => `<div class="legend st-legend">${TIERS.map((l, i) => `<span><i class="st-key t${i}"></i>${l}${i > 1 ? ` <span class="muted">${THRESHOLDS[l]}+</span>` : ''}</span>`).join('')}</div>`

// Your level on its belt band: stripes set the floor, the tree fills the rest.
export function levelCard(L = bjjLevel()) {
  if (L.black) return `<section class="st-level black"><div class="st-lv"><span class="w-lbl">BJJ level</span><b>Black Belt Lv ${L.level}</b></div>
    <p class="small">Level 100${L.since ? ` since ${esc(fmtDate(L.since))}` : ''}. Each degree is 10 levels; your tree fills each one.</p>${explain()}</section>`
  const into = (L.level - L.lo) / (L.hi - L.lo)
  return `<section class="st-level" data-belt="${esc(L.belt)}"><div class="st-lv"><span class="w-lbl">BJJ level</span><b>${L.level}</b><span class="small muted">of 100</span></div>
    <div class="st-band"><div class="st-bar" aria-hidden="true"><span style="width:${Math.max(3, Math.round(into * 100))}%"></span>${[1, 2, 3, 4].map(s => `<i style="left:${s * 20}%"></i>`).join('')}</div>
      <p class="small">${esc(L.belt)} belt band · levels ${L.lo}–${L.hi}${L.stripes ? ` · ${plural(L.stripes, 'stripe')} start you at ${L.floor}` : ''}</p>
      ${L.top ? '<p class="st-ready">Top of your band. Ready for the next stripe or belt?</p>' : ''}</div>${explain()}</section>`
}

// The same explainer on the Skill tree and in the Dojo.
export const explain = () => `<details class="explain"><summary>How your level works</summary><p class="small muted">One number from 1 to 100, set by your belt and your skill tree. Each belt is a band: white 1–20, blue 21–40, purple 41–60, brown 61–80. Stripes (from your belt history) raise where you start in the band, and lighting up moves and landing them live fills the rest. Colored moves count more: blue ×3, purple ×6, brown ×10, black ×15. Mat time at your current belt helps a little: about ${MAT_HOURS} hours counts like a quarter of the band’s moves. You can’t pass the top of your band until you’re promoted. Level 100 is the day you get your black belt; then a new track starts, Black Belt Lv 1+, 10 levels per degree.</p></details>`

const bar = b => `<span class="st-mix" aria-hidden="true">${b.tiers.map((n, i) => i && n ? `<i class="t${i}" style="flex:${n}"></i>` : '').join('')}<i class="t0" style="flex:${b.tiers[0]}"></i></span>`

function branchRow(b) {
  return `<li><button class="st-row" data-act="st-branch" data-b="${esc(b.name)}"><span class="st-dot t${b.top}" aria-hidden="true"></span>
    <span class="st-row-main"><b>${esc(b.name)}</b>${bar(b)}<span class="small muted">${b.lit} of ${b.nodes.length} explored${b.top > 1 ? ' · best ' + TIERS[b.top].toLowerCase() : ''}${!isSimple() && (b.wins || b.caught) ? ` · ${b.wins} live wins${b.caught ? ` · caught ${b.caught}×` : ''}` : ''}</span></span>
    <span class="st-row-pct">${pct(b.pct)}</span></button></li>`
}

const blindRow = s => `<li><button class="st-blind" data-act="st-branch" data-b="${esc(s.branch)}"><span>${esc(s.text)}</span><span class="small muted">${plural(s.n, 'move')} to try ›</span></button></li>`

export function view() {
  const tree = skillTree(), b = tree.branches.find(x => x.name === subOf('skills'))
  if (b) return branchView(tree, b)
  return `<div class="page-head"><div><h1>Skill tree</h1><p class="lede">Every move you log lights up. Land it live and it climbs the belts: white, blue, purple, brown, black. The dark patches are your blind spots.</p></div></div>
    ${levelCard()}
    ${sky(tree)}
    ${legend()}
    <p class="small muted st-sum"><b>${tree.lit}</b> of ${tree.nodes.length} moves explored · ${pct(tree.lit / tree.nodes.length)}</p>
    <section aria-labelledby="st-blind-h"><div class="history-head"><h2 id="st-blind-h">Blind spots</h2></div>
      ${tree.blind.length ? `<ul class="list st-blinds">${more('st-blind', tree.blind, 4, blindRow)}</ul>` : '<p class="small muted">None: every kind of move from every position has something explored.</p>'}</section>
    <section aria-labelledby="st-br-h"><div class="history-head"><h2 id="st-br-h">Positions</h2></div>
      <ul class="list st-rows">${tree.branches.map(branchRow).join('')}</ul></section>`
}

function branchView(tree, b) {
  const blind = tree.blind.filter(s => s.branch === b.name)
  const near = tree.links.filter(l => l.a === b.name || l.b === b.name).map(l => ({ name: l.a === b.name ? l.b : l.a, lit: l.lit })).sort((x, y) => y.lit - x.lit)
  const node = n => `<button class="st-node t${n.tier}" data-act="st-move" data-id="${esc(n.id)}"><span class="st-dot t${n.tier}" aria-hidden="true"></span>
    <span class="st-node-name">${esc(n.t.name)}</span>
    <span class="small muted">${n.tier ? TIERS[n.tier] + (n.wins ? ` · ${n.wins} live` : '') : 'Unexplored'}</span>
    ${n.caught >= PROBLEM ? `<span class="st-problem" title="Partners keep catching you with this">caught ${n.caught}×</span>` : ''}</button>`
  return `${subHead(b.name, 'Skill tree')}
    <div class="st-branch-head"><span class="st-dot big t${b.top}" aria-hidden="true"></span><div><b>${pct(b.pct)} explored</b><span class="small muted">${b.lit} of ${b.nodes.length} moves${b.top > 1 ? ` · best ${TIERS[b.top].toLowerCase()}` : ''}</span></div></div>
    ${bar(b)}
    ${isSimple() ? '' : `<div class="st-stats">${TIERS.map((l, i) => `<div><b>${b.tiers[i]}</b><span class="small muted">${l}</span></div>`).join('')}</div>
      <p class="small muted">${plural(b.wins, 'live success', 'live successes')} · caught ${b.caught}× here</p>`}
    ${blind.length ? `<ul class="list st-blinds">${blind.map(s => `<li class="st-blind"><span>${esc(s.text)}</span></li>`).join('')}</ul>` : ''}
    ${b.groups.map(g => `<section class="st-group"><h2 class="field-label">${esc(g.name)} <span class="muted">${g.nodes.filter(n => n.tier).length}/${g.nodes.length}</span></h2>
      <div class="st-nodes">${g.nodes.map(node).join('')}</div></section>`).join('')}
    ${near.length ? `<section class="st-group"><h2 class="field-label">Leads to and from</h2><div class="chips">${near.map(x => `<button class="pill ${x.lit ? 'on' : ''}" data-act="st-branch" data-b="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div></section>` : ''}`
}

// The Profile tile: each position as one dot, colored by its best move and as bright as it's explored.
export function miniTree() {
  const tree = skillTree()
  return `<svg class="st-mini" viewBox="0 0 ${W} ${H}" aria-hidden="true">${tree.branches.map(b => {
    const [x, y] = SPOTS[b.name] || [W / 2, H / 2]
    return `<circle class="st-halo t${b.top}" cx="${x}" cy="${y}" r="${radius(b) + 14}" style="--p:${Math.max(0.15, b.pct).toFixed(2)}"/>`
  }).join('')}</svg>`
}

// ---------- Drag and pinch, with pointer events ----------

const clampCam = () => {
  cam.k = Math.min(8, Math.max(1, cam.k))
  cam.x = Math.min(0, Math.max(W * (1 - cam.k), cam.x))
  cam.y = Math.min(0, Math.max(H * (1 - cam.k), cam.y))
}
const zoomAt = (f, px, py) => { const k = cam.k; cam.k *= f; clampCam(); const s = cam.k / k; cam.x = px - (px - cam.x) * s; cam.y = py - (py - cam.y) * s; clampCam() }

export function mount(root) {
  const svg = root.querySelector('#st-sky'), g = svg?.querySelector('#st-cam')
  if (!svg) return
  const pts = new Map()
  let moved = 0, pinch = null
  const unit = () => W / svg.getBoundingClientRect().width
  const local = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * unit(), (e.clientY - r.top) * unit()] }
  // Labels and links keep their size on screen as you zoom.
  const draw = () => { g.setAttribute('transform', camera()); svg.style.setProperty('--k', cam.k) }
  svg.addEventListener('pointerdown', e => { pts.set(e.pointerId, local(e)); moved = 0; if (pts.size === 2) pinch = null })
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return
    const [x, y] = local(e), [px, py] = pts.get(e.pointerId)
    if (pts.size === 1) { cam.x += x - px; cam.y += y - py; moved += Math.abs(x - px) + Math.abs(y - py) }
    pts.set(e.pointerId, [x, y])
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (pinch) { zoomAt(d / pinch.d, ...mid); cam.x += mid[0] - pinch.mid[0]; cam.y += mid[1] - pinch.mid[1] }
      pinch = { d, mid }
      moved = 99
    }
    clampCam(); draw()
    if (moved > 3 && !svg.hasPointerCapture(e.pointerId)) try { svg.setPointerCapture(e.pointerId) } catch {}
  })
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null }
  svg.addEventListener('pointerup', up)
  svg.addEventListener('pointercancel', up)
  // A drag or pinch ends in a click: that one doesn't open anything.
  svg.addEventListener('click', e => { if (moved > 12) { e.stopPropagation(); moved = 0 } }, true)
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, ...local(e)); draw() }, { passive: false })
}

export const actions = {
  'st-branch': el => { UI.sub.skills = el.dataset.b; scrollTo(0, 0) },
  // Zoomed out, a star opens its position; zoomed in, the move itself.
  'st-node': el => cam.k >= NODE_ZOOM ? actions['st-move'](el) : actions['st-branch'](el.closest('[data-b]')),
  'st-move': el => { UI.view = 'library'; UI.sub.library = [{ move: el.dataset.id, from: 'skills' }]; scrollTo(0, 0) },
  'st-zoom': el => { if (+el.dataset.z) zoomAt(+el.dataset.z, W / 2, H / 2); else cam = { x: 0, y: 0, k: 1 } },
}
