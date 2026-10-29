// Game plan: your whole game as one tree. Logged rolls are the main source: each roll's chain, in order,
// says where every move happened, how it went and where it led. Sequences and Live roll chains add
// planned edges, and moves you know add the library's own. Nothing is guessed: where a move led is the
// next position you logged, else what the Live roll table lists from that exact spot, else unknown
// until you say.
import { S, cached } from './store.js'
import { CATALOG_BY_ID } from './catalog.js'
import { masteryOf, rollMoves, sparred, techById } from './model.js'
import { liveRollSeqs } from './loop.js'
import { GUARDS, TABLE, flip, key } from './sim.js'

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

export const at = k => { const [pos, role] = k.split('|'); return { pos, role } }
const norm = (pos, role) => { const k = key(pos, pos === 'Standing' ? 'Neutral' : role); return TABLE[k] ? k : null }
const isSub = id => techById(id)?.type === 'Submission'
export const isPlace = d => d.includes('|')

// How a place reads in a sentence: "bottom side control", "closed guard top", "the back".
export function place(k) {
  const { pos, role } = at(k), p = /^(De La|Reverse|X-)/.test(pos) ? pos : pos.toLowerCase()
  if (role === 'Neutral') return 'standing'
  if (pos === 'Back') return role === 'Top' ? 'the back' : 'back control'
  if (CONTROL.includes(pos) || pos === 'Front headlock') return role === 'Top' ? p : 'bottom ' + p
  return p + ' ' + role.toLowerCase()
}

// Where a move goes from k by the Live roll table alone: a position, 'stay' (control), 'finish', or '?'.
// Your partner's moves are looked up from their side and turned back into yours. A '?' you settled
// yourself is kept in settings.
export function tableDest(id, k, theirs = false) {
  const from = theirs ? key(at(k).pos, flip(at(k).role)) : k, m = TABLE[from]?.find(x => x.id === id)
  if (m) return m.to ? key(m.to.pos, theirs ? flip(m.to.role) : m.to.role) : isSub(id) ? 'finish' : 'stay'
  return isSub(id) ? 'finish' : !theirs && S.settings.gpAfter?.[k + '|' + id] || '?'
}

// Proven: it landed in a roll, or you hit it in sparring. Drilled: drilled, or tried live. Seen: the rest.
export const tier = m => m.landed || m.level >= 3 ? 'proven' : m.level >= 2 || m.tried ? 'drilled' : 'seen'
const strength = m => 3 * m.landed + m.tried + m.level + m.seq / 2

const onlyPlace = id => { const ks = Object.keys(TABLE).filter(k => TABLE[k].some(m => m.id === id)); return ks.length === 1 ? ks[0] : null }

export const gamePlan = () => cached('gamePlan', () => {
  const nodes = Object.fromEntries(Object.keys(TABLE).map(k => [k, { k, ...at(k), mine: {}, theirs: {}, been: 0 }])), unplaced = []
  const entry = (k, side, id) => nodes[k][side][id] ||= { id, t: techById(id), landed: 0, tried: 0, caught: 0, seq: 0, live: 0, known: false, rolls: [], seqs: [], dests: {} }
  // An edge: seen in rolls (n), planned in a sequence, or what the library says (lib).
  const edge = (e, d, kind = 'n') => { const x = e.dests[d] ||= { n: 0, planned: 0, lib: 0 }; x[kind]++ }

  sparred().forEach(r => {
    const ref = { id: r.id, date: r.date || '', partner: r.partner || '' }
    const log = (k, m, d) => {
      if (!techById(m.techId)) return
      if (!k) return unplaced.push({ ...ref, techId: m.techId, outcome: m.outcome })
      nodes[k].been++
      const e = entry(k, m.outcome === 'caughtBy' ? 'theirs' : 'mine', m.techId)
      e[{ landed: 'landed', tried: 'tried', caughtBy: 'caught' }[m.outcome]]++
      if (!e.rolls.some(x => x.id === r.id)) e.rolls.push(ref)
      if (d) edge(e, d === k ? 'stay' : d)
    }
    if (r.chain?.length) r.chain.forEach((m, i) => {
      // Where it led: the position of the next step as you logged it; the last step goes by the table.
      const k = norm(m.position, m.role), next = r.chain[i + 1]
      const d = m.outcome === 'tried' || !k ? '' : isSub(m.techId) ? 'finish' : next ? norm(next.position, next.role) || '?' : tableDest(m.techId, k, m.outcome === 'caughtBy')
      log(k, m, d)
    })
    else {
      // Rolls from before chains: the moves in the order you listed them, from where the roll started.
      let k = norm(r.position, r.role)
      rollMoves(r).forEach(m => {
        const d = m.outcome === 'tried' || !k ? '' : tableDest(m.techId, k, m.outcome === 'caughtBy')
        log(k, m, d)
        if (d && isPlace(d)) k = d
        else if (d === '?') k = null
      })
    }
  })

  // Sequences: a step sits where you mapped it if the table or the library puts it there (a finish always
  // does: it draws no edge), else where the table lists it, when that's one place: their reaction may
  // have moved you. Otherwise it waits in "position unknown".
  const live = new Set(liveRollSeqs().map(x => x.seq.id))
  S.seq.forEach(s => {
    const walk = (parentId, k, depth) => depth < 40 && s.nodes.filter(n => (n.parentId || null) === parentId).forEach(n => {
      let next = k
      if (n.who !== 'them') {
        const t = techById(n.techId)
        const here = !t ? null : k && (TABLE[k].some(m => m.id === t.id) || isSub(t.id) || t.position === at(k).pos) ? k : onlyPlace(t.id)
        if (here) {
          const e = entry(here, 'mine', t.id), d = tableDest(t.id, here)
          e.seq++
          if (live.has(s.id)) e.live++
          if (!e.seqs.includes(s.id)) e.seqs.push(s.id)
          edge(e, d, 'planned')
          next = isPlace(d) ? d : d === '?' ? null : here
        } else {
          if (t) unplaced.push({ seq: s.name, seqId: s.id, techId: t.id, outcome: 'planned' })
          next = null
        }
      }
      walk(n.id, next, depth + 1)
    })
    walk(null, norm(s.position, s.role), 0)
  })

  // Moves you know but haven't put anywhere on the map, at the position the library files them under.
  const placed = new Set(Object.values(nodes).flatMap(x => Object.keys(x.mine)))
  Object.entries(TABLE).forEach(([k, menu]) => menu.forEach(m => {
    const t = techById(m.id)
    if (!t || placed.has(m.id) || t.position !== at(k).pos || !masteryOf(t).level) return
    const e = entry(k, 'mine', m.id)
    e.known = true
    if (!Object.keys(e.dests).length) edge(e, tableDest(m.id, k), 'lib')
  }))

  const done = e => {
    const edges = Object.entries(e.dests).map(([d, x]) => ({ d, ...x })).sort((a, b) => b.n - a.n || b.planned - a.planned)
    const places = edges.filter(x => isPlace(x.d)).map(x => at(x.d))
    return { ...e, edges, level: masteryOf(e.t).level, rolls: e.rolls.sort((a, b) => b.date.localeCompare(a.date)), places, finish: edges.some(x => x.d === 'finish') || (!edges.length && e.t.type === 'Submission') }
  }
  Object.values(nodes).forEach(x => {
    x.moves = Object.values(x.mine).map(done).sort((a, b) => strength(b) - strength(a) || a.t.name.localeCompare(b.t.name))
    x.caught = Object.values(x.theirs).map(done).sort((a, b) => b.caught - a.caught)
    x.caughtN = x.caught.reduce((n, m) => n + m.caught, 0)
  })
  return { nodes, unplaced, gaps: gaps(nodes), moves: Object.values(nodes).reduce((n, x) => n + x.moves.length, 0) }
})

// What counts as each kind of answer, from where it leads. A move whose landing isn't known yet counts
// by its type (a sweep is a sweep), but never by a guessed position.
const WANT = {
  down: (m, places) => places.some(d => d.pos !== 'Standing' && d.pos !== 'Front headlock') || (!places.length && m.t.type === 'Takedown'),
  sweep: (m, places) => places.some(d => d.role === 'Top' && d.pos !== 'Back') || (!places.length && m.t.type === 'Sweep'),
  pass: (m, places, k) => places.some(d => d.role === 'Top' && d.pos !== at(k).pos) || (!places.length && m.t.type === 'Pass'),
  sub: m => m.finish,
  escape: (m, places, k) => places.some(d => key(d.pos, d.role) !== k) || (!places.length && m.t.type === 'Escape'),
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

// Missing: no move of that kind. Thin: fewer than it needs. Untested: none has landed in a roll.
// Suggestions are the Live roll table's moves from that exact spot and side, fundamentals first.
function gaps(nodes) {
  return CHECKS.map(([k, what, need, label]) => {
    const node = nodes[k], test = WANT[what], pl = place(k)
    const tableTo = id => { const d = tableDest(id, k); return isPlace(d) ? [at(d)] : [] }
    const have = node.moves.filter(m => test(m, m.places.length ? m.places : tableTo(m.id), k))
    const level = !have.length ? 'missing' : have.length < need ? 'thin' : !have.some(m => tier(m) === 'proven') ? 'untested' : ''
    if (!level) return null
    const title = level === 'missing' ? (what === 'escape' ? `No escape logged from ${pl}` : what === 'sub' ? `No submission from ${pl} yet` : `No ${label} from ${pl}`)
      : level === 'thin' ? `Only one ${label} from ${pl}` : `No ${label} from ${pl} has landed in a roll yet`
    const fresh = TABLE[k].filter(m => !m.after.length && !have.some(h => h.id === m.id)
      && test({ t: techById(m.id), finish: !m.to && isSub(m.id) }, m.to ? [m.to] : [], k)).map(m => m.id)
    const suggest = (level === 'untested' ? have.map(m => m.id) : fresh).slice(0, 3)
    const why = [node.caughtN && `caught ${node.caughtN === 1 ? 'once' : node.caughtN + ' times'} here`, node.been && `${node.been} logged roll ${node.been === 1 ? 'step' : 'steps'} here`,
      have.length && `you have ${have.map(m => m.t.name).join(', ')}`].filter(Boolean)
    return { id: k + '|' + what, k, what, label, level, title, why, suggest, phase: what === 'sub' ? 'subs' : phaseOf(k) }
  }).filter(Boolean).sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level] || nodes[b.k].caughtN - nodes[a.k].caughtN || nodes[b.k].been - nodes[a.k].been)
}
