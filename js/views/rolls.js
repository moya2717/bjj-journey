import { S, save, saveMany, remove } from '../store.js'
import { UI } from '../ui.js'
import { BELTS, POSITIONS, REASONS, RESULTS, SIZES, STYLES } from '../vocab.js'
import { $, byDateDesc, esc, fmtDate, fmtDateLong, newId, posRole, toast, today, trunc } from '../util.js'
import { field, selectEl, chipsEl, techSelect, openSheet } from '../sheet.js'
import { more, subOf } from './hub.js'
import { opponentList, opponentStory } from './opponents.js'
import { roundList } from './rounds.js'
import { chainBuilder, readChain, rollFlow, setChainStart } from '../picker.js'
import { describeBox } from '../describe.js'
import { MOVE_OUTCOMES, logMode, nodeDepth, nodePath, partnerNames, partnerProfile, rollTechId, seqById, sizeLabel, techById, treeOrder } from '../model.js'

// Rolls has two sides: your roll notes, and your opponents with their stories.
const sides = on => `<div class="seg roll-sides" role="group" aria-label="Show">${[['', 'Roll notes'], ['opponents', 'Opponents']].map(([k, label]) =>
  `<button data-act="open-sub" data-sub="${k}" aria-pressed="${k === on}">${label}</button>`).join('')}</div>`

export function view() {
  const sub = subOf('rolls')
  if (sub.startsWith('opp:')) return opponentStory(sub.slice(4))
  if (sub === 'opponents') return `${sides(sub)}<div class="page-head"><div><h1>Opponents</h1><p class="lede">Everyone you’ve named on a roll, and the story of every roll with them.</p></div></div>${opponentList()}`
  return `${sides(sub)}<div class="page-head"><div><h1>Rolling analysis</h1><p class="lede">One note per key exchange: where it started, where it broke down, and what you’ll try next.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-roll">Log a roll</button><button class="btn ghost" data-act="new-round">Log a positional round</button></div></div>
    ${roundList()}
    ${S.roll.length ? `<div class="filters sticky-chips">
      ${field('Position', selectEl('', [{ value: '', label: 'All positions' }, ...POSITIONS], UI.rollPos, 'id="roll-pos"'))}
      ${field('Result', selectEl('', [{ value: '', label: 'All results' }, { value: 'broke', label: 'Broke down' }, { value: 'partial', label: 'Partly worked' }, { value: 'worked', label: 'Worked' }, { value: 'open', label: 'Has an untested “try next”' }], UI.rollRes, 'id="roll-res"'))}
    </div>` : ''}
    <div id="roll-list">${rollList()}</div>`
}

export function mount() {
  $('#roll-pos')?.addEventListener('change', e => { UI.rollPos = e.target.value; UI.more.rolls = 0; $('#roll-list').innerHTML = rollList() })
  $('#roll-res')?.addEventListener('change', e => { UI.rollRes = e.target.value; UI.more.rolls = 0; $('#roll-list').innerHTML = rollList() })
}

const isOpenExperiment = r => r.tryNext && (r.tryStatus || 'open') === 'open'

function rollList() {
  if (!S.roll.length) return `<div class="empty-state"><h2>No rolls logged yet</h2><p>Pick one exchange from your last roll that mattered. Note the position, what you tried, and where it fell apart.</p><button class="btn" data-act="new-roll">Log a roll</button></div>`
  const list = [...S.roll].sort(byDateDesc)
    .filter(r => !UI.rollPos || r.position === UI.rollPos)
    .filter(r => !UI.rollRes || (UI.rollRes === 'open' ? isOpenExperiment(r) : r.result === UI.rollRes))
  return list.length ? `<div class="stack">${more('rolls', list, 6, rollCard)}</div>` : '<p class="muted">No rolls match these filters.</p>'
}

export function rollCard(r) {
  const seq = seqById(r.seqId), tech = techById(rollTechId(r))
  const status = r.tryStatus || 'open'
  const statusLabel = { open: 'Not tested yet', worked: 'Tested, it worked', failed: 'Tested, didn’t work' }[status]
  const partnerBits = [r.partner && `with ${esc(r.partner)}`, r.level && r.level !== 'Unknown' && `${esc(r.level.toLowerCase())} belt`, r.size && esc(sizeLabel(r.size)), (r.styles || []).length && esc(r.styles.join(', ').toLowerCase())].filter(Boolean)
  return `<article class="roll ${esc(r.result)}">
    <div class="entry-top"><h3>${r.position ? posRole(r.position, r.role) : r.partner ? 'Roll with ' + esc(r.partner) : 'Roll'}</h3><span class="result ${esc(r.result)}">${esc(RESULTS[r.result]?.label || '')}</span></div>
    <p class="entry-meta">${[fmtDateLong(r.date), ...partnerBits].join(', ')}</p>
    ${seq ? `<p class="path">${esc(seq.name)}: ${nodePath(seq, r.nodeId).map(esc).join(' › ')}</p>` : tech ? `<p class="path">${esc(tech.name)}</p>` : ''}
    ${rollFlow(r) || movesUsed(r)}
    ${(r.reasons || []).length ? `<div class="tags">${r.reasons.map(x => `<button class="tag fix-tag" data-act="fix" data-reason="${esc(x)}" aria-label="How to fix: ${esc(x)}">${esc(x)} <span aria-hidden="true">›</span></button>`).join('')}</div>` : ''}
    ${r.what ? `<p style="margin-top:8px">${esc(r.what)}</p>` : ''}
    ${r.tryNext ? `<div class="trynext"><strong>Try next:</strong> ${esc(r.tryNext)} <span class="status ${status}">${statusLabel}</span>
      <div class="row-actions">
        ${status !== 'worked' ? `<button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="worked">Tried it, worked</button>` : ''}
        ${status !== 'failed' ? `<button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="failed">Tried it, didn’t work</button>` : ''}
        ${status !== 'open' ? `<button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="open">Mark untested</button>` : ''}
        ${status === 'worked' && !r.promoted ? `<button class="btn sm" data-act="promote" data-id="${r.id}">Add to sequence</button>` : ''}
      </div>
      ${r.promoted && seqById(r.promoted.seqId) ? `<p class="promoted">Added to ${esc(seqById(r.promoted.seqId).name)}. <button class="link" data-act="open-seq" data-id="${r.promoted.seqId}">Open it</button></p>` : ''}
    </div>` : ''}
    <div class="row-actions"><button class="btn sm ghost" data-act="edit-roll" data-id="${r.id}">Edit</button></div>
  </article>`
}

// The "moves used" list, grouped by outcome: "Landed: Kimura, Armbar · Caught by: Triangle".
export function movesUsed(r) {
  const parts = Object.entries(MOVE_OUTCOMES).map(([k, label]) => [label, (r.moves || []).filter(m => m.outcome === k).map(m => techById(m.techId)).filter(Boolean)]).filter(([, list]) => list.length)
  return parts.length ? `<p class="moves-used">${parts.map(([label, list]) => `<span><strong>${label}:</strong> ${list.map(t => esc(t.name)).join(', ')}</span>`).join('')}</p>` : ''
}

export function stepOptions(seqId, selected, first = 'Whole sequence') {
  const seq = seqById(seqId)
  if (!seq) return '<option value="">Pick a sequence first</option>'
  return `<option value="">${esc(first)}</option>` + treeOrder(seq).map(n =>
    `<option value="${n.id}" ${n.id === selected ? 'selected' : ''}>${' '.repeat(nodeDepth(seq, n))}${n.who === 'them' ? 'They: ' : 'You: '}${esc(trunc(n.label, 60))}</option>`).join('')
}

export const partnerDatalist = () => `<datalist id="partner-list">${partnerNames().map(p => `<option value="${esc(p)}"></option>`).join('')}</datalist>`

const SIMPLE_RESULTS = { worked: 'It worked', partial: 'Partly', broke: 'It fell apart' }

const seqOptions = () => [{ value: '', label: 'None' }, ...S.seq.map(s => ({ value: s.id, label: s.name }))]

function rollForm(id, preset = {}) {
  const session = preset.sessionId ? S.session.find(s => s.id === preset.sessionId) : null
  // A new roll starts where your last one did: most notes in a sitting are about the same position.
  const last = [...S.roll].sort(byDateDesc)[0]
  const r = id ? S.roll.find(x => x.id === id) : {
    date: session?.date || today(), sessionId: session?.id || '', partner: '', level: 'Blue', size: '', styles: [],
    position: '', role: '', seqId: preset.seqId || '', nodeId: preset.nodeId || '', techId: '',
    result: 'broke', reasons: [], what: '', tryNext: '', tryStatus: 'open',
  }
  if (!r) return
  const presetSeq = !id && seqById(preset.seqId)
  if (presetSeq) { r.position = presetSeq.position; r.role = presetSeq.role || r.role }
  const sessionOptions = [{ value: '', label: 'Not linked' }, ...[...S.session].sort(byDateDesc).slice(0, 60).map(s => ({ value: s.id, label: fmtDateLong(s.date) + ', ' + s.type }))]
  // Simple mode asks three things: who with, how it went, what happened. The rest folds away,
  // and opens by itself when a roll already has it.
  const simple = logMode() === 'simple'
  if (simple && !id) Object.assign(r, { result: '', level: 'Unknown' })
  const detailed = id && (r.position || r.reasons?.length || r.tryNext || r.seqId || r.techId || r.styles?.length || r.size)

  const partnerName = field(simple ? 'Who did you roll with? (optional)' : 'Partner (optional)', `<input type="text" name="partner" id="r-partner" list="partner-list" autocomplete="off" value="${esc(r.partner)}" placeholder="Name or nickname">`)
  const where = `<fieldset><legend>What happened, move by move</legend>${describeBox('')}${chainBuilder('', r, last?.position)}</fieldset>`
  const result = `<fieldset><legend>${simple ? 'How did it go?' : 'Result'}</legend><div class="chips">${Object.entries(RESULTS).map(([k, v]) => `<label class="chip r-${k}"><input type="radio" name="result" value="${k}" ${r.result === k ? 'checked' : ''}><span>${simple ? SIMPLE_RESULTS[k] : v.label}</span></label>`).join('')}</div></fieldset>`
  const why = `<fieldset data-why ${r.result === 'worked' ? 'hidden' : ''}><legend>Why it went wrong</legend>${chipsEl('reasons', REASONS, r.reasons || [])}</fieldset>`
  const what = field(simple ? 'What happened?' : 'What happened', `<textarea name="what" id="r-what" rows="3" placeholder="${simple ? 'They got on top and I couldn’t get them off. I remembered to keep my elbows in.' : 'He got the underhook as soon as I cut, came up, and I ended up on bottom'}">${esc(r.what)}</textarea>`)
  const tryNext = field('What you’ll try next time', `<input type="text" name="tryNext" id="r-next" value="${esc(r.tryNext)}" placeholder="Crossface first, then cut">`)
  const partnerMore = `<div class="grid3">
        ${simple ? '' : partnerName}
        ${field('Partner’s belt', selectEl('level', BELTS, r.level, 'id="r-level"'))}
        ${field('Their size', selectEl('size', [{ value: '', label: 'Not noted' }, ...SIZES], r.size || '', 'id="r-size"'))}
      </div>${partnerDatalist()}
      <fieldset><legend>Their style</legend>${chipsEl('styles', STYLES, r.styles || [])}</fieldset>`
  const sequence = `<div class="grid2">${field('Sequence you ran', selectEl('seqId', seqOptions(), r.seqId, 'id="r-seq"'))}${field('Step it reached', `<select name="nodeId" id="r-node">${stepOptions(r.seqId, r.nodeId)}</select>`)}</div>
      ${field('Main move (if not in a sequence)', techSelect('techId', r.techId, { extra: 'id="r-tech"' }))}`
  const date = field('Date', `<input type="date" name="date" id="r-date" value="${esc(r.date)}" required>`)
  const sessionPick = field('Session', selectEl('sessionId', sessionOptions, r.sessionId, 'id="r-session"'))

  // The common case comes first (where, how it went, what next). Partner and sequence details fold away.
  openSheet(id ? 'Edit roll note' : 'Log a roll', simple ? `
    <div class="grid2">${date}${partnerName}</div>
    ${result}
    ${what}
    <details class="more" ${detailed ? 'open' : ''}><summary>Add more detail <span class="hint">position, moves, causes, what to try next</span></summary><div>
      ${sessionPick}${where}${why}${tryNext}${partnerMore}${sequence}
    </div></details>
    <p class="form-error" id="form-error"></p>` : `
    <div class="grid2">${date}${sessionPick}</div>
    ${where}${result}${why}${what}${tryNext}
    <details class="more" ${r.partner || (r.styles || []).length ? 'open' : ''}><summary>Partner: name, belt, size, style</summary><div>${partnerMore}</div></details>
    <details class="more" ${r.seqId || r.techId ? 'open' : ''}><summary>Sequence or main move</summary><div>${sequence}</div></details>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Save roll',
    onDelete: id ? () => remove(r) : null,
    onMount: form => {
      $('#r-seq', form).addEventListener('change', e => {
        const seq = seqById(e.target.value)
        $('#r-node', form).innerHTML = stepOptions(e.target.value, '')
        if (seq) setChainStart($('[data-chain]', form), seq.position, seq.role)
      })
      $('#r-session', form).addEventListener('change', e => { const s = S.session.find(x => x.id === e.target.value); if (s) form.elements.date.value = s.date })
      $('#r-partner', form).addEventListener('change', e => fillFromPartner(form, e.target.value, id))
      form.addEventListener('change', e => { if (e.target.name === 'result') $('[data-why]', form).hidden = e.target.value === 'worked' })
    },
    onSubmit: (fd, form) => {
      const date = fd.get('date')
      if (!date) { $('#form-error').textContent = 'Add the date of the roll.'; return false }
      const chain = readChain($('[data-chain]', form))
      if (simple && !fd.get('result')) { $('#form-error').textContent = 'Pick how it went.'; return false }
      if (!simple && !chain.position && (!id || r.position)) { $('#form-error').textContent = 'Pick where the roll started.'; return false }
      const tryNext = fd.get('tryNext').trim()
      const rec = {
        ...(id ? r : {}), id: id || newId('roll'), kind: 'roll', date, sessionId: fd.get('sessionId'),
        partner: fd.get('partner').trim(), level: fd.get('level'), size: fd.get('size') || '', styles: fd.getAll('styles'),
        position: chain.position, role: chain.role, seqId: fd.get('seqId'), nodeId: fd.get('seqId') ? fd.get('nodeId') : '',
        techId: fd.get('techId'), moves: chain.moves, chain: chain.chain, result: fd.get('result') || 'broke', reasons: fd.get('result') === 'worked' ? [] : fd.getAll('reasons'), what: fd.get('what').trim(),
        tryNext, tryStatus: tryNext ? (id && r.tryNext === tryNext ? (r.tryStatus || 'open') : 'open') : '',
      }
      if (id && r.tryNext !== tryNext) { delete rec.promoted; delete rec.promoteSkip }
      save(rec)
      toast(id ? 'Roll saved' : 'Roll logged')
    },
  })
}

function fillFromPartner(form, name, skipId) {
  const p = partnerProfile(name)
  if (!p || p.id === skipId) return
  if (p.level) form.elements.level.value = p.level
  form.elements.size.value = p.size || ''
  form.querySelectorAll('input[name="styles"]').forEach(c => c.checked = (p.styles || []).includes(c.value))
}

// The experiment loop: a "try next" that works becomes your answer in a sequence.
function promoteForm(rollId) {
  const r = S.roll.find(x => x.id === rollId)
  if (!r) return
  if (!S.seq.length) { toast('Create a sequence first, then add this to it.'); UI.view = 'sequences'; return }
  const start = seqById(r.seqId) || S.seq.find(s => s.position === r.position && s.role === r.role) || S.seq.find(s => s.position === r.position) || S.seq[0]
  const parentFor = seqId => seqId === r.seqId ? r.nodeId : ''
  openSheet('Add to a sequence', `
    <p class="hint">“${esc(r.tryNext)}” worked on ${fmtDate(r.date)}. Save it as your answer so the sequence matches what you actually do.</p>
    ${field('Sequence', selectEl('seqId', S.seq.map(s => ({ value: s.id, label: s.name })), start.id, 'id="p-seq"'))}
    ${field('It comes after', `<select name="parentId" id="p-parent">${stepOptions(start.id, parentFor(start.id), 'Start of the sequence')}</select>`)}
    ${field('Your answer', `<input type="text" name="label" id="p-label" value="${esc(r.tryNext)}" required>`)}
    ${field('Linked move', techSelect('techId', r.techId || ''))}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: 'Add to sequence',
    onMount: form => $('#p-seq', form).addEventListener('change', e => { $('#p-parent', form).innerHTML = stepOptions(e.target.value, parentFor(e.target.value), 'Start of the sequence') }),
    onSubmit: fd => {
      const label = fd.get('label').trim(), seq = seqById(fd.get('seqId'))
      if (!label || !seq) { $('#form-error').textContent = 'Describe your answer.'; return false }
      const node = { id: newId('n'), parentId: fd.get('parentId') || null, who: 'me', label, techId: fd.get('techId'), note: r.what ? `From your roll on ${fmtDate(r.date)}: ${r.what}` : '', fromRoll: r.id }
      saveMany([{ ...seq, nodes: [...seq.nodes, node] }, { ...r, tryStatus: 'worked', promoted: { seqId: seq.id, nodeId: node.id } }])
      UI.seqSel = seq.id
      toast('Added to ' + seq.name)
    },
  })
}

export const actions = {
  'new-roll': el => rollForm(null, { sessionId: el.dataset.session }),
  'edit-roll': el => rollForm(el.dataset.id),
  'log-node': el => rollForm(null, { seqId: el.dataset.seq, nodeId: el.dataset.id }),
  'exp': el => {
    const r = S.roll.find(x => x.id === el.dataset.id), status = el.dataset.status
    if (!r) return
    save({ ...r, tryStatus: status })
    if (status === 'worked' && !r.promoted && S.seq.length) promoteForm(r.id)
    else toast(status === 'open' ? 'Marked untested' : 'Experiment updated')
  },
  'promote': el => promoteForm(el.dataset.id),
  'promote-skip': el => { const r = S.roll.find(x => x.id === el.dataset.id); if (r) { save({ ...r, promoteSkip: true }); toast('Kept out of your sequences') } },
}
