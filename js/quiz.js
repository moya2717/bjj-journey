// Multiple-choice questions built from your sequences, the game maps and the move library.
// Nothing here is hand-written per question: every tree and every move becomes questions.

import { S } from './store.js'
import { CATALOG } from './catalog.js'
import { GAME_MAPS } from './maps.js'
import { techById } from './model.js'
import { cap } from './util.js'

const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const pick = list => list[Math.floor(Math.random() * list.length)]

export function quizTopics() {
  return [
    { id: 'all', label: 'Everything' },
    ...(S.seq.length ? [{ id: 'mine', label: 'My sequences' }] : []),
    { id: 'maps', label: 'All game maps' },
    { id: 'library', label: 'Moves and positions' },
    ...S.seq.map(s => ({ id: 'seq:' + s.id, label: 'Sequence: ' + s.name })),
    ...GAME_MAPS.filter(m => !S.seq.some(s => s.fromMap === m.id)).map(m => ({ id: 'map:' + m.id, label: 'Map: ' + m.name })),
  ]
}

// A tree is anything with nodes: your sequences, or a game map you haven't copied yet.
function treesFor(topic) {
  const mine = S.seq.map(s => ({ ref: 'seq:' + s.id, name: s.name, position: s.position, role: s.role, nodes: s.nodes }))
  const maps = GAME_MAPS.filter(m => !S.seq.some(s => s.fromMap === m.id)).map(m => ({ ref: 'map:' + m.id, name: m.name, position: m.position, role: m.role, nodes: m.nodes }))
  if (topic === 'mine') return mine
  if (topic === 'maps') return maps
  if (topic === 'library') return []
  if (topic === 'all') return [...mine, ...maps]
  return [...mine, ...maps].filter(t => t.ref === topic)
}

const optionFor = node => {
  const tech = techById(node.techId)
  return { text: node.label, sub: tech && tech.name.toLowerCase() !== node.label.toLowerCase() ? tech.name : '' }
}

const pathOf = (tree, node) => {
  const out = []
  let n = node, guard = 0
  while (n && guard++ < 40) { out.unshift((n.who === 'them' ? 'They: ' : '') + n.label); n = tree.nodes.find(x => x.id === n.parentId) }
  return out.join(' → ')
}

const ancestors = (tree, node) => {
  const out = []
  let n = tree.nodes.find(x => x.id === node.parentId), guard = 0
  while (n && guard++ < 40) { out.push(n); n = tree.nodes.find(x => x.id === n.parentId) }
  return out
}

const lower = s => s.charAt(0).toLowerCase() + s.slice(1)

// Builds a question with one right answer and up to three wrong ones drawn from `pool`.
function question({ key, context, prompt, right, wrongPool, explain }) {
  const taken = new Set([right.text.toLowerCase()])
  const wrong = shuffle(wrongPool).filter(o => !taken.has(o.text.toLowerCase()) && taken.add(o.text.toLowerCase())).slice(0, 3)
  if (wrong.length < 2) return null
  const options = shuffle([right, ...wrong])
  return { key, context, prompt, options, answer: options.indexOf(right), explain }
}

function treeQuestions(trees) {
  const all = [...trees, ...treesFor('all')]
  const myMoves = all.flatMap(t => t.nodes.filter(n => n.who === 'me').map(n => ({ ...optionFor(n), position: t.position })))
  const reactions = all.flatMap(t => t.nodes.filter(n => n.who === 'them').map(n => ({ text: cap(n.label), sub: '', position: t.position })))
  const out = []
  trees.forEach(tree => tree.nodes.forEach(node => {
    const kids = tree.nodes.filter(c => c.parentId === node.id)
    const parent = tree.nodes.find(p => p.id === node.parentId)
    const context = `${tree.name} · ${tree.position}${tree.role && tree.role !== 'Neutral' ? ', ' + tree.role.toLowerCase() : ''}`

    // They react; what's your answer?
    const answers = kids.filter(k => k.who === 'me')
    if (node.who === 'them' && answers.length) {
      const right = answers[Math.floor(Math.random() * answers.length)]
      // Wrong answers never include the right ones or the moves already in the question.
      const siblings = new Set([...answers, ...ancestors(tree, node)].map(a => a.label.toLowerCase()))
      const pool = myMoves.filter(o => !siblings.has(o.text.toLowerCase()))
      const samePosition = pool.filter(o => o.position === tree.position)
      out.push(question({
        key: `${tree.ref}:${node.id}:answer`, context,
        prompt: `${parent ? `You go for “${parent.label}”. ` : ''}Your partner ${lower(node.label)}. What’s your best answer?`,
        right: optionFor(right), wrongPool: samePosition.length >= 3 ? samePosition : pool,
        explain: pathOf(tree, right),
      }))
    }

    // You attack; how do partners usually react?
    const reacts = kids.filter(k => k.who === 'them')
    if (node.who === 'me' && reacts.length) {
      const right = reacts[Math.floor(Math.random() * reacts.length)]
      const siblings = new Set(reacts.map(r => r.label.toLowerCase()))
      out.push(question({
        key: `${tree.ref}:${node.id}:react`, context,
        prompt: `You go for “${node.label}”. Which of these is a reaction you should expect?`,
        right: { text: cap(right.label), sub: '' }, wrongPool: reactions.filter(o => !siblings.has(o.text.toLowerCase())),
        explain: `In this map, partners react by: ${reacts.map(r => lower(r.label)).join('; ')}.`,
      }))
    }
  }))
  return out.filter(Boolean)
}

function libraryQuestions() {
  const moves = CATALOG.filter(t => t.position !== 'Solo drills')
  const positions = [...new Set(moves.map(t => t.position))]
  const out = []
  shuffle(moves).slice(0, 60).forEach(t => {
    out.push(question({
      key: `lib:${t.id}:position`, context: 'Moves and positions',
      prompt: `Where does the ${t.name.toLowerCase()} usually happen?`,
      right: { text: t.position, sub: '' }, wrongPool: positions.filter(p => p !== t.position).map(text => ({ text, sub: '' })),
      explain: `${t.name}: ${t.type.toLowerCase()} from ${t.position.toLowerCase()}.`,
    }))
  })
  // "Which of these is an escape from mount?" style questions.
  positions.forEach(position => ['Escape', 'Submission', 'Sweep', 'Pass'].forEach(type => {
    const fits = moves.filter(t => t.position === position && t.type === type)
    if (!fits.length) return
    const right = pick(fits)
    out.push(question({
      key: `lib:${position}:${type}:${right.id}`, context: 'Moves and positions',
      prompt: `Which of these is ${type === 'Escape' ? 'an escape' : 'a ' + type.toLowerCase()} from ${position.toLowerCase()}?`,
      right: { text: right.name, sub: '' },
      wrongPool: moves.filter(t => t.type !== type).map(t => ({ text: t.name, sub: '' })),
      explain: `${right.name} is ${type === 'Escape' ? 'an escape' : 'a ' + type.toLowerCase()} from ${position.toLowerCase()}.`,
    }))
  }))
  return out.filter(Boolean)
}

// Questions you've missed before come first, so the quiz drills your weak spots.
export function buildQuiz(topic, length) {
  const trees = treesFor(topic)
  let pool = treeQuestions(trees)
  if (topic === 'library' || topic === 'all') pool = [...pool, ...libraryQuestions()]
  const misses = S.settings.quizMisses || {}
  return shuffle(pool)
    .sort((a, b) => (misses[b.key] || 0) - (misses[a.key] || 0))
    .slice(0, length)
    .sort(() => Math.random() - 0.5)
}
