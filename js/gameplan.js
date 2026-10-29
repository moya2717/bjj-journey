// Game plan: your whole game as one tree, built from what you already log. Each position (with your
// role in it) lists your moves out of it and where they land, so the gaps show: the places you end
// up with no answer. Moves come from roll chains, sequences (Live roll chains included) and mastery.
import { S, cached } from './store.js'
import { CATALOG_BY_ID } from './catalog.js'
import { masteryOf, rollMoves, techById } from './model.js'
import { liveRollSeqs } from './loop.js'
import { GUARDS, TABLE, key, landing } from './sim.js'

const CONTROL = ['Side control', 'Mount', 'Back', 'Knee on belly', 'North-south', 'Turtle']
const finishes = k => TABLE[k].some(m => !m.to && CATALOG_BY_ID[m.id]?.type === 'Submission')

// Standing → Guard (bottom) / Passing (top) → Control → Submissions, with Escapes from each bad spot.
export const PHASES = [
  { id: 'standing', label: 'Standing', keys: ['Standing|Neutral', 'Front headlock|Top'] },
  { id: 'guard', label: 'Guard', keys: [...GUARDS, 'Leg entanglement'].map(p => p + '|Bottom') },
  { id: 'passing', label: 'Passing', keys: GUARDS.map(p => p + '|Top') },
  { id: 'control', label: 'Control', keys: CONTROL.map(p => p + '|Top') },
  { id: 'subs', label: 'Submissions', keys: [] },
  { id: 'escapes', label: 'Escapes', keys: [...CONTROL.map(p => p + '|Bottom'), 'Front headlock|Bottom', 'Leg entanglement|Top'] },
]
// Finishes, from pins first, then guard, then the rest.
PHASES[4].keys = [PHASES[3], PHASES[1], PHASES[0], PHASES[2]].flatMap(p => p.keys).filter(finishes)
export const phaseOf = k => PHASES.find(p => p.id !== 'subs' && p.keys.includes(k))?.id || 'standing'

const at = k => { const [pos, role] = k.split('|'); return { pos, role } }
const norm = (pos, role) => { const k = key(pos, pos === 'Standing' ? 'Neutral' : role); return TABLE[k] ? k : null }

// How a place reads in a sentence: "bottom side control", "closed guard top", "the back".
export function place(k) {
  const { pos, role } = at(k), p = /^(De La|Reverse|X-)/.test(pos) ? pos : pos.toLowerCase()
  if (role === 'Neutral') return 'standing'
  if (pos === 'Back') return role === 'Top' ? 'the back' : 'back control'
  if (CONTROL.includes(pos) || pos === 'Front headlock') return role === 'Top' ? p : 'bottom ' + p
  return p + ' ' + role.toLowerCase()
}

// Proven: it landed live, or you hit it in sparring. Drilled: drilled, or tried live. Seen: the rest.
export const tier = m => m.landed || m.level >= 3 ? 'proven' : m.level >= 2 || m.tried ? 'drilled' : 'seen'
const strength = m => 2 * m.landed + m.level + m.tried / 2 + m.seq / 2

// A sequence step goes where the move belongs: here if the position lists it, else its own position.
const placeOf = (id, k) => TABLE[k]?.some(m => m.id === id) ? k
  : Object.keys(TABLE).find(x => at(x).pos === techById(id)?.position && TABLE[x].some(m => m.id === id)) || k

export const gamePlan = () => cached('gamePlan', () => {
  const found = {}, been = {}, caught = {}
  const add = (k, id, f = () => {}) => {
    if (!k || !techById(id)) return
    f((found[k] ||= {})[id] ||= { id, landed: 0, tried: 0, seq: 0, live: 0 })
  }
  S.roll.forEach(r => {
    const steps = r.chain?.length ? r.chain : rollMoves(r).map(m => ({ ...m, position: r.position, role: r.role }))
    steps.forEach(m => {
      const k = norm(m.position, m.role)
      if (!k) return
      been[k] = (been[k] || 0) + 1
      if (m.outcome === 'caughtBy') caught[k] = (caught[k] || 0) + 1
      else add(k, m.techId, x => m.outcome === 'landed' ? x.landed++ : x.tried++)
    })
  })
  // Sequences: follow each of your moves to where it lands, so deeper steps sit in the right place.
  const live = new Set(liveRollSeqs().map(x => x.seq.id))
  S.seq.forEach(s => {
    const walk = (parentId, k, depth = 0) => depth < 40 && s.nodes.filter(n => (n.parentId || null) === parentId).forEach(n => {
      let next = k
      if (n.who !== 'them' && n.techId && k) {
        const here = placeOf(n.techId, k), to = landing(n.techId, at(here))
        add(here, n.techId, x => { x.seq++; if (live.has(s.id)) x.live++ })
        next = to ? norm(to.pos, to.role) : here
      }
      walk(n.id, next, depth + 1)
    })
    walk(null, norm(s.position, s.role))
  })
  // Moves you know from their own position, even before you log them anywhere.
  Object.entries(TABLE).forEach(([k, menu]) => menu.forEach(m => {
    const t = techById(m.id)
    if (t && t.position === at(k).pos && masteryOf(t).level) add(k, m.id)
  }))

  const nodes = Object.fromEntries(Object.keys(TABLE).map(k => {
    const moves = Object.values(found[k] || {}).map(x => {
      const t = techById(x.id), m = TABLE[k].find(y => y.id === x.id), to = m ? m.to : landing(x.id, at(k))
      return { ...x, t, to, pts: m?.pts || 0, level: masteryOf(t).level, finish: !to && t.type === 'Submission' }
    }).sort((a, b) => strength(b) - strength(a) || a.t.name.localeCompare(b.t.name))
    return [k, { k, ...at(k), moves, been: been[k] || 0, caught: caught[k] || 0 }]
  }))
  return { nodes, gaps: gaps(nodes), moves: Object.values(nodes).reduce((n, x) => n + x.moves.length, 0) }
})

// What every key position needs: [position, what, how many, label].
const WANT = {
  down: m => !!m.to, sweep: m => !!(m.to && m.pts), sub: m => m.finish, pass: m => !!m.to, escape: m => !!m.to,
}
// Escapes first: when two gaps are equally open, surviving the bad spots comes before the rest.
const CHECKS = [
  ['Side control|Bottom', 'escape', 1, 'escape'], ['Mount|Bottom', 'escape', 1, 'escape'], ['Back|Bottom', 'escape', 1, 'escape'],
  ['Closed guard|Bottom', 'sweep', 1, 'sweep'], ['Closed guard|Bottom', 'sub', 1, 'submission'],
  ['Half guard|Bottom', 'sweep', 1, 'sweep'], ['Open guard|Bottom', 'sweep', 1, 'sweep'],
  ['Closed guard|Top', 'pass', 2, 'guard break'], ['Half guard|Top', 'pass', 2, 'pass'], ['Open guard|Top', 'pass', 2, 'pass'],
  ['Side control|Top', 'sub', 1, 'submission'], ['Mount|Top', 'sub', 1, 'submission'], ['Back|Top', 'sub', 1, 'submission'],
  ['Turtle|Bottom', 'escape', 1, 'escape'], ['Standing|Neutral', 'down', 1, 'takedown or guard pull'],
]
const SEVERITY = { missing: 0, thin: 1, untested: 2 }

// Missing: no move of that kind at all. Thin: fewer than it needs. Untested: none has landed live.
// Suggestions come from the Live roll menu for that spot, fundamentals first.
function gaps(nodes) {
  return CHECKS.map(([k, what, need, label]) => {
    const node = nodes[k], test = WANT[what], have = node.moves.filter(test), pl = place(k)
    const level = !have.length ? 'missing' : have.length < need ? 'thin' : !have.some(m => tier(m) === 'proven') ? 'untested' : ''
    if (!level) return null
    const title = level === 'missing' ? (what === 'escape' ? `No escape logged from ${pl}` : what === 'sub' ? `No submission from ${pl} yet` : `No ${label} from ${pl}`)
      : level === 'thin' ? `Only one ${label} from ${pl}` : `No ${label} from ${pl} has landed live yet`
    const fresh = TABLE[k].filter(m => test({ ...m, finish: !m.to && techById(m.id)?.type === 'Submission' }) && !m.after.length && !have.some(h => h.id === m.id)).map(m => m.id)
    const suggest = (level === 'untested' ? have.map(m => m.id) : fresh).slice(0, 3)
    const why = [node.caught && `caught ${node.caught === 1 ? 'once' : node.caught + ' times'} here`, node.been && `in ${node.been} logged roll ${node.been === 1 ? 'step' : 'steps'}`,
      have.length && `you have ${have.map(m => m.t.name).join(', ')}`].filter(Boolean)
    return { id: k + '|' + what, k, what, label, level, title, why, suggest, phase: what === 'sub' ? 'subs' : phaseOf(k) }
  }).filter(Boolean).sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level] || nodes[b.k].caught - nodes[a.k].caught || nodes[b.k].been - nodes[a.k].been)
}
