// A self-check for the Live roll. Not loaded by the app; run it from the browser console:
//   import('./js/simcheck.js').then(m => m.checkSim())
// It walks every position and role, checks each move's landing, role and IBJJF points, then
// plays random games looking for crashes, dead ends and impossible scores, plain and with
// "Your game" turned on (a made-up journal, then yours).

import { CATALOG_BY_ID } from './catalog.js'
import { techById } from './model.js'
import { AFTER, GUARDS, MENU, STARTS, PARTNERS, TABLE, TURNS, attackerOf, defensesFor, flip, isFinish, key, menuFor, myGame, newRoll, play, pointsFor, slipTo } from './sim.js'
import { slug } from './util.js'

const idOf = name => 'c:' + slug(name)
const ALL_SETUPS = Object.values(MENU).flat().map(m => idOf(m[0]))

// What's wrong with offering this move from here, if anything.
function moveProblems(pos, role, t, to, pts) {
  const out = []
  if (to) {
    if (!MENU[key(to.pos, to.role)]) out.push(`lands in ${key(to.pos, to.role)}, which has no menu`)
    if (pts !== pointsFor({ pos, role }, t, to)) out.push(`scores ${pts}, IBJJF says ${pointsFor({ pos, role }, t, to)}`)
    if (pts && !MENU[key(slipTo(pos, to).pos, slipTo(pos, to).role)]) out.push('slips to a position with no menu')
  } else if (pts) out.push('scores without moving')
  if (t.type === 'Pass' && !(GUARDS.includes(pos) && role === 'Top')) out.push('is a pass offered off the top of a guard')
  if (t.type === 'Sweep' && role !== 'Bottom') out.push(`is a sweep offered to ${role}`)
  if (t.type === 'Takedown' && pos !== 'Standing') out.push('is a takedown offered off the feet')
  if (t.type === 'Escape' && role === attackerOf(pos) && !['Half guard', 'Standing'].includes(pos)) out.push('is an escape offered to the attacker')
  if (!to && t.type === 'Submission' && role !== attackerOf(pos) && !['Half guard', 'Leg entanglement'].includes(pos)) out.push('is a finish offered to the one being attacked')
  return out.map(p => `${t.name} ${p}`)
}

export function checkTable() {
  const errors = [], err = (k, msg) => errors.push(`${k}: ${msg}`)
  for (const [k, moves] of Object.entries(MENU)) {
    const [pos, role] = k.split('|')
    for (const [name, toPos, toRole, pts = 0] of moves) {
      const t = CATALOG_BY_ID[idOf(name)]
      if (!t) { err(k, `${name} is not in the catalog`); continue }
      moveProblems(pos, role, t, toPos && { pos: toPos, role: toRole }, pts).forEach(p => err(k, p))
      if (AFTER[name] && !AFTER[name].some(n => Object.keys(MENU).some(k2 => k2.startsWith(pos + '|') && MENU[k2].some(m => m[0] === n)))) err(k, `${name} waits for a move that never happens here`)
    }
    const open = menuFor({ pos, role, setups: [] })
    if (open.length < 3) err(k, `only ${open.length} moves before any setup`)
    if (!open.some(m => m.to || isFinish(m))) err(k, 'no way to attack or move on')
    // Every finish your partner can try from here must have an answer.
    const victim = { pos, role: flip(role), setups: ALL_SETUPS }
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

// A made-up journal: moves logged in sensible spots, a few logged in the wrong spot, and moves that caught you.
const log = list => Object.fromEntries(list.map(([k, ...names]) => [k, Object.fromEntries(names.map(n => [idOf(n), 2]))]))
export const SAMPLE = {
  starts: ['Half guard|Bottom', 'Closed guard|Top', 'Standing|Neutral'],
  mine: log([
    ['Butterfly guard|Top', 'Knee cut pass', 'Torreando pass'], ['Closed guard|Top', 'Torreando pass'], ['Closed guard|Bottom', 'Biceps slicer', 'Rear naked choke', 'Butterfly sweep'], ['Standing|Neutral', 'Sprawl', 'Duck under'],
    ['Knee on belly|Top', 'Americana'], ['Mount|Bottom', 'Knee cut pass'], ['Side control|Top', 'Hip bump sweep'], ['Mount|Top', 'Upa (bridge and roll)'],
    ['Half guard|Top', 'Double leg', 'Knee cut pass'], ['Half guard|Bottom', 'Underhook sweep', 'Butterfly sweep', 'Switch base to mount'],
  ]),
  caught: log([['Half guard|Top', 'Triangle choke', 'Guillotine'], ['Side control|Bottom', 'Kimura from side control', 'Rear naked choke'], ['Mount|Bottom', 'Ezekiel choke']]),
}
// [position|role, move, whether it should be offered]
const EXPECT = [
  ['Butterfly guard|Top', 'Knee cut pass', true], ['Closed guard|Bottom', 'Biceps slicer', true], ['Standing|Neutral', 'Sprawl', true], ['Knee on belly|Top', 'Americana', true],
  ['Half guard|Bottom', 'Butterfly sweep', true], ['Closed guard|Bottom', 'Rear naked choke', false], ['Mount|Bottom', 'Knee cut pass', false],
  ['Side control|Top', 'Hip bump sweep', false], ['Closed guard|Top', 'Torreando pass', false], ['Closed guard|Bottom', 'Butterfly sweep', false], ['Mount|Top', 'Upa (bridge and roll)', false], ['Half guard|Top', 'Double leg', false],
]

// Your-game menus: everything they add must pass the same rules as the game's own moves.
export function checkPersonal(my = SAMPLE) {
  const errors = []
  for (const k of Object.keys(MENU)) {
    const [pos, role] = k.split('|'), native = new Set(TABLE[k].map(m => m.id))
    const sides = [[role, menuFor({ pos, role, setups: ALL_SETUPS, personal: true, my })], [flip(role), menuFor({ pos, role: flip(role), setups: ALL_SETUPS }, my.caught[k])]]
    for (const [r, menu] of sides) menu.filter(m => !TABLE[key(pos, r)]?.some(x => x.id === m.id)).forEach(m => {
      const t = techById(m.id)
      moveProblems(pos, r, t, m.to, m.pts).forEach(p => errors.push(`your game, ${key(pos, r)}: ${p}`))
    })
    if (my === SAMPLE) EXPECT.filter(([k2]) => k2 === k).forEach(([, name, ok]) => {
      if (sides[0][1].some(m => m.id === idOf(name)) !== ok) errors.push(`your game, ${k}: ${name} should ${ok ? '' : 'not '}be offered`)
    })
    if (my === SAMPLE && k === 'Half guard|Top' && !sides[1][1].some(m => m.id === idOf('Triangle choke'))) errors.push('your game: the triangle that caught you from half guard top never comes back')
    if (my === SAMPLE && k === 'Side control|Bottom' && sides[1][1].some(m => m.id === idOf('Rear naked choke'))) errors.push('your game: a rear naked choke from side control should never be rehearsed')
    if (!native.size) errors.push(`${k}: no menu`)
  }
  return errors
}

export function checkGames(games = 300, opts = {}) {
  const errors = [], results = {}, label = opts.personal ? (opts.my === SAMPLE ? 'sample journal ' : 'your journal ') : ''
  const starts = [...Object.keys(STARTS), ...(opts.my?.starts || [])]
  for (const start of starts) for (const partner of Object.keys(PARTNERS)) for (let n = 0; n < games; n++) {
    const tally = results[label + partner] ||= { win: 0, loss: 0, draw: 0, subs: 0, tapped: 0, turns: 0, chains: 0 }
    try {
      const g = newRoll(start, partner, opts)
      while (!g.over) {
        const where = `${label}${start}/${partner} turn ${g.turn} ${key(g.pos, g.role)}`
        if (!MENU[key(g.pos, g.role)]) errors.push(`${where}: no menu`)
        if (g.options.length < 3) errors.push(`${where}: only ${g.options.length} options`)
        const here = new Set(menuFor(g).map(m => m.id)), logged = g.personal && g.my.mine[key(g.pos, g.role)] || {}
        g.options.forEach(o => {
          if (!techById(o.id)) errors.push(`${where}: unknown move ${o.id}`)
          else if (!o.decoy && !o.defend && !here.has(o.id)) errors.push(`${where}: ${techById(o.id).name} offered but not playable here`)
          else if (o.decoy && here.has(o.id)) errors.push(`${where}: decoy ${techById(o.id).name} is actually playable here`)
          else if (o.mine && !logged[o.id]) errors.push(`${where}: ${techById(o.id).name} marked as yours but you never logged it here`)
        })
        if ([...here].some(id => logged[id]) && !g.options.some(o => o.mine)) errors.push(`${where}: none of your logged moves got a slot`)
        if (g.threat && !g.options.some(o => o.defend)) errors.push(`${where}: under attack with no defense offered`)
        const before = [g.me, g.them, g.turn]
        play(g, Math.floor(Math.random() * g.options.length))
        if (g.turn !== before[2] + 1) errors.push(`${where}: the clock didn’t move`)
        for (const d of [g.me - before[0], g.them - before[1]]) if (![0, 2, 3, 4].includes(d)) errors.push(`${where}: scored ${d} in one turn`)
      }
      if (g.turn > TURNS + 1) errors.push(`${label}${start}/${partner}: ran past time`)
      ;(g.chains || []).forEach(c => {
        if (!MENU[key(c.from.pos, c.from.role)]) errors.push(`${label}${start}/${partner}: chain starts in ${key(c.from.pos, c.from.role)}`)
        if (c.steps[0]?.who !== 'me') errors.push(`${label}${start}/${partner}: chain doesn’t start with your move`)
        c.steps.forEach(st => { if (st.who === 'me' ? !techById(st.techId) : !st.label) errors.push(`${label}${start}/${partner}: chain step ${JSON.stringify(st)} is empty`) })
        if (!menuFor({ ...c.from, setups: ALL_SETUPS, personal: g.personal, my: g.my }).some(m => m.id === c.steps[0].techId)) errors.push(`${label}${start}/${partner}: chain opens with ${c.steps[0].techId}, not playable from ${key(c.from.pos, c.from.role)}`)
      })
      tally.chains += (g.chains || []).length
      tally[g.over.result]++
      tally.turns += g.turn - 1
      if (g.over.how.startsWith('Submission')) tally.subs++
      if (g.over.how.startsWith('Submitted')) tally.tapped++
    } catch (e) { errors.push(`${label}${start}/${partner}: ${e.stack}`) }
  }
  return { errors: [...new Set(errors)], results }
}

// mine: also check "Your game" against your own journal (in the browser).
export function checkSim(games = 300, { mine = typeof indexedDB !== 'undefined' } = {}) {
  const table = checkTable(), personal = [...checkPersonal(), ...(mine ? checkPersonal(myGame()) : [])]
  const runs = [checkGames(games), checkGames(games, { personal: true, rehearse: true, my: SAMPLE }), ...(mine ? [checkGames(games, { personal: true, rehearse: true })] : [])]
  const errors = runs.flatMap(r => r.errors), results = Object.assign({}, ...runs.map(r => r.results))
  console.log(table.length ? table : 'Table: every move fits its position, role and points.')
  console.log(personal.length ? personal : 'Your game: every logged move it adds fits its position, role and points; misplaced ones stay out.')
  console.log(errors.length ? errors.slice(0, 50) : `Games: ${Object.values(results).reduce((n, r) => n + r.win + r.loss + r.draw, 0)} random games, no problems.`)
  console.table(results)
  return { table, personal, errors, results }
}
