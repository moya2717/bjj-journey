import { S, cached } from './store.js'
import { CATALOG, CATALOG_BY_ID } from './catalog.js'
import { BELTS } from './vocab.js'
import { byDateAsc, byDateDesc, plural } from './util.js'

// Techniques: the built-in catalog, with your own notes layered on top, plus moves you added.
// A record you save with a catalog id ("c:...") overrides that move's notes, link and star.
// These lists are cached until the next save, so lookups are a single table read.
// Treat what they return as read-only.
export const allTechs = () => cached('allTechs', () => {
  const overrides = Object.fromEntries(S.tech.map(t => [t.id, t]))
  const builtIn = CATALOG.map(t => overrides[t.id] ? { ...t, ...overrides[t.id] } : t)
  return [...builtIn, ...S.tech.filter(t => !CATALOG_BY_ID[t.id])]
})

const techIndex = () => cached('techIndex', () => Object.fromEntries(allTechs().map(t => [t.id, t])))
export const techById = id => id ? techIndex()[id] || null : null

export const isCustom = t => !CATALOG_BY_ID[t.id]

export const techUsage = () => cached('techUsage', () => {
  const uses = {}
  const bump = (id, n = 1) => { if (id) uses[id] = (uses[id] || 0) + n }
  S.session.forEach(s => { (s.drilled || []).forEach(id => bump(id)); (s.reps || []).forEach(r => bump(r.techId)) })
  S.roll.forEach(r => rollMoves(r).forEach(m => m.outcome !== 'caughtBy' && bump(m.techId)))
  S.seq.forEach(s => s.nodes.forEach(n => bump(n.techId)))
  S.study.forEach(v => (v.notes || []).forEach(n => bump(n.techId)))
  return uses
})

// "My moves": starred, added by you, or used anywhere in your journal. Most used first.
export const myTechs = () => cached('myTechs', () => {
  const uses = techUsage()
  return allTechs()
    .filter(t => t.starred || isCustom(t) || uses[t.id])
    .sort((a, b) => (uses[b.id] || 0) - (uses[a.id] || 0) || a.name.localeCompare(b.name))
})

// ---------- Mastery: seen it → drilled it → hit it in sparring → hit it on a higher belt ----------

export const MASTERY = ['Not started', 'Seen it', 'Drilled it', 'Hit it in sparring', 'Hit it on a higher belt']

// What your logs prove for each move. You can always set a move higher by hand, never lower.
const masteryEvidence = () => cached('masteryEvidence', () => {
  const level = {}
  const raise = (id, n) => { if (id && (level[id] || 0) < n) level[id] = n }
  S.seq.forEach(s => s.nodes.forEach(n => raise(n.techId, 1)))
  S.study.forEach(v => (v.notes || []).forEach(n => raise(n.techId, 1)))
  S.session.forEach(s => { (s.drilled || []).forEach(id => raise(id, 2)); (s.reps || []).forEach(r => raise(r.techId, 2)) })
  // A planned move you stuck to counts as drilled, or as hit in sparring when you say you landed it.
  S.session.forEach(s => { if (s.planTechId && s.planHit && s.planHit !== 'Went another way') raise(s.planTechId, s.planResult === 'landed' ? 3 : 2) })
  const myRank = BELTS.indexOf(currentRank().belt)
  const since = {}
  ;[...S.roll].sort(byDateAsc).forEach(r => {
    const higher = BELTS.indexOf(r.level) > myRank && r.level !== 'Unknown'
    landedIds(r).forEach(id => { raise(id, higher ? 4 : 3); since[id] ||= r.date })
  })
  S.profile.tournaments.forEach(t => (t.matches || []).filter(m => m.result === 'Win' && m.method === 'Submission').forEach(m => {
    raise(m.techId, 3)
    if (m.techId && (!since[m.techId] || t.date < since[m.techId])) since[m.techId] = t.date
  }))
  return { level, since }
})

// The first day a live roll proved a move worked, if one has.

export function masteryOf(t) {
  const auto = Math.max(masteryEvidence().level[t.id] || 0, t.starred ? 1 : 0)
  const manual = t.mastery ?? (t.learned ? 3 : 0)
  return { level: Math.max(auto, manual), auto, manual }
}

export const masteryPips = level => `<span class="pips" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`

// Sequences
export const seqById = id => S.seq.find(s => s.id === id)

export function nodePath(seq, nodeId) {
  const out = []
  let node = seq?.nodes.find(x => x.id === nodeId), guard = 0
  while (node && guard++ < 60) { out.unshift(node.label); node = seq.nodes.find(x => x.id === node.parentId) }
  return out
}

export function nodeDepth(seq, node) {
  let depth = 0, cur = node
  while (cur?.parentId && depth < 60) { cur = seq.nodes.find(x => x.id === cur.parentId); depth++ }
  return depth
}

export function treeOrder(seq) {
  const out = []
  const walk = parentId => seq.nodes.filter(n => (n.parentId || null) === parentId).forEach(n => { out.push(n); walk(n.id) })
  walk(null)
  return out
}

export function rollTechId(roll) {
  if (roll.techId) return roll.techId
  return seqById(roll.seqId)?.nodes.find(n => n.id === roll.nodeId)?.techId || ''
}

// Every move in a roll: the single move (or sequence step) a note has always had, plus its
// "moves used" list. The single move counts as landed when the roll worked, tried otherwise.
// 'caughtBy' is a move your partner got on you: it never raises your mastery.
export const MOVE_OUTCOMES = { landed: 'Landed', tried: 'Tried', caughtBy: 'Caught by' }

export function rollMoves(roll) {
  const moves = (roll.moves || []).filter(m => m.techId && MOVE_OUTCOMES[m.outcome]), id = rollTechId(roll)
  return id && !moves.some(m => m.techId === id) ? [{ techId: id, outcome: roll.result === 'worked' ? 'landed' : 'tried' }, ...moves] : moves
}

export const landedIds = roll => [...new Set(rollMoves(roll).filter(m => m.outcome === 'landed').map(m => m.techId))]

// Partners are free text. Their belt, size and style come from your latest roll with them.
export function partnerNames() {
  const seen = {}
  ;[...S.roll].sort(byDateDesc).forEach(r => {
    const name = (r.partner || '').trim()
    if (name && !seen[name.toLowerCase()]) seen[name.toLowerCase()] = name
  })
  return Object.values(seen)
}

export function partnerProfile(name) {
  const key = (name || '').trim().toLowerCase()
  return key ? [...S.roll].sort(byDateDesc).find(r => (r.partner || '').trim().toLowerCase() === key) || null : null
}

export const sizeLabel = s => ({ Lighter: 'lighter', Heavier: 'heavier', Similar: 'similar size' }[s] || '')

// Rank
export function currentRank() {
  const promotions = [...S.profile.promotions].sort(byDateAsc)
  const last = promotions[promotions.length - 1]
  return last ? { belt: last.belt, stripes: +last.stripes || 0, since: last.date } : { belt: 'White', stripes: 0, since: '' }
}

// IBJJF age divisions go by the age you turn this calendar year.
export function ageDivision(birthday) {
  if (!birthday) return null
  const age = new Date().getFullYear() - +birthday.slice(0, 4)
  const masters = [[61, 7], [56, 6], [51, 5], [46, 4], [41, 3], [36, 2], [30, 1]].find(([min]) => age >= min)
  const label = masters ? `Master ${masters[1]}` : age >= 18 ? 'Adult' : age >= 16 ? 'Juvenile' : 'Kids or teens'
  return { age, label }
}

// Simple or Advanced, for the whole app. Simple shows the essentials and Advanced every chart and
// analysis. Everyone starts Simple, journals from before this setting too: the stats were what crowded.
export const isSimple = () => (S.settings.mode || 'simple') === 'simple'

// The log form follows the mode: Simple asks for a note, Detailed (Advanced) opens everything.
// Your own pick for the form wins, so you can keep stats simple and logs detailed. Before there was
// a mode, a journal that already had detail stayed detailed, unless you'd recorded a white belt.
export const hasDetail = s => !!(s.plan || s.feel || s.energy || s.sleep || s.lesson || s.reflectA || s.coachQ
  || [s.drilled, s.reps, s.focus, s.wentWell, s.trouble, s.injuryIds].some(x => (x || []).length))

export function logMode() {
  if (S.settings.logMode) return S.settings.logMode
  if (S.settings.mode) return S.settings.mode === 'advanced' ? 'detailed' : 'simple'
  const white = S.profile.promotions.length && currentRank().belt === 'White'
  return !white && (S.roll.length || S.session.some(hasDetail)) ? 'detailed' : 'simple'
}

export const rankName =r => r.belt + ' belt' + (+r.stripes ? ', ' + plural(+r.stripes, 'stripe') : '')
