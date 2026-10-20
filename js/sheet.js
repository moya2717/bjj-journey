import { cached } from './store.js'
import { LIBRARY_GROUPS, POSITIONS } from './vocab.js'
import { $, $$, esc, toast } from './util.js'
import { MOVE_OUTCOMES, allTechs, myTechs, techById } from './model.js'

// Form building blocks. Every form in the app is a sheet: a dialog with a form inside.

export const field = (label, control) => `<label class="field"><span class="field-label">${esc(label)}</span>${control}</label>`

const optValue = o => typeof o === 'object' ? o.value : o
const optLabel = o => typeof o === 'object' ? o.label : o

export function selectEl(name, options, value, extra = '') {
  return `<select ${name ? `name="${name}"` : ''} ${extra}>${options.map(o =>
    `<option value="${esc(optValue(o))}" ${String(optValue(o)) === String(value ?? '') ? 'selected' : ''}>${esc(optLabel(o))}</option>`).join('')}</select>`
}

export function chipsEl(name, options, values) {
  return `<div class="chips">${options.map(o =>
    `<label class="chip"><input type="checkbox" name="${name}" value="${esc(optValue(o))}" ${values.includes(optValue(o)) ? 'checked' : ''}><span>${esc(optLabel(o))}</span></label>`).join('')}</div>`
}

export function radioChips(name, options, value) {
  return `<div class="chips">${options.map(o =>
    `<label class="chip"><input type="radio" name="${name}" value="${esc(o)}" ${o === value ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`
}

// A select of every move, your moves first, the rest grouped by position.
// The ~350 options are built once per change to the journal and reused by every select.
const techOptions = () => cached('techOptions', () => {
  const option = t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`
  const mine = myTechs(), all = allTechs()
  const groups = LIBRARY_GROUPS.map(g => [g, all.filter(t => t.position === g)]).filter(([, list]) => list.length)
  return (mine.length ? `<optgroup label="My moves">${mine.map(option).join('')}</optgroup>` : '')
    + groups.map(([g, list]) => `<optgroup label="${esc(g)}">${list.sort((a, b) => a.name.localeCompare(b.name)).map(option).join('')}</optgroup>`).join('')
})

export function techSelect(name, value, { empty = 'None', extra = '' } = {}) {
  const options = value ? techOptions().replace(`value="${esc(value)}"`, `value="${esc(value)}" selected`) : techOptions()
  return `<select name="${name}" ${extra}><option value="">${esc(empty)}</option>${options}</select>`
}

// "Moves used" in a roll: add moves from the list, then mark each landed, tried or caught by.
let moveRows = 0
const moveRow = m => {
  const t = techById(m.techId), n = moveRows++
  return t ? `<div class="move-row" data-move="${esc(t.id)}"><b>${esc(t.name)}</b>
    <div class="chips">${Object.entries(MOVE_OUTCOMES).map(([k, label]) => `<label class="chip o-${k}"><input type="radio" name="mv${n}" value="${k}" ${m.outcome === k ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>
    <button type="button" class="mini" data-move-drop aria-label="Remove ${esc(t.name)}">×</button></div>` : ''
}

export const movesPicker = (moves = []) => `<fieldset><legend>Moves used</legend><div class="moves-pick" data-moves>${moves.map(moveRow).join('')}
  ${techSelect('', '', { empty: '+ Add a move', extra: 'data-move-add aria-label="Add a move you used or got caught by"' })}</div></fieldset>`

export const readMoves = box => $$('[data-move]', box).map(row => ({ techId: row.dataset.move, outcome: $('input:checked', row)?.value || 'tried' }))

function wireMovePickers(form) {
  form.addEventListener('change', e => {
    const pick = e.target.closest('[data-move-add]')
    if (!pick?.value) return
    if (!$(`[data-move="${CSS.escape(pick.value)}"]`, pick.parentElement)) pick.insertAdjacentHTML('beforebegin', moveRow({ techId: pick.value, outcome: 'landed' }))
    pick.value = ''
  })
  form.addEventListener('click', e => e.target.closest('[data-move-drop]')?.closest('[data-move]').remove())
}

// What class covered: pick positions first, and that position's moves appear to tap.
// With no position picked, your usual moves show instead. Search adds anything else.
export function focusPicker(focus = [], drilled = []) {
  return `<div class="focus-pick" data-focus-pick>
    <p class="pick-step"><span class="step-n small-n">1</span>Which positions did class cover?</p>
    <div class="chips">${POSITIONS.map(p => `<label class="chip"><input type="checkbox" name="focus" value="${esc(p)}" ${focus.includes(p) ? 'checked' : ''}><span>${esc(p)}</span></label>`).join('')}</div>
    <p class="pick-step"><span class="step-n small-n">2</span>Which moves did you drill?</p>
    <div data-focus-moves>${focusMoves(focus, drilled)}</div>
    <input type="search" list="dl-techs" data-tech-add="drilled" placeholder="Something else? Search all moves" autocomplete="off" aria-label="Add another move">
  </div>`
}

function focusMoves(focus, drilled) {
  const groups = focus.length
    ? focus.map(p => [p, allTechs().filter(t => t.position === p)])
    : [['Your usual moves', myTechs().filter(t => t.type !== 'Movement').slice(0, 12)]]
  const shown = new Set(groups.flatMap(([, list]) => list.map(t => t.id)))
  const others = drilled.filter(id => !shown.has(id)).map(techById).filter(Boolean)
  return groups.map(([title, list]) => list.length ? `<div class="move-group"><p class="small muted">${esc(title)}</p>
      <div class="chips">${list.map(t => techChip('drilled', t, drilled.includes(t.id))).join('')}</div></div>` : '').join('')
    + `<div class="move-group"><div class="chips" data-chips="drilled">${others.map(t => techChip('drilled', t, true)).join('')}</div></div>`
}

function wireFocusPickers(form) {
  $$('[data-focus-pick]', form).forEach(box => box.addEventListener('change', e => {
    if (e.target.name !== 'focus') return
    const focus = $$('input[name="focus"]:checked', box).map(i => i.value)
    const drilled = $$('input[name="drilled"]:checked', box).map(i => i.value)
    $('[data-focus-moves]', box).innerHTML = focusMoves(focus, drilled)
  }))
}

const techChip = (name, t, checked) =>
  `<label class="chip"><input type="checkbox" name="${name}" value="${esc(t.id)}" ${checked ? 'checked' : ''}><span>${esc(t.name)}</span></label>`

const techDatalist = () => cached('techDatalist', () => `<datalist id="dl-techs">${allTechs().map(t => `<option value="${esc(t.name)}"></option>`).join('')}</datalist>`)

function wireTechPickers(form) {
  $$('[data-tech-add]', form).forEach(input => input.addEventListener('change', () => {
    const wanted = input.value.trim().toLowerCase()
    if (!wanted) return
    const tech = allTechs().find(t => t.name.toLowerCase() === wanted)
    if (!tech) { toast('No move by that name. Add it under Game → Moves first.'); return }
    const name = input.dataset.techAdd, chips = $(`[data-chips="${name}"]`, form)
    const existing = $$(`input[value="${CSS.escape(tech.id)}"]`, chips)[0]
    if (existing) existing.checked = true
    else chips.insertAdjacentHTML('beforeend', techChip(name, tech, true))
    input.value = ''
  }))
}

// Delete buttons ask twice instead of using confirm().
export function armDelete(button, onConfirm) {
  if (button.dataset.armed) { onConfirm(); return true }
  button.dataset.armed = '1'
  const label = button.textContent
  button.textContent = 'Tap again to confirm'
  setTimeout(() => { if (button.isConnected) { delete button.dataset.armed; button.textContent = label } }, 3500)
  return false
}

const dialog = () => $('#sheet')
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// The sheet slides away before it closes. Every way out goes through here.
// `shown` counts sheets, so a late close never shuts a sheet opened after it.
let shown = 0, closing
function dismiss() {
  const dlg = dialog()
  if (!dlg.open || dlg.classList.contains('closing')) return
  const done = () => { dlg.classList.remove('closing'); dlg.style.transform = ''; dlg.close() }
  if (calm()) return done()
  dlg.classList.add('closing')
  closing = setTimeout(done, 260)
}

// Drag the sheet down by its handle, or from the top of the form, to close it.
function wireSwipe(dlg) {
  let y0 = null, dy = 0, t0 = 0
  dlg.addEventListener('touchstart', e => {
    const body = $('.sheet-body', dlg)
    const top = e.target.closest('.sheet-head') || (body && body.scrollTop <= 0 && !e.target.closest('input,select,textarea'))
    y0 = top ? e.touches[0].clientY : null
    dy = 0; t0 = e.timeStamp
  }, { passive: true })
  dlg.addEventListener('touchmove', e => {
    if (y0 == null) return
    dy = e.touches[0].clientY - y0
    if (dy < 0) { y0 = null; dlg.style.transform = ''; return }
    if (dy < 8) return
    e.preventDefault()
    dlg.style.transition = 'none'
    dlg.style.transform = `translateY(${dy}px)`
  }, { passive: false })
  dlg.addEventListener('touchend', e => {
    if (y0 == null || dy < 8) { y0 = null; return }
    y0 = null
    dlg.style.transition = ''
    if (dy > 140 || (dy > 40 && dy / (e.timeStamp - t0) > .5)) dismiss()
    else dlg.style.transform = ''
  })
  dlg.addEventListener('cancel', e => { e.preventDefault(); dismiss() })
}

// Forms in numbered steps get a progress bar, and a step's number turns into a tick once it has an answer.
function wireSteps(form) {
  const steps = $$('.form-step', form), bar = $('.sheet-progress i', form)
  if (!steps.length || !bar) return
  const answered = step => $$('input,textarea', step).some(i => ['radio', 'checkbox'].includes(i.type) ? i.checked : !['search', 'hidden', 'file'].includes(i.type) && i.value.trim())
  const update = () => { bar.style.width = steps.filter(s => s.classList.toggle('done', answered(s))).length / steps.length * 100 + '%' }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  form.addEventListener('click', () => setTimeout(update))
  update()
}

export function openSheet(title, body, { submitLabel = 'Save', onSubmit, onMount, onDelete, deleteLabel = 'Delete' } = {}) {
  const dlg = dialog(), mine = ++shown
  clearTimeout(closing)
  dlg.classList.remove('closing')
  dlg.style.transform = ''
  if (!dlg.dataset.wired) { wireSwipe(dlg); dlg.dataset.wired = '1' }
  dlg.innerHTML = `<form class="sheet-form" novalidate>
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    ${body.includes('form-step') ? '<div class="sheet-progress" aria-hidden="true"><i></i></div>' : ''}
    <div class="sheet-body">${body}${body.includes('data-tech-add') ? techDatalist() : ''}</div>
    <div class="sheet-foot">
      ${onDelete ? `<button type="button" class="btn danger sm" data-delete>${esc(deleteLabel)}</button>` : ''}
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-close>${onSubmit ? 'Cancel' : 'Close'}</button>
      ${onSubmit ? `<button type="submit" class="btn">${esc(submitLabel)}</button>` : ''}
    </div></form>`
  const form = $('form', dlg)
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const save = $('[type=submit]', form)
    if (!onSubmit || save.disabled) return
    if (await onSubmit(new FormData(form), form) === false) return
    // A saved sheet flashes its button green and the toast gets a tick before the sheet slides away.
    save.disabled = true
    save.classList.add('done')
    save.textContent = 'Saved'
    $('#toast').classList.add('ok')
    navigator.vibrate?.(10)
    setTimeout(() => mine === shown && dismiss(), calm() ? 0 : 280)
  })
  $$('[data-close]', dlg).forEach(b => b.addEventListener('click', dismiss))
  const del = $('[data-delete]', dlg)
  if (del) del.addEventListener('click', () => { if (armDelete(del, onDelete)) { dismiss(); toast('Deleted') } })
  wireTechPickers(form)
  wireFocusPickers(form)
  wireMovePickers(form)
  onMount?.(form)
  wireSteps(form)
  if (!dlg.open) dlg.showModal()
  // Only focus on a mouse or trackpad: on a phone it would pop the keyboard over the form.
  const first = $('.sheet-body input:not([type=checkbox]):not([type=radio]):not([type=file]),.sheet-body select,.sheet-body textarea', form)
  if (first && matchMedia('(pointer:fine)').matches) first.focus({ preventScroll: true })
}

export const closeSheet = dismiss
