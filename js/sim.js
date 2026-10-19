// Live roll: a turn-based roll against a simulated partner.
// Each turn you pick a move that fits your position. Success depends on the move, the position,
// your partner, and how well you know the move (its mastery level from your journal).
// Moves from your sequences and the game maps draw the reactions you mapped, and your mapped
// answer becomes an option next turn. Points follow IBJJF scoring; a submission ends it.

import { S } from './store.js'
import { GAME_MAPS } from './maps.js'
import { allTechs, masteryOf, techById } from './model.js'

export const TURNS = 12
const GUARDS = ['Closed guard', 'Half guard', 'Butterfly guard', 'De La Riva', 'Reverse De La Riva', 'X-guard', 'Spider / lasso', 'Lapel guards', 'Open guard']
const PINS = ['Side control', 'Mount', 'Back', 'Knee on belly', 'North-south', 'Turtle', 'Front headlock']

export const PARTNERS = {
  easy: { label: 'A newer, lighter partner', bonus: 0.06 },
  even: { label: 'A partner at your level', bonus: -0.06 },
  tough: { label: 'A heavier, higher belt', bonus: -0.15 },
}
export const STARTS = {
  standing: { label: 'On the feet', pos: 'Standing', role: 'Neutral' },
  guard: { label: 'Playing guard', pos: 'Closed guard', role: 'Bottom' },
  passing: { label: 'Passing guard', pos: 'Closed guard', role: 'Top' },
  bad: { label: 'Escaping side control', pos: 'Side control', role: 'Bottom' },
}

const BASE = { Takedown: 0.42, Sweep: 0.38, Pass: 0.38, Submission: 0.22, Escape: 0.38, Transition: 0.48, Control: 0.75, Retention: 0.6 }
const pick = list => list[Math.floor(Math.random() * list.length)]
const shuffle = list => [...list].sort(() => Math.random() - 0.5)

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

// Which kinds of moves make sense from here.
function typesFor({ pos, role }) {
  if (pos === 'Standing') return ['Takedown']
  if (pos === 'Leg entanglement') return role === 'Bottom' ? ['Submission', 'Control'] : ['Escape']
  if (GUARDS.includes(pos)) return role === 'Bottom' ? ['Sweep', 'Submission', 'Transition', 'Retention'] : ['Pass']
  if (PINS.includes(pos)) return role === 'Top' ? ['Submission', 'Transition', 'Control'] : ['Escape']
  return ['Escape']
}

function poolFor(state) {
  const types = typesFor(state), all = allTechs()
  const here = all.filter(t => t.position === state.pos && types.includes(t.type))
  if (state.pos === 'Standing') here.push(...['c:guard-pull', 'c:sit-down-guard-pull'].map(techById).filter(Boolean))
  // Passing works with the general open guard passes too.
  if (state.role === 'Top' && GUARDS.includes(state.pos) && state.pos !== 'Open guard') here.push(...all.filter(t => t.position === 'Open guard' && t.type === 'Pass'))
  return [...new Map(here.map(t => [t.id, t])).values()]
}

// Where a move takes you when it works, and the points it scores.
function destination(t, state) {
  const n = t.name.toLowerCase()
  if (t.type === 'Takedown') return n.includes('snap down') ? { pos: 'Front headlock', role: 'Top', pts: 0 } : { pos: 'Half guard', role: 'Top', pts: 2 }
  if (t.type === 'Sweep') return { pos: 'Half guard', role: 'Top', pts: 2 }
  if (t.type === 'Pass') return { pos: 'Side control', role: 'Top', pts: 3 }
  if (t.type === 'Escape') {
    if (n.includes('upa')) return { pos: 'Closed guard', role: 'Top', pts: 0 }
    if (/knees|single|sit-out|front headlock escape|heel hook|boot|knee line/.test(n)) return { pos: 'Standing', role: 'Neutral', pts: 0 }
    if (n.includes('back escape')) return { pos: 'Half guard', role: 'Top', pts: 0 }
    return { pos: 'Half guard', role: 'Bottom', pts: 0 }
  }
  if (t.type === 'Transition' || t.name === 'Snap down') {
    if (/guard pull|jumping closed guard/.test(n)) return { pos: 'Closed guard', role: 'Bottom', pts: 0 }
    if (/mount/.test(n)) return { pos: 'Mount', role: 'Top', pts: state.role === 'Top' ? 4 : 2 }
    if (/back|seatbelt|go-behind|spin behind|crab ride|matrix|berimbolo|kiss of the dragon|baby bolo|twister/.test(n)) return { pos: 'Back', role: 'Top', pts: 4 }
    if (n.includes('knee on belly')) return { pos: 'Knee on belly', role: 'Top', pts: 2 }
    if (n.includes('north-south')) return { pos: 'North-south', role: 'Top', pts: 0 }
    if (/single-leg x|ashi|imanari|reap/.test(n)) return { pos: 'Leg entanglement', role: 'Bottom', pts: 0 }
    if (/stand-up|wrestle up/.test(n)) return { pos: 'Standing', role: 'Neutral', pts: 0 }
    if (n.includes('truck')) return { pos: 'Turtle', role: 'Top', pts: 0 }
    if (n.includes('x-guard entry')) return { pos: 'X-guard', role: 'Bottom', pts: 0 }
    if (n.includes('leg drag')) return { pos: 'Side control', role: 'Top', pts: 3 }
  }
  return null
}

// Reactions you or the game maps have mapped for a move, with the answers to each.
function mappedReactions(techId) {
  const trees = [...S.seq, ...GAME_MAPS]
  return trees.flatMap(tree => tree.nodes.filter(n => n.who === 'me' && n.techId === techId).flatMap(n =>
    tree.nodes.filter(r => r.parentId === n.id && r.who === 'them').map(r => ({
      label: r.label, from: tree.name, mine: S.seq.includes(tree),
      answers: tree.nodes.filter(a => a.parentId === r.id && a.techId && techById(a.techId)).map(a => a.techId),
    })))).filter(r => r.answers.length)
}

export function newRoll(start, partner) {
  const s = STARTS[start] || STARTS[pick(Object.keys(STARTS))]
  const state = { pos: s.pos, role: s.role, me: 0, them: 0, turn: 1, partner, momentum: false, pending: null, log: [], used: [], over: null }
  state.options = optionsFor(state)
  return state
}

export function optionsFor(state) {
  const pool = poolFor(state)
  const known = shuffle(pool.filter(t => masteryOf(t).level >= 1)).slice(0, 1)
  const rest = shuffle(pool.filter(t => !known.includes(t))).slice(0, 3 - known.length)
  const options = [...known, ...rest].map(t => ({ id: t.id }))
  if (state.pending) state.pending.answers.slice(0, 2).forEach(id => { if (!options.some(o => o.id === id)) options.unshift({ id, answer: true }) })
  // Sometimes a move from somewhere else sneaks in, to test whether you know where moves belong.
  if (Math.random() < 0.3) {
    const types = typesFor(state)
    const decoy = pick(allTechs().filter(t => t.position !== state.pos && types.includes(t.type) && t.position !== 'Open guard'))
    if (decoy) options.splice(Math.floor(Math.random() * (options.length + 1)), 0, { id: decoy.id, decoy: true })
  }
  return shuffle(options).slice(0, 5)
}

function chance(t, state, option) {
  let p = BASE[t.type] ?? 0.4
  if (t.type === 'Submission' && ['Back', 'Mount', 'Front headlock'].includes(state.pos)) p = 0.32
  if (state.momentum && ['Submission', 'Sweep', 'Pass', 'Transition'].includes(t.type)) p += 0.15
  if (option.answer) p += 0.2
  p += masteryOf(t).level * 0.07 + PARTNERS[state.partner].bonus
  return Math.max(0.05, Math.min(0.9, p))
}

// What your partner does after your move fails.
function counter(state, extra = 0) {
  const r = Math.random() - extra
  const { pos, role } = state
  const go = (to, pts, text) => { Object.assign(state, to); state.them += pts; return text + (pts ? ` (+${pts} for them)` : '') }
  if (pos === 'Standing' && r < 0.45) return go({ pos: 'Open guard', role: 'Bottom' }, 2, 'They take you down.')
  if (GUARDS.includes(pos) && role === 'Bottom' && r < 0.45) return go({ pos: 'Side control', role: 'Bottom' }, 3, 'They pass your guard.')
  if (GUARDS.includes(pos) && role === 'Top' && r < 0.4) return go({ pos: 'Half guard', role: 'Bottom' }, 2, 'They sweep you.')
  if (PINS.includes(pos) && role === 'Top' && r < 0.4) return go({ pos: 'Half guard', role: 'Top' }, 0, 'They recover guard.')
  if (pos === 'Leg entanglement' && role === 'Bottom' && r < 0.35) return go({ pos: 'Standing', role: 'Neutral' }, 0, 'They free their leg and stand.')
  if (role === 'Bottom' || role === 'Top' && pos === 'Leg entanglement') {
    if (['Side control', 'Knee on belly', 'North-south'].includes(pos) && r < 0.35) return go({ pos: 'Mount', role: 'Bottom' }, 4, 'They climb to mount.')
    if ((pos === 'Mount' || pos === 'Turtle') && r < 0.3) return go({ pos: 'Back', role: 'Bottom' }, 4, 'They take your back.')
    if ((pos === 'Back' && r < 0.35) || (pos === 'Front headlock' && r < 0.25) || (pos === 'Leg entanglement' && r < 0.3) || (pos === 'Mount' && r < 0.45) || (pos === 'Side control' && r < 0.42)) {
      state.over = { result: 'loss', how: 'They submit you.' }
      return 'They lock in the finish. You tap.'
    }
  }
  return 'They hold their position.'
}

export function play(state, index) {
  const option = state.options[index], t = techById(option.id)
  if (!t || state.over) return state
  const entry = { turn: state.turn, move: t.name, id: t.id, worked: false, text: '' }
  state.used.push(t.id)

  if (option.decoy) {
    entry.text = `${t.name} works from ${t.position.toLowerCase()}, not from here. ${counter(state, 0.25)}`
    state.momentum = false
  } else {
    const reactions = mappedReactions(t.id)
    if (reactions.length && !option.answer && Math.random() < 0.45) {
      const r = pick(reactions)
      state.pending = r
      entry.text = `You go for the ${t.name.toLowerCase()}. They react: ${r.label.toLowerCase()}. ${r.mine ? 'Your sequence' : 'The map'} has an answer.`
    } else if (Math.random() < chance(t, state, option)) {
      entry.worked = true
      state.pending = null
      if (t.type === 'Submission') {
        state.over = { result: 'win', how: `Submission: ${t.name}` }
        entry.text = `${t.name}. They tap.`
      } else {
        const to = destination(t, state)
        if (to) {
          state.pos = to.pos; state.role = to.role; state.me += to.pts; state.momentum = false
          entry.text = `${t.name} works.${to.pts ? ` +${to.pts}.` : ''} ${describe(state)}.`
        } else {
          state.momentum = true
          entry.text = `${t.name} works. You’re in control and your next attack is more likely to land.`
        }
      }
    } else {
      state.pending = null
      state.momentum = false
      entry.text = `${t.name} doesn’t land. ${counter(state)}`
    }
  }
  state.log.unshift(entry)
  state.turn++
  if (!state.over && state.turn > TURNS) {
    const result = state.me > state.them ? 'win' : state.me < state.them ? 'loss' : 'draw'
    state.over = { result, how: `Time. ${state.me}–${state.them} on points.` }
  }
  if (!state.over) state.options = optionsFor(state)
  return state
}
