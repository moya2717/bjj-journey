// Moves from your class notes: as you write "we drilled the scissor sweep, then armbar from guard",
// the moves and positions you named show up under the note as ticked chips. They save with the
// session as moves drilled and positions covered, so they count everywhere the picker's do.
// Same matching as "Describe the roll" (parse.js), on the phone, nothing sent anywhere.
import { S } from './store.js'
import { $, esc } from './util.js'
import { allTechs, partnerNames, techById, techUsage } from './model.js'
import { parseClass } from './parse.js'
import { findMove, learnWord } from './picker.js'

export const noteMovesBox = () => `<div class="note-moves" data-note-moves aria-live="polite"></div>`

// Moves the note found that you unticked stay unticked while you keep typing, and after saving:
// a session remembers what it took from its note (noteMoves, noteFocus), so a found move missing
// from that list is one you said no to.
export function wireNoteMoves(form, s) {
  const box = $('[data-note-moves]', form), notes = form.elements.notes
  const said = (list, x) => !list || list.includes(x)
  const off = new Set(), added = new Set()
  let first = true, timer
  const render = () => {
    const got = notes.value.trim() ? parseClass(notes.value, { techs: allTechs(), personal: S.settings.moveWords || {}, partners: partnerNames(), usage: techUsage() }) : { moves: [], places: [], unmatched: [] }
    if (first) {
      got.moves.forEach(m => { if (!said(s.noteMoves, m.techId)) off.add(m.techId) })
      got.places.forEach(p => { if (!said(s.noteFocus, p)) off.add(p) })
      ;(s.noteMoves || []).forEach(id => { if (!got.moves.some(m => m.techId === id)) added.add(id) })
      first = false
    }
    // Unsure matches offer what else the words could mean, unticked, right beside them.
    const ids = [...new Set([...got.moves.flatMap(m => m.confidence < 0.75 ? [m.techId, ...m.alts.slice(0, 2)] : [m.techId]), ...added])]
    const main = new Set([...got.moves.map(m => m.techId), ...added]), unsure = new Set(got.moves.filter(m => m.confidence < 0.75).map(m => m.techId))
    const guessOf = Object.fromEntries(got.moves.flatMap(m => m.confidence < 0.75 ? m.alts.slice(0, 2).map(a => [a, m.techId]) : []))
    const chip = (name, value, label, on, cls = '') => `<label class="chip ${cls}"><input type="checkbox" name="${name}" value="${esc(value)}" ${on ? 'checked' : ''} ${guessOf[value] ? `data-instead="${esc(guessOf[value])}"` : ''}><span>${esc(label)}</span></label>`
    if (!ids.length && !got.places.length && !got.unmatched.length) { box.innerHTML = notes.value.trim() ? '<p class="hint">Name the moves you drilled, like “scissor sweep” or “knee cut”, and they’re added to your moves.</p>' : ''; return }
    box.innerHTML = `<p class="field-label">Moves in your note <span class="hint">· saved as what class covered. Untick anything that’s wrong.</span></p>
      <div class="chips">${got.places.map(p => chip('noteFocus', p, p, !off.has(p), 'pos-chip')).join('')}
        ${ids.map(techById).filter(Boolean).map(t => chip('noteMoves', t.id, t.name + (unsure.has(t.id) ? '?' : ''), main.has(t.id) && !off.has(t.id), main.has(t.id) ? '' : 'alt-chip')).join('')}</div>
      ${got.unmatched.length ? `<div class="miss-chips">${got.unmatched.map(u => `<span class="miss-chip" data-miss="${esc(JSON.stringify(u))}">“${esc(u.text)}” <button type="button" class="mini" data-note-find>Find move</button></span>`).join('')}</div>` : ''}`
  }
  notes.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 450) })
  box.addEventListener('change', e => {
    const v = e.target.value
    if (e.target.checked) off.delete(v)
    else off.add(v)
    // Picking what else the words meant replaces the guess.
    const guess = e.target.checked && e.target.dataset.instead && box.querySelector(`input[value="${CSS.escape(e.target.dataset.instead)}"]`)
    if (guess) { guess.checked = false; off.add(guess.value) }
    if (e.target.checked && e.target.closest('.alt-chip')) added.add(v)
  })
  box.addEventListener('click', e => {
    const miss = e.target.closest('[data-note-find]')?.closest('[data-miss]')
    if (!miss) return
    const u = JSON.parse(miss.dataset.miss)
    findMove({ title: `“${u.text}” is…`, onPick: id => { if (!id) return; learnWord(u.phrase, id); added.add(id); render() } })
  })
  render()
}

// What the note adds to the session, and the picker's own picks without them.
export const readNoteMoves = fd => ({ noteMoves: [...new Set(fd.getAll('noteMoves'))], noteFocus: [...new Set(fd.getAll('noteFocus'))] })
export const withoutNote = (list, s, key) => (list || []).filter(x => !(s[key] || []).includes(x))
