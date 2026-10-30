// Skill tree: every move is a node, dark until you log it. Live successes (landed in a roll or a
// positional round, or a submission win in competition) raise it through the belt colors.
// Being caught by a move never raises it. Branches are the library's positions; the links between
// them are where moves lead, from the audited move table (flow.js). Your BJJ level comes from here.
import { S, cached } from './store.js'
import { LIBRARY_GROUPS } from './vocab.js'
import { MOVE_GROUPS } from './catalog.js'
import { allTechs, currentRank, masteryOf, rollMoves, sparred, landedIds, techUsage } from './model.js'
import { FLOW } from './flow.js'
import { place } from './gameplan.js'
import { $, sum, toast } from './util.js'

// Live successes a node needs for each color. Tune here: each step asks for more than the last.
export const THRESHOLDS = { Blue: 3, Purple: 10, Brown: 25, Black: 50 }
export const TIERS = ['Unexplored', 'White', ...Object.keys(THRESHOLDS)]
// How much a node adds to your level at each tier, and how many catches make it a problem.
const WEIGHT = [0, 1, 3, 6, 10, 15]
export const PROBLEM = 3

const tierOf = (lit, wins) => !lit ? 0 : 1 + Object.values(THRESHOLDS).filter(n => wins >= n).length

// The groups a branch shows its moves in: offense, control, defense, then solo movement.
export const groupName = type => Object.keys(MOVE_GROUPS).find(g => MOVE_GROUPS[g].includes(type)) || 'Movement'
const GROUP_ORDER = [...Object.keys(MOVE_GROUPS), 'Movement']

export const skillTree = () => cached('skillTree', () => {
  const wins = {}, caught = {}, uses = techUsage()
  const bump = (to, id) => { if (id) to[id] = (to[id] || 0) + 1 }
  sparred().forEach(r => {
    landedIds(r).forEach(id => bump(wins, id))
    rollMoves(r).filter(m => m.outcome === 'caughtBy').forEach(m => bump(caught, m.techId))
  })
  S.profile.tournaments.forEach(t => (t.matches || []).filter(m => m.result === 'Win' && m.method === 'Submission').forEach(m => bump(wins, m.techId)))

  const nodes = allTechs().map(t => {
    const w = wins[t.id] || 0, lit = !!(w || uses[t.id] || masteryOf(t).level)
    return { id: t.id, t, branch: LIBRARY_GROUPS.includes(t.position) ? t.position : 'Other', group: groupName(t.type), wins: w, caught: caught[t.id] || 0, tier: tierOf(lit, w) }
  })
  const branches = LIBRARY_GROUPS.map(name => {
    const list = nodes.filter(n => n.branch === name), lit = list.filter(n => n.tier)
    const groups = GROUP_ORDER.map(g => ({ name: g, nodes: list.filter(n => n.group === g) })).filter(g => g.nodes.length)
    return { name, nodes: list, groups, lit: lit.length, pct: list.length ? lit.length / list.length : 0, top: Math.max(0, ...list.map(n => n.tier)),
      wins: list.reduce((s, n) => s + n.wins, 0), caught: list.reduce((s, n) => s + n.caught, 0), tiers: TIERS.map((_, i) => list.filter(n => n.tier === i).length) }
  }).filter(b => b.nodes.length)

  // Links between branches: a move filed under one position that leads to another. Lit by the lit moves.
  const links = {}
  nodes.forEach(n => (FLOW[n.id] || []).forEach(r => (r.lands || []).forEach(k => {
    const to = k.split('|')[0]
    if (to === n.branch || !branches.some(b => b.name === to)) return
    const l = links[[n.branch, to].sort().join('>')] ||= { a: n.branch, b: to, n: 0, lit: 0, moves: new Set() }
    if (l.moves.has(n.id)) return
    l.moves.add(n.id); l.n++
    if (n.tier) l.lit++
  })))

  const score = nodes.reduce((s, n) => s + WEIGHT[n.tier], 0)
  return { nodes, branches, links: Object.values(links), byId: Object.fromEntries(nodes.map(n => [n.id, n])), score, lit: nodes.filter(n => n.tier).length, blind: blindSpots(branches) }
})

// Blind spots: a kind of move from a position with nothing explored. Escapes and the core positions
// come first, and anywhere partners keep catching you.
const CORE = ['Side control', 'Mount', 'Back', 'Closed guard', 'Half guard', 'Open guard', 'Standing', 'Turtle', 'Knee on belly', 'North-south']
const TYPE_ORDER = ['Escape', 'Retention', 'Sweep', 'Pass', 'Takedown', 'Submission', 'Transition', 'Control']
const PLURAL = { Pass: 'passes', Escape: 'escapes', Retention: 'guard retention', Control: 'control' }
function blindSpots(branches) {
  const out = []
  branches.filter(b => b.name !== 'Solo drills' && b.name !== 'Other').forEach(b => {
    TYPE_ORDER.forEach(type => {
      const list = b.nodes.filter(n => n.t.type === type)
      if (!list.length || list.some(n => n.tier)) return
      // Where these moves start, from the move table: "bottom side control", "half guard top".
      const froms = list.flatMap(n => (FLOW[n.id] || []).map(r => r.from)), from = froms.sort((x, y) => froms.filter(f => f === y).length - froms.filter(f => f === x).length)[0]
      const where = from?.startsWith(b.name + '|') ? place(from) : /^(De La|Reverse|X-)/.test(b.name) ? b.name : b.name.toLowerCase()
      const what = PLURAL[type] || type.toLowerCase() + 's'
      out.push({ branch: b.name, type, text: `No ${what} from ${where} explored`, n: list.length, rank: [CORE.indexOf(b.name) < 0 ? 99 : CORE.indexOf(b.name), TYPE_ORDER.indexOf(type)], caught: b.caught })
    })
  })
  return out.sort((x, y) => (y.caught > 2) - (x.caught > 2) || x.rank[1] - y.rank[1] || x.rank[0] - y.rank[0])
}

// ---------- Your BJJ level ----------

// Each belt is a band of 20 levels; stripes raise the floor, the tree fills the rest of the band.
// Brown tops out at 80; level 100 is the black belt itself, then a new track starts: Black Belt Lv 1+.
const BANDS = { White: 1, Blue: 21, Purple: 41, Brown: 61 }
// How much tree a full band asks for (sum of node weights). The square root makes early moves count most.
const TARGET = { White: 60, Blue: 160, Purple: 340, Brown: 600, Black: 1000 }
// Mat time at your current belt helps a little: MAT_HOURS of it counts as a quarter of the band's target.
export const MAT_HOURS = 150

export const bjjLevel = () => cached('bjjLevel', () => {
  const rank = currentRank(), { score } = skillTree(), stripes = Math.min(4, rank.stripes)
  const hours = sum(S.session.filter(s => !rank.since || s.date >= rank.since), 'minutes') / 60
  const mat = TARGET[rank.belt] / 4 * Math.min(1, hours / MAT_HOURS)
  if (rank.belt === 'Black') {
    const black = [...S.profile.promotions].filter(p => p.belt === 'Black').sort((a, b) => a.date.localeCompare(b.date))[0]
    // Each degree is 10 levels; the tree you grow past a full brown belt's, and your mat time, fill each one.
    const fill = Math.min(1, Math.sqrt((Math.max(0, score - TARGET.Brown) + mat) / TARGET.Black))
    return { black: true, level: 1 + 10 * rank.stripes + Math.floor(9 * fill), since: black?.date || '', belt: rank.belt, stripes: rank.stripes, fill, score, hours }
  }
  const lo = BANDS[rank.belt], hi = lo + 19, floor = lo + 4 * stripes
  const fill = Math.min(1, Math.sqrt((score + mat) / TARGET[rank.belt]))
  const level = Math.min(hi, floor + Math.floor(fill * (hi - floor + 1)))
  return { level, lo, hi, floor, belt: rank.belt, stripes, fill, score, hours, top: level >= hi }
})

// ---------- Color changes: a toast when a save lights a node or raises its color ----------

let last = null
export function watchTiers() {
  const now = Object.fromEntries(skillTree().nodes.map(n => [n.id, n.tier]))
  const up = last ? Object.keys(now).filter(id => now[id] > (last[id] || 0)).sort((a, b) => now[b] - now[a]) : []
  last = now
  // A restore or an import changes hundreds at once: no toast for those.
  if (!up.length || up.length > 12) return
  const n = skillTree().byId[up[0]], tier = n.tier
  // After the form's own "Roll logged", so both are seen.
  setTimeout(() => {
    toast(`${n.t.name} ${tier > 1 ? '→ ' + TIERS[tier] : 'lit up'}${up.length > 1 ? ` · +${up.length - 1} more` : ''}`)
    $('#toast').classList.add('belt')
    $('#toast').dataset.tier = tier
  }, 1200)
}
