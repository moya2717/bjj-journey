// Positional rounds on screen: the form (a game, your side and a tap counter), the cards on the
// journal, and the list on Rolls. The same fields sit in the session form, one block per game.
// Simple mode shows the quick counter only; partner, moves and a note are for Detailed.
import { S, save, remove } from '../store.js'
import { BELTS, POSITIONS, SIZES } from '../vocab.js'
import { $, $$, byDateDesc, cap, esc, fmtDateLong, newId, pct, plural, toast, today } from '../util.js'
import { field, selectEl, openSheet } from '../sheet.js'
import { chainBuilder, readChain, rollFlow, setChainStart } from '../picker.js'
import { describeBox } from '../describe.js'
import { logMode, partnerProfile } from '../model.js'
import { GAMES, SIDES, gameName, roleOf, sideName } from '../rounds.js'
import { partnerDatalist } from './rolls.js'
import { more } from './hub.js'

const COUNTS = [['tries', 'Goes'], ['wins', 'You scored'], ['losses', 'They scored']]
const other = side => side === 'Top' ? 'Bottom' : 'Top'
const radio = (name, value, label, on, extra = '') => `<label class="chip" ${extra}><input type="radio" name="${name}" value="${esc(value)}" ${on ? 'checked' : ''}><span>${esc(label)}</span></label>`

// A new game starts as your last one did, or as a suggestion asked for (Today's focus).
export function newRound(preset = {}) {
  const last = [...S.round].sort(byDateDesc)[0]
  const game = preset.game ?? last?.game ?? 'half', position = GAMES[game]?.position || preset.position || last?.position || 'Half guard'
  return { game, position, side: preset.side || last?.side || 'Top', tries: 0, wins: 0, losses: 0, partner: '', level: 'Unknown', size: '', goal: '', theirGoal: '', note: '' }
}

const sideChips = (p, game, position, side) => SIDES.map(s => radio(p + 'side', s, cap(sideName(position, s)) + (GAMES[game] ? ': ' + GAMES[game].goals[s].toLowerCase() : ''), s === side)).join('')
const countLine = g => g.tries ? `You scored on ${g.wins} of ${plural(g.tries, 'go', 'goes')} (${pct(g.wins / g.tries)})${g.losses ? `, they scored on ${g.losses}` : ''}.` : 'Tap + after each go. A go where nobody scored counts on “Goes” only.'

// p names the fields in a form with several games ("g0_").
export function roundFields(p, g) {
  const custom = !GAMES[g.game]
  return `<div class="round-box" data-round="${esc(p)}">
    <fieldset><legend>The game</legend><div class="chips">${Object.entries(GAMES).map(([k, x]) => radio(p + 'game', k, x.name, g.game === k)).join('')}${radio(p + 'game', 'custom', 'Your own game', custom, 'data-detail-only')}</div></fieldset>
    <div class="grid3" data-custom ${custom ? '' : 'hidden'}>
      ${field('Starts from', selectEl(p + 'position', POSITIONS, g.position, 'data-pos'))}
      ${field('Your goal', `<input type="text" name="${p}goal" value="${esc(custom ? g.goal : '')}" placeholder="Take the back">`)}
      ${field('Their goal', `<input type="text" name="${p}theirGoal" value="${esc(custom ? g.theirGoal : '')}" placeholder="Get to their knees">`)}
    </div>
    <fieldset><legend>Your side</legend><div class="chips" data-sides>${sideChips(p, g.game, g.position, g.side)}</div></fieldset>
    <div class="counter" role="group" aria-label="Score">${COUNTS.map(([k, label]) => `<div class="count-row ${k}"><span>${label}</span>
      <button type="button" class="count-btn" data-count="${k}" data-d="-1" aria-label="${label}: one less">−</button>
      <output data-n="${k}">${+g[k] || 0}</output><input type="hidden" name="${p}${k}" value="${+g[k] || 0}">
      <button type="button" class="count-btn plus" data-count="${k}" data-d="1" aria-label="${label}: one more">+</button></div>`).join('')}</div>
    <p class="small muted" data-count-line aria-live="polite">${countLine(g)}</p>
    <div class="round-more" data-detail-only>
      <div class="grid3">
        ${field('Partner (optional)', `<input type="text" name="${p}partner" list="partner-list" autocomplete="off" value="${esc(g.partner)}" data-partner>`)}
        ${field('Their belt', selectEl(p + 'level', BELTS, g.level || 'Unknown'))}
        ${field('Their size', selectEl(p + 'size', [{ value: '', label: 'Not noted' }, ...SIZES], g.size || ''))}
      </div>
      <fieldset><legend>Moves you used <span class="hint">Optional. A move you land in a game you scored in counts as hit in sparring</span></legend>
        ${describeBox(p)}${chainBuilder(p, { ...g, role: roleOf(g.position, g.side) })}</fieldset>
      ${field('Note', `<textarea name="${p}note" rows="2" placeholder="What won the goes, what lost them">${esc(g.note)}</textarea>`)}
    </div>
  </div>`
}

// Taps on the counters, and a new game or side resets where the moves start.
export function wireRounds(form) {
  form.addEventListener('click', e => {
    const btn = e.target.closest('[data-count]'), box = btn?.closest('[data-round]')
    if (!box) return
    const p = box.dataset.round, get = k => +form.elements[p + k].value
    const n = { tries: get('tries'), wins: get('wins'), losses: get('losses') }, k = btn.dataset.count
    n[k] = Math.max(0, n[k] + +btn.dataset.d)
    // Every score is a go: scoring adds one when needed, and goes can't drop below the scores.
    n.tries = Math.max(n.tries, n.wins + n.losses)
    COUNTS.forEach(([c]) => { form.elements[p + c].value = n[c]; $(`[data-n="${c}"]`, box).textContent = n[c] })
    $('[data-count-line]', box).textContent = countLine(n)
    navigator.vibrate?.(8)
  })
  form.addEventListener('change', e => {
    const box = e.target.closest('[data-round]')
    if (!box) return
    const p = box.dataset.round, name = e.target.name
    const game = form.elements[p + 'game'].value, side = form.elements[p + 'side'].value || 'Top'
    const position = GAMES[game]?.position || form.elements[p + 'position'].value
    if (name === p + 'game' || name === p + 'position') {
      $('[data-custom]', box).hidden = !!GAMES[game]
      $('[data-sides]', box).innerHTML = sideChips(p, game, position, side)
    }
    if ([p + 'game', p + 'position', p + 'side'].includes(name)) setChainStart($('[data-chain]', box), position, roleOf(position, side))
    if (name === p + 'partner') {
      const x = partnerProfile(e.target.value)
      if (x) { if (x.level) form.elements[p + 'level'].value = x.level; form.elements[p + 'size'].value = x.size || '' }
    }
  })
}

// What a game block says, ready to save once it has an id, date and session.
export function readRound(fd, box) {
  const p = box.dataset.round, g = n => String(fd.get(p + n) || '').trim()
  const game = g('game'), preset = GAMES[game], side = g('side') || 'Top', position = preset ? preset.position : g('position')
  const goal = preset ? preset.goals[side] : g('goal'), theirGoal = preset ? preset.goals[other(side)] : g('theirGoal')
  const chain = readChain($('[data-chain]', box))
  return {
    game: preset ? game : '', name: preset ? preset.name : `${position}: ${(goal || 'your goal').toLowerCase()} vs ${(theirGoal || 'theirs').toLowerCase()}`,
    position, side, role: roleOf(position, side), goal, theirGoal,
    tries: +g('tries') || 0, wins: +g('wins') || 0, losses: +g('losses') || 0,
    partner: g('partner'), level: g('level') || 'Unknown', size: g('size'), chain: chain.chain, moves: chain.moves, note: g('note'),
  }
}

export const roundProblem = (r, n = '') => !r.tries ? `Tap + for each go${n ? ` in game ${n}` : ''}, or remove it.` : !GAMES[r.game] && !r.goal ? `Say what your goal was${n ? ` in game ${n}` : ''}.` : ''

// A game on the journal: its name, your side, the score and the moves.
export const roundMini = (g, dated = false) => `<div class="log-roll log-round ${g.wins > g.losses ? 'worked' : g.wins ? 'partial' : 'broke'}">
  <div class="log-roll-head"><span><b>${esc(gameName(g))}</b> <span class="small muted">· ${esc(sideName(g.position, g.side))}${g.partner ? ` with ${esc(g.partner)}` : ''}${dated ? ` · ${fmtDateLong(g.date)}` : ''}</span></span>
    <button class="mini" data-act="edit-round" data-id="${g.id}">Edit</button></div>
  <div class="tags score-tags"><span class="tag good">You ${+g.wins || 0}</span><span class="tag bad">Them ${+g.losses || 0}</span><span class="tag">${plural(+g.tries || 0, 'go', 'goes')}</span>${g.tries ? `<span class="tag pos">${pct(g.wins / g.tries)}</span>` : ''}</div>
  ${rollFlow(g)}
  ${g.note ? `<p class="small log-what">${esc(g.note)}</p>` : ''}
</div>`

export const roundList = () => S.round.length ? `<section class="panel rounds-panel"><div class="history-head"><h2>Positional rounds</h2><button class="card-link" data-act="new-round">Log one</button></div>
  <div class="log-rolls">${more('rounds', [...S.round].sort(byDateDesc), 4, g => roundMini(g, true))}</div></section>` : ''

function roundForm(id, preset = {}) {
  const session = preset.sessionId ? S.session.find(s => s.id === preset.sessionId) : null
  const g = id ? S.round.find(x => x.id === id) : { ...newRound(preset), date: session?.date || today(), sessionId: session?.id || '' }
  if (!g) return
  // A game of your own needs its goals, so it always opens in full.
  const mode = logMode() === 'simple' && GAMES[g.game] ? 'simple' : 'detailed'
  const sessions = [{ value: '', label: 'Not linked' }, ...[...S.session].sort(byDateDesc).slice(0, 60).map(s => ({ value: s.id, label: fmtDateLong(s.date) + ', ' + s.type }))]
  openSheet(id ? 'Edit positional round' : 'Positional round', `<div class="log-form" data-mode="${mode}">
    <p class="hint">A sparring game: both start in one spot, each with a goal. Reset whenever someone scores, and tap who did.</p>
    <div class="grid2">${field('Date', `<input type="date" name="date" value="${esc(g.date)}" required>`)}<span data-detail-only>${field('Session', selectEl('sessionId', sessions, g.sessionId, 'data-session'))}</span></div>
    ${roundFields('', g)}
    ${partnerDatalist()}</div>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Save round',
    onDelete: id ? () => remove(g) : null,
    onMount: form => {
      wireRounds(form)
      $('[data-session]', form).addEventListener('change', e => { const s = S.session.find(x => x.id === e.target.value); if (s) form.elements.date.value = s.date })
    },
    onSubmit: (fd, form) => {
      const date = fd.get('date'), r = readRound(fd, $('[data-round]', form))
      const problem = !date ? 'Add the date.' : roundProblem(r)
      if (problem) { $('#form-error').textContent = problem; return false }
      save({ ...(id ? g : {}), ...r, id: id || newId('round'), kind: 'round', date, sessionId: fd.get('sessionId') || '' })
      toast(id ? 'Round saved' : `Round logged: you ${r.wins}, them ${r.losses}`)
    },
  })
}

// A game block in the session form, with its own Remove.
export const roundRow = (i, g) => `<div class="ql-roll" data-game-row><div class="ql-roll-head"><h3>Positional round</h3><button type="button" class="mini" data-remove-row>Remove</button></div>${roundFields(`g${i}_`, g)}</div>`

export const actions = {
  'new-round': el => roundForm(null, { ...(el.dataset.session ? { sessionId: el.dataset.session } : {}), ...(el.dataset.game != null ? { game: el.dataset.game, side: el.dataset.side, position: el.dataset.position } : {}) }),
  'edit-round': el => roundForm(el.dataset.id),
}
