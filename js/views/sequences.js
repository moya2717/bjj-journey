import { S, save, remove } from '../store.js'
import { UI } from '../ui.js'
import { POSITIONS, ROLES } from '../vocab.js'
import { $, esc, newId, pct, plural, posRole, rate, trunc } from '../util.js'
import { field, selectEl, techSelect, openSheet } from '../sheet.js'
import { seqById, techById } from '../model.js'
import { stepStats } from '../analysis.js'

export function view() {
  const head = `<div class="page-head"><div><h1>Sequences</h1><p class="lede">Decision trees for your game: your move, how they react, and your answer to each reaction. Steps that keep breaking in rolls are marked.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-seq">New sequence</button></div></div>`
  if (!S.seq.length) return head + `<div class="empty-state"><h2>Map your first sequence</h2><p>Start with the move you go to most from one position. Then add the two or three ways partners usually react, and what you do against each.</p><button class="btn" data-act="new-seq">New sequence</button></div>`
  if (!seqById(UI.seqSel)) UI.seqSel = S.seq[0].id
  const seq = seqById(UI.seqSel), stats = stepStats(), rolls = S.roll.filter(r => r.seqId === seq.id)
  const children = parentId => seq.nodes.filter(n => (n.parentId || null) === parentId)

  const nodeHtml = n => {
    const st = stats[seq.id + '|' + n.id], kids = children(n.id), tech = techById(n.techId)
    const unanswered = n.who === 'them' && !kids.length
    const testing = S.roll.filter(r => r.seqId === seq.id && r.nodeId === n.id && r.tryNext && (r.tryStatus || 'open') === 'open')
    let stat = ''
    if (st) {
      const bad = st.broke + st.partial * 0.5
      stat = `<span class="node-stat ${bad / st.n >= 0.5 ? 'bad' : bad > 0 ? 'mid' : 'good'}">${st.worked} of ${st.n} worked</span>`
    }
    return `<li><div class="node ${n.who === 'them' ? 'them' : 'me'} ${unanswered ? 'open' : ''}">
      <span class="who ${n.who === 'them' ? 'them' : 'me'}">${n.who === 'them' ? 'They' : 'You'}</span>
      <span class="node-label">${esc(n.label)}${tech ? ` <span class="node-tech">(${esc(tech.name)})</span>` : ''}</span>
      ${n.fromRoll ? '<span class="node-src" title="Added after it worked in a roll">Proven in a roll</span>' : ''}
      ${stat}${unanswered ? `<span class="node-flag">${testing.length ? 'Testing an answer' : 'No answer yet'}</span>` : ''}
      ${testing.length ? `<p class="node-test">Testing: ${testing.slice(0, 2).map(r => `“${esc(trunc(r.tryNext, 70))}”`).join(', ')}</p>` : ''}
      <span class="node-actions">
        ${n.who === 'me' ? `<button class="mini" data-act="add-node" data-seq="${seq.id}" data-parent="${n.id}" data-who="them">+ Their reaction</button>` : ''}
        <button class="mini" data-act="add-node" data-seq="${seq.id}" data-parent="${n.id}" data-who="me">+ ${n.who === 'them' ? 'Your answer' : 'Your next move'}</button>
        <button class="mini" data-act="edit-node" data-seq="${seq.id}" data-id="${n.id}">Edit</button>
        <button class="mini" data-act="log-node" data-seq="${seq.id}" data-id="${n.id}">Log a roll here</button>
      </span></div>${kids.length ? `<ul class="tree">${kids.map(nodeHtml).join('')}</ul>` : ''}</li>`
  }

  return head + `<div class="seq-layout">
    <div class="seq-list">${S.seq.map(s => {
      const n = S.roll.filter(r => r.seqId === s.id)
      return `<button class="seq-pick" data-act="pick-seq" data-id="${s.id}" aria-current="${s.id === seq.id}"><strong>${esc(s.name)}</strong><span>${posRole(s.position, s.role)}${n.length ? `, ${pct(rate(n))} over ${plural(n.length, 'roll')}` : ''}</span></button>`
    }).join('')}</div>
    <section class="seq-main">
      <div class="seq-head"><div><h2>${esc(seq.name)}</h2>
        <p class="muted small">${posRole(seq.position, seq.role)}${rolls.length ? `. ${plural(rolls.length, 'roll')} logged, ${pct(rate(rolls))} success` : '. No rolls logged against it yet'}</p>
        ${seq.notes ? `<p class="small" style="margin-top:6px">${esc(seq.notes)}</p>` : ''}</div>
        <div class="head-actions"><button class="btn sm ghost" data-act="edit-seq" data-id="${seq.id}">Edit sequence</button></div></div>
      <div class="legend"><span><span class="who me">You</span> your move</span><span><span class="who them">They</span> their reaction</span><span><span class="node-stat bad">0 of 2 worked</span> results from your rolls</span></div>
      <div class="tree-wrap">${children(null).length ? `<ul class="tree">${children(null).map(nodeHtml).join('')}</ul>` : `<button class="btn sm" data-act="add-node" data-seq="${seq.id}" data-parent="" data-who="me">Add your first move</button>`}</div>
    </section></div>`
}

function seqForm(id) {
  const s = id ? seqById(id) : { name: '', position: 'Half guard', role: 'Top', notes: '', nodes: [] }
  if (!s) return
  openSheet(id ? 'Edit sequence' : 'New sequence', `
    ${field('Name', `<input type="text" name="name" id="q-name" value="${esc(s.name)}" placeholder="Knee cut series" required>`)}
    <div class="grid2">${field('Starting position', selectEl('position', POSITIONS, s.position))}${field('Your role', selectEl('role', ROLES, s.role))}</div>
    ${id ? '' : field('Your first move', techSelect('firstTech', '', { empty: 'Pick from the library (optional)' })) + field('Or describe it', `<input type="text" name="first" id="q-first" placeholder="Knee cut with crossface and underhook">`)}
    ${field('Notes', `<textarea name="notes" id="q-notes" rows="2" placeholder="Key details, grips, when to use it">${esc(s.notes)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Create sequence',
    onDelete: id ? () => { remove(s); UI.seqSel = null } : null,
    onSubmit: fd => {
      const name = fd.get('name').trim()
      if (!name) { $('#form-error').textContent = 'Give the sequence a name.'; return false }
      const rec = { ...(id ? s : {}), id: id || newId('seq'), kind: 'seq', name, position: fd.get('position'), role: fd.get('role'), notes: fd.get('notes').trim(), nodes: id ? s.nodes : [] }
      if (!id) {
        const techId = fd.get('firstTech'), label = (fd.get('first') || '').trim() || techById(techId)?.name
        if (label) rec.nodes = [{ id: newId('n'), parentId: null, who: 'me', label, techId, note: '' }]
      }
      UI.seqSel = rec.id
      save(rec)
    },
  })
}

function nodeForm(seqId, nodeId, parentId, who) {
  const seq = seqById(seqId)
  if (!seq) return
  const n = nodeId ? seq.nodes.find(x => x.id === nodeId) : { label: '', who: who || 'me', techId: '', note: '', parentId: parentId || null }
  if (!n) return
  const parent = seq.nodes.find(x => x.id === (nodeId ? n.parentId : parentId))
  const title = nodeId ? 'Edit step' : n.who === 'them' ? 'Add their reaction' : parent?.who === 'them' ? 'Add your answer' : 'Add your move'
  openSheet(title, `
    ${parent ? `<p class="hint">After: ${parent.who === 'them' ? 'They ' : 'You: '}${esc(parent.label)}</p>` : ''}
    <fieldset><legend>Whose move</legend><div class="chips">
      <label class="chip"><input type="radio" name="who" value="me" ${n.who !== 'them' ? 'checked' : ''}><span>Yours</span></label>
      <label class="chip"><input type="radio" name="who" value="them" ${n.who === 'them' ? 'checked' : ''}><span>Their reaction</span></label></div></fieldset>
    ${field('Move from the library', techSelect('techId', n.techId, { empty: 'None' }))}
    ${field('What happens', `<input type="text" name="label" id="n-label" value="${esc(n.label)}" placeholder="${n.who === 'them' ? 'Frames on my hip and blocks the knee' : 'Leave blank to use the move’s name'}">`)}
    ${field('Notes', `<textarea name="note" id="n-note" rows="2" placeholder="Cues, grips, timing">${esc(n.note)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: nodeId ? 'Save step' : 'Add step',
    deleteLabel: 'Delete step and what follows',
    onDelete: nodeId ? () => {
      const doomed = new Set([nodeId])
      let grew = true
      while (grew) { grew = false; seq.nodes.forEach(x => { if (x.parentId && doomed.has(x.parentId) && !doomed.has(x.id)) { doomed.add(x.id); grew = true } }) }
      save({ ...seq, nodes: seq.nodes.filter(x => !doomed.has(x.id)) })
    } : null,
    onSubmit: fd => {
      const techId = fd.get('techId'), label = fd.get('label').trim() || techById(techId)?.name || ''
      if (!label) { $('#form-error').textContent = 'Pick a move or describe what happens.'; return false }
      const node = { ...n, id: nodeId || newId('n'), parentId: nodeId ? n.parentId : (parentId || null), who: fd.get('who'), label, techId, note: fd.get('note').trim() }
      save({ ...seq, nodes: nodeId ? seq.nodes.map(x => x.id === nodeId ? node : x) : [...seq.nodes, node] })
    },
  })
}

export const actions = {
  'new-seq': () => seqForm(),
  'edit-seq': el => seqForm(el.dataset.id),
  'pick-seq': el => { UI.seqSel = el.dataset.id },
  'open-seq': el => { UI.seqSel = el.dataset.id; UI.view = 'sequences'; scrollTo(0, 0) },
  'add-node': el => nodeForm(el.dataset.seq, null, el.dataset.parent || null, el.dataset.who),
  'edit-node': el => nodeForm(el.dataset.seq, el.dataset.id),
}
