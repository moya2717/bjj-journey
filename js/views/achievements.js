import { S, save, remove } from '../store.js'
import { POSITIONS, ROLES } from '../vocab.js'
import { $, esc, fmtDate, newId, today } from '../util.js'
import { field, selectEl, techSelect, openSheet } from '../sheet.js'
import { computeAchievements, goalDesc, goalStatus, goalWindow, METRICS, progressOf, visibleAchievements } from '../achievements.js'

const SECTIONS = ['Mat time', 'Drills and reps', 'Rolling', 'Techniques', 'Study', 'Cross-training', 'Competition and rank', 'Journal habits']

// The badge face shows the number you're chasing, styled like a belt with its bar.
const markText = a => typeof a.target === 'number' ? (a.target >= 1000 ? a.target / 1000 + 'k' : a.target) : a.target.slice(0, 2)

function badge(a) {
  const p = progressOf(a)
  return `<div class="ach ${a.unlockedOn ? 'won' : ''}">
    <span class="ach-mark" aria-hidden="true">${esc(markText(a))}</span>
    <span class="ach-title">${esc(a.title)}</span>
    <span class="ach-desc">${esc(a.desc)}</span>
    ${a.unlockedOn
      ? `<span class="ach-when">Unlocked ${fmtDate(a.unlockedOn)}</span>`
      : `<span><span class="meter mat" role="img" aria-label="${Math.round(p * 100)}% of the way"><span style="width:${Math.max(2, p * 100)}%"></span></span><span class="ach-desc">${typeof a.target === 'number' ? `${Math.floor(a.total).toLocaleString()} of ${a.target.toLocaleString()}` : 'Not yet'}</span></span>`}
  </div>`
}

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

export function view() {
  const all = computeAchievements(), shown = visibleAchievements(all)
  const unlocked = all.filter(a => a.unlockedOn)
  const upNext = all.filter(a => !a.unlockedOn && progressOf(a) > 0).sort((a, b) => progressOf(b) - progressOf(a)).slice(0, 4)
  const challenges = [...S.goal].sort((a, b) => (goalStatus(a).state === 'done') - (goalStatus(b).state === 'done') || goalWindow(b)[0].localeCompare(goalWindow(a)[0]))
  return `<div class="page-head"><div><h1>Achievements</h1><p class="lede">Milestones unlock on their own as you log training, reps, rolls and tournaments. Set your own challenges to stay on track.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-goal">New challenge</button></div></div>
    <div class="ach-count figures">
      <div class="figure"><div class="big">${unlocked.length}</div><div class="lbl">unlocked</div></div>
      <div class="figure"><div class="big">${S.goal.filter(g => goalStatus(g).state === 'done').length} / ${S.goal.length}</div><div class="lbl">challenges complete</div></div>
    </div>
    ${upNext.length ? `<section class="ach-section"><h2>Almost there</h2><div class="ach-grid">${upNext.map(badge).join('')}</div></section>` : ''}
    <section class="ach-section"><h2>My challenges</h2>
      ${challenges.length ? `<div class="ach-grid">${challenges.map(challengeCard).join('')}</div>` : `<div class="empty-state"><h2>Set a challenge</h2><p>Pick something you can count: 500 shrimps this month, 10 successful knee cuts, 12 sessions. Progress fills in from what you log.</p><button class="btn" data-act="new-goal">New challenge</button></div>`}
    </section>
    ${SECTIONS.map(sec => {
      const list = shown.filter(a => a.section === sec)
      return list.length ? `<section class="ach-section"><h2>${sec}</h2><div class="ach-grid">${list.map(badge).join('')}</div></section>` : ''
    }).join('')}
    ${!shown.some(a => a.section === 'Techniques') ? '<p class="muted small">Technique milestones appear once you drill or land a move.</p>' : ''}`
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
