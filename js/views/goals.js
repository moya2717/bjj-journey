// Your challenges on Profile: each one a card with its progress, plus the form to set one.
import { S, save, remove } from '../store.js'
import { POSITIONS, ROLES } from '../vocab.js'
import { $, esc, fmtDate, newId, today } from '../util.js'
import { field, selectEl, techSelect, openSheet } from '../sheet.js'
import { more } from './hub.js'
import { METRICS, goalDesc, goalStatus, goalWindow } from '../goals.js'

function challengeCard(g) {
  const st = goalStatus(g), [from, until] = goalWindow(g), p = Math.min(1, st.value / (+g.target || 1))
  return `<div class="ach ${st.state === 'done' ? 'won' : ''}">
    <span class="ach-mark" aria-hidden="true">${esc(String(g.target).length > 4 ? '★' : g.target)}</span>
    <span class="ach-title">${esc(g.title)}</span>
    <span class="ach-desc">${esc(goalDesc(g))} · ${fmtDate(from)}${until ? ` to ${fmtDate(until)}` : ' onward'} · <span class="pace ${st.state}">${st.label}</span></span>
    <span><span class="meter ${st.state === 'done' || st.state === 'on' ? 'good' : 'mat'}"><span style="width:${Math.max(2, p * 100)}%"></span></span>
      <span class="row-actions" style="margin-top:4px;align-items:center"><span class="ach-desc">${st.value} of ${esc(g.target)}</span>
      ${g.metric === 'manual' ? `<button class="mini" data-act="goal-step" data-id="${g.id}" data-d="-1" aria-label="Subtract one">−1</button><button class="mini" data-act="goal-step" data-id="${g.id}" data-d="1" aria-label="Add one">+1</button>` : ''}
      <button class="mini" data-act="edit-goal" data-id="${g.id}">Edit</button></span></span>
  </div>`
}

// Open challenges first, newest first.
const sortedGoals = () => [...S.goal].sort((a, b) => (goalStatus(a).state === 'done') - (goalStatus(b).state === 'done') || goalWindow(b)[0].localeCompare(goalWindow(a)[0]))

export function goalsPanel() {
  const list = sortedGoals()
  return `<section class="panel wide" id="goals"><div class="history-head"><h2>Challenges</h2><button class="btn sm" data-act="new-goal">New challenge</button></div>
    ${list.length ? `<div class="ach-grid">${more('goals', list, 5, challengeCard)}</div>`
      : '<p class="muted">Pick something you can count: 500 shrimps this month, 10 successful knee cuts, 12 sessions. Progress fills in from what you log.</p>'}</section>`
}

function goalForm(id) {
  const g = id ? S.goal.find(x => x.id === id) : { title: '', metric: 'reps', target: 500, techId: 'c:shrimp', position: '', role: '', from: today(), until: '', manual: 0 }
  if (!g) return
  const [from, until] = goalWindow(g)
  openSheet(id ? 'Edit challenge' : 'New challenge', `
    ${field('Challenge', `<input type="text" name="title" id="g-title" value="${esc(g.title)}" placeholder="500 shrimps this month" required>`)}
    ${field('How progress is counted', selectEl('metric', Object.entries(METRICS).map(([value, label]) => ({ value, label })), g.metric, 'id="g-metric"'))}
    <div data-for="reps rollsWorked drilled">${field('Move', techSelect('techId', g.techId, { empty: 'Any move' }))}</div>
    <div class="grid2" data-for="rollsWorked">${field('Position', selectEl('position', [{ value: '', label: 'Any position' }, ...POSITIONS], g.position))}${field('Your role', selectEl('role', [{ value: '', label: 'Any role' }, ...ROLES], g.role))}</div>
    <div class="grid3">
      ${field('Target', `<input type="number" name="target" id="g-target" min="1" max="100000" step="any" inputmode="decimal" value="${esc(g.target)}">`)}
      ${field('Counting from', `<input type="date" name="from" id="g-from" value="${esc(from)}">`)}
      ${field('Deadline (optional)', `<input type="date" name="until" id="g-until" value="${esc(until)}">`)}
    </div>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Start challenge',
    onDelete: id ? () => remove(g) : null,
    onMount: form => {
      const sync = () => form.querySelectorAll('[data-for]').forEach(el => el.hidden = !el.dataset.for.split(' ').includes(form.elements.metric.value))
      form.elements.metric.addEventListener('change', sync)
      sync()
    },
    onSubmit: fd => {
      const title = fd.get('title').trim(), metric = fd.get('metric')
      if (!title) { $('#form-error').textContent = 'Name the challenge.'; return false }
      if ((metric === 'reps' || metric === 'drilled') && !fd.get('techId')) { $('#form-error').textContent = 'Pick the move to count.'; return false }
      const until = fd.get('until') || ''
      if (until && until < fd.get('from')) { $('#form-error').textContent = 'The deadline is before the start date.'; return false }
      const rec = { ...(id ? g : {}), id: id || newId('goal'), kind: 'goal', title, metric, target: Math.max(1, +fd.get('target') || 1), techId: fd.get('techId') || '', position: fd.get('position') || '', role: fd.get('role') || '', from: fd.get('from') || today(), until, manual: g.manual || 0 }
      delete rec.month
      save(rec)
    },
  })
}

export const actions = {
  'new-goal': () => goalForm(),
  'edit-goal': el => goalForm(el.dataset.id),
  'goal-step': el => { const g = S.goal.find(x => x.id === el.dataset.id); if (g) save({ ...g, manual: Math.max(0, (+g.manual || 0) + (+el.dataset.d)) }) },
}
