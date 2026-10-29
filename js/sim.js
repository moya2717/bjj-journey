// Live roll: a turn-based roll against a simulated partner.
// Each turn you pick a move that fits your position. Success depends on the move, the position,
// your partner, and how well you know the move (its mastery level from your journal).
// Moves from your sequences and the game maps draw the reactions you mapped, and your mapped
// answer becomes an option next turn. Points follow IBJJF scoring and only count once the
// position is stabilized; a near miss earns an advantage. A submission ends it.

import { S } from './store.js'
import { GAME_MAPS } from './maps.js'
import { allTechs, currentRank, isCustom, masteryOf, rollMoves, techById } from './model.js'
import { BELTS } from './vocab.js'
import { slug } from './util.js'

export const TURNS = 12
export const GUARDS = ['Closed guard', 'Half guard', 'Butterfly guard', 'De La Riva', 'Reverse De La Riva', 'X-guard', 'Spider / lasso', 'Lapel guards', 'Open guard']

// you: added to your odds. counter: how often they punish a miss. finish: how often their
// submission finishes when you don't defend it. scramble: how often they wriggle out before you
// stabilize a score. hold: how often they stabilize theirs.
export const PARTNERS = {
  easy: { label: 'A lower belt, a bit lighter', you: 0.08, counter: 0.3, finish: 0.35, scramble: 0.1, hold: 0.7 },
  even: { label: 'Your belt, your size', you: 0, counter: 0.45, finish: 0.5, scramble: 0.2, hold: 0.8 },
  tough: { label: 'A heavier, higher belt', you: -0.1, counter: 0.6, finish: 0.65, scramble: 0.3, hold: 0.9 },
}
export const STARTS = {
  standing: { label: 'On the feet', pos: 'Standing', role: 'Neutral' },
  guard: { label: 'Playing guard', pos: 'Closed guard', role: 'Bottom' },
  passing: { label: 'Passing guard', pos: 'Closed guard', role: 'Top' },
  bad: { label: 'Escaping side control', pos: 'Side control', role: 'Bottom' },
}

// Every move the game offers, by position and role: [library move, where it lands, your role there,
// IBJJF points]. A move with no landing keeps you where you are: a submission finishes, anything else
// is control that sets up your next attack. You and your partner both play from this table.
// In a leg entanglement, Bottom is the one attacking the legs.
export const MENU = {
  'Standing|Neutral': [
    ['Double leg', 'Half guard', 'Top', 2], ['Blast double', 'Open guard', 'Top', 2], ['Single leg', 'Open guard', 'Top', 2], ['Low single', 'Open guard', 'Top', 2],
    ['Ankle pick', 'Open guard', 'Top', 2], ['Knee tap', 'Open guard', 'Top', 2], ['High crotch', 'Half guard', 'Top', 2], ['Body lock takedown', 'Half guard', 'Top', 2],
    ['Inside trip', 'Half guard', 'Top', 2], ['Ouchi gari', 'Half guard', 'Top', 2], ['De ashi barai (foot sweep)', 'Open guard', 'Top', 2],
    ['Osoto gari', 'Side control', 'Top', 2], ['Seoi nage', 'Side control', 'Top', 2], ['Uchi mata', 'Side control', 'Top', 2], ['Hip toss', 'Side control', 'Top', 2],
    ['Snap down', 'Front headlock', 'Top'], ['Guard pull', 'Open guard', 'Bottom'], ['Sit-down guard pull', 'Open guard', 'Bottom'], ['Jumping closed guard', 'Closed guard', 'Bottom'],
    ['Collar tie'], ['Collar and sleeve grips'], ['Underhook pummeling'], ['Russian tie'], ['Two-on-one'], ['Arm drag'], ['Inside tie (wrist control)'],
    ['Standing guillotine'], ['Arm-in guillotine'],
  ],
  'Front headlock|Top': [
    ['High elbow guillotine'], ['Japanese necktie'], ['Peruvian necktie'], ['D’arce choke'], ['Anaconda choke'], ['Chin strap control'],
    ['Go-behind from front headlock', 'Turtle', 'Top'], ['Front headlock spin behind', 'Turtle', 'Top'],
  ],
  'Front headlock|Bottom': [
    ['Front headlock escape', 'Standing', 'Neutral'], ['Turtle to single leg', 'Half guard', 'Top'], ['Granby roll escape', 'Open guard', 'Bottom'], ['Guillotine defense'],
  ],
  'Closed guard|Bottom': [
    ['Hip bump sweep', 'Mount', 'Top', 2], ['Scissor sweep', 'Mount', 'Top', 2], ['Flower sweep', 'Mount', 'Top', 2], ['Kimura sweep', 'Mount', 'Top', 2],
    ['Muscle sweep', 'Half guard', 'Top', 2], ['Lumberjack sweep', 'Open guard', 'Top', 2], ['Overhead sweep', 'Open guard', 'Top', 2],
    ['Armbar from guard'], ['Triangle choke'], ['Triangle armbar'], ['Kimura'], ['Omoplata'], ['Guillotine'], ['Cross collar choke'], ['Loop choke'], ['Gogoplata'], ['Wristlock from guard'],
    ['Breaking posture'], ['High guard'], ['Overhook guard'], ['Shoulder clamp'], ['Rubber guard'], ['Two-on-one from guard'],
    ['Arm drag to back', 'Back', 'Top', 4], ['Collar sleeve guard', 'Open guard', 'Bottom'],
  ],
  'Closed guard|Top': [
    ['Posture in closed guard'], ['Standing guard break', 'Open guard', 'Top'], ['Kneeling guard break', 'Open guard', 'Top'], ['Knee in the middle break', 'Open guard', 'Top'],
  ],
  'Open guard|Bottom': [
    ['Collar sleeve sweep', 'Open guard', 'Top', 2], ['Shin-to-shin sweep', 'Open guard', 'Top', 2], ['Double ankle sweep', 'Open guard', 'Top', 2], ['Chair sweep', 'Open guard', 'Top', 2],
    ['Hook sweep', 'Half guard', 'Top', 2], ['X-guard sweep from open guard', 'Open guard', 'Top', 2], ['Triangle choke'], ['Omoplata'],
    ['Guard retention (frames and hips)'], ['Inversion'], ['Granby roll recovery'], ['Shoulder walk'], ['Collar sleeve guard'],
    ['De La Riva hook', 'De La Riva', 'Bottom'], ['Reverse De La Riva hook', 'Reverse De La Riva', 'Bottom'], ['Seated guard', 'Butterfly guard', 'Bottom'],
    ['Spider guard retention', 'Spider / lasso', 'Bottom'], ['X-guard entry', 'X-guard', 'Bottom'], ['Worm guard', 'Lapel guards', 'Bottom'],
    ['Shin-to-shin entry', 'Leg entanglement', 'Bottom'], ['Technical stand-up from guard', 'Standing', 'Neutral'], ['Wrestle up', 'Standing', 'Neutral'],
  ],
  'Open guard|Top': [
    ['Long step pass', 'Side control', 'Top', 3], ['Leg drag pass', 'Side control', 'Top', 3], ['Torreando pass', 'Side control', 'Top', 3], ['Over-under pass', 'Side control', 'Top', 3],
    ['Double under pass', 'Side control', 'Top', 3], ['Stack pass', 'Side control', 'Top', 3], ['X-pass', 'Side control', 'Top', 3], ['Leg weave pass', 'Side control', 'Top', 3],
    ['Smash pass', 'Side control', 'Top', 3], ['Float pass', 'Side control', 'Top', 3], ['Folding pass', 'Side control', 'Top', 3], ['Body lock pass', 'Side control', 'Top', 3],
    ['Knee cut pass', 'Side control', 'Top', 3], ['Headquarters'], ['Ashi garami', 'Leg entanglement', 'Bottom'],
  ],
  'Half guard|Bottom': [
    ['Underhook sweep', 'Half guard', 'Top', 2], ['Old school sweep', 'Half guard', 'Top', 2], ['Electric chair', 'Half guard', 'Top', 2], ['Waiter sweep', 'Open guard', 'Top', 2],
    ['Deep half sweep', 'Half guard', 'Top', 2], ['Homer Simpson sweep', 'Half guard', 'Top', 2], ['Coyote half sweep', 'Open guard', 'Top', 2], ['John Wayne sweep', 'Half guard', 'Top', 2],
    ['Kimura sweep from half guard', 'Half guard', 'Top', 2], ['Plan B sweep', 'Half guard', 'Top', 2],
    ['Back take from half guard', 'Back', 'Top', 4], ['Back take from dogfight', 'Back', 'Top', 4],
    ['Kimura from half guard'], ['Triangle from knee shield'], ['Guillotine'],
    ['Knee shield'], ['Lockdown'], ['Z guard'], ['Deep half guard entry'], ['Dogfight'], ['Shrimp to guard recovery', 'Open guard', 'Bottom'],
  ],
  'Half guard|Top': [
    ['Knee cut pass', 'Side control', 'Top', 3], ['Back step pass', 'Side control', 'Top', 3], ['Tripod pass', 'Side control', 'Top', 3], ['Underhook half pass', 'Side control', 'Top', 3],
    ['Shin slide', 'Side control', 'Top', 3], ['Hip switch half pass', 'Side control', 'Top', 3], ['Smash pass', 'Side control', 'Top', 3],
    ['Knee shield pass', 'Side control', 'Top', 3], ['Lockdown pass', 'Side control', 'Top', 3], ['Deep half pass', 'Side control', 'Top', 3],
    ['Kimura from half guard'], ['D’arce choke'], ['Arm triangle from half guard'], ['Toe hold from half guard top'],
    ['Crossface and underhook'], ['Flat half guard control'], ['Whizzer'],
  ],
  'Butterfly guard|Bottom': [
    ['Butterfly sweep', 'Open guard', 'Top', 2], ['Arm drag sweep', 'Open guard', 'Top', 2], ['Elevator sweep', 'Open guard', 'Top', 2], ['Overhook butterfly sweep', 'Open guard', 'Top', 2],
    ['Shoulder crunch sweep', 'Open guard', 'Top', 2], ['Butterfly back take', 'Back', 'Top', 4], ['Butterfly to single-leg X', 'Leg entanglement', 'Bottom'],
    ['Butterfly ashi entry', 'Leg entanglement', 'Bottom'], ['Guillotine from butterfly'], ['Butterfly guard retention'], ['Shoulder crunch'],
  ],
  'Butterfly guard|Top': [
    ['Butterfly pass (hip switch)', 'Side control', 'Top', 3], ['Knee pin pass', 'Side control', 'Top', 3], ['Body lock pass', 'Side control', 'Top', 3],
    ['Smash pass', 'Side control', 'Top', 3], ['Over-under pass', 'Side control', 'Top', 3], ['Headquarters'],
  ],
  'De La Riva|Bottom': [
    ['De La Riva sweep', 'Open guard', 'Top', 2], ['Tripod sweep', 'Open guard', 'Top', 2], ['Sickle sweep', 'Open guard', 'Top', 2], ['Single leg from De La Riva', 'Open guard', 'Top', 2],
    ['Berimbolo', 'Back', 'Top', 4], ['Back take from De La Riva', 'Back', 'Top', 4], ['Matrix back take', 'Back', 'Top', 4], ['Crab ride'],
    ['De La Riva to single-leg X', 'Leg entanglement', 'Bottom'], ['De La Riva omoplata'], ['De La Riva hook'], ['Reverse De La Riva hook', 'Reverse De La Riva', 'Bottom'],
  ],
  'De La Riva|Top': [
    ['De La Riva pass (knee slide out)', 'Side control', 'Top', 3], ['Leg pin pass', 'Side control', 'Top', 3], ['Torreando pass', 'Side control', 'Top', 3],
    ['Leg drag pass', 'Side control', 'Top', 3], ['Long step pass', 'Side control', 'Top', 3], ['Headquarters'],
  ],
  'Reverse De La Riva|Bottom': [
    ['Reverse De La Riva sweep', 'Open guard', 'Top', 2], ['Kiss of the dragon', 'Back', 'Top', 4], ['Baby bolo', 'Back', 'Top', 4], ['Reverse De La Riva back take', 'Back', 'Top', 4],
    ['Reverse De La Riva to single-leg X', 'Leg entanglement', 'Bottom'], ['Reverse De La Riva hook'], ['De La Riva hook', 'De La Riva', 'Bottom'],
  ],
  'Reverse De La Riva|Top': [
    ['Reverse De La Riva pass', 'Side control', 'Top', 3], ['Back step pass', 'Side control', 'Top', 3], ['Smash pass', 'Side control', 'Top', 3],
    ['Body lock pass', 'Side control', 'Top', 3], ['Headquarters'],
  ],
  'X-guard|Bottom': [
    ['X-guard sweep', 'Open guard', 'Top', 2], ['X-guard stand-up sweep', 'Open guard', 'Top', 2], ['X-guard back roll sweep', 'Open guard', 'Top', 2],
    ['Single-leg X sweep', 'Open guard', 'Top', 2], ['X-guard to leg drag', 'Open guard', 'Top', 2], ['Ashi garami', 'Leg entanglement', 'Bottom'],
  ],
  'X-guard|Top': [
    ['X-guard pass', 'Side control', 'Top', 3], ['Back step pass', 'Side control', 'Top', 3], ['Smash pass', 'Side control', 'Top', 3],
  ],
  'Spider / lasso|Bottom': [
    ['Spider guard sweep', 'Open guard', 'Top', 2], ['Lasso sweep', 'Open guard', 'Top', 2], ['Balloon sweep', 'Open guard', 'Top', 2], ['Spider guard overhead sweep', 'Open guard', 'Top', 2],
    ['Triangle from spider'], ['Omoplata from lasso'], ['Lasso to back take', 'Back', 'Top', 4], ['Spider guard retention'],
  ],
  'Spider / lasso|Top': [
    ['Spider guard pass (break the grips)', 'Side control', 'Top', 3], ['Lasso pass', 'Side control', 'Top', 3], ['Stack pass', 'Side control', 'Top', 3], ['Torreando pass', 'Side control', 'Top', 3],
  ],
  'Lapel guards|Bottom': [
    ['Lapel guard sweep', 'Open guard', 'Top', 2], ['Berimbolo', 'Back', 'Top', 4], ['Worm guard'], ['Squid guard'], ['Ringworm guard'],
  ],
  'Lapel guards|Top': [
    ['Lapel guard pass', 'Side control', 'Top', 3], ['Leg pin pass', 'Side control', 'Top', 3], ['Long step pass', 'Side control', 'Top', 3], ['Headquarters'],
  ],
  'Leg entanglement|Bottom': [
    ['Straight ankle lock'], ['Inside heel hook'], ['Outside heel hook'], ['Kneebar'], ['Toe hold'], ['Estima lock'], ['Calf slicer'], ['Aoki lock'],
    ['Single-leg X'], ['Ashi garami'], ['50/50'], ['Saddle (inside sankaku)'], ['Outside ashi'], ['Cross ashi'], ['Backside 50/50'], ['Single-leg X sweep', 'Open guard', 'Top', 2],
  ],
  'Leg entanglement|Top': [
    ['Heel hook defense'], ['Boot escape', 'Open guard', 'Top'], ['Clear the knee line', 'Open guard', 'Top'], ['Straight ankle lock'], ['Toe hold'],
  ],
  'Side control|Top': [
    ['Americana'], ['Kimura from side control'], ['Arm triangle'], ['Paper cutter choke'], ['Baseball bat choke'], ['Far-side armbar'], ['Step-over armbar'], ['Bread cutter choke'], ['Ezekiel from side control'],
    ['Crossface control'], ['Kesa gatame'], ['Reverse kesa gatame'], ['Near-side underhook control'], ['Hip switch side control'],
    ['Side control to mount', 'Mount', 'Top', 4], ['Side control to knee on belly', 'Knee on belly', 'Top', 2], ['Side control to north-south', 'North-south', 'Top'],
  ],
  'Side control|Bottom': [
    ['Shrimp to guard recovery', 'Open guard', 'Bottom'], ['Elbow-knee escape', 'Half guard', 'Bottom'], ['Underhook escape to knees', 'Turtle', 'Bottom'],
    ['Ghost escape', 'Turtle', 'Bottom'], ['Running escape', 'Turtle', 'Bottom'], ['Kesa gatame escape', 'Half guard', 'Bottom'],
  ],
  'Mount|Top': [
    ['Armbar from mount'], ['Arm triangle from mount'], ['Ezekiel choke'], ['Cross collar choke from mount'], ['Americana from mount'], ['Mounted guillotine'], ['Armbar from S-mount'], ['Mounted triangle'],
    ['High mount'], ['S-mount'], ['Technical mount'], ['Low mount'], ['Grapevine mount'],
    ['Mount to back take', 'Back', 'Top', 4], ['Gift wrap'],
  ],
  'Mount|Bottom': [
    ['Upa (bridge and roll)', 'Closed guard', 'Top'], ['Elbow-knee escape', 'Half guard', 'Bottom'], ['Kipping escape', 'Open guard', 'Bottom'], ['Heel drag escape', 'Half guard', 'Bottom'],
  ],
  'Back|Top': [
    ['Rear naked choke'], ['Bow and arrow choke'], ['Collar choke from back'], ['Short choke'], ['Armbar from back'], ['Arm trap choke'], ['Back triangle'],
    ['Seatbelt control'], ['Body triangle'], ['Hooks in'], ['Straight jacket'], ['Technical mount', 'Mount', 'Top', 4],
  ],
  'Back|Bottom': [
    ['Back escape (shoulder to the mat)', 'Half guard', 'Top'], ['Back escape to guard', 'Open guard', 'Bottom'], ['Body triangle escape'], ['Two-on-one'],
  ],
  'Knee on belly|Top': [
    ['Knee on belly control'], ['Far-side armbar from knee on belly'], ['Spinning armbar'], ['Baseball bat choke'],
    ['Knee on belly to mount', 'Mount', 'Top', 4], ['Crossface control', 'Side control', 'Top'],
  ],
  'Knee on belly|Bottom': [
    ['Knee on belly escape', 'Open guard', 'Bottom'], ['Shrimp to guard recovery', 'Open guard', 'Bottom'], ['Underhook escape to knees', 'Turtle', 'Bottom'],
  ],
  'North-south|Top': [
    ['North-south choke'], ['Kimura from north-south'], ['Armbar from north-south'], ['North-south control'], ['Crossface control', 'Side control', 'Top'],
  ],
  'North-south|Bottom': [
    ['North-south escape', 'Open guard', 'Bottom'], ['Shrimp to guard recovery', 'Open guard', 'Bottom'], ['Underhook escape to knees', 'Turtle', 'Bottom'],
  ],
  'Turtle|Top': [
    ['Clock choke'], ['Anaconda choke'], ['Crucifix'], ['Calf slicer from the truck'], ['Spiral ride'], ['Truck entry'],
    ['Seatbelt back take', 'Back', 'Top', 4], ['Back take from turtle (hooks in)', 'Back', 'Top', 4], ['Front headlock', 'Front headlock', 'Top'],
  ],
  'Turtle|Bottom': [
    ['Sit-out', 'Standing', 'Neutral'], ['Granby roll escape', 'Open guard', 'Bottom'], ['Turtle to guard recovery', 'Open guard', 'Bottom'],
    ['Turtle to single leg', 'Half guard', 'Top'], ['Peterson roll', 'Half guard', 'Top'],
  ],
}

// Moves that only make sense once something else has happened in this position (by either of you).
export const AFTER = {
  'Triangle armbar': ['Triangle choke'], 'Armbar from S-mount': ['S-mount'], 'Mounted triangle': ['S-mount', 'High mount'],
  'Electric chair': ['Lockdown'], 'Waiter sweep': ['Deep half guard entry'], 'Deep half sweep': ['Deep half guard entry'], 'Homer Simpson sweep': ['Deep half guard entry'],
  'Back take from dogfight': ['Dogfight', 'Underhook sweep'], 'Triangle from knee shield': ['Knee shield', 'Z guard'], 'Shoulder crunch sweep': ['Shoulder crunch'],
  'Lockdown pass': ['Lockdown'], 'Deep half pass': ['Deep half guard entry'], 'Knee shield pass': ['Knee shield', 'Z guard'], 'Whizzer': ['Dogfight', 'Underhook sweep'],
  'Kesa gatame escape': ['Kesa gatame', 'Reverse kesa gatame'], 'Body triangle escape': ['Body triangle'], 'Calf slicer from the truck': ['Truck entry'],
}

// The defenses that answer a submission, besides the escapes of the position you're in.
const DEFENSES = [
  [/armbar|wristlock/i, 'Armbar defense (stack)'], [/^(?!arm triangle).*triangle/i, 'Triangle defense'], [/kimura|americana|omoplata/i, 'Kimura defense'],
  [/guillotine|necktie|d’arce|anaconda/i, 'Guillotine defense'], [/heel hook|ankle|toe hold|kneebar|calf|estima|aoki/i, 'Heel hook defense'],
]
// Why a finish didn't land.
const BLOCKS = [
  [/heel hook|ankle|toe hold|kneebar|calf|estima|aoki/i, 'they clear the knee line and hide the heel'], [/armbar|wristlock|kimura|americana|omoplata|crucifix/i, 'they hide the arm and pull it free'],
  [/^(?!arm triangle).*triangle/i, 'they posture and pop the head out'], [/./, 'they hand-fight and protect the neck'],
]
// Where you end up when you nearly score but they scramble before you stabilize (scorer's view).
const SLIP = { 'Side control': 'Half guard', 'Mount': 'Half guard', 'Back': 'Turtle', 'Knee on belly': 'Side control' }
export const slipTo = (from, to) => from === 'Standing' || !SLIP[to.pos] ? { pos: 'Standing', role: 'Neutral' } : { pos: SLIP[to.pos], role: 'Top' }
// What a submission from a pin needs, for spotting the decoys.
const NEEDS = { 'Back': 'their back', 'Mount': 'you mounted on them', 'Side control': 'you on top in side control', 'Knee on belly': 'your knee on their belly', 'North-south': 'you on top in north-south', 'Turtle': 'them turtled under you' }

export const key = (pos, role) => pos + '|' + role
export const flip = role => ({ Top: 'Bottom', Bottom: 'Top' }[role] || role)
const idOf = name => 'c:' + slug(name)
const pick = list => list[Math.floor(Math.random() * list.length)]
const shuffle = list => [...list].sort(() => Math.random() - 0.5)
export const attackerOf = pos => pos === 'Standing' ? 'Neutral' : GUARDS.includes(pos) || pos === 'Leg entanglement' ? 'Bottom' : 'Top'

export const TABLE = Object.fromEntries(Object.entries(MENU).map(([k, moves]) => [k, moves.map(([name, pos, role, pts = 0]) =>
  ({ id: idOf(name), to: pos ? { pos, role } : null, pts, after: (AFTER[name] || []).map(idOf) }))]))

// Where a move takes you, in your own terms: the move's landing from here, else from wherever the game
// lists it. A move with no landing (a grip, a finish, a stall) keeps you where you are.
export function landing(id, at) {
  const here = (TABLE[key(at.pos, at.role)] || []).find(m => m.id === id)
  if (here) return here.to
  return Object.values(TABLE).flat().find(m => m.id === id && m.to)?.to || null
}

// Library moves that belong to this side of the position: the attacker sweeps and submits, the other side passes and escapes.
export const fits = (t, { pos, role }) => t.type !== 'Movement' && (pos === 'Standing' || (role === attackerOf(pos)) !== ['Escape', 'Pass'].includes(t.type))

// Moves you added yourself join in when their type says clearly what they do from here.
function customMoves({ pos, role }) {
  const guard = GUARDS.includes(pos), move = (id, to, pts = 0) => ({ id, to, pts, after: [] })
  return allTechs().filter(t => isCustom(t) && t.position === pos).flatMap(t =>
    t.type === 'Takedown' && pos === 'Standing' ? [move(t.id, { pos: 'Half guard', role: 'Top' }, 2)]
    : t.type === 'Sweep' && guard && role === 'Bottom' ? [move(t.id, { pos: 'Half guard', role: 'Top' }, 2)]
    : t.type === 'Pass' && guard && role === 'Top' ? [move(t.id, { pos: 'Side control', role: 'Top' }, 3)]
    : (t.type === 'Submission' || t.type === 'Control') && role === attackerOf(pos) || t.type === 'Retention' && guard && role === 'Bottom' ? [move(t.id, null)]
    : [])
}

// The points a landing scores under IBJJF rules, in the mover's own terms.
export function pointsFor({ pos, role }, t, to) {
  if (to.role !== 'Top') return 0
  if (to.pos === 'Back') return 4
  // A sweep scores 2 even when it comes up in mount: the mount's 4 only counts once it's held on its own.
  if ((GUARDS.includes(pos) || pos === 'Leg entanglement') && role === 'Bottom') return 2
  if (to.pos === 'Mount') return 4
  if (pos === 'Standing' && t.type === 'Takedown' && to.pos !== 'Front headlock') return 2 // a snap down isn't a takedown
  if (GUARDS.includes(pos) && role === 'Top' && to.pos === 'Side control') return 3
  if (to.pos === 'Knee on belly') return 2
  return 0 // reversals from turtle, mount or the back don't score
}

// A move from your log that the game doesn't list here joins in when the game lists it for the same side
// of a sibling spot (another open guard, another pin), or the library files it under this position for this side.
// It lands where it does from that sibling; otherwise it keeps you where you are. A locked closed guard
// has no siblings: you can't torreando their crossed ankles.
const FAMILIES = [GUARDS.filter(p => p !== 'Closed guard'), ['Side control', 'Knee on belly', 'North-south']]
function borrow(id, at) {
  const t = techById(id)
  if (!t || !fits(t, at)) return null
  const from = Object.entries(TABLE).find(([k, moves]) => {
    const [p, r] = k.split('|')
    return r === at.role && FAMILIES.some(f => f.includes(p) && f.includes(at.pos)) && moves.some(m => m.id === id)
  })
  if (!from && t.position !== at.pos) return null
  const to = from?.[1].find(m => m.id === id).to || null
  return { id, to, pts: to ? pointsFor(at, t, to) : 0, after: [] }
}

// The game's moves from here, plus any you log from here (or, for your partner, the ones that caught you).
export const menuFor = (state, logged = state.personal ? state.my?.mine[key(state.pos, state.role)] : null) => {
  const base = [...(TABLE[key(state.pos, state.role)] || []), ...customMoves(state)], have = new Set(base.map(m => m.id))
  return [...base, ...Object.keys(logged || {}).filter(id => !have.has(id)).map(id => borrow(id, state)).filter(Boolean)]
    .filter(m => !m.after.length || m.after.some(id => state.setups.includes(id)))
}
export const isFinish = m => !m.to && techById(m.id)?.type === 'Submission'
const isAttack = m => isFinish(m) || m.pts > 0

export function describe({ pos, role }) {
  if (pos === 'Standing') return 'You’re both standing'
  if (pos === 'Back') return role === 'Top' ? 'You have their back' : 'They have your back'
  if (pos === 'Mount') return role === 'Top' ? 'You’re mounted on them' : 'They’re mounted on you'
  if (pos === 'Leg entanglement') return role === 'Bottom' ? 'You’re attacking their legs' : 'They’re attacking your legs'
  if (pos === 'Front headlock') return role === 'Top' ? 'You have a front headlock' : 'They have you in a front headlock'
  if (pos === 'Turtle') return role === 'Top' ? 'They’re turtled and you’re on top' : 'You’re turtled with them on top'
  if (GUARDS.includes(pos)) return role === 'Bottom' ? `You’re playing ${pos.toLowerCase()}` : `You’re in their ${pos.toLowerCase()}`
  return role === 'Top' ? `You’re on top in ${pos.toLowerCase()}` : `They’re on top of you in ${pos.toLowerCase()}`
}

export function defensesFor(t, state) {
  const own = menuFor(state).filter(m => ['Escape', 'Retention'].includes(techById(m.id)?.type)).map(m => m.id)
  return [...new Set([...DEFENSES.filter(([re]) => re.test(t.name)).map(([, name]) => idOf(name)), ...own])]
}

// Decoys are moves that clearly belong to the other person: sweeps and escapes when you're on
// top; passes and finishes from a pin when you're underneath or standing.
const ALL = Object.entries(TABLE).flatMap(([k, moves]) => moves.map(m => ({ ...m, role: k.split('|')[1] })))
function decoysFor(state) {
  const here = new Set(menuFor(state).map(m => m.id))
  return [...new Set(ALL.filter(m => !here.has(m.id) && (state.role === 'Top'
    ? m.role === 'Bottom' && ['Sweep', 'Escape'].includes(techById(m.id).type)
    : m.role === 'Top' && (techById(m.id).type === 'Pass' || isFinish(m) && NEEDS[techById(m.id).position]))).map(m => m.id))]
}
function decoyText(t) {
  if (t.type === 'Pass') return `${t.name} is a guard pass, and you’re not on top of a guard.`
  if (t.type === 'Sweep') return `${t.name} is a sweep from underneath, and you’re on top.`
  if (t.type === 'Escape') return `${t.name} is an escape for whoever is underneath, and you’re on top.`
  return `${t.name} needs ${NEEDS[t.position] || 'a different position'}.`
}

// Reactions you or the game maps have mapped for a move, with the answers that work from here.
function mappedReactions(techId, state) {
  const here = new Set(menuFor(state).map(m => m.id))
  const trees = [...S.seq, ...GAME_MAPS]
  return trees.flatMap(tree => tree.nodes.filter(n => n.who === 'me' && n.techId === techId).flatMap(n =>
    tree.nodes.filter(r => r.parentId === n.id && r.who === 'them').map(r => ({
      label: r.label, mine: S.seq.includes(tree),
      answers: tree.nodes.filter(a => a.parentId === r.id && here.has(a.techId)).map(a => a.techId),
    })))).filter(r => r.answers.length)
}

// Your game, from your journal: where your rolls start, the moves you use and land in each spot
// (weighted toward landed), and the moves that caught you there, keyed by your position and role.
export function myGame() {
  const starts = {}, mine = {}, caught = {}
  const at = (pos, role) => { const k = key(pos, pos === 'Standing' ? 'Neutral' : role); return MENU[k] ? k : null }
  const bump = (o, k, id, n) => { if (k && techById(id)) (o[k] ||= {})[id] = (o[k][id] || 0) + n }
  S.roll.forEach(r => {
    const k = at(r.position, r.role)
    if (k) starts[k] = (starts[k] || 0) + 1
    const steps = r.chain?.length ? r.chain.map(m => ({ ...m, k: at(m.position, m.role) })) : rollMoves(r).map(m => ({ ...m, k }))
    steps.forEach(m => m.outcome === 'caughtBy' ? bump(caught, m.k, m.techId, 1) : bump(mine, m.k, m.techId, m.outcome === 'landed' ? 2 : 1))
  })
  S.seq.forEach(s => s.nodes.filter(n => !n.parentId && n.who === 'me').forEach(n => bump(mine, at(s.position, s.role), n.techId, 1)))
  return { starts: Object.keys(starts).sort((a, b) => starts[b] - starts[a]).slice(0, 3), mine, caught }
}

// Your last logged roll as a start: its position, and a partner as tough as their belt and size were for you.
export function lastRoll() {
  const r = S.roll.filter(r => r.position).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
  const k = r && key(r.position, r.position === 'Standing' ? 'Neutral' : r.role)
  if (!r || !MENU[k]) return null
  const belt = BELTS.indexOf(r.level), mineBelt = BELTS.indexOf(currentRank().belt)
  const edge = Math.sign((r.level !== 'Unknown' && belt >= 0 ? belt - mineBelt : 0) + ({ Heavier: 1, Lighter: -1 }[r.size] || 0))
  return { start: k, partner: ['easy', 'even', 'tough'][edge + 1], roll: r }
}

// start: a STARTS key or a 'Position|Role' key. personal: your logged moves join the menus.
// rehearse: your partner favors the moves that have caught you.
export function newRoll(start, partner, { personal = false, rehearse = false, my = null } = {}) {
  const s = MENU[start] ? { pos: start.split('|')[0], role: start.split('|')[1] } : STARTS[start] || STARTS[pick(Object.keys(STARTS))]
  const state = { pos: s.pos, role: s.role, me: 0, them: 0, advMe: 0, advThem: 0, turn: 1, partner: PARTNERS[partner] ? partner : 'even',
    momentum: false, pending: null, threat: null, setups: [], log: [], used: [], over: null,
    personal, rehearse, my: personal || rehearse ? my || myGame() : null }
  state.options = optionsFor(state)
  return state
}

function optionsFor(state) {
  const menu = shuffle(menuFor(state)), out = []
  const add = (id, extra) => { if (id && !out.some(o => o.id === id)) out.push({ id, ...extra }) }
  state.threat?.defenses.slice(0, 2).forEach(id => add(id, { defend: true }))
  state.pending?.answers.slice(0, 2).forEach(id => add(id, { answer: true }))
  const fresh = test => menu.find(m => test(m) && !out.some(o => o.id === m.id))?.id
  // One of your own moves from here always gets a slot, favoring the ones you use and land most.
  const logged = state.personal && state.my.mine[key(state.pos, state.role)] || {}
  const yours = menu.filter(m => logged[m.id] && !out.some(o => o.id === m.id))
  if (yours.length) add(weighted(yours, m => logged[m.id]).id)
  add(fresh(m => masteryOf(techById(m.id)).level >= 1))
  add(fresh(isAttack))
  add(fresh(m => !isAttack(m)))
  menu.forEach(m => out.length < 4 && add(m.id))
  // Sometimes a move that belongs to the other person sneaks in. Spot it, or pay for it.
  if (state.pos !== 'Leg entanglement' && Math.random() < 0.3) add(pick(decoysFor(state)), { decoy: true })
  out.forEach(o => { if (logged[o.id] && !o.decoy) o.mine = true })
  return [...out.filter(o => o.defend), ...shuffle(out.filter(o => !o.defend))]
}
const weighted = (list, w) => { let r = Math.random() * list.reduce((n, x) => n + w(x), 0); return list.find(x => (r -= w(x)) < 0) || list[0] }

function chance(m, t, state, option) {
  const finish = isFinish(m)
  let p = finish ? (['Back', 'Mount', 'Front headlock'].includes(state.pos) && state.role === 'Top' ? 0.32 : 0.22)
    : m.pts ? { 2: 0.45, 3: 0.4, 4: 0.36 }[m.pts]
    : m.to ? (t.type === 'Escape' ? 0.42 : 0.5) : 0.75
  if (state.momentum && (finish || m.to)) p += 0.15
  if (option.answer) p += 0.2
  p += masteryOf(t).level * 0.07 + PARTNERS[state.partner].you
  return Math.max(0.05, Math.min(0.9, p))
}

function blockText(m, t) {
  if (isFinish(m)) return BLOCKS.find(([re]) => re.test(t.name))[1]
  if (m.to?.pos === 'Back') return 'they turn in to face you'
  if (m.to?.pos === 'Mount') return 'they block your knee and hold you in place'
  return { Takedown: 'they sprawl and square back up', Sweep: 'they post and keep their base', Pass: 'they frame and pummel a leg back in', Escape: 'they stay heavy and shut it down' }[t.type] || 'they fight it off'
}

// Someone lands a move: points count once the position is stabilized, otherwise it's an advantage.
function land(state, mine, m, t, say) {
  const p = PARTNERS[state.partner], from = state.pos, name = t.name.toLowerCase()
  const go = ({ pos, role }) => { state.pos = pos; state.role = mine ? role : flip(role); state.setups = []; state.pending = null }
  if (!m.pts) {
    go(m.to)
    say(mine ? `${t.name} works. ${describe(state)}.` : `They answer with the ${name}. ${describe(state)}.`)
    return true
  }
  if (Math.random() >= (mine ? p.scramble : 1 - p.hold)) {
    go(m.to)
    if (mine) state.me += m.pts; else state.them += m.pts
    say(mine ? `${t.name} works and you stabilize: +${m.pts}. ${describe(state)}.` : `They hit the ${name} and settle it: +${m.pts} for them. ${describe(state)}.`)
    return true
  }
  go(slipTo(from, m.to))
  if (mine) state.advMe++; else state.advThem++
  say(mine ? `${t.name} nearly works, but they scramble before you stabilize. Advantage to you. ${describe(state)}.`
    : `They nearly hit the ${name}, but you scramble before they stabilize. Advantage to them. ${describe(state)}.`)
}

// What your partner does after your move fails.
// Rehearsing your problem spots, they go for what has caught you from here more often.
function partnerMove(state, say, extra = 0) {
  const caught = state.rehearse && state.my.caught[key(state.pos, state.role)] || {}
  const menu = menuFor({ ...state, role: flip(state.role) }, caught), attacks = menu.filter(m => m.to || isFinish(m))
  const problems = menu.filter(m => caught[m.id])
  if (Math.random() >= PARTNERS[state.partner].counter + extra + (problems.length ? 0.1 : 0)) return say('They hold their position.')
  const m = problems.length && Math.random() < 0.6 ? weighted(problems, x => caught[x.id]) : pick(attacks.length && Math.random() < 0.8 ? attacks : menu), t = techById(m.id)
  state.setups.push(m.id)
  if (isFinish(m)) {
    state.threat = { id: m.id, defenses: defensesFor(t, state) }
    return say(`They go for the ${t.name.toLowerCase()}!`)
  }
  if (m.to) { land(state, false, m, t, say); return }
  say(`They work their ${t.name.toLowerCase()}.`)
}

const tap = (state, t) => { state.over = { result: 'loss', how: `Submitted: ${t.name}` } }

export function play(state, index) {
  const option = state.options[index], t = option && techById(option.id)
  if (!t || state.over) return state
  // Each turn records where it started and how it went, for finding the chains worth saving.
  const p = PARTNERS[state.partner], entry = { turn: state.turn, move: t.name, id: t.id, from: { pos: state.pos, role: state.role }, worked: false, text: '' }
  const say = text => { entry.text += (entry.text ? ' ' : '') + text }
  state.used.push(t.id)
  const finishLater = () => end(state, entry)

  // Their submission comes first: defend it, or take your chances.
  if (state.threat) {
    const threat = techById(state.threat.id), name = threat.name.toLowerCase()
    state.threat = null
    entry.pressured = true
    if (option.defend) {
      if (Math.random() < 0.6 + masteryOf(t).level * 0.07 + p.you) {
        entry.worked = true
        say(`${t.name}: you shut down the ${name}.`)
      } else if (Math.random() < p.finish) {
        say(`${t.name} comes too late. They finish the ${name}. You tap.`)
        tap(state, threat)
      } else {
        state.advThem++
        say(`${t.name} only half works. You survive the ${name}, barely. Advantage to them.`)
      }
      return finishLater()
    }
    if (Math.random() < p.finish + 0.15) {
      say(`You ignore the ${name} and they finish it. You tap.`)
      tap(state, threat)
      return finishLater()
    }
    state.advThem++
    say(`You rip free of the ${name}. Advantage to them.`)
  }

  if (option.decoy) {
    entry.decoy = true
    state.momentum = false
    state.pending = null
    say(decoyText(t))
    partnerMove(state, say, 0.3)
    return finishLater()
  }

  const m = menuFor(state).find(x => x.id === t.id) || { id: t.id, to: null, pts: 0 }
  state.setups.push(t.id)
  const reactions = option.answer ? [] : mappedReactions(t.id, state)
  if (reactions.length && Math.random() < 0.45) {
    const r = pick(reactions)
    state.pending = r
    entry.reaction = r.label
    say(`You go for the ${t.name.toLowerCase()}. They react: ${r.label.toLowerCase()}. ${r.mine ? 'Your sequence' : 'The map'} has an answer.`)
    return finishLater()
  }
  state.pending = null
  const odds = chance(m, t, state, option), roll = Math.random()
  if (roll < odds) {
    entry.worked = true
    if (isFinish(m)) {
      state.over = { result: 'win', how: `Submission: ${t.name}` }
      entry.gain = entry.finish = true
      say(`${t.name}. They tap.`)
    } else if (m.to) {
      state.momentum = false
      if (land(state, true, m, t, say)) Object.assign(entry, { gain: true, pts: m.pts })
      else entry.slipped = true
    } else {
      state.momentum = true
      say(`${t.name}: you tighten your control, and your next attack is more likely to land.`)
    }
  } else {
    state.momentum = false
    say(`${t.name} doesn’t land: ${blockText(m, t)}.`)
    if (isAttack(m) && roll < odds + 0.1) {
      state.advMe++
      say('It was close: advantage to you.')
    } else partnerMove(state, say, isFinish(m) ? 0.1 : 0)
  }
  return finishLater()
}

function end(state, entry) {
  state.log.unshift(entry)
  state.turn++
  if (!state.over && state.turn > TURNS) {
    const diff = state.me - state.them || state.advMe - state.advThem
    state.over = { result: diff > 0 ? 'win' : diff < 0 ? 'loss' : 'draw',
      how: `Time. ${state.me}–${state.them} on points${state.me === state.them ? `, ${state.advMe}–${state.advThem} on advantages` : ''}.` }
  }
  if (!state.over) state.options = optionsFor(state)
  else state.chains = strongChains(state)
  return state
}

// Strong chains: unbroken runs of your moves (with the reactions you read) that landed at least
// two gains (a new position, points or the tap) and scored or finished. A decoy, a scramble or
// their attack breaks a run.
export function strongChains(state) {
  const chains = []
  let run = []
  const close = () => {
    while (run.length && !run[run.length - 1].pts && !run[run.length - 1].finish) run.pop() // end on the score or the tap
    const pts = run.reduce((n, e) => n + (e.pts || 0), 0), finish = !!run[run.length - 1]?.finish
    if (run.filter(e => e.gain).length >= 2 && (pts || finish)) chains.push({
      from: run[0].from, finish, pts,
      steps: run.filter((e, i) => e.id !== run[i - 1]?.id || e.reaction).flatMap(e => [{ who: 'me', techId: e.id }, ...(e.reaction ? [{ who: 'them', label: e.reaction }] : [])]),
    })
    run = []
  }
  ;[...state.log].reverse().forEach(e => {
    if (!e.decoy && !e.pressured && !e.slipped && (e.worked || e.reaction)) run.push(e)
    else close()
  })
  close()
  return chains.sort((a, b) => b.finish - a.finish || b.pts - a.pts).slice(0, 3)
}
