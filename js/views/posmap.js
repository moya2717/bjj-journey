// A position's page as a mental map: what to work on there (objectives you tick while drilling and rate
// over time), how it goes for you there from your own logs, the chains out of it, and videos.
// Each part after the objectives is a fold, so the page opens on about one screen.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { esc, fmtDate, pct, plural, rate, sum, today } from '../util.js'
import { techById, sparred } from '../model.js'
import { OBJECTIVES, rank } from '../objectives.js'
import { GAMES, roundSpots, sideName } from '../rounds.js'
import { TABLE, describe, flip, key } from '../sim.js'
import { kindFrom, movesFrom } from '../flow.js'
import { gamePlan } from '../gameplan.js'
import { skillTree } from '../skills.js'
import { badSpots } from '../analysis.js'
import { opponents } from '../rivals.js'
import { fold } from './hub.js'
import { chips, howHere, posChip } from './library.js'
import { videosSection } from './videos.js'

const sideOf = role => role === 'Bottom' ? 'Bottom' : 'Top'
const isHere = (pos, role) => x => x.position === pos && (pos === 'Standing' || (x.role || x.side) === role)
const countChip = (id, n) => `<button class="flow-chip" data-act="lib-open" data-move="${esc(id)}">${esc(techById(id).name)}${n ? ` <span class="muted">${n}×</span>` : ''}</button>`

// Ticks reset each day; ratings keep their history: settings.objRate[k#id] = [[date, 1–3], …].
const ticked = () => S.settings.objDone?.date === today() ? S.settings.objDone.ids : []
const ratings = (k, id) => S.settings.objRate?.[k + '#' + id] || []

export function posMap(k) {
  const [pos, role] = k.split('|'), o = OBJECTIVES[k], ids = movesFrom(k)
  const group = (label, i) => ids.some(id => kindFrom(id, k) === i) ? `<p class="flow-sub">${label}</p>${chips(ids.filter(id => kindFrom(id, k) === i), 99)}` : ''
  return `<p class="hint">${esc(describe({ pos, role }))}.</p>
    ${pos !== 'Standing' ? `<div class="flow-chips"><span class="flow-tag">Their side</span>${posChip(pos + '|' + flip(role))}</div>` : ''}
    ${o ? goalsCard(k, o) : '<p class="hint">No objectives written for this spot yet.</p>'}
    ${o ? fold('pm-how', '<b>Key details and mistakes</b>', `<ul class="small fix-list">${o.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
      <p class="flow-sub">Common mistakes</p><ul class="small fix-list pm-mistakes">${o.mistakes.map(([text, cause]) => `<li>${esc(text)}${cause ? ` <button class="tag fix-tag" data-act="fix" data-reason="${esc(cause)}" aria-label="How to fix: ${esc(cause)}">${esc(cause)} <span aria-hidden="true">›</span></button>` : ''}</li>`).join('')}</ul>`) : ''}
    ${o ? fold('pm-theirs', `<b>What they want</b><span class="small muted">shut it down</span>`, `<ul class="small fix-list">${o.theirs.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`) : ''}
    ${fold('pm-next', '<b>Where to go next</b><span class="small muted">best first</span>', nextPlaces(k))}
    ${you(k)}
    ${chains(k)}
    ${fold('pm-moves', `<b>Moves from here</b><span class="small muted">${plural(ids.length, 'move')}</span>`, `${ids.length ? group('Move on', 0) + group('Finish', 1) + group('Hold and set up', 2) : '<p class="hint">None mapped yet.</p>'}
      <p class="flow-sub"><b>How you get here</b></p>${howHere([k], 99) || '<p class="hint">Nothing mapped lands here.</p>'}`)}
    ${fold('pm-vid', '<b>Videos</b><span class="small muted">curated, bjj.tips and your notes</span>', videosSection({ pos, k, head: false }))}`
}

function goalsCard(k, o) {
  const done = ticked()
  const row = ([id, text], i) => {
    const r = ratings(k, id), now = r.at(-1)?.[1] || 0, was = r.length > 1 ? r[0] : null, on = done.includes(k + '#' + id)
    return `<li class="${on ? 'done' : ''}"><button class="pm-check" data-act="obj-tick" data-k="${esc(k)}" data-id="${id}" aria-pressed="${on}" aria-label="Worked on today: ${esc(text)}">${on ? '✓' : i + 1}</button>
      <span class="pm-text">${esc(text)}</span>
      <span class="pm-rate" role="group" aria-label="How well can you do this?">${[1, 2, 3].map(v => `<button data-act="obj-rate" data-k="${esc(k)}" data-id="${id}" data-v="${v}" aria-pressed="${v <= now}" aria-label="${v} of 3"></button>`).join('')}
        ${was && was[1] !== now ? `<span class="pm-trend ${now > was[1] ? 'up' : 'down'}" title="${was[1]} of 3 on ${fmtDate(was[0])}">${now > was[1] ? '↑' : '↓'}</span>` : ''}</span></li>`
  }
  return `<section class="flow-card pm-goals"><h2>Objectives${o.shared ? ` <span class="muted">· shared with ${esc(o.shared.toLowerCase())}</span>` : ''}</h2>
    <ol class="pm-list">${o.goals.map(row).join('')}</ol>
    <p class="small muted">Tick what you worked on today. Rate each: 1 not yet, 2 against light resistance, 3 against a resisting partner.</p>
    ${gameButton(k, o.game)}</section>`
}

// The objective as a positional round, one tap into the form with the game set.
function gameButton(k, game) {
  const [pos, role] = k.split('|'), side = sideOf(role), preset = GAMES[game]
  const [mine, theirs] = preset ? [preset.goals[side], preset.goals[side === 'Top' ? 'Bottom' : 'Top']] : game
  const at = preset ? preset.position : pos
  return `<button class="btn sm pm-game" data-act="new-round" data-game="${preset ? game : ''}" data-position="${esc(at)}" data-side="${side}" ${preset ? '' : `data-goal="${esc(mine)}" data-their="${esc(theirs)}"`}>Drill it: ${esc(mine.toLowerCase())} vs ${esc(theirs.toLowerCase())}</button>`
}

// Where the move table can take you from here, best place first, with the moves that get you there.
function nextPlaces(k) {
  const by = {}
  ;(TABLE[k] || []).filter(m => m.to).forEach(m => { const d = key(m.to.pos, m.to.role); if (d !== k) (by[d] ||= []).push(m.id) })
  const list = Object.entries(by).sort((a, b) => rank(a[0]) - rank(b[0]))
  return list.length ? list.map(([d, ids]) => `<div class="pm-next">${posChip(d)}${chips(ids, 4, k)}</div>`).join('')
    : '<p class="hint">Nothing in the move table moves you on from here: finish, or hold and set up.</p>'
}

// Your numbers here, only from what you logged. Rolls count by where they started.
function you(k) {
  const [pos, role] = k.split('|'), here = isHere(pos, role), node = gamePlan().nodes[k]
  const rolls = S.roll.filter(here), spots = roundSpots().filter(s => here({ position: s.position, side: s.side }))
  const tries = sum(spots, 'tries'), wins = sum(spots, 'wins'), r = rate(rolls)
  const landed = node.moves.filter(m => m.landed).sort((a, b) => b.landed - a.landed), caught = node.caught
  const bad = badSpots('').groups.find(g => here(g)), causes = bad ? Object.entries(bad.reasons).sort((a, b) => b[1] - a[1]).slice(0, 3) : []
  const tree = skillTree().byId, ids = movesFrom(k).filter(id => tree[id]), lit = ids.filter(id => tree[id].tier), dark = ids.filter(id => !tree[id].tier)
  const trouble = opponents().map(o => ({ o, n: o.entries.filter(x => here(x) && (x.isRound ? x.losses > x.wins : x.result === 'broke')).length })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3)
  const thin = rolls.length + tries < 3 && !landed.length && !caught.length
  const line = [rolls.length && `${pct(r)} in ${plural(rolls.length, 'roll')}`, tries && `${wins}/${tries} in rounds`, node.caughtN && `caught ${node.caughtN}×`].filter(Boolean).join(' · ')
  return fold('pm-you', `<b>You here</b><span class="small muted">${line || 'not enough logged yet'}</span>`, `
    ${thin ? '<p class="hint">Not enough logged here yet to call strengths or weaknesses. Log rolls that start here, or play the game above.</p>' : ''}
    ${rolls.length || tries ? `<div class="tech-stats">${rolls.length ? `<span>Rolls <b>${rolls.length}</b></span><span>Went your way <b>${pct(r)}</b></span>` : ''}${tries ? `<span>Rounds <b>${wins}/${tries}</b> <span class="muted">(${pct(wins / tries)})</span></span>` : ''}</div>` : ''}
    ${landed.length ? `<p class="flow-sub">Strengths: landed from here</p><div class="flow-chips">${landed.slice(0, 6).map(m => countChip(m.id, m.landed)).join('')}</div>` : ''}
    ${caught.length ? `<p class="flow-sub">Caught you from here</p><div class="flow-chips">${caught.slice(0, 6).map(m => countChip(m.id, m.caught)).join('')}</div>` : ''}
    ${causes.length ? `<p class="flow-sub">Why rolls broke down here</p><div class="tags">${causes.map(([c, n]) => `<button class="tag fix-tag" data-act="fix" data-reason="${esc(c)}">${esc(c)} ${n}× <span aria-hidden="true">›</span></button>`).join('')}</div>` : ''}
    ${trouble.length ? `<p class="flow-sub">Partners who give you trouble here</p><div class="flow-chips">${trouble.map(({ o, n }) => `<button class="flow-chip" data-act="goto" data-view="rolls" data-anchor="opp:${esc(o.key)}">${esc(o.name)} <span class="muted">${n}×</span></button>`).join('')}</div>` : ''}
    <p class="flow-sub">Skill tree: ${lit.length} of ${plural(ids.length, 'move')} from here explored</p>
    ${dark.length ? `<p class="small muted">Blind spots, not explored yet:</p>${chips(dark, 6)}` : '<p class="small muted">Every move from here is lit.</p>'}`)
}

// Chains out of here: your sequences that start here, chains you logged in rolls, and your usual moves.
function chains(k) {
  const [pos, role] = k.split('|'), here = isHere(pos, role)
  const seqs = S.seq.filter(s => here(s))
  const logged = {}
  sparred().forEach(r => {
    const c = r.chain || []
    if (c.length < 2 || c[0].who === 'them' || key(c[0].position, c[0].position === 'Standing' ? 'Neutral' : c[0].role) !== k) return
    const sig = c.map(m => m.who + m.techId).join('>'), x = logged[sig] ||= { steps: c, n: 0, last: '' }
    x.n++
    if ((r.date || '') > x.last) x.last = r.date || ''
  })
  const top = Object.values(logged).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 4)
  const usual = gamePlan().nodes[k].moves.filter(m => m.landed || m.tried || m.seq).slice(0, 6)
  const step = m => `<button class="flow-chip ${m.who === 'them' ? 'them' : ''}" data-act="lib-open" data-move="${esc(m.techId)}">${m.who === 'them' ? '<span class="muted">they:</span> ' : ''}${esc(techById(m.techId)?.name || '?')}</button>`
  const n = seqs.length + top.length
  return fold('pm-chains', `<b>Chains from here</b><span class="small muted">${n ? plural(n, 'chain') : 'none yet'}</span>`, `
    ${seqs.length ? `<p class="flow-sub">Your sequences</p><div class="flow-chips">${seqs.map(s => `<button class="flow-chip pos" data-act="open-seq" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>` : ''}
    ${top.length ? `<p class="flow-sub">From your rolls</p>${top.map(x => `<div class="flow-chips pm-chain">${x.steps.filter(m => techById(m.techId)).map(step).join('<span aria-hidden="true">→</span>')}<span class="small muted">${x.n > 1 ? x.n + '×' : fmtDate(x.last)}</span></div>`).join('')}` : ''}
    ${usual.length ? `<p class="flow-sub">Your usual moves from here</p>${chips(usual.map(m => m.id), 6)}` : ''}
    ${n || usual.length ? '' : '<p class="hint">No chains from here yet. Log a roll move by move, or map a sequence that starts here.</p>'}`)
}

export const actions = {
  // Opens a position page from anywhere; Back returns to the screen it came from.
  'pm-open': el => { UI.view = 'library'; UI.sub.library = [{ pos: el.dataset.k, from: el.dataset.from || '' }]; scrollTo(0, 0) },
  'obj-tick': el => {
    const id = el.dataset.k + '#' + el.dataset.id, ids = ticked()
    save({ ...S.settings, objDone: { date: today(), ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] } })
  },
  // One rating a day per objective; tapping today's rating again clears it.
  'obj-rate': el => {
    const id = el.dataset.k + '#' + el.dataset.id, v = +el.dataset.v, list = ratings(el.dataset.k, el.dataset.id).filter(([d]) => d !== today())
    const same = ratings(el.dataset.k, el.dataset.id).at(-1)?.join() === [today(), v].join()
    save({ ...S.settings, objRate: { ...S.settings.objRate, [id]: same ? list : [...list, [today(), v]] } })
  },
}
