// A self-check for the Live roll. Not loaded by the app; run it from the browser console:
//   import('./js/simcheck.js').then(m => m.checkSim())
// It walks every position and role, checks each move's landing, role and IBJJF points, then
// plays random games looking for crashes, dead ends and impossible scores.

import { CATALOG_BY_ID } from './catalog.js'
import { techById } from './model.js'
import { AFTER, GUARDS, MENU, STARTS, PARTNERS, TURNS, defensesFor, isFinish, key, menuFor, newRoll, play, slipTo } from './sim.js'
import { slug } from './util.js'

const idOf = name => 'c:' + slug(name)
const flip = role => ({ Top: 'Bottom', Bottom: 'Top' }[role] || role)
const attackerOf = pos => pos === 'Standing' ? 'Neutral' : GUARDS.includes(pos) || pos === 'Leg entanglement' ? 'Bottom' : 'Top'

// The points a landing should score under IBJJF rules.
function expectedPoints(pos, role, t, to) {
  if (to.role !== 'Top') return 0
  if (to.pos === 'Mount' || to.pos === 'Back') return 4
  if (pos === 'Standing' && t.type === 'Takedown' && to.pos !== 'Front headlock') return 2 // a snap down isn't a takedown
  if (GUARDS.includes(pos) && role === 'Top' && to.pos === 'Side control') return 3
  if ((GUARDS.includes(pos) || pos === 'Leg entanglement') && role === 'Bottom') return 2 // a sweep
  if (to.pos === 'Knee on belly') return 2
  return 0 // reversals from turtle, mount or the back don't score
}

export function checkTable() {
  const errors = [], err = (k, msg) => errors.push(`${k}: ${msg}`)
  for (const [k, moves] of Object.entries(MENU)) {
    const [pos, role] = k.split('|')
    for (const [name, toPos, toRole, pts = 0] of moves) {
      const t = CATALOG_BY_ID[idOf(name)]
      if (!t) { err(k, `${name} is not in the catalog`); continue }
      if (toPos) {
        const to = { pos: toPos, role: toRole }
        if (!MENU[key(toPos, toRole)]) err(k, `${name} lands in ${key(toPos, toRole)}, which has no menu`)
        if (pts !== expectedPoints(pos, role, t, to)) err(k, `${name} scores ${pts}, IBJJF says ${expectedPoints(pos, role, t, to)}`)
        if (pts && !MENU[key(slipTo(pos, to).pos, slipTo(pos, to).role)]) err(k, `${name} slips to a position with no menu`)
      } else if (pts) err(k, `${name} scores without moving`)
      if (t.type === 'Pass' && !(GUARDS.includes(pos) && role === 'Top')) err(k, `${name} is a pass offered off the top of a guard`)
      if (t.type === 'Sweep' && role !== 'Bottom') err(k, `${name} is a sweep offered to ${role}`)
      if (t.type === 'Takedown' && pos !== 'Standing') err(k, `${name} is a takedown offered off the feet`)
      if (t.type === 'Escape' && role === attackerOf(pos) && pos !== 'Half guard') err(k, `${name} is an escape offered to the attacker`)
      if (!toPos && t.type === 'Submission' && role !== attackerOf(pos) && !['Half guard', 'Leg entanglement'].includes(pos)) err(k, `${name} is a finish offered to the one being attacked`)
      if (AFTER[name] && !AFTER[name].some(n => Object.keys(MENU).some(k2 => k2.startsWith(pos + '|') && MENU[k2].some(m => m[0] === n)))) err(k, `${name} waits for a move that never happens here`)
    }
    const open = menuFor({ pos, role, setups: [] })
    if (open.length < 3) err(k, `only ${open.length} moves before any setup`)
    if (!open.some(m => m.to || isFinish(m))) err(k, 'no way to attack or move on')
    // Every finish your partner can try from here must have an answer.
    const victim = { pos, role: flip(role), setups: Object.values(MENU).flat().map(m => idOf(m[0])) }
    open.filter(isFinish).forEach(m => { if (!defensesFor(techById(m.id), victim).length) err(k, `no defense against ${techById(m.id).name}`) })
  }
  // Every position the game can reach has a menu for both of you.
  const seen = new Set(), queue = Object.values(STARTS).map(s => key(s.pos, s.role))
  while (queue.length) {
    const k = queue.pop()
    if (seen.has(k)) continue
    seen.add(k)
    if (!MENU[k]) { err(k, 'reachable but has no menu'); continue }
    const [pos, role] = k.split('|')
    for (const [r, flipped] of [[role, false], [flip(role), true]]) (MENU[key(pos, r)] || []).filter(m => m[1]).forEach(([, toPos, toRole, pts]) => {
      const lands = [{ pos: toPos, role: toRole }, ...(pts ? [slipTo(pos, { pos: toPos, role: toRole })] : [])]
      lands.forEach(l => queue.push(key(l.pos, flipped ? flip(l.role) : l.role)))
    })
  }
  Object.keys(MENU).filter(k => !seen.has(k)).forEach(k => err(k, 'never reached'))
  return errors
}

export function checkGames(games = 300) {
  const errors = [], results = {}
  for (const start of Object.keys(STARTS)) for (const partner of Object.keys(PARTNERS)) for (let n = 0; n < games; n++) {
    const tally = results[partner] ||= { win: 0, loss: 0, draw: 0, subs: 0, tapped: 0, turns: 0, chains: 0 }
    try {
      const g = newRoll(start, partner)
      while (!g.over) {
        const where = `${start}/${partner} turn ${g.turn} ${key(g.pos, g.role)}`
        if (!MENU[key(g.pos, g.role)]) errors.push(`${where}: no menu`)
        if (g.options.length < 3) errors.push(`${where}: only ${g.options.length} options`)
        const here = new Set(menuFor(g).map(m => m.id))
        g.options.forEach(o => {
          if (!techById(o.id)) errors.push(`${where}: unknown move ${o.id}`)
          else if (!o.decoy && !o.defend && !here.has(o.id)) errors.push(`${where}: ${techById(o.id).name} offered but not playable here`)
          else if (o.decoy && here.has(o.id)) errors.push(`${where}: decoy ${techById(o.id).name} is actually playable here`)
        })
        if (g.threat && !g.options.some(o => o.defend)) errors.push(`${where}: under attack with no defense offered`)
        const before = [g.me, g.them, g.turn]
        play(g, Math.floor(Math.random() * g.options.length))
        if (g.turn !== before[2] + 1) errors.push(`${where}: the clock didn’t move`)
        for (const d of [g.me - before[0], g.them - before[1]]) if (![0, 2, 3, 4].includes(d)) errors.push(`${where}: scored ${d} in one turn`)
      }
      if (g.turn > TURNS + 1) errors.push(`${start}/${partner}: ran past time`)
      ;(g.chains || []).forEach(c => {
        if (!MENU[key(c.from.pos, c.from.role)]) errors.push(`${start}/${partner}: chain starts in ${key(c.from.pos, c.from.role)}`)
        if (c.steps[0]?.who !== 'me') errors.push(`${start}/${partner}: chain doesn’t start with your move`)
        c.steps.forEach(st => { if (st.who === 'me' ? !techById(st.techId) : !st.label) errors.push(`${start}/${partner}: chain step ${JSON.stringify(st)} is empty`) })
        if (!menuFor({ ...c.from, setups: Object.values(MENU).flat().map(m => idOf(m[0])) }).some(m => m.id === c.steps[0].techId)) errors.push(`${start}/${partner}: chain opens with ${c.steps[0].techId}, not playable from ${key(c.from.pos, c.from.role)}`)
      })
      tally.chains = (tally.chains || 0) + (g.chains || []).length
      tally[g.over.result]++
      tally.turns += g.turn - 1
      if (g.over.how.startsWith('Submission')) tally.subs++
      if (g.over.how.startsWith('Submitted')) tally.tapped++
    } catch (e) { errors.push(`${start}/${partner}: ${e.stack}`) }
  }
  return { errors: [...new Set(errors)], results }
}

export function checkSim(games = 300) {
  const table = checkTable(), { errors, results } = checkGames(games)
  console.log(table.length ? table : 'Table: every move fits its position, role and points.')
  console.log(errors.length ? errors.slice(0, 50) : `Games: ${games * Object.keys(STARTS).length * Object.keys(PARTNERS).length} random games, no problems.`)
  console.table(results)
  return { table, errors, results }
}
