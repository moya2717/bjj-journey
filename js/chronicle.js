// The Story So Far: a chronicle of your character, written from the journal. One chapter per belt
// and stripe. Each picks a few key moments, scored by how much they mattered, and tells them with
// templates. Wording is chosen from the moment itself, so the story doesn't reshuffle on every visit.
// It only tells what's in the log: no moment is ever made up.
import { S, cached } from './store.js'
import { byDateAsc, fmtDate, fmtDateLong, isoDate, parseD, plural, sum, weekStart, hrs } from './util.js'
import { currentRank, landedIds, rankName, rollMoves, techById } from './model.js'
import { injuryName } from './body.js'
import { liveRollSeqs } from './loop.js'
import { distIn, distUnit, isRun } from './load.js'
import { RANKS } from './vocab.js'
import { fighterName, styleOf } from './game.js'

const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
const pick = (key, list) => list[hash(key) % list.length]
const low = s => String(s).toLowerCase()
const MAX_MOMENTS = 6

// A subtitle for each belt, by stripe.
const ARCS = {
  White: ['The Empty Cup', 'First Tape', 'Learning to Breathe', 'The Grind', 'Almost Blue'],
  Blue: ['Blue Waters', 'The Dangerous Blue', 'Finding a Game', 'Sharper Edges', 'Almost Purple'],
  Purple: ['The Purple Path', 'Webs and Chains', 'The Long Middle', 'A Game of One’s Own', 'Almost Brown'],
  Brown: ['The Brown Belt Years', 'Heavy Pressure', 'Teaching Hands', 'The Polish', 'Almost Black'],
  Black: ['The Beginning, Again', 'First Degree', 'Second Degree', 'Third Degree', 'Fourth Degree'],
}

// Your rank history cut into chapters. Before your first logged promotion is a prologue chapter.
function periods() {
  const promos = [...S.profile.promotions].sort(byDateAsc)
  const start = [S.profile.startDate, ...[...S.session, ...S.roll, ...S.activity].map(x => x.date)].filter(Boolean).sort()[0] || ''
  const out = []
  if (!promos.length) out.push({ rank: currentRank(), from: start, to: '' })
  else if (start && start < promos[0].date) out.push({ rank: promos[0].belt === 'White' && promos[0].stripes ? { belt: 'White', stripes: 0 } : null, from: start, to: promos[0].date })
  promos.forEach((p, i) => out.push({ rank: { belt: p.belt, stripes: +p.stripes || 0 }, from: p.date, to: promos[i + 1]?.date || '', promo: p }))
  return out
}

// ---------- Key moments ----------

// Each moment: { type, date, score, key, v }. Scores say what matters most; a chapter keeps its top few.
function moments() {
  const out = [], add = (type, date, score, v, key = type + date) => date && out.push({ type, date, score, v, key })
  const rolls = [...S.roll].sort(byDateAsc), sessions = [...S.session].sort(byDateAsc)

  if (sessions[0]) add('firstClass', sessions[0].date, 9, { kind: sessions[0].type })
  if (rolls[0]) add('firstRoll', rolls[0].date, 4, { partner: rolls[0].partner, result: rolls[0].result })
  const sub = rolls.find(r => landedIds(r).some(id => techById(id)?.type === 'Submission'))
  if (sub) add('firstSub', sub.date, 8, { move: techById(landedIds(sub).find(id => techById(id)?.type === 'Submission')).name, partner: sub.partner })

  // A move that caught you first and that you later landed yourself.
  const firstCaught = {}, firstLanded = {}
  rolls.forEach(r => rollMoves(r).forEach(m => {
    if (m.outcome === 'caughtBy') firstCaught[m.techId] ||= r.date
    if (m.outcome === 'landed') firstLanded[m.techId] ||= r.date
  }))
  Object.keys(firstLanded).filter(id => firstCaught[id] && firstCaught[id] < firstLanded[id] && techById(id)).forEach(id =>
    add('turnaround', firstLanded[id], 7, { move: techById(id).name, before: firstCaught[id] }, 'turn' + id))

  S.injury.forEach(i => {
    add('injury', i.startDate, 5 + Math.min(2, (i.severity || 1) - 1), { part: injuryName(i), severity: i.severity || 1 }, 'inj' + i.id)
    const back = i.endDate && sessions.find(s => s.date > i.endDate)
    if (back) add('comeback', back.date, 7, { part: injuryName(i), days: Math.round((parseD(back.date) - parseD(i.startDate)) / 864e5) }, 'back' + i.id)
  })

  S.profile.tournaments.forEach(t => add('tournament', t.date, ['Gold', 'Silver', 'Bronze'].includes(t.place) ? 9 : 8,
    { name: t.name, place: t.place, wins: +t.wins || 0, losses: +t.losses || 0, division: t.division }, 'comp' + (t.id || t.date)))

  const chain = liveRollSeqs().at(-1)
  if (chain) add('chain', chain.date, 5, { seq: chain.seq.name })

  // Run distance: the milestone crossed, on the day it was crossed.
  const unit = distUnit()
  let total = 0, next = 0
  const marks = unit === 'km' ? [10, 25, 50, 100, 250, 500, 1000] : [5, 15, 30, 60, 150, 300, 600]
  S.activity.filter(isRun).sort(byDateAsc).forEach(r => {
    total += distIn(r, unit)
    while (next < marks.length && total >= marks[next]) { add('run', r.date, 4 + Math.min(3, next), { n: marks[next], unit }, 'run' + marks[next]); next++ }
  })

  // Streaks of weeks at your session target, dated by the week they peaked.
  const target = S.settings.weeklyTarget || 3, perWeek = {}
  sessions.forEach(s => { const w = isoDate(weekStart(parseD(s.date))); perWeek[w] = (perWeek[w] || 0) + 1 })
  let streak = 0, prev = null
  Object.keys(perWeek).filter(w => perWeek[w] >= target).sort().forEach(w => {
    streak = prev && Math.round((parseD(w) - parseD(prev)) / 864e5) === 7 ? streak + 1 : 1
    prev = w
    if ([4, 8, 12, 26, 52].includes(streak)) add('streak', w, 5 + Math.min(3, Math.floor(streak / 8)), { n: streak }, 'streak' + w)
  })
  return out
}

// Moments that belong to one chapter's own window: a rival, a signature move, a change of style.
function chapterMoments(rolls, prevRolls) {
  const out = [], tough = {}
  rolls.filter(r => r.result !== 'worked' && (r.partner || '').trim()).forEach(r => (tough[r.partner.trim()] ||= []).push(r))
  const rival = Object.entries(tough).sort((a, b) => b[1].length - a[1].length)[0]
  if (rival && rival[1].length >= 2) out.push({ type: 'rival', date: rival[1].at(-1).date, score: 6, key: 'rival' + rival[0], v: { partner: rival[0], n: rival[1].length } })
  const landed = {}
  rolls.forEach(r => landedIds(r).forEach(id => landed[id] = (landed[id] || 0) + 1))
  const top = Object.entries(landed).sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 3 && techById(top[0])) out.push({ type: 'signature', date: rolls.filter(r => landedIds(r).includes(top[0])).at(-1).date, score: 5, key: 'sig' + top[0], v: { move: techById(top[0]).name, n: top[1] } })
  const now = styleOf(rolls), before = styleOf(prevRolls)
  const real = s => !['Fresh recruit', 'All-rounder'].includes(s.name)
  if (real(now) && real(before) && now.name !== before.name) out.push({ type: 'style', date: rolls.at(-1).date, score: 6, key: 'style' + now.name, v: { from: before.name, to: now.name } })
  return out
}

// ---------- The words ----------

// Dates from another year carry the year, so the story reads clearly across seasons.
const D = d => parseD(d).getFullYear() === new Date().getFullYear() ? fmtDate(d) : parseD(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const T = {
  firstClass: [
    (m, N) => `On ${D(m.date)}, ${N} tied on a belt and stepped onto the mat for the first time. Nobody knew it yet, but the story had started.`,
    (m, N) => `It began on ${D(m.date)}: one ${low(m.v.kind || 'BJJ')} class, a borrowed sense of balance, and a lot of being squished. ${N} came back anyway.`,
    (m, N) => `${D(m.date)}. First class in the log. The warm-up alone was a boss fight, and ${N} survived it.`,
  ],
  firstRoll: [
    (m, N) => `The first roll in the log came on ${D(m.date)}${m.v.partner ? ` against ${m.v.partner}` : ''}. ${m.v.result === 'worked' ? 'It even went to plan.' : m.v.result === 'partial' ? 'Half of it worked, which is half more than nothing.' : 'It fell apart, which is where the learning starts.'}`,
    (m, N) => `On ${D(m.date)}, ${N} wrote down a roll for the first time${m.v.partner ? `, with ${m.v.partner}` : ''}. The scroll of lessons had its first line.`,
  ],
  firstSub: [
    (m, N) => `On ${D(m.date)}, the first tap: a ${low(m.v.move)}${m.v.partner ? ` on ${m.v.partner}` : ''}. ${N} tried very hard to look calm about it.`,
    (m, N) => `${D(m.date)} brought the first submission. ${m.v.move}${m.v.partner ? `, and ${m.v.partner} tapped` : ', and they tapped'}. A new scroll went into the secret archive.`,
    (m, N) => `The ${low(m.v.move)} landed for real on ${D(m.date)}${m.v.partner ? ` against ${m.v.partner}` : ''}: the first finish in ${N}’s journal.`,
  ],
  turnaround: [
    (m, N) => `The ${low(m.v.move)} used to be a problem: it caught ${N} on ${D(m.v.before)}. On ${D(m.date)} the tables turned, and ${N} landed it.`,
    (m, N) => `Once the ${low(m.v.move)} was something that happened to ${N}. By ${D(m.date)} it was something ${N} did to other people.`,
    (m, N) => `Weakness to weapon: caught by the ${low(m.v.move)} on ${D(m.v.before)}, landing it on ${D(m.date)}.`,
  ],
  injury: [
    (m, N) => `On ${D(m.date)}, the ${low(m.v.part)} said “enough”. ${m.v.severity >= 3 ? 'Time off the mats.' : 'Training slowed down, but didn’t stop.'}`,
    (m, N) => `${D(m.date)}: a ${low(m.v.part)} injury. Even ninjas tape up sometimes.`,
    (m, N) => `The ${low(m.v.part)} gave out on ${D(m.date)}. ${N} learned the hardest technique of all: patience.`,
  ],
  comeback: [
    (m, N) => `${N} was back on the mat on ${D(m.date)}, ${plural(m.v.days, 'day')} after the ${low(m.v.part)} injury. The comeback is the best part of any story.`,
    (m, N) => `On ${D(m.date)} the ${low(m.v.part)} was healed enough, and ${N} bowed back onto the mat.`,
    (m, N) => `${plural(m.v.days, 'day')} later, on ${D(m.date)}, the return. A little wiser about the ${low(m.v.part)}.`,
  ],
  tournament: [
    (m, N) => `${m.v.name}, ${D(m.date)}: ${m.v.wins}–${m.v.losses}${['Gold', 'Silver', 'Bronze'].includes(m.v.place) ? `, and ${low(m.v.place)} around the neck` : ''}. ${N} stepped into the bright lights and found out what the training was for.`,
    (m, N) => `On ${D(m.date)}, ${N} entered ${m.v.name}${m.v.division ? ` (${m.v.division})` : ''}. ${m.v.wins ? `${plural(m.v.wins, 'win')}` : 'No wins this time'}${m.v.losses ? `, ${plural(m.v.losses, 'loss', 'losses')}` : ''}${['Gold', 'Silver', 'Bronze'].includes(m.v.place) ? `, ${low(m.v.place)} medal` : ''}.`,
    (m, N) => `Competition day: ${m.v.name}, ${D(m.date)}. The record says ${m.v.wins}–${m.v.losses}${['Gold', 'Silver', 'Bronze'].includes(m.v.place) ? ` and ${low(m.v.place)}` : ''}. The nerves said a lot more.`,
  ],
  chain: [
    (m, N) => `On ${D(m.date)}, a chain from a Live roll got saved as “${m.v.seq}”. The training montage finally had choreography.`,
    (m, N) => `${N} studied the shadow rounds and on ${D(m.date)} wrote one down: “${m.v.seq}”.`,
  ],
  run: [
    (m, N) => `By ${D(m.date)}, ${N} had run ${m.v.n} ${m.v.unit} in all. Gas tank: upgraded.`,
    (m, N) => `${m.v.n} ${m.v.unit} of road behind ${N} by ${D(m.date)}. The lungs remember every one.`,
    (m, N) => `On ${D(m.date)} the running log passed ${m.v.n} ${m.v.unit}. Round six started to feel like round two.`,
  ],
  streak: [
    (m, N) => `${m.v.n} weeks in a row at the weekly target. The kind of consistency the old scrolls write about.`,
    (m, N) => `${N} didn’t miss: ${m.v.n} straight weeks on target by the week of ${D(m.date)}.`,
  ],
  rival: [
    (m, N) => `${m.v.partner} became the rival of this chapter: ${plural(m.v.n, 'round')} with them went sideways. Every dojo needs a final boss.`,
    (m, N) => `There was always ${m.v.partner}. ${plural(m.v.n, 'roll')} against them broke down, and ${N} kept coming back for more.`,
    (m, N) => `${m.v.partner} won the exchanges ${plural(m.v.n, 'time')}. Rivals are just teachers who don’t go easy.`,
  ],
  signature: [
    (m, N) => `The ${low(m.v.move)} turned into a signature move, landing ${plural(m.v.n, 'time')}.`,
    (m, N) => `If ${N} had a calling card, it was the ${low(m.v.move)}: ${plural(m.v.n, 'time')} landed.`,
    (m, N) => `Partners started to see the ${low(m.v.move)} coming. It landed ${plural(m.v.n, 'time')} anyway.`,
  ],
  style: [
    (m, N) => `Somewhere in here the style shifted, from ${low(m.v.from)} to ${low(m.v.to)}.`,
    (m, N) => `The game changed shape: less ${low(m.v.from)}, more ${low(m.v.to)}.`,
  ],
}

const nextUp = r => r.belt === 'Black' ? 'The journey has no end, only deeper chapters…'
  : r.stripes < 4 ? `The ${['first', 'second', 'third', 'fourth'][r.stripes]} stripe awaits…` : `The ${low(RANKS[RANKS.indexOf(r.belt) + 1])} belt waits somewhere up ahead…`

function promoLine(p, N) {
  return pick('promo' + p.date, [
    `On ${D(p.date)}, coach called ${N} up: ${low(rankName(p))}. Chapter closed.`,
    `Then came ${D(p.date)}, a roll of tape and a handshake: ${low(rankName(p))}.`,
    `${D(p.date)}: ${low(rankName(p))}. The next page turns.`,
  ])
}

// ---------- The chapters ----------

export const chronicle = () => cached('chronicle', () => {
  const N = fighterName(), all = moments(), list = periods()
  return list.map((p, i) => {
    const inside = x => (!p.from || x.date >= p.from) && (!p.to || x.date < p.to)
    const rolls = S.roll.filter(inside).sort(byDateAsc), prevRolls = i ? S.roll.filter(r => r.date < p.from) : []
    const sessions = S.session.filter(inside)
    const picked = [...all.filter(inside), ...chapterMoments(rolls, prevRolls)]
      .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, MAX_MOMENTS).sort((a, b) => a.date.localeCompare(b.date))
    const r = p.rank, current = !p.to, next = list[i + 1]?.promo
    return {
      n: i + 1, key: p.from + (r ? r.belt + r.stripes : ''), current, from: p.from, to: p.to,
      title: r ? `${rankName(r)}: ${ARCS[r.belt]?.[Math.min(4, r.stripes)] || 'The Road'}` : 'The Early Days',
      moments: picked.map(m => pick(m.key, T[m.type])(m, N)),
      summary: sessions.length ? `${plural(sessions.length, 'session')}, ${hrs(sum(sessions, 'minutes'))} mat hours${rolls.length ? `, ${plural(rolls.length, 'roll')} written down` : ''}.` : '',
      ending: current ? nextUp(r || currentRank()) : next ? promoLine(next, N) : '',
      quiet: !picked.length,
    }
  })
})

export const chapterText = c => [c.title, ...c.moments, c.summary, c.ending].filter(Boolean).join('\n\n')
export const sinceLabel = c => c.from ? `${fmtDateLong(c.from)}${c.to ? ` to ${fmtDateLong(c.to)}` : ' to now'}` : ''
