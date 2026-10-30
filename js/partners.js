// Partner profiles (the opponents you keep notes on), the partner picker on the roll and round forms,
// and how a save links rolls to profiles. Records, stories and the scouting brief are in rivals.js.
import { S } from './store.js'
import { $, $$, esc, newId } from './util.js'
import { partnerNames, profileByName, profileOf } from './model.js'

export const partnerById = id => S.partner.find(p => p.id === id) || null
export const newProfile = (fields = {}) => ({ id: newId('partner'), kind: 'partner', name: '', nickname: '', belt: '', stripes: 0, size: '', weight: '', styles: [], rival: false, gym: '', photo: '', notes: [], ...fields })

// The day you last rolled with each name or profile, newest first. Profiles you haven't rolled with yet come last.
export function recentPartners() {
  const last = {}
  ;[...S.roll, ...S.round].forEach(x => {
    const name = profileOf(x)?.name || (x.partner || '').trim()
    if (name && (last[name] || '') < x.date) last[name] = x.date
  })
  S.partner.forEach(p => last[p.name] ??= '')
  return Object.keys(last).sort((a, b) => last[b].localeCompare(last[a]) || a.localeCompare(b))
}

// Names on 2+ rolls or rounds that have no profile yet, most rolled first.
export function unprofiled() {
  const n = {}, shown = {}
  ;[...S.roll, ...S.round].forEach(x => {
    const name = (x.partner || '').trim(), k = name.toLowerCase()
    if (!name || profileOf(x)) return
    n[k] = (n[k] || 0) + 1
    shown[k] ||= name
  })
  return Object.keys(n).filter(k => n[k] >= 2).sort((a, b) => n[b] - n[a]).map(k => ({ name: shown[k], n: n[k] }))
}

// ---------- The picker on the roll and round forms ----------

// A text field (it still takes any name), your recent partners as one-tap chips, a tick to save a
// new name as a profile, and a note that goes on their profile. prefix names the fields ("r0_").
export function partnerPicker(prefix, value = '', { label = 'Partner (optional)', note = '', id = '' } = {}) {
  return `<div class="partner-pick" data-partner-pick="${esc(prefix)}">
    <label class="field"><span class="field-label">${esc(label)}</span><input type="text" name="${prefix}partner" ${id ? `id="${id}"` : ''} list="partner-list" autocomplete="off" value="${esc(value)}" placeholder="Name or nickname" data-partner></label>
    ${recentPartners().length ? `<div class="pick-chips partner-chips">${recentPartners().slice(0, 6).map(n => `<button type="button" class="pick-chip" data-pick-partner="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    <label class="new-partner" data-new-partner hidden><input type="checkbox" name="${prefix}newPartner" value="1" checked> <span>Save <b data-new-name></b> as a training partner</span></label>
    <label class="field" data-partner-note hidden><span class="field-label">Note for <span data-note-name></span> <span class="hint">optional, goes on their profile</span></span>
      <input type="text" name="${prefix}partnerNote" value="${esc(note)}" placeholder="Loves the over-under; keep elbows tight"></label>
  </div>`
}

function showPick(box) {
  const name = $('[data-partner]', box).value.trim(), known = profileByName(name)
  $('[data-new-partner]', box).hidden = !name || !!known
  $('[data-new-name]', box).textContent = name
  $('[data-partner-note]', box).hidden = !name
  $('[data-note-name]', box).textContent = known?.name || name
  $$('[data-pick-partner]', box).forEach(b => b.setAttribute('aria-pressed', b.dataset.pickPartner.toLowerCase() === name.toLowerCase()))
}

export function wirePartnerPicks(form) {
  $$('[data-partner-pick]', form).forEach(showPick)
  form.addEventListener('click', e => {
    const chip = e.target.closest('[data-pick-partner]'), box = chip?.closest('[data-partner-pick]')
    if (!box) return
    const input = $('[data-partner]', box)
    input.value = chip.dataset.pickPartner
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // The describer fills the name in with a change event, so both events update the box.
  ;['input', 'change'].forEach(type => form.addEventListener(type, e => {
    const box = e.target.matches('[data-partner]') && e.target.closest('[data-partner-pick]')
    if (box) showPick(box)
  }))
}

export const partnerDatalist = () => `<datalist id="partner-list">${partnerNames().map(p => `<option value="${esc(p)}"></option>`).join('')}</datalist>`

// The note a roll or round left on its partner's profile, for its edit form.
export const noteFor = x => profileOf(x)?.notes?.find(n => n.refId === x.id)?.text || ''

// Saving rolls and rounds: each links to its partner's profile by id and takes the profile's name
// (so a rename carries over), a ticked new name becomes a profile, and the note goes on it.
// One linker per save, so two rolls with the same partner in one session share one profile.
export function partnerLinker() {
  const touched = {} // each profile as this save leaves it, by id
  const link = (fd, prefix, { level = '', size = '', styles = [], date, refId }) => {
    const name = String(fd.get(prefix + 'partner') || '').trim(), note = String(fd.get(prefix + 'partnerNote') || '').trim()
    if (!name) return { partner: '', partnerId: '' }
    const known = profileByName(name)
    let p = known ? touched[known.id] || known : Object.values(touched).find(x => x.name.toLowerCase() === name.toLowerCase())
    if (!p && fd.get(prefix + 'newPartner')) { p = newProfile({ name, belt: level === 'Unknown' ? '' : level, size, styles }); touched[p.id] = p }
    if (!p) return { partner: name, partnerId: '' }
    const old = p.notes.find(n => n.refId === refId)
    if (note !== (old?.text || '')) {
      const notes = p.notes.filter(n => n.refId !== refId)
      if (note) notes.push({ id: old?.id || newId('note'), date, text: note, pinned: !!old?.pinned, refId })
      p = touched[p.id] = { ...p, notes }
    }
    return { partner: p.name, partnerId: p.id }
  }
  return { link, recs: () => Object.values(touched) }
}
