// Training partners and rivals: profiles, the partner picker on the roll forms, and the pre-roll
// scouting brief. The brief only counts what you logged: every line carries the ids of the rolls
// behind it, so a tap shows exactly where each number came from. Nothing is guessed.
import { S } from './store.js'
import { $, $$, byDateDesc, esc, fmtDate, newId, plural } from './util.js'
import { partnerNames, profileByName, profileOf, rollMoves, techById } from './model.js'

export const partnerById = id => S.partner.find(p => p.id === id) || null
export const rollsWith = p => S.roll.filter(r => profileOf(r) === p).sort(byDateDesc)
export const roundsWith = p => S.round.filter(g => profileOf(g) === p).sort(byDateDesc)
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

// ---------- The scouting brief ----------

// What a partner's move did to you, by move type. Other types read as "caught you".
const DID = { Pass: 'passed your guard', Sweep: 'swept you', Submission: 'caught you in a submission', Takedown: 'took you down', Escape: 'escaped from you', Retention: 'held their guard against you' }
const lower = s => s.charAt(0).toLowerCase() + s.slice(1)
export const spotOf = x => x.position ? x.position + (x.role && x.role !== 'Neutral' ? ', ' + x.role.toLowerCase() : '') : ''

// Each key and the rolls it shows up in, once per roll, most rolls first.
function tally(list, keysOf) {
  const c = {}
  list.forEach(x => new Set(keysOf(x)).forEach(k => { if (k) (c[k] ||= []).push(x.id) }))
  return Object.entries(c).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
}
const movesOf = (r, outcome) => rollMoves(r).filter(m => m.outcome === outcome).map(m => techById(m.techId)).filter(Boolean)
const withs = (total, list) => list.map(([id, ids]) => `${ids.length === total ? total === 1 ? '' : total === 2 ? 'both ' : 'all ' : ids.length + ' '}with the ${lower(techById(id).name)}`).join(', ')
const counted = list => list.map(([k, ids]) => `${k} (${ids.length})`)

// The brief for one profile. Each line: { k, text, ids }. ids are rolls (or rounds, for the rounds line).
export function scout(p) {
  const rolls = rollsWith(p), rounds = roundsWith(p), n = rolls.length, name = p.name
  const by = res => rolls.filter(r => r.result === res).length
  const lines = { head: [], them: [], mine: [], starts: [] }
  const add = (part, k, text, ids) => ids.length && lines[part].push({ k, text, ids })

  if (n) add('head', 'all', `You’ve rolled with ${name} ${n === 1 ? 'once' : n + ' times'} (last: ${fmtDate(rolls[0].date)}). Results: ${by('worked')} worked, ${by('partial')} partly, ${by('broke')} broke.`, rolls.map(r => r.id))
  if (rounds.length) {
    const goes = rounds.reduce((t, g) => t + (+g.tries || 0), 0), wins = rounds.reduce((t, g) => t + (+g.wins || 0), 0), losses = rounds.reduce((t, g) => t + (+g.losses || 0), 0)
    add('head', 'rounds', `Positional rounds: ${rounds.length}. You scored on ${wins} of ${plural(goes, 'go', 'goes')}, ${name} on ${losses}.`, rounds.map(g => g.id))
  }

  // What they do to you: their moves by type, then the causes and spots you noted when it broke.
  const typeOf = t => DID[t.type] ? t.type : 'Other'
  tally(rolls, r => movesOf(r, 'caughtBy').map(typeOf)).slice(0, 3).forEach(([type, ids]) => {
    const theirs = tally(rolls.filter(r => ids.includes(r.id)), r => movesOf(r, 'caughtBy').filter(t => typeOf(t) === type).map(t => t.id)).slice(0, 3)
    add('them', 'caught-' + type, `${name} ${DID[type] || 'caught you'} in ${ids.length} of ${plural(n, 'roll')}: ${withs(ids.length, theirs)}.`, ids)
  })
  const bad = rolls.filter(r => r.result !== 'worked')
  const causes = tally(bad, r => r.reasons || []).slice(0, 3), spots = tally(bad, r => [spotOf(r)]).slice(0, 3)
  add('them', 'causes', `When it went wrong you noted: ${counted(causes).join(', ').toLowerCase()}.`, [...new Set(causes.flatMap(c => c[1]))])
  add('them', 'spots', `It went wrong from: ${counted(spots).join('; ').toLowerCase()}.`, [...new Set(spots.flatMap(c => c[1]))])

  // What works for you, and where your rolls with them start.
  const landed = tally(rolls, r => movesOf(r, 'landed').map(t => t.id)).slice(0, 4)
  add('mine', 'landed', `You landed: ${landed.map(([id, ids]) => `${lower(techById(id).name)} in ${plural(ids.length, 'roll')}`).join(', ')}.`, [...new Set(landed.flatMap(c => c[1]))])
  const starts = tally(rolls, r => [spotOf(r)]).slice(0, 3)
  add('starts', 'starts', `Where it starts: ${starts.map(([spot, ids]) => `${lower(spot)} (${ids.length}, ${rolls.filter(r => ids.includes(r.id) && r.result === 'worked').length} worked)`).join('; ')}.`, [...new Set(starts.flatMap(c => c[1]))])

  const pinned = (p.notes || []).filter(x => x.pinned)
  const latest = [...(p.notes || [])].filter(x => !x.pinned).sort(byDateDesc)[0] || null
  return { n, rolls, rounds, lines, plan: planFor(p, rolls), pinned, latest, thin: n < 3 }
}

// One suggestion, from the data only: the start where your rolls with them work best (2+ rolls,
// half or more worked), else a chain of yours that worked on them, else their most common weapon.
function planFor(p, rolls) {
  const best = tally(rolls, r => [spotOf(r)]).map(([spot, ids]) => {
    const there = rolls.filter(r => ids.includes(r.id)), won = there.filter(r => r.result === 'worked')
    return { spot, ids, won, n: there.length, start: there[0] }
  }).filter(s => s.n >= 2 && s.won.length * 2 >= s.n).sort((a, b) => b.won.length / b.n - a.won.length / a.n || b.n - a.n)[0]
  if (best) {
    const [top] = tally(best.won, r => movesOf(r, 'landed').map(t => t.id))
    return { text: `Start from ${lower(best.spot)}: ${best.won.length} of ${best.n} rolls there worked${top ? `, and you landed the ${lower(techById(top[0]).name)} in ${top[1].length === best.won.length && top[1].length > 1 ? 'each' : plural(top[1].length, 'roll')}` : ''}.`, ids: best.ids, from: best.start }
  }
  const chain = rolls.find(r => r.result === 'worked' && (r.chain || []).filter(m => m.outcome === 'landed').length >= 2)
  if (chain) return { text: `Run what worked on ${fmtDate(chain.date)}: ${chain.chain.filter(m => m.outcome === 'landed').map(m => lower(techById(m.techId)?.name || '')).filter(Boolean).join(' › ')}.`, ids: [chain.id], from: chain }
  const [weapon] = tally(rolls, r => movesOf(r, 'caughtBy').map(t => t.id))
  if (weapon && weapon[1].length >= 2) return { text: `Have an answer ready for the ${lower(techById(weapon[0]).name)}: it got you in ${weapon[1].length} of ${plural(rolls.length, 'roll')}.`, ids: weapon[1], from: rolls.find(r => r.id === weapon[1][0]) }
  return null
}

// The brief line a drilldown asked for: k is a line key, or 'plan'.
export function briefLine(p, k) {
  const b = scout(p)
  return k === 'plan' ? b.plan : Object.values(b.lines).flat().find(l => l.k === k) || null
}
