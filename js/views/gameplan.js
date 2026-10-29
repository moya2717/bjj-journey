// Game plan: your whole game as one outline, by phase, with the gaps first. Each gap gets one-tap
// ways to close it: a focus for your next class, a sequence to map, or a video to watch.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { cap, esc, newId, plural, toast, today } from '../util.js'
import { techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { fold, more, subHead, subOf, tile } from './hub.js'
import { PHASES, gamePlan, phaseOf, place, tier } from '../gameplan.js'

const TIER = { proven: 'Landed live', drilled: 'Drilled', seen: 'Seen' }
const pickOf = g => UI.gpPick?.[g.id] && g.suggest.includes(UI.gpPick[g.id]) ? UI.gpPick[g.id] : g.suggest[0]

export function view() {
  const plan = gamePlan(), sub = subOf('gameplan'), phase = PHASES.find(p => p.id === sub)
  if (phase) return subHead(phase.label, 'Game plan') + phaseView(plan, phase)
  const byPhase = id => plan.gaps.filter(g => g.phase === id).length
  return `<div class="page-head"><div><h1>Game plan</h1><p class="lede">Your whole game from your rolls, sequences and moves: every position, your answers from it and where they lead. Gaps first.</p></div></div>
    <section aria-labelledby="gp-gaps-h"><div class="history-head"><h2 id="gp-gaps-h">Gaps to close</h2></div>
      ${plan.moves ? '' : '<p class="small muted">Nothing logged yet, so every spot is open. Log rolls with their moves, map a sequence or mark moves you know, and this fills in.</p>'}
      ${plan.gaps.length ? `<ul class="list gp-gaps">${more('gp-gaps', plan.gaps, 3, gapCard)}</ul>
        <p class="small muted gp-more">More videos and courses in <button class="link small" data-act="goto" data-view="resources" data-anchor="">Learn → Resources</button></p>`
        : '<p class="small muted">No gaps in the key positions. Every one has an answer that’s landed live.</p>'}
    </section>
    <section aria-labelledby="gp-tree-h"><div class="history-head"><h2 id="gp-tree-h">Your game</h2></div>
      <p class="small muted gp-flow">Standing → Guard or Passing → Control → Submissions, with Escapes from the bad spots</p>
      <div class="dojo-tiles">${PHASES.map(p => {
        const nodes = p.keys.map(k => plan.nodes[k]), moves = nodes.reduce((n, x) => n + shown(x, p).length, 0), covered = nodes.filter(x => shown(x, p).length).length, gaps = byPhase(p.id)
        return tile(p.id, p.label, moves, gaps ? `<span class="gp-flag">${plural(gaps, 'gap')}</span>` : covered ? `from ${plural(covered, 'position')}` : 'nothing yet', { cls: gaps ? 'gp-tile has-gap' : 'gp-tile' })
      }).join('')}</div></section>`
}

// The moves a phase shows for a position: finishes on Submissions, everything else elsewhere.
const shown = (node, phase) => node.moves.filter(m => phase.id === 'subs' ? m.finish : !m.finish)

function gapCard(g) {
  const pick = pickOf(g), t = techById(pick)
  return `<li class="gp-gap ${g.level}"><div class="gp-gap-head"><b>${esc(g.title)}</b>${g.why.length ? `<span class="small muted">${esc(cap(g.why.join(' · ')))}</span>` : ''}</div>
    ${g.suggest.length ? `<div class="chips gp-try" role="group" aria-label="${g.level === 'untested' ? 'Drill' : 'Try'}"><span class="small muted">${g.level === 'untested' ? 'Drill' : 'Try'}</span>${g.suggest.map(id =>
      `<button class="pill" data-act="gp-pick" data-g="${esc(g.id)}" data-id="${esc(id)}" aria-pressed="${id === pick}">${esc(techById(id)?.name || '')}</button>`).join('')}</div>` : ''}
    ${t ? `<div class="gp-acts"><button class="btn sm" data-act="gp-focus" data-g="${esc(g.id)}">Add to Today’s focus</button><button class="btn sm ghost" data-act="gp-seq" data-g="${esc(g.id)}">Make a sequence</button>
      <a class="btn sm ghost" href="${videoSearch(t.name)}" target="_blank" rel="noopener">Find an instructional ↗</a></div>` : ''}</li>`
}

function moveRow(m) {
  const n = [m.landed && `landed ${m.landed}×`, m.tried && `tried ${m.tried}×`, m.seq && (m.live ? 'Live roll chain' : 'in a sequence')].filter(Boolean).join(' · ')
  const to = m.to ? `<button class="link small gp-edge" data-act="gp-go" data-k="${esc(m.to.pos + '|' + m.to.role)}">→ ${esc(m.to.pos)}${m.to.role === 'Neutral' ? '' : ', ' + m.to.role.toLowerCase()}</button>` : m.finish ? '<span class="small muted">finish</span>' : '<span class="small muted">control</span>'
  return `<li class="gp-move ${tier(m)}"><span class="gp-dot" title="${TIER[tier(m)]}"></span><span class="gp-name"><b>${esc(m.t.name)}</b><span class="small muted">${TIER[tier(m)]}${n ? ' · ' + n : ''}</span></span>${to}</li>`
}

function phaseView(plan, phase) {
  const gaps = plan.gaps.filter(g => g.phase === phase.id), gapAt = k => gaps.filter(g => g.k === k)
  const rows = phase.keys.map(k => plan.nodes[k]).filter(x => (phase.id === 'subs' ? shown(x, phase) : x.moves).length || gapAt(x.k).length)
  const empty = phase.keys.map(k => plan.nodes[k]).filter(x => !rows.includes(x))
  return `<p class="small muted">${{ standing: 'Getting it to the ground, or pulling guard.', guard: 'Playing from bottom: sweeps, back takes and guard changes.', passing: 'On top of their guard: breaks and passes.', control: 'Pins and the back: holding, moving between them and setting up the finish.', subs: 'Your finishes, by where you hit them.', escapes: 'The bad spots: how you get out.' }[phase.id]}</p>
    <div class="legend gp-legend">${Object.entries(TIER).map(([k, l]) => `<span class="gp-move ${k}"><span class="gp-dot"></span>${l}</span>`).join('')}</div>
    ${rows.map(x => {
      const moves = shown(x, phase), g = gapAt(x.k), subs = x.moves.filter(m => m.finish).length
      return `<div data-gp="${esc(x.k)}">${fold('gp:' + x.k, `<span class="gp-pos"><b>${esc(x.pos)}</b><span class="small muted">${x.role === 'Neutral' ? '' : esc(x.role) + ' · '}${moves.length || !subs || phase.id === 'subs' ? plural(moves.length, phase.id === 'subs' ? 'finish' : 'move', phase.id === 'subs' ? 'finishes' : 'moves') : plural(subs, 'finish', 'finishes')}</span></span>${g.length ? `<span class="gp-flag">${plural(g.length, 'gap')}</span>` : ''}`,
        `${moves.length ? `<ul class="gp-moves">${moves.map(moveRow).join('')}</ul>` : ''}
        ${subs && phase.id !== 'subs' ? `<button class="link small gp-subs" data-act="gp-go" data-k="${esc(x.k)}" data-phase="subs">${plural(subs, 'finish', 'finishes')} from here ›</button>` : ''}
        ${g.length ? `<ul class="list gp-gaps">${g.map(gapCard).join('')}</ul>` : ''}`, true)}</div>`
    }).join('') || '<p class="small muted">Nothing here yet.</p>'}
    ${empty.length ? `<p class="small muted gp-empty">Not in your game yet: ${empty.map(x => esc(place(x.k))).join(', ')}</p>` : ''}`
}

export function mount(root) {
  if (!UI.gpAt) return
  const el = root.querySelector(`[data-gp="${CSS.escape(UI.gpAt)}"]`)
  UI.gpAt = ''
  if (el) { el.querySelector('details').open = true; el.scrollIntoView({ block: 'start' }) }
}

const gapOf = el => gamePlan().gaps.find(g => g.id === el.dataset.g)

export const actions = {
  'gp-pick': el => { UI.gpPick = { ...UI.gpPick, [el.dataset.g]: el.dataset.id } },
  // An edge: open the phase that position belongs to, at that position.
  'gp-go': el => { UI.sub.gameplan = el.dataset.phase || phaseOf(el.dataset.k); UI.gpAt = el.dataset.k; scrollTo(0, 0) },
  'gp-focus': el => {
    const g = gapOf(el), t = g && techById(pickOf(g))
    if (!t) return false
    save({ ...S.settings, gameFocus: { text: `Drill ${t.name} (${place(g.k)})`, techId: t.id, set: today() } })
    toast('Added to Today’s focus on Home')
  },
  // A new sequence from that spot, starting with the move, ready for their reactions.
  'gp-seq': el => {
    const g = gapOf(el), t = g && techById(pickOf(g))
    if (!t) return false
    const [position, role] = g.k.split('|'), node = { id: newId('n'), parentId: null, who: 'me', label: t.name, techId: t.id, note: '' }
    const rec = { id: newId('seq'), kind: 'seq', name: `${t.name} from ${place(g.k)}`, position, role, notes: `Closes a gap: ${g.title.toLowerCase()}.`, nodes: [node] }
    save(rec)
    Object.assign(UI, { view: 'sequences', seqSel: rec.id, seqNode: node.id, quiz: null })
    scrollTo(0, 0)
    toast('Sequence started. Add how they react.')
  },
}
