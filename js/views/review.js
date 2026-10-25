// Weekly review: the week filled in from your log, open coach questions, and one focus for next week.
import { S, save } from '../store.js'
import { $, esc, fmtDate, hrs, pct, plural, toast, today } from '../util.js'
import { field, openSheet } from '../sheet.js'
import { fmtDist } from '../load.js'
import { focusIdeas, openCoachQs, reviewWeek, todaysFocus, weekFocus, weekReview } from '../loop.js'

const figure = (big, lbl) => `<div class="figure"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`
const moveList = list => list.length ? `<ul class="list">${list.map(m => `<li class="move-line"><span>${esc(m.tech.name)}</span><span class="muted">× ${m.n}</span></li>`).join('')}</ul>` : '<p class="small muted">None logged this week.</p>'

export function view() {
  const w = weekReview(), done = S.settings.reviewedWeek === w.from
  return `<div class="page-head"><div><h1>Week in review</h1><p class="lede">${fmtDate(w.from)} – ${fmtDate(w.to)}${w.back ? '' : ', so far'}. Filled in from your log; finish by picking one focus for next week.</p></div></div>
  <div class="stat-grid">
    <section class="panel"><h2>Training</h2><div class="figures tight">
      ${figure(`${w.sessions}<small>/${w.target}</small>`, 'sessions vs target')}
      ${figure(hrs(w.minutes[0]), 'mat hours')}
      ${figure(w.ratio == null ? w.load : pct(w.ratio), w.ratio == null ? 'training load' : 'of your 4-week load')}
      ${figure(`${fmtDist(w.runs.dist)}<small> ${w.runs.unit}</small>`, plural(w.runs.n, 'run'))}
    </div>${w.ratio > 1.4 ? '<p class="small muted">Load was well above your average. Plan an easier start to next week.</p>' : ''}</section>
    <section class="panel"><h2>Rolls</h2>${w.rolls.n ? `<div class="figures tight">
      ${figure(w.rolls.worked, 'worked')}${figure(w.rolls.partial, 'partly')}${figure(w.rolls.broke, 'broke down')}</div>
      ${w.causes.length ? `<p class="sub">Top causes of breakdowns</p><div class="tags">${w.causes.map(([k, n]) => `<span class="tag bad">${esc(k)} · ${n}</span>`).join('')}</div>` : ''}`
      : '<p class="small muted">No rolls logged this week.</p>'}</section>
    <section class="panel"><h2>Moves</h2><div class="trend-grid">
      <div><p class="sub">Landed</p>${moveList(w.landed)}</div><div><p class="sub">Caught by</p>${moveList(w.caught)}</div></div></section>
    <section class="panel"><h2>Plan hit rate</h2>${w.plan.n
      ? `<div class="figures tight">${figure(pct(w.plan.hit / w.plan.n), `of ${plural(w.plan.n, 'planned session')} went to plan`)}</div><p class="small muted">Stuck to it counts 1, partly ½.</p>`
      : '<p class="small muted">No sessions with a plan and an answer this week. Pick one from Today’s focus on Home before class.</p>'}
      ${w.plan.unrated ? `<p class="small muted">${plural(w.plan.unrated, 'session')} had a plan but no answer to “Did you stick to it?”.</p>` : ''}</section>
    ${coachPanel()}
    ${focusPanel(done)}
  </div>`
}

function coachPanel() {
  const qs = openCoachQs()
  return `<section class="panel wide" id="coach-qs"><h2>Questions for your coach</h2>${qs.length ? `<ul class="list">${qs.map(s => `<li>
    <p>${esc(s.coachQ)}</p><p class="small muted">From ${fmtDate(s.date)}${s.coachAsked ? ' · asked, waiting on an answer' : ''}</p>
    <div class="row-actions">${s.coachAsked ? '' : `<button class="btn sm ghost" data-act="coach-asked" data-id="${s.id}">Asked it</button>`}<button class="btn sm ghost" data-act="coach-answer" data-id="${s.id}">Got an answer</button></div></li>`).join('')}</ul>`
    : '<p class="small muted">No open questions. Add one under “Think it through” when you log a session.</p>'}</section>`
}

let ideas = []
function focusPanel(done) {
  const current = weekFocus()
  ideas = focusIdeas().filter(f => f.text !== current?.text).slice(0, 4)
  return `<section class="panel wide" id="week-focus"><h2>Focus for next week</h2>
    ${current ? `<p class="small muted" style="margin-top:-6px">Current focus: <strong>${esc(current.text)}</strong>${done ? ' (set in this review)' : ''}</p>` : ''}
    ${ideas.length ? `<div class="focus-pick">${ideas.map((f, i) => `<label class="focus-opt"><input type="radio" name="wf" value="${i}" ${i === 0 && !done ? 'checked' : ''}><span><b>${esc(f.text)}</b><small>${esc(f.why)}</small></span></label>`).join('')}</div>` : ''}
    <label class="field" style="margin-top:10px"><span class="field-label">${ideas.length ? 'Or in your own words' : 'One thing to work on'}</span><input type="text" id="wf-own" placeholder="Win the grip fight before engaging"></label>
    <div class="row-actions"><button class="btn" data-act="set-week-focus">${done ? 'Change focus' : 'Save focus and finish review'}</button></div>
  </section>`
}

export function mount(root) {
  // Typing your own focus clears the picked idea, so it's clear which one gets saved.
  $('#wf-own', root)?.addEventListener('input', e => { if (e.target.value.trim()) root.querySelectorAll('[name=wf]').forEach(r => r.checked = false) })
}

export const actions = {
  'set-week-focus': () => {
    const own = $('#wf-own').value.trim(), pick = ideas[+document.querySelector('[name=wf]:checked')?.value]
    const f = own ? { text: own, techId: '', seqId: '' } : pick
    if (!f) { toast('Pick a focus or write your own.'); return false }
    save({ ...S.settings, weekFocus: { text: f.text, techId: f.techId || '', seqId: f.seqId || '', set: today() }, reviewedWeek: reviewWeek().from, reviewedWeeks: [...new Set([...(S.settings.reviewedWeeks || []), reviewWeek().from])] })
    toast('Focus saved. It’s on Home all week.')
  },
  // Pick something from Today's focus as the plan for your next session log.
  'plan-focus': el => {
    const f = todaysFocus()[+el.dataset.i]
    if (!f) return
    save({ ...S.settings, nextPlan: { text: f.text, techId: f.techId || '', seqId: f.seqId || '' } })
    toast('Planned. It’s filled in when you log your next session.')
  },
  'clear-plan': () => { save({ ...S.settings, nextPlan: null }) },
  'coach-answer': el => {
    const s = S.session.find(x => x.id === el.dataset.id)
    if (!s) return
    openSheet('Coach’s answer', `<p>${esc(s.coachQ)}</p>
      ${field('What they said (optional)', `<textarea name="answer" id="ca-text" rows="3" placeholder="The short version, so you remember it">${esc(s.coachA || '')}</textarea>`)}`, {
      submitLabel: 'Mark answered',
      onSubmit: fd => { save({ ...s, coachAsked: true, coachAnswered: true, coachA: fd.get('answer').trim() }); toast('Answer saved with the session') },
    })
    return false
  },
}
