// The review deck: spaced repetition for the moves you're working on.
// Each move you've seen, starred or drilled is a card. Recall it, grade yourself, and the gap
// before you see it again grows when you know it and resets when you don't.

import { S } from './store.js'
import { isoDate, parseD, today } from './util.js'
import { allTechs, masteryOf } from './model.js'

const NEW_PER_DAY = 10

// Moves join the deck once they reach "seen it", and stay unless you take them out.
export const inDeck = t => t.type !== 'Movement' && (t.deck ?? masteryOf(t).level >= 1)

export const deck = () => allTechs().filter(inDeck)

export function dueCards() {
  const now = today()
  const cards = deck()
  const reviews = cards.filter(t => t.srs && t.srs.due <= now).sort((a, b) => a.srs.due.localeCompare(b.srs.due))
  const doneToday = S.settings.srsDay?.date === now ? S.settings.srsDay.newCount : 0
  const fresh = cards.filter(t => !t.srs).slice(0, Math.max(0, NEW_PER_DAY - doneToday))
  return [...reviews, ...fresh]
}

export const nextDue = () => deck().filter(t => t.srs).map(t => t.srs.due).sort()[0] || ''

const addDays = n => { const d = parseD(today()); d.setDate(d.getDate() + n); return isoDate(d) }

// A simplified SM-2 schedule: "again" comes back tomorrow; "good" multiplies the gap by ease.
export function schedule(srs = {}, grade) {
  let { interval = 0, ease = 2.5, reps = 0, lapses = 0 } = srs
  if (grade === 'again') { interval = 1; ease = Math.max(1.3, ease - 0.2); reps = 0; lapses++ }
  else if (grade === 'hard') { interval = Math.max(1, Math.round((interval || 1) * 1.2)); ease = Math.max(1.3, ease - 0.15); reps++ }
  else {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease)
    if (grade === 'easy') { interval = Math.round(interval * 1.3) + 1; ease += 0.15 }
    reps++
  }
  return { interval, ease: Math.round(ease * 100) / 100, reps, lapses, due: addDays(interval), last: today() }
}

export const intervalLabel = days => days <= 1 ? 'tomorrow' : days < 30 ? `${days} days` : days < 365 ? `${Math.round(days / 30)} mo` : `${Math.round(days / 365)} yr`

// A recall question that fits the kind of move.
export function cardPrompt(t) {
  return {
    Submission: 'How do you set it up, what finishes it, and how do people usually escape?',
    Pass: 'What grips and pressure make it work, and what do you do when they recover guard?',
    Sweep: 'What’s the setup grip, and which detail takes their balance?',
    Escape: 'What’s your first move, and where do you end up?',
    Takedown: 'What’s the setup, and what do you do when they sprawl or defend?',
    Retention: 'What do you do with your hips and frames, and what’s your next attack?',
  }[t.type] || 'What are the three details that make it work for you?'
}

// What follows the move in your sequences, to check the answer against.
export function followUps(t) {
  return S.seq.flatMap(seq => seq.nodes.filter(n => n.techId === t.id).flatMap(n =>
    seq.nodes.filter(c => c.parentId === n.id).map(c => ({ seq: seq.name, who: c.who, label: c.label }))))
}
