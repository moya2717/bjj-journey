import { cached } from './store.js'
import { LIBRARY_GROUPS } from './vocab.js'
import { $, $$, esc, toast } from './util.js'
import { allTechs, myTechs } from './model.js'

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

// Chips for your usual moves, plus a search box that can add any move from the library.
export function techPicker(name, selected = []) {
  const shown = [...new Set([...myTechs().slice(0, 14).map(t => t.id), ...selected])]
  const byId = Object.fromEntries(allTechs().map(t => [t.id, t]))
  return `<div class="tech-pick">
    <div class="chips" data-chips="${name}">${shown.filter(id => byId[id]).map(id => techChip(name, byId[id], selected.includes(id))).join('')}</div>
    <input type="search" list="dl-techs" data-tech-add="${name}" placeholder="Search all moves to add one" autocomplete="off" aria-label="Add a move">
  </div>`
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

export function openSheet(title, body, { submitLabel = 'Save', onSubmit, onMount, onDelete, deleteLabel = 'Delete' } = {}) {
  const dlg = dialog()
  dlg.innerHTML = `<form class="sheet-form" novalidate>
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
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
    if (!onSubmit) return
    if (await onSubmit(new FormData(form), form) !== false) dlg.close()
  })
  $$('[data-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()))
  const del = $('[data-delete]', dlg)
  if (del) del.addEventListener('click', () => { if (armDelete(del, onDelete)) { dlg.close(); toast('Deleted') } })
  wireTechPickers(form)
  onMount?.(form)
  dlg.showModal()
  const first = $('.sheet-body input:not([type=checkbox]):not([type=radio]):not([type=file]),.sheet-body select,.sheet-body textarea', form)
  if (first && matchMedia('(pointer:fine)').matches) first.focus()
}

export const closeSheet = () => dialog().close()
