// The quiz lives inside the Sequences tab: setup, one question at a time, then results.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { esc, fmtDate, plural, today } from '../util.js'
import { selectEl } from '../sheet.js'
import { buildQuiz, quizTopics } from '../quiz.js'

const LENGTHS = [5, 10, 20]

export function quizView() {
  const q = UI.quiz
  return `<section class="panel quiz">${q.phase === 'setup' ? setup() : q.phase === 'play' ? play() : results()}</section>`
}

function setup() {
  const log = S.settings.quizLog || [], last = log[log.length - 1]
  const best = log.reduce((b, r) => Math.max(b, r.score / r.total), 0)
  return `<div class="quiz-head"><h2>Quiz</h2><button class="btn sm ghost" data-act="quiz-exit">Back to sequences</button></div>
    <p class="lede">Multiple-choice questions from your sequences, the game maps and the move library. Questions you miss come back more often.</p>
    <label class="field" style="margin-top:14px"><span class="field-label">Topic</span>${selectEl('', quizTopics().map(t => ({ value: t.id, label: t.label })), UI.quiz.topic, 'id="quiz-topic"')}</label>
    <div style="margin-top:12px"><span class="field-label">Questions</span>
      <div class="seg" role="group" aria-label="Number of questions" style="margin-top:6px">${LENGTHS.map(n => `<button data-act="quiz-length" data-n="${n}" aria-pressed="${UI.quiz.length === n}">${n}</button>`).join('')}</div></div>
    ${UI.quiz.note ? `<p class="form-error" style="margin-top:12px">${esc(UI.quiz.note)}</p>` : ''}
    <div class="row-actions" style="margin-top:16px"><button class="btn" data-act="quiz-start">Start quiz</button></div>
    ${log.length ? `<p class="small muted" style="margin-top:14px">${plural(log.length, 'quiz', 'quizzes')} played · best ${Math.round(best * 100)}% · last ${last.score}/${last.total} on ${fmtDate(last.date)}</p>` : ''}`
}

function play() {
  const q = UI.quiz, item = q.questions[q.i], answered = q.picked != null
  const last = q.i === q.questions.length - 1
  return `<div class="quiz-head"><span class="small muted">Question ${q.i + 1} of ${q.questions.length} · Score ${q.score}</span><button class="btn sm ghost" data-act="quiz-exit">Quit</button></div>
    <div class="meter mat quiz-progress"><span style="width:${(q.i + (answered ? 1 : 0)) / q.questions.length * 100}%"></span></div>
    <p class="tag pos quiz-context">${esc(item.context)}</p>
    <h2 class="quiz-prompt">${esc(item.prompt)}</h2>
    <div class="quiz-options">${item.options.map((o, i) => {
      const state = !answered ? '' : i === item.answer ? 'right' : i === q.picked ? 'wrong' : 'dim'
      return `<button class="quiz-opt ${state}" data-act="quiz-answer" data-i="${i}" ${answered ? 'disabled' : ''}>
        <span>${esc(o.text)}</span>${o.sub ? `<span class="small muted">${esc(o.sub)}</span>` : ''}</button>`
    }).join('')}</div>
    ${answered ? `<div class="quiz-explain ${q.picked === item.answer ? 'right' : 'wrong'}">
        <strong>${q.picked === item.answer ? 'Correct.' : 'Not quite.'}</strong> ${esc(item.explain)}</div>
      <div class="row-actions"><button class="btn" data-act="quiz-next">${last ? 'See results' : 'Next question'}</button></div>` : ''}`
}

function results() {
  const q = UI.quiz, ratio = q.score / q.questions.length
  const verdict = ratio === 1 ? 'Perfect round.' : ratio >= 0.8 ? 'Sharp. You know these.' : ratio >= 0.5 ? 'Solid base. Drill the ones you missed.' : 'Worth another pass. Study the missed branches below.'
  return `<div class="quiz-head"><h2>Results</h2></div>
    <div class="figures"><div class="figure"><div class="big">${q.score}/${q.questions.length}</div><div class="lbl">${Math.round(ratio * 100)}% correct</div></div></div>
    <p class="verdict ${ratio >= 0.8 ? 'up' : ratio >= 0.5 ? 'flat' : 'down'}">${verdict}</p>
    ${q.missed.length ? `<h3 style="margin-top:16px">Review</h3><ul class="list">${q.missed.map(m => `<li><p>${esc(m.prompt)}</p><p class="small"><strong>Answer:</strong> ${esc(m.options[m.answer].text)}</p><p class="small muted">${esc(m.explain)}</p></li>`).join('')}</ul>` : ''}
    <div class="row-actions" style="margin-top:14px"><button class="btn" data-act="quiz-start">Play again</button><button class="btn ghost" data-act="quiz-open">Change topic</button><button class="btn ghost" data-act="quiz-exit">Back to sequences</button></div>`
}

export function mountQuiz(root) {
  root.querySelector('#quiz-topic')?.addEventListener('change', e => { UI.quiz.topic = e.target.value })
}

export const quizActions = {
  'quiz-open': () => { UI.quiz = { phase: 'setup', topic: UI.quiz?.topic || 'all', length: UI.quiz?.length || 10 }; scrollTo(0, 0) },
  'quiz-exit': () => { UI.quiz = null },
  'quiz-length': el => { UI.quiz.length = +el.dataset.n },
  'quiz-start': () => {
    const questions = buildQuiz(UI.quiz.topic, UI.quiz.length)
    if (!questions.length) { UI.quiz.note = 'No questions for this topic yet. Add reactions and answers to the sequence, or pick another topic.'; return }
    Object.assign(UI.quiz, { note: '', phase: 'play', questions, i: 0, picked: null, score: 0, missed: [] })
    scrollTo(0, 0)
  },
  'quiz-answer': el => {
    const q = UI.quiz, item = q.questions[q.i]
    if (q.picked != null) return false
    q.picked = +el.dataset.i
    const misses = { ...(S.settings.quizMisses || {}) }
    if (q.picked === item.answer) { q.score++; if (misses[item.key]) misses[item.key]-- }
    else { q.missed.push(item); misses[item.key] = (misses[item.key] || 0) + 1 }
    save({ ...S.settings, quizMisses: misses })
  },
  'quiz-next': () => {
    const q = UI.quiz
    if (q.i < q.questions.length - 1) { q.i++; q.picked = null; return }
    q.phase = 'done'
    const log = [...(S.settings.quizLog || []), { date: today(), topic: q.topic, score: q.score, total: q.questions.length }].slice(-200)
    save({ ...S.settings, quizLog: log })
    scrollTo(0, 0)
  },
}
