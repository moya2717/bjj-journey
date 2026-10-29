// Live roll: choose a start and a partner, then play twelve turns.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { cap, esc, newId, plural, posRole, toast, today } from '../util.js'
import { masteryOf, masteryPips, sizeLabel, techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { PARTNERS, STARTS, TURNS, describe, lastRoll, myGame, newRoll, play } from '../sim.js'

export function view() {
  const g = UI.sim
  return `<div class="page-head"><div><h1>Live roll</h1><p class="lede">Roll against a simulated partner, one decision at a time. Moves you’ve mastered work more often, and moves from your sequences bring up the reactions you mapped.</p></div></div>
    <section class="panel sim">${!g ? setup() : g.over ? results(g) : turn(g)}</section>`
}

function setup() {
  const log = S.settings.simLog || [], wins = log.filter(r => r.result === 'win').length
  const choice = UI.simSetup ||= { start: 'standing', partner: 'even' }
  const my = myGame(), last = lastRoll(), logged = Object.keys(my.mine).length > 0
  const pick = (act, k, label, on) => `<button class="choice ${on ? 'on' : ''}" data-act="${act}" data-k="${esc(k)}" aria-pressed="${on}">${label}</button>`
  choice.personal ??= logged
  const toggle = (k, label) => pick('sim-toggle', k, label, !!choice[k])
  return `<h2>Start a roll</h2>
    ${my.starts.length ? `<p class="field-label" style="margin-top:12px">Where you usually start</p>
    <div class="choice-grid">${my.starts.map(k => pick('sim-start', k, posRole(...k.split('|')), choice.start === k)).join('')}
      ${last ? pick('sim-start', 'last', `Recreate my last roll: ${posRole(last.roll.position, last.roll.role)}${last.roll.level && last.roll.level !== 'Unknown' ? `, ${esc(last.roll.level.toLowerCase())} belt` : ''}${last.roll.size ? `, ${esc(sizeLabel(last.roll.size))}` : ''}`, choice.start === 'last') : ''}</div>` : ''}
    <p class="field-label" style="margin-top:12px">${my.starts.length ? 'Or pick a start' : 'Where it starts'}</p>
    <div class="choice-grid">${Object.entries(STARTS).map(([k, s]) => `<button class="choice ${choice.start === k ? 'on' : ''}" data-act="sim-start" data-k="${k}" aria-pressed="${choice.start === k}">${s.label}</button>`).join('')}
      <button class="choice ${choice.start === 'random' ? 'on' : ''}" data-act="sim-start" data-k="random" aria-pressed="${choice.start === 'random'}">Surprise me</button></div>
    <p class="field-label" style="margin-top:14px">Your partner</p>
    <div class="choice-grid">${Object.entries(PARTNERS).map(([k, p]) => `<button class="choice ${choice.partner === k ? 'on' : ''}" data-act="sim-partner" data-k="${k}" aria-pressed="${choice.partner === k}">${p.label}</button>`).join('')}</div>
    ${logged || Object.keys(my.caught).length ? `<p class="field-label" style="margin-top:14px">Your game</p>
    <div class="choice-grid">${logged ? toggle('personal', 'Use the moves I log') : ''}${Object.keys(my.caught).length ? toggle('rehearse', 'Rehearse my problem spots') : ''}</div>
    <p class="small muted" style="margin-top:6px">${logged ? 'Your logged moves get a slot each turn wherever they fit. ' : ''}${Object.keys(my.caught).length ? 'Rehearsing, your partner goes for what has caught you from each spot.' : ''}</p>` : ''}
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
        <span>${esc(t.name)}${o.answer ? ' <span class="tag good">Your answer</span>' : o.defend ? ' <span class="tag">Defend</span>' : o.mine ? ' <span class="tag">Your move</span>' : ''}</span>
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
    ${chains(g)}
    <h3 style="margin-top:14px">How it went</h3><ol class="sim-log">${[...g.log].reverse().map(e => `<li class="${e.worked ? 'worked' : ''}"><span class="small muted">Turn ${e.turn}</span> ${esc(e.text)}</li>`).join('')}</ol>
    <div class="row-actions" style="margin-top:14px"><button class="btn" data-act="sim-go">Roll again</button><button class="btn ghost" data-act="sim-quit">Change setup</button></div>`
}

// The chains that worked, offered as sequences to drill before your next session.
const stepName = s => s.who === 'me' ? techById(s.techId).name : `“${cap(s.label)}”`
export const homeFor = c => S.seq.find(s => s.position === c.from.pos && s.role === c.from.role && s.nodes.some(n => !n.parentId && n.techId === c.steps[0].techId))

function chains(g) {
  if (!g.chains?.length) return ''
  const saved = UI.simSaved ||= {}
  return `<h3 style="margin-top:14px">Chains worth saving</h3><p class="small muted">These moves worked back to back. Save them as a sequence and drill them before your next session.</p>
    <ul class="list">${g.chains.map((c, i) => {
      const home = homeFor(c)
      return `<li><p><strong>${posRole(c.from.pos, c.from.role)}:</strong> ${esc(c.steps.map(stepName).join(' → '))}${c.finish ? ' → tap' : ''}
        <span class="small muted">${c.finish ? 'Ends in a submission' : `+${c.pts}`}</span></p>
        <div class="row-actions">${saved[i] ? `<button class="btn sm ghost" data-act="open-seq" data-id="${esc(saved[i])}">Open in Sequences</button>`
          : home ? `<button class="btn sm" data-act="sim-save-chain" data-i="${i}" data-into="${esc(home.id)}">Add to ${esc(home.name)}</button>`
          : `<button class="btn sm" data-act="sim-save-chain" data-i="${i}">Save as sequence</button>`}</div></li>`
    }).join('')}</ul>`
}

// Saves a chain as a new sequence, or as a branch of one that already starts with its first move.
// The roll log's chain builder saves its chains through here too.
export function saveChain(c, intoId, note = `From live roll on ${today()}`) {
  const nodes = c.steps.map(s => ({ id: newId('n'), parentId: null, who: s.who, label: s.who === 'me' ? techById(s.techId).name : cap(s.label), techId: s.techId || '', note: '' }))
  const home = S.seq.find(s => s.id === intoId)
  let parentId = null, i = 0
  if (home) for (; i < nodes.length; i++) {
    const same = home.nodes.find(n => n.parentId === parentId && n.who === nodes[i].who && (nodes[i].techId ? n.techId === nodes[i].techId : n.label.toLowerCase() === nodes[i].label.toLowerCase()))
    if (!same) break
    parentId = same.id
  }
  const fresh = nodes.slice(i)
  fresh.forEach((n, k) => { n.parentId = k ? fresh[k - 1].id : parentId })
  if (fresh[0]) fresh[0].note = note
  if (home) {
    if (fresh.length) save({ ...home, nodes: [...home.nodes, ...fresh] })
    toast(fresh.length ? `Added to ${home.name}. Find it in Game → Sequences.` : `${home.name} already has this chain.`)
    return home.id
  }
  const moves = c.steps.filter(s => s.who === 'me').map(s => techById(s.techId).name.toLowerCase())
  const rec = { id: newId('seq'), kind: 'seq', name: `${c.from.pos}: ${moves[0]} to ${moves[moves.length - 1]}`, position: c.from.pos, role: c.from.role, notes: note, nodes }
  save(rec)
  toast('Saved. Find it in Game → Sequences.')
  return rec.id
}

export const actions = {
  'sim-save-chain': el => { (UI.simSaved ||= {})[el.dataset.i] = saveChain(UI.sim.chains[+el.dataset.i], el.dataset.into) },
  'sim-start': el => { UI.simSetup.start = el.dataset.k; if (el.dataset.k === 'last') UI.simSetup.partner = lastRoll()?.partner || UI.simSetup.partner },
  'sim-toggle': el => { UI.simSetup[el.dataset.k] = !UI.simSetup[el.dataset.k] },
  'sim-partner': el => { UI.simSetup.partner = el.dataset.k },
  'sim-go': () => {
    const c = UI.simSetup ||= { start: 'standing', partner: 'even' }
    UI.sim = newRoll(c.start === 'last' ? lastRoll()?.start : c.start, c.partner, { personal: !!c.personal, rehearse: !!c.rehearse })
    UI.simSaved = {}
    scrollTo(0, 0)
  },
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
