// Live roll: choose a start and a partner, then play twelve turns.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { esc, plural, toast, today } from '../util.js'
import { masteryOf, masteryPips, techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { PARTNERS, STARTS, TURNS, describe, newRoll, play } from '../sim.js'

export function view() {
  const g = UI.sim
  return `<div class="page-head"><div><h1>Live roll</h1><p class="lede">Roll against a simulated partner, one decision at a time. Moves you’ve mastered work more often, and moves from your sequences bring up the reactions you mapped.</p></div></div>
    <section class="panel sim">${!g ? setup() : g.over ? results(g) : turn(g)}</section>`
}

function setup() {
  const log = S.settings.simLog || [], wins = log.filter(r => r.result === 'win').length
  const choice = UI.simSetup ||= { start: 'standing', partner: 'even' }
  return `<h2>Start a roll</h2>
    <p class="field-label" style="margin-top:12px">Where it starts</p>
    <div class="choice-grid">${Object.entries(STARTS).map(([k, s]) => `<button class="choice ${choice.start === k ? 'on' : ''}" data-act="sim-start" data-k="${k}" aria-pressed="${choice.start === k}">${s.label}</button>`).join('')}
      <button class="choice ${choice.start === 'random' ? 'on' : ''}" data-act="sim-start" data-k="random" aria-pressed="${choice.start === 'random'}">Surprise me</button></div>
    <p class="field-label" style="margin-top:14px">Your partner</p>
    <div class="choice-grid">${Object.entries(PARTNERS).map(([k, p]) => `<button class="choice ${choice.partner === k ? 'on' : ''}" data-act="sim-partner" data-k="${k}" aria-pressed="${choice.partner === k}">${p.label}</button>`).join('')}</div>
    <div class="row-actions" style="margin-top:16px"><button class="btn" data-act="sim-go">Slap hands and roll</button></div>
    <ul class="small muted fix-list" style="margin-top:14px">
      <li>${TURNS} turns. Points follow IBJJF scoring and count once you stabilize; near misses earn advantages. A submission ends it.</li>
      <li>When they attack a submission, defend it or risk the tap.</li>
      <li>Some options are moves for the other person, like a sweep when you’re on top. Spot them, or pay for it.</li>
      <li>Raise a move’s mastery in your journal and it lands more often here.</li>
    </ul>
    ${log.length ? `<p class="small muted">${plural(log.length, 'roll')} played · ${wins} won · ${log.filter(r => r.how?.startsWith('Submission')).length} by submission</p>` : ''}`
}

const adv = n => `<span class="lbl">${n || 0} adv</span>`

function turn(g) {
  return `<div class="scoreboard" role="status">
      <div><span class="lbl">You</span><span class="big">${g.me}</span>${adv(g.advMe)}</div>
      <div class="clock"><span class="lbl">Turn</span><span>${g.turn} / ${TURNS}</span></div>
      <div><span class="lbl">Them</span><span class="big">${g.them}</span>${adv(g.advThem)}</div>
    </div>
    <p class="sim-where"><span class="tag pos">${esc(g.pos)}</span> ${esc(describe(g))}.${g.momentum ? ' <span class="tag good">Momentum</span>' : ''}</p>
    ${g.threat ? `<p class="sim-react">They’re attacking with the ${esc(techById(g.threat.id).name.toLowerCase())}. Defend it or risk the tap.</p>` : ''}
    ${g.pending ? `<p class="sim-react">They react: ${esc(g.pending.label.toLowerCase())}.</p>` : ''}
    <p class="field-label" style="margin:10px 0 6px">What do you do?</p>
    <div class="quiz-options">${g.options.map((o, i) => {
      const t = techById(o.id), m = masteryOf(t).level
      return `<button class="quiz-opt" data-act="sim-move" data-i="${i}">
        <span>${esc(t.name)}${o.answer ? ' <span class="tag good">Your answer</span>' : o.defend ? ' <span class="tag">Defend</span>' : ''}</span>
        <span class="small muted">${esc(t.type)} ${m ? masteryPips(m) : ''}</span></button>`
    }).join('')}</div>
    ${g.log.length ? `<ol class="sim-log">${g.log.slice(0, 4).map(e => `<li class="${e.worked ? 'worked' : ''}"><span class="small muted">Turn ${e.turn}</span> ${esc(e.text)}</li>`).join('')}</ol>` : ''}
    <div class="row-actions"><button class="btn sm ghost" data-act="sim-quit">Stop</button></div>`
}

function results(g) {
  const label = { win: 'You win', loss: 'You lose', draw: 'Draw' }[g.over.result]
  const failed = [...new Set(g.log.filter(e => !e.worked).map(e => e.id))].map(techById).filter(Boolean)
  const worked = [...new Set(g.log.filter(e => e.worked).map(e => e.id))].map(techById).filter(Boolean)
  return `<div class="scoreboard final ${g.over.result}"><div><span class="lbl">You</span><span class="big">${g.me}</span>${adv(g.advMe)}</div>
      <div class="clock"><span class="verdict ${g.over.result === 'win' ? 'up' : g.over.result === 'loss' ? 'down' : 'flat'}">${label}</span><span class="small">${esc(g.over.how)}</span></div>
      <div><span class="lbl">Them</span><span class="big">${g.them}</span>${adv(g.advThem)}</div></div>
    ${worked.length ? `<h3 style="margin-top:14px">What worked</h3><div class="tags">${worked.map(t => `<span class="tag good">${esc(t.name)}</span>`).join('')}</div>` : ''}
    ${failed.length ? `<h3 style="margin-top:14px">Worth studying</h3><ul class="list">${failed.map(t => `<li><p>${esc(t.name)} <span class="small muted">${esc(t.position)} · ${esc(t.type)}</span></p>
      <div class="row-actions"><a class="btn sm ghost" href="${esc(t.link || videoSearch(t.name))}" target="_blank" rel="noopener noreferrer">Find videos</a><button class="btn sm ghost" data-act="edit-tech" data-id="${esc(t.id)}">My notes</button></div></li>`).join('')}</ul>` : ''}
    <h3 style="margin-top:14px">How it went</h3><ol class="sim-log">${[...g.log].reverse().map(e => `<li class="${e.worked ? 'worked' : ''}"><span class="small muted">Turn ${e.turn}</span> ${esc(e.text)}</li>`).join('')}</ol>
    <div class="row-actions" style="margin-top:14px"><button class="btn" data-act="sim-go">Roll again</button><button class="btn ghost" data-act="sim-quit">Change setup</button></div>`
}

export const actions = {
  'sim-start': el => { UI.simSetup.start = el.dataset.k },
  'sim-partner': el => { UI.simSetup.partner = el.dataset.k },
  'sim-go': () => { const c = UI.simSetup ||= { start: 'standing', partner: 'even' }; UI.sim = newRoll(c.start, c.partner); scrollTo(0, 0) },
  'sim-quit': () => { UI.sim = null },
  'sim-move': el => {
    const g = play(UI.sim, +el.dataset.i)
    if (g.over) {
      const log = [...(S.settings.simLog || []), { date: today(), result: g.over.result, how: g.over.how, me: g.me, them: g.them }].slice(-500)
      save({ ...S.settings, simLog: log })
      if (g.over.result === 'win') toast(g.over.how.startsWith('Submission') ? 'Tap! You win.' : 'You win on points.')
    }
  },
}
