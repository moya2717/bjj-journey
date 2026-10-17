import { S } from './store.js'
import { CATALOG, CATALOG_BY_ID } from './catalog.js'
import { byDateAsc, byDateDesc, plural } from './util.js'

// Techniques: the built-in catalog, with your own notes layered on top, plus moves you added.
// A record you save with a catalog id ("c:...") overrides that move's notes, link and star.
export function techById(id) {
  if (!id) return null
  const own = S.tech.find(t => t.id === id)
  return own ? { ...CATALOG_BY_ID[id], ...own } : CATALOG_BY_ID[id] || null
}

export function allTechs() {
  const overrides = Object.fromEntries(S.tech.map(t => [t.id, t]))
  const builtIn = CATALOG.map(t => overrides[t.id] ? { ...t, ...overrides[t.id] } : t)
  const added = S.tech.filter(t => !CATALOG_BY_ID[t.id])
  return [...builtIn, ...added]
}

export const isCustom = t => !CATALOG_BY_ID[t.id]

export function techUsage() {
  const uses = {}
  const bump = (id, n = 1) => { if (id) uses[id] = (uses[id] || 0) + n }
  S.session.forEach(s => { (s.drilled || []).forEach(id => bump(id)); (s.reps || []).forEach(r => bump(r.techId)) })
  S.roll.forEach(r => bump(rollTechId(r)))
  S.seq.forEach(s => s.nodes.forEach(n => bump(n.techId)))
  return uses
}

// "My moves": starred, added by you, or used anywhere in your journal. Most used first.
export function myTechs() {
  const uses = techUsage()
  return allTechs()
    .filter(t => t.starred || isCustom(t) || uses[t.id])
    .sort((a, b) => (uses[b.id] || 0) - (uses[a.id] || 0) || a.name.localeCompare(b.name))
}

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

export const rankName = r => r.belt + ' belt' + (+r.stripes ? ', ' + plural(+r.stripes, 'stripe') : '')
