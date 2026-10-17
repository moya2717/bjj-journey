import { S, save, saveMany, remove } from '../store.js'
import { UI } from '../ui.js'
import { ACTIVITY_TYPES, BELTS, FEELS, INTENSITIES, PLAN_HIT, POSITIONS, PROMPTS, REASONS, RESULTS, ROLES, SESSION_TYPES, SIZES, promptFor } from '../vocab.js'
import { $, $$, byDateDesc, esc, fmtDateLong, fmtTime, hrs, isoDate, monthLabel, newId, parseD, plural, posRole, shiftMonth, sum, toast, today, weekStart, ym } from '../util.js'
import { field, selectEl, chipsEl, radioChips, techPicker, techSelect, openSheet } from '../sheet.js'
import { partnerProfile, seqById, techById } from '../model.js'
import { heatLevel } from '../charts.js'
import { addPhotos, removePhotos, hydratePhotos, photoURL } from '../photos.js'
import { partnerDatalist, stepOptions } from './rolls.js'

// ---------- Calendar ----------

export function view() {
  return `<div class="page-head"><div><h1>Journal</h1><p class="lede">Every training day on the calendar. Tap a day to see or add what happened.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-session" data-date="${UI.calDay}">Log BJJ</button><button class="btn ghost" data-act="new-activity" data-date="${UI.calDay}">Log other activity</button></div></div>
    <div class="filters"><label class="field search"><span class="field-label">Search your notes</span><input type="search" id="journal-search" value="${esc(UI.journalQ)}" placeholder="Try “underhook” or “mount”"></label></div>
    <div id="journal-body">${UI.journalQ.trim() ? searchResults() : calendar() + dayPanel()}</div>`
}

export function mount(root) {
  $('#journal-search')?.addEventListener('input', e => {
    UI.journalQ = e.target.value
    $('#journal-body').innerHTML = UI.journalQ.trim() ? searchResults() : calendar() + dayPanel()
    hydratePhotos(root)
  })
  hydratePhotos(root)
}

function calendar() {
  const [y, m] = UI.calMonth.split('-').map(Number)
  const first = new Date(y, m - 1, 1), start = weekStart(first)
  const monthSessions = S.session.filter(s => s.date.startsWith(UI.calMonth))
  const photoCount = sum(monthSessions, s => (s.photos || []).length)
  const otherMinutes = sum(S.activity.filter(a => a.date.startsWith(UI.calMonth)), 'minutes')
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    if (i >= 35 && d.getMonth() !== m - 1) break
    cells.push(dayCell(d, d.getMonth() === m - 1))
  }
  return `<section class="panel">
    <div class="cal-head">
      <div class="month-nav"><button class="icon-btn" data-act="cal-month" data-d="-1" aria-label="Previous month">‹</button><h2>${monthLabel(UI.calMonth)}</h2><button class="icon-btn" data-act="cal-month" data-d="1" aria-label="Next month">›</button></div>
      <p class="cal-summary">${plural(monthSessions.length, 'session')} · ${hrs(sum(monthSessions, 'minutes'))} mat hrs${otherMinutes ? ` · ${hrs(otherMinutes)} hrs other` : ''}${photoCount ? ` · ${plural(photoCount, 'photo')}` : ''}${UI.calMonth !== ym(new Date()) ? ` · <button class="link" data-act="cal-today">Today</button>` : ''}</p>
    </div>
    <div class="cal" role="grid" aria-label="${monthLabel(UI.calMonth)}">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('')}
      ${cells.join('')}
    </div></section>`
}

function dayCell(d, inMonth) {
  if (!inMonth) return '<div class="cal-day out" aria-hidden="true"></div>'
  const key = isoDate(d)
  const sessions = S.session.filter(s => s.date === key), rolls = S.roll.filter(r => r.date === key)
  const activities = S.activity.filter(a => a.date === key)
  const photo = sessions.flatMap(s => s.photos || [])[0]
  const minutes = sum(sessions, 'minutes')
  const label = `${fmtDateLong(key)}: ${[sessions.length && plural(sessions.length, 'session') + `, ${minutes} min`, activities.length && plural(activities.length, 'other activity', 'other activities')].filter(Boolean).join(', ') || 'nothing logged'}`
  return `<button class="cal-day l${photo ? 0 : heatLevel(minutes)} ${key === today() ? 'today' : ''}" data-act="cal-day" data-date="${key}" aria-pressed="${key === UI.calDay}" aria-label="${esc(label)}">
    ${photo ? `<img data-photo="${photo}" alt="">` : ''}
    <span class="cal-n">${d.getDate()}</span>
    <span class="cal-dots">${sessions.map(() => '<i></i>').join('')}${activities.map(() => '<i class="act"></i>').join('')}${rolls.filter(r => r.result === 'broke').slice(0, 3).map(() => '<i class="broke"></i>').join('')}</span>
  </button>`
}

function dayPanel() {
  const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99')
  const sessions = S.session.filter(s => s.date === UI.calDay).sort(byTime)
  const activities = S.activity.filter(a => a.date === UI.calDay).sort(byTime)
  const looseRolls = S.roll.filter(r => r.date === UI.calDay && !sessions.some(s => s.id === r.sessionId))
  return `<div class="day-panel">
    <div class="day-head"><h2>${fmtDateLong(UI.calDay)}</h2><div class="head-actions"><button class="btn sm" data-act="new-session" data-date="${UI.calDay}">Log BJJ</button><button class="btn sm ghost" data-act="new-activity" data-date="${UI.calDay}">Log other activity</button></div></div>
    ${sessions.length || activities.length
      ? [...sessions.map(s => [s.time, entryCard(s)]), ...activities.map(a => [a.time, activityCard(a)])].sort((a, b) => (a[0] || '99').localeCompare(b[0] || '99')).map(x => x[1]).join('')
      : `<p class="muted">Nothing logged on this day.</p>`}
    ${looseRolls.length ? `<section class="panel"><h3>Roll notes</h3>${looseRolls.map(rollMini).join('')}</section>` : ''}
  </div>`
}

function searchResults() {
  const q = UI.journalQ.trim().toLowerCase()
  const text = s => [s.worked, s.struggled, s.lesson, s.plan, s.reflectA, s.coachQ, s.notes, s.type, (s.focus || []).join(' '), (s.drilled || []).map(id => techById(id)?.name).join(' ')].join(' ').toLowerCase()
  const hits = [...S.session].sort(byDateDesc).filter(s => text(s).includes(q))
  return hits.length ? `<div class="stack">${hits.map(entryCard).join('')}</div>` : `<p class="muted">No sessions mention “${esc(UI.journalQ)}”.</p>`
}

const rollMini = r => `<div class="roll-mini"><span>${posRole(r.position, r.role)} <span class="result ${esc(r.result)}">${esc(RESULTS[r.result]?.label || '')}</span></span><button class="mini" data-act="edit-roll" data-id="${r.id}">Edit</button></div>`

function entryCard(s) {
  const d = parseD(s.date), rolls = S.roll.filter(r => r.sessionId === s.id)
  const drilled = (s.drilled || []).map(techById).filter(Boolean)
  const reps = (s.reps || []).filter(r => r.count && techById(r.techId))
  const notes = [['Plan', s.plan ? s.plan + (s.planHit ? ` (${s.planHit.toLowerCase()})` : '') : ''], ['Felt', s.feel], ['Worked', s.worked], ['Went wrong', s.struggled], ['Lesson', s.lesson], ['Notes', s.notes]].filter(x => x[1])
  return `<article class="entry">
    <div class="date-block"><span class="d">${d.getDate()}</span><span class="m">${d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span></div>
    <div style="min-width:0">
      <div class="entry-top"><h3>${esc(s.type)}${s.time ? ` <span class="entry-time">${fmtTime(s.time)}</span>` : ''}</h3><span class="entry-meta">${s.minutes ? esc(s.minutes) + ' min' : ''}${s.rounds ? `, ${plural(+s.rounds, 'round')}` : ''}</span></div>
      ${(s.focus || []).length || drilled.length ? `<div class="tags">${(s.focus || []).map(p => `<span class="tag pos">${esc(p)}</span>`).join('')}${drilled.map(t => `<span class="tag">${esc(t.name)}</span>`).join('')}</div>` : ''}
      ${reps.length ? `<p class="small" style="margin-top:8px">Reps: ${reps.map(r => `${r.count} × ${esc(techById(r.techId).name.toLowerCase())}`).join(', ')}</p>` : ''}
      ${notes.length ? `<dl class="refl">${notes.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      ${s.reflectA ? `<p class="prompt-q">${esc(s.reflectQ)}</p><p class="small" style="max-width:70ch">${esc(s.reflectA)}</p>` : ''}
      ${s.coachQ ? `<p class="coach-q"><span class="tag pos">Ask coach</span> ${esc(s.coachQ)}${s.coachAsked ? ' <span class="small muted">(asked)</span>' : ''}</p>` : ''}
      ${(s.photos || []).length ? `<div class="photos">${s.photos.map(id => `<button data-act="view-photo" data-id="${id}" aria-label="Open photo"><img data-photo="${id}" alt="Training photo"></button>`).join('')}</div>` : ''}
      ${rolls.length ? `<div style="margin-top:10px">${rolls.map(rollMini).join('')}</div>` : ''}
      <div class="row-actions">
        <button class="btn sm ghost" data-act="new-roll" data-session="${s.id}">Add roll notes</button>
        <button class="btn sm ghost" data-act="edit-session" data-id="${s.id}">Edit</button>
      </div>
    </div></article>`
}

// ---------- Session form: the session, its drills, its rolls and photos on one screen ----------

function beforeFields(s) {
  return `${field('What did you plan to work on?', `<input type="text" name="plan" id="f-plan" value="${esc(s.plan || '')}" placeholder="Win the underhook before I cut">`)}
    <fieldset><legend>How did your body feel?</legend>${radioChips('feel', FEELS, s.feel || '')}</fieldset>`
}

function reflectionFields(s) {
  const question = s.reflectQ || promptFor(s.date || today())
  return `<fieldset><legend>Did you stick to your plan?</legend>${radioChips('planHit', PLAN_HIT, s.planHit || '')}</fieldset>
    ${field('What worked', `<textarea name="worked" id="f-worked" rows="2" placeholder="A position or moment where it clicked">${esc(s.worked || '')}</textarea>`)}
    ${field('What went wrong', `<textarea name="struggled" id="f-struggled" rows="2" placeholder="Where you got stuck, swept, passed or tapped">${esc(s.struggled || '')}</textarea>`)}
    <div class="prompt-box">
      <div class="prompt-head"><span class="small muted">Something to think about</span><button type="button" class="link small" data-new-prompt>Different question</button></div>
      <p class="q-text" data-prompt-text>${esc(question)}</p><input type="hidden" name="reflectQ" value="${esc(question)}">
      <textarea name="reflectA" id="f-reflect" rows="3" aria-label="Your answer" placeholder="Take a minute with this one">${esc(s.reflectA || '')}</textarea>
    </div>
    ${field('Lesson to keep', `<textarea name="lesson" id="f-lesson" rows="2" placeholder="One sentence you want to remember">${esc(s.lesson || '')}</textarea>`)}
    ${field('Question for your coach', `<input type="text" name="coachQ" id="f-coach" value="${esc(s.coachQ || '')}" placeholder="How do I stop the knee shield coming back?">`)}
    ${field('Other observations', `<textarea name="notes" id="f-notes" rows="4" placeholder="Anything else: injuries, what class covered, who you rolled with, ideas to try">${esc(s.notes || '')}</textarea>`)}`
}

function repRow(i, rep = { techId: 'c:shrimp', count: '' }) {
  return `<div class="rep-row" data-rep="${i}">${techSelect(`rep${i}_tech`, rep.techId, { empty: 'Pick a move', extra: 'aria-label="Move"' })}
    <input type="number" name="rep${i}_count" min="0" max="10000" inputmode="numeric" value="${esc(rep.count)}" placeholder="Reps" aria-label="Reps">
    <button type="button" class="mini" data-remove-row>Remove</button></div>`
}

function rollRow(i, preset) {
  const k = name => `r${i}_${name}`
  const seqOptions = [{ value: '', label: 'None' }, ...S.seq.map(s => ({ value: s.id, label: s.name }))]
  return `<div class="ql-roll" data-row="${i}">
    <div class="ql-roll-head"><h3 data-row-title>Roll</h3><button type="button" class="mini" data-remove-row>Remove</button></div>
    <div class="grid3">
      ${field('Partner', `<input type="text" name="${k('partner')}" list="partner-list" autocomplete="off" placeholder="Optional" data-partner>`)}
      ${field('Belt', selectEl(k('level'), BELTS, 'Blue'))}
      ${field('Size', selectEl(k('size'), [{ value: '', label: 'Not noted' }, ...SIZES], ''))}
    </div>
    <div class="grid2">${field('Position', selectEl(k('position'), POSITIONS, preset.position))}${field('Your role', selectEl(k('role'), ROLES, preset.role))}</div>
    <div class="grid2">${field('Sequence', selectEl(k('seqId'), seqOptions, preset.seqId, 'data-seq'))}${field('Step it reached', `<select name="${k('nodeId')}" data-node>${stepOptions(preset.seqId, '')}</select>`)}</div>
    <fieldset><legend>Result</legend><div class="chips">${Object.entries(RESULTS).map(([v, o]) => `<label class="chip r-${v}"><input type="radio" name="${k('result')}" value="${v}" data-result><span>${o.label}</span></label>`).join('')}</div></fieldset>
    <fieldset data-why hidden><legend>Why it went wrong</legend>${chipsEl(k('reasons'), REASONS, [])}</fieldset>
    ${field('What happened', `<textarea name="${k('what')}" rows="2" placeholder="Where it started and where it fell apart"></textarea>`)}
    ${field('Try next time', `<input type="text" name="${k('tryNext')}" placeholder="One thing to test">`)}
  </div>`
}

function sessionForm(id, date) {
  const last = [...S.session].sort(byDateDesc)[0] || { type: 'Gi', minutes: 90, rounds: 5 }
  const s = id ? S.session.find(x => x.id === id) : { date: date || today(), time: last.time || '', type: last.type, minutes: last.minutes, rounds: last.rounds, focus: [], drilled: [], reps: [], photos: [] }
  if (!s) return
  const lastRoll = [...S.roll].sort(byDateDesc)[0] || { position: 'Half guard', role: 'Top', seqId: '' }
  const rollPreset = { position: lastRoll.position, role: lastRoll.role, seqId: seqById(lastRoll.seqId) ? lastRoll.seqId : '' }
  const existingRolls = id ? S.roll.filter(r => r.sessionId === id) : []
  const keptPhotos = [...(s.photos || [])], newFiles = []
  let rows = 0

  openSheet(id ? 'Edit training' : 'Log training', `
    ${id ? '' : `<p class="hint">Running, lifting, yoga or recovery? <button type="button" class="link" data-act="new-activity" data-date="${esc(s.date)}">Log other activity</button></p>`}
    <div class="grid3">${field('Date', `<input type="date" name="date" id="s-date" value="${esc(s.date)}" required>`)}${field('Class time', `<input type="time" name="time" id="s-time" value="${esc(s.time || '')}">`)}${field('Class type', selectEl('type', SESSION_TYPES, s.type, 'id="s-type"'))}</div>
    <div class="grid2">
      ${field('Minutes on the mat', `<input type="number" name="minutes" id="s-min" min="0" max="600" step="5" inputmode="numeric" value="${esc(s.minutes)}">`)}
      ${field('Rounds rolled', `<input type="number" name="rounds" id="s-rounds" min="0" max="40" inputmode="numeric" value="${esc(s.rounds)}">`)}
    </div>
    ${beforeFields(s)}
    <details class="more" ${id && ((s.focus || []).length || (s.drilled || []).length) ? 'open' : ''}><summary>Class focus and moves drilled</summary><div>
      <fieldset><legend>Positions you focused on</legend>${chipsEl('focus', POSITIONS, s.focus || [])}</fieldset>
      <fieldset><legend>Moves you drilled</legend>${techPicker('drilled', s.drilled || [])}</fieldset>
    </div></details>
    <details class="more" ${(s.reps || []).length ? 'open' : ''}><summary>Drill reps (shrimps, bridges, stand-ups…)</summary><div>
      <div class="reps" id="s-reps">${(s.reps || []).map((r, i) => repRow(i, r)).join('')}</div>
      <div><button type="button" class="btn sm ghost" id="s-add-rep">+ Add reps</button></div>
    </div></details>
    <div><h3>Key exchanges</h3><p class="hint">One note per exchange that mattered. A roll without a result isn’t saved.</p></div>
    ${existingRolls.length ? `<div>${existingRolls.map(r => `<div class="roll-mini"><span>${posRole(r.position, r.role)} <span class="result ${esc(r.result)}">${esc(RESULTS[r.result]?.label || '')}</span></span></div>`).join('')}<p class="hint">Edit saved rolls from the journal.</p></div>` : ''}
    <div class="ql-rolls" id="s-rolls"></div>
    <div><button type="button" class="btn sm ghost" id="s-add-roll">+ Add a roll</button></div>
    <div><h3>Photos</h3><div class="photos" id="s-photos"></div>
      <label class="btn sm ghost file-btn" style="margin-top:10px">Add photos<input type="file" id="s-file" accept="image/*" multiple></label></div>
    <details class="more" open><summary>Reflection</summary><div>${reflectionFields(s)}</div></details>
    ${partnerDatalist()}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Save',
    onDelete: id ? () => { remove(s); removePhotos(s.photos || []); saveMany(existingRolls.map(r => ({ ...r, sessionId: '' }))) } : null,
    onMount: form => {
      const rollBox = $('#s-rolls', form), repBox = $('#s-reps', form), photoBox = $('#s-photos', form)
      const renumber = () => $$('[data-row-title]', rollBox).forEach((h, j) => h.textContent = 'Roll ' + (j + 1))
      const addRoll = preset => { rollBox.insertAdjacentHTML('beforeend', rollRow(rows++, preset)); renumber() }
      let reps = (s.reps || []).length

      $('#s-add-roll', form).addEventListener('click', () => {
        const prev = $$('[data-row]', rollBox).pop()
        const get = name => prev?.querySelector(`[name$="_${name}"]`)?.value
        addRoll(prev ? { position: get('position'), role: get('role'), seqId: get('seqId') } : rollPreset)
      })
      $('#s-add-rep', form).addEventListener('click', () => repBox.insertAdjacentHTML('beforeend', repRow(reps++)))
      form.addEventListener('click', e => {
        const removeBtn = e.target.closest('[data-remove-row]')
        if (removeBtn) { removeBtn.closest('[data-row],[data-rep]').remove(); renumber() }
        const dropPhoto = e.target.closest('[data-drop-photo]')
        if (dropPhoto) { const i = keptPhotos.indexOf(dropPhoto.dataset.dropPhoto); if (i >= 0) keptPhotos.splice(i, 1); dropPhoto.parentElement.remove() }
        const dropFile = e.target.closest('[data-drop-file]')
        if (dropFile) { newFiles[+dropFile.dataset.dropFile] = null; dropFile.parentElement.remove() }
      })
      rollBox.addEventListener('change', e => {
        const row = e.target.closest('[data-row]'), i = row?.dataset.row
        if (!row) return
        if (e.target.matches('[data-seq]')) {
          const seq = seqById(e.target.value)
          $('[data-node]', row).innerHTML = stepOptions(e.target.value, '')
          if (seq) { row.querySelector(`[name="r${i}_position"]`).value = seq.position; if (seq.role) row.querySelector(`[name="r${i}_role"]`).value = seq.role }
        }
        if (e.target.matches('[data-result]')) $('[data-why]', row).hidden = e.target.value === 'worked'
        if (e.target.matches('[data-partner]')) {
          const p = partnerProfile(e.target.value)
          if (p) { if (p.level) row.querySelector(`[name="r${i}_level"]`).value = p.level; row.querySelector(`[name="r${i}_size"]`).value = p.size || '' }
        }
      })
      $('[data-new-prompt]', form).addEventListener('click', () => {
        const next = PROMPTS[(PROMPTS.indexOf(form.elements.reflectQ.value) + 1) % PROMPTS.length]
        form.elements.reflectQ.value = next
        $('[data-prompt-text]', form).textContent = next
      })

      keptPhotos.forEach(async pid => photoBox.insertAdjacentHTML('beforeend', `<span class="photo-thumb"><img src="${await photoURL(pid)}" alt="Training photo"><button type="button" class="x" data-drop-photo="${pid}" aria-label="Remove photo">×</button></span>`))
      $('#s-file', form).addEventListener('change', e => {
        ;[...e.target.files].forEach(file => {
          const i = newFiles.push(file) - 1
          photoBox.insertAdjacentHTML('beforeend', `<span class="photo-thumb"><img src="${URL.createObjectURL(file)}" alt="New photo"><button type="button" class="x" data-drop-file="${i}" aria-label="Remove photo">×</button></span>`)
        })
        e.target.value = ''
      })
      if (!id) addRoll(rollPreset)
    },
    onSubmit: async (fd, form) => {
      const date = fd.get('date')
      if (!date) { $('#form-error').textContent = 'Add the date you trained.'; return false }
      const rows = $$('[data-row]', form)
      const typed = row => ['partner', 'what', 'tryNext'].some(n => (fd.get(`r${row.dataset.row}_${n}`) || '').trim())
      const missing = rows.findIndex(row => !fd.get(`r${row.dataset.row}_result`) && typed(row))
      if (missing >= 0) { $('#form-error').textContent = `Pick a result for roll ${missing + 1}, or remove it.`; return false }

      const added = await addPhotos(newFiles.filter(Boolean))
      const dropped = (s.photos || []).filter(p => !keptPhotos.includes(p))
      if (dropped.length) removePhotos(dropped)

      const answer = (fd.get('reflectA') || '').trim(), coachQ = fd.get('coachQ').trim()
      const sessionId = id || newId('session')
      const session = {
        ...(id ? s : {}), id: sessionId, kind: 'session', date, type: fd.get('type'),
        time: fd.get('time') || '', minutes: +fd.get('minutes') || 0, rounds: +fd.get('rounds') || 0,
        focus: fd.getAll('focus'), drilled: fd.getAll('drilled'),
        reps: $$('[data-rep]', form).map(r => ({ techId: fd.get(`rep${r.dataset.rep}_tech`), count: +fd.get(`rep${r.dataset.rep}_count`) || 0 })).filter(r => r.techId && r.count),
        photos: [...keptPhotos, ...added],
        plan: fd.get('plan').trim(), feel: fd.get('feel') || '', planHit: fd.get('planHit') || '',
        worked: fd.get('worked').trim(), struggled: fd.get('struggled').trim(), lesson: fd.get('lesson').trim(),
        reflectQ: answer ? fd.get('reflectQ') : '', reflectA: answer, notes: fd.get('notes').trim(),
        coachQ, coachAsked: coachQ && coachQ === s.coachQ ? !!s.coachAsked : false,
      }
      const rolls = rows.filter(row => fd.get(`r${row.dataset.row}_result`)).map((row, j) => {
        const g = name => fd.get(`r${row.dataset.row}_${name}`) || ''
        const partner = g('partner').trim(), seqId = g('seqId'), result = g('result'), tryNext = g('tryNext').trim()
        return {
          id: newId('roll'), kind: 'roll', date, sessionId, partner, level: g('level'), size: g('size'),
          styles: partnerProfile(partner)?.styles || [], position: g('position'), role: g('role'),
          seqId, nodeId: seqId ? g('nodeId') : '', techId: '', result,
          reasons: result === 'worked' ? [] : fd.getAll(`r${row.dataset.row}_reasons`),
          what: g('what').trim(), tryNext, tryStatus: tryNext ? 'open' : '', createdAt: Date.now() + j,
        }
      })
      UI.calDay = date
      UI.calMonth = date.slice(0, 7)
      saveMany([session, ...rolls])
      toast(rolls.length ? `Training and ${plural(rolls.length, 'roll')} saved` : 'Training saved')
    },
  })
}

// ---------- Other activities: running, lifting, yoga, recovery ----------

function activityCard(a) {
  const d = parseD(a.date)
  return `<article class="entry activity">
    <div class="date-block"><span class="d">${d.getDate()}</span><span class="m">${d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span></div>
    <div style="min-width:0">
      <div class="entry-top"><h3>${esc(a.type)}${a.time ? ` <span class="entry-time">${fmtTime(a.time)}</span>` : ''}</h3>
        <span class="entry-meta">${[a.minutes && a.minutes + ' min', a.distance && `${a.distance} ${a.unit || 'mi'}`, a.intensity].filter(Boolean).map(esc).join(', ')}</span></div>
      ${a.notes ? `<p class="small" style="margin-top:6px;max-width:70ch">${esc(a.notes)}</p>` : ''}
      <div class="row-actions"><button class="btn sm ghost" data-act="edit-activity" data-id="${a.id}">Edit</button></div>
    </div></article>`
}

const DISTANCE_TYPES = ['Running', 'Cycling', 'Swimming']

function activityForm(id, date) {
  const last = [...S.activity].sort(byDateDesc)[0]
  const a = id ? S.activity.find(x => x.id === id) : { date: date || today(), time: '', type: last?.type || 'Running', minutes: 30, distance: '', unit: last?.unit || 'mi', intensity: 'Moderate', notes: '' }
  if (!a) return
  openSheet(id ? 'Edit activity' : 'Log other activity', `
    <p class="hint">Training outside BJJ. It shows on your calendar and in Stats, but doesn’t count toward mat hours.</p>
    <fieldset><legend>Activity</legend>${radioChips('type', ACTIVITY_TYPES, a.type)}</fieldset>
    <div class="grid3">
      ${field('Date', `<input type="date" name="date" id="a-date" value="${esc(a.date)}" required>`)}
      ${field('Time', `<input type="time" name="time" id="a-time" value="${esc(a.time)}">`)}
      ${field('Minutes', `<input type="number" name="minutes" id="a-min" min="0" max="1440" step="5" inputmode="numeric" value="${esc(a.minutes)}">`)}
    </div>
    <div class="grid2" data-distance ${DISTANCE_TYPES.includes(a.type) ? '' : 'hidden'}>
      ${field('Distance', `<input type="number" name="distance" id="a-dist" min="0" step="0.1" inputmode="decimal" value="${esc(a.distance)}">`)}
      ${field('Unit', selectEl('unit', ['mi', 'km'], a.unit, 'id="a-unit"'))}
    </div>
    <fieldset><legend>Intensity</legend>${radioChips('intensity', INTENSITIES, a.intensity)}</fieldset>
    ${field('Notes', `<textarea name="notes" id="a-notes" rows="3" placeholder="What you did, how you felt, how it carried over to the mat">${esc(a.notes)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Save activity',
    onDelete: id ? () => remove(a) : null,
    onMount: form => form.addEventListener('change', e => {
      if (e.target.name === 'type') $('[data-distance]', form).hidden = !DISTANCE_TYPES.includes(e.target.value)
    }),
    onSubmit: fd => {
      const date = fd.get('date')
      if (!date) { $('#form-error').textContent = 'Add the date.'; return false }
      const type = fd.get('type') || 'Other sport'
      UI.calDay = date
      UI.calMonth = date.slice(0, 7)
      save({
        ...(id ? a : {}), id: id || newId('activity'), kind: 'activity', date, time: fd.get('time') || '', type,
        minutes: +fd.get('minutes') || 0, distance: DISTANCE_TYPES.includes(type) ? +fd.get('distance') || '' : '', unit: fd.get('unit'),
        intensity: fd.get('intensity') || '', notes: fd.get('notes').trim(),
      })
      toast(id ? 'Activity saved' : `${type} logged`)
    },
  })
}

export const actions = {
  'new-activity': el => activityForm(null, el.dataset.date),
  'edit-activity': el => activityForm(el.dataset.id),
  'new-session': el => sessionForm(null, el.dataset.date),
  'edit-session': el => sessionForm(el.dataset.id),
  'cal-month': el => { UI.calMonth = shiftMonth(UI.calMonth, +el.dataset.d) },
  'cal-today': () => { UI.calMonth = ym(new Date()); UI.calDay = today() },
  'cal-day': el => { UI.calDay = el.dataset.date },
  'view-photo': async el => openSheet('Photo', `<img class="photo-full" src="${await photoURL(el.dataset.id)}" alt="Training photo">`),
  'coach-asked': el => { const s = S.session.find(x => x.id === el.dataset.id); if (s) { saveMany([{ ...s, coachAsked: true }]); toast('Marked as asked') } },
}
