// Describe a roll in your own words and get a move chain back. It runs on the phone with no AI and
// no network: the words are matched against the move library, your own moves, and words you taught it.
// Pure: parseRoll(text, { techs, personal, partners, usage }) returns the chain and what it couldn't place.
import { POSITIONS } from './vocab.js'
import { GUARDS, TABLE, attackerOf, fits, flip, key, landing } from './sim.js'

// ---------- Words ----------

const NUMBERS = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', fifty: '50', hundred: '100' }
const normWord = w => { const x = w.toLowerCase().normalize('NFD').replace(/[̀-ͯ’‘'`]/g, ''); return NUMBERS[x] || x }
export const phraseKey = s => (String(s).match(/[\p{L}\p{N}’‘'`]+/gu) || []).map(normWord).filter(Boolean).join(' ')

// Misspellings and what the keyboard mic hears, fixed before anything is matched.
const FIXES = {
  'kimora': 'kimura', 'kamora': 'kimura', 'kimara': 'kimura', 'key mura': 'kimura', 'omo plata': 'omoplata', 'oma plata': 'omoplata', 'omaplata': 'omoplata', 'homo plata': 'omoplata',
  'arm bar': 'armbar', 'arm bars': 'armbar', 'arm barred': 'armbarred', 'd arce': 'darce', 'darse': 'darce', 'dark choke': 'darce choke', 'dart choke': 'darce choke',
  'bear in bolo': 'berimbolo', 'berry bolo': 'berimbolo', 'barimbolo': 'berimbolo', 'bear a bolo': 'berimbolo', 'bear em bolo': 'berimbolo',
  'xguard': 'x guard', 'ex guard': 'x guard', 'halfguard': 'half guard', 'dela riva': 'de la riva', 'della riva': 'de la riva', 'delariva': 'de la riva', 'dlr': 'de la riva', 'rdlr': 'reverse de la riva',
  'northsouth': 'north south', 'guilotine': 'guillotine', 'gillotine': 'guillotine', 'guillo': 'guillotine', 'gogo plata': 'gogoplata', 'ezekial': 'ezekiel', 'zeke': 'ezekiel', 'tri angle': 'triangle',
  'americano': 'americana', 'key lock': 'keylock', 'heelhook': 'heel hook', 'heel hooked': 'heel hook', 'knee bar': 'kneebar', 'toehold': 'toe hold', 'foot lock': 'footlock', 'ankle lock': 'footlock',
  'side mount': 'side control', 'cross side': 'side control', 'crossside': 'side control', 'sidecontrol': 'side control', 'knee on stomach': 'knee on belly', 'kob': 'knee on belly',
  'butter fly': 'butterfly', 'tore ando': 'toreando', 'toriando': 'toreando', 'toreando': 'toreando', 'bull fighter': 'bullfighter', 'rear naked': 'rear naked', 'rear naked choked': 'rear naked choke',
  'seat belt': 'seatbelt', 'cross face': 'crossface', 'under hook': 'underhook', 'over hook': 'overhook', 'take down': 'takedown', 'took down': 'takedown', 'stand up': 'standup', 'full mount': 'mount',
  'fifty fifty': '50 50', '411': 'saddle', '4 11': 'saddle', 'hip bumped': 'hip bump', 'knee sliced': 'knee slice', 'knee cut': 'knee cut', 'leg dragged': 'leg drag',
}

const BACK_TAKES = ['Seatbelt back take', 'Mount to back take', 'Back take from half guard', 'Arm drag to back', 'Back take from De La Riva', 'Back take from turtle (hooks in)', 'Butterfly back take', 'Kimura grip to back', 'Back take from dogfight', 'Lasso to back take']
const GUARD_BREAKS = ['Standing guard break', 'Kneeling guard break', 'Knee in the middle break']
// Slang and short names, each to the moves it can mean. Where you are decides between them.
const ALIASES = {
  'knee slice': ['Knee cut pass'], 'knee slide': ['Knee cut pass'], 'knee through': ['Knee cut pass'], 'rnc': ['Rear naked choke'], 'rear naked': ['Rear naked choke'], 'mata leao': ['Rear naked choke'],
  'hip bump': ['Hip bump sweep'], 'bump sweep': ['Hip bump sweep'], 'sit up sweep': ['Hip bump sweep'], 'pendulum': ['Flower sweep'], 'pendulum sweep': ['Flower sweep'],
  'elbow escape': ['Elbow-knee escape'], 'elbow knee': ['Elbow-knee escape'], 'shrimp': ['Shrimp to guard recovery', 'Elbow-knee escape'], 'shrimped out': ['Shrimp to guard recovery', 'Elbow-knee escape'],
  'upa': ['Upa (bridge and roll)'], 'bridge': ['Upa (bridge and roll)'], 'bridge and roll': ['Upa (bridge and roll)'], 'trap and roll': ['Upa (bridge and roll)'], 'bridged out': ['Upa (bridge and roll)'],
  'americana': ['Americana', 'Americana from mount'], 'keylock': ['Americana', 'Americana from mount'], 'toreando': ['Torreando pass'], 'bullfighter': ['Torreando pass'], 'bullfighter pass': ['Torreando pass'],
  'underhook': ['Dogfight', 'Crossface and underhook', 'Near-side underhook control', 'Underhook pummeling', 'Underhook escape to knees', 'Underhook sweep'],
  'crossface': ['Crossface control', 'Crossface and underhook'], 'single': ['Single leg'], 'double': ['Double leg'], 'slx': ['Single-leg X'], 'ashi': ['Ashi garami'],
  'heel hook': ['Inside heel hook', 'Outside heel hook'], 'footlock': ['Straight ankle lock'], 'straight footlock': ['Straight ankle lock'], 'head and arm': ['Arm triangle', 'Arm triangle from mount', 'Arm triangle from half guard'],
  'kata gatame': ['Arm triangle', 'Arm triangle from mount'], 'collar choke': ['Cross collar choke', 'Cross collar choke from mount', 'Collar choke from back'], 'cross choke': ['Cross collar choke', 'Cross collar choke from mount'],
  'took his back': BACK_TAKES, 'took her back': BACK_TAKES, 'took their back': BACK_TAKES, 'took the back': BACK_TAKES, 'took my back': BACK_TAKES, 'take the back': BACK_TAKES, 'take his back': BACK_TAKES, 'take her back': BACK_TAKES, 'take their back': BACK_TAKES, 'back take': BACK_TAKES,
  'pulled guard': ['Guard pull'], 'pull guard': ['Guard pull'], 'jumped guard': ['Jumping closed guard'], 'jumped closed guard': ['Jumping closed guard'],
  'technical standup': ['Technical stand-up from guard'], 'granby': ['Granby roll escape', 'Granby roll recovery'], 'seatbelt': ['Seatbelt control'], 'truck': ['Truck entry'], 'deep half': ['Deep half guard entry', 'Deep half sweep'],
  'recovered guard': ['Shrimp to guard recovery', 'Guard retention (frames and hips)', 'Back escape to guard', 'Turtle to guard recovery'], 'recovered my guard': ['Shrimp to guard recovery', 'Guard retention (frames and hips)'],
  'baseball choke': ['Baseball bat choke'], 'north south choke': ['North-south choke'], 'darce': ['D’arce choke'], 'anaconda': ['Anaconda choke'], 'loop': ['Loop choke'], 'clock': ['Clock choke'],
  'takedown': ['Double leg', 'Single leg', 'Body lock takedown'], 'sprawled': ['Sprawl'], 'wrestled up': ['Wrestle up'], 'arm drag': ['Arm drag', 'Arm drag to back', 'Arm drag sweep'],
  'gift wrap': ['Gift wrap'], 'smashed through': ['Smash pass'], 'leg weave': ['Leg weave pass'], 'kimura trap': ['Kimura', 'Kimura from side control'],
  'kimura grip': ['Kimura grip to back'], 'deep half guard': ['Deep half guard entry'], 'broke posture': ['Breaking posture'], 'broke his posture': ['Breaking posture'], 'broke her posture': ['Breaking posture'],
  'break posture': ['Breaking posture'], 'hip escape': ['Shrimp to guard recovery', 'Elbow-knee escape'],
  'opened his guard': GUARD_BREAKS, 'opened her guard': GUARD_BREAKS, 'opened the guard': GUARD_BREAKS, 'broke his guard': GUARD_BREAKS, 'broke the guard': GUARD_BREAKS, 'guard break': GUARD_BREAKS, 'opened guard': GUARD_BREAKS, 'break his posture': ['Breaking posture'], 'broke him down': ['Breaking posture'],
}
// Generic phrases are guesses: they always ask "Did you mean…".
const GENERIC = new Set(['takedown', 'underhook', 'recovered guard', 'shrimp', 'collar choke', 'heel hook'])
const RESTATED = new Set(BACK_TAKES)

// Where you are. A position named without a side gets one from the words around it.
const POS_WORDS = {
  'standing': 'Standing', 'on the feet': 'Standing', 'on our feet': 'Standing', 'front headlock': 'Front headlock', 'front head lock': 'Front headlock',
  'closed guard': 'Closed guard', 'full guard': 'Closed guard', 'guard': 'Closed guard', 'half guard': 'Half guard', 'half': 'Half guard', 'top half': 'Half guard', 'bottom half': 'Half guard',
  'butterfly': 'Butterfly guard', 'butterfly guard': 'Butterfly guard', 'butterfly hooks': 'Butterfly guard', 'de la riva': 'De La Riva', 'de la riva guard': 'De La Riva',
  'reverse de la riva': 'Reverse De La Riva', 'x guard': 'X-guard', 'spider': 'Spider / lasso', 'spider guard': 'Spider / lasso', 'lasso': 'Spider / lasso', 'lasso guard': 'Spider / lasso',
  'lapel guard': 'Lapel guards', 'open guard': 'Open guard', 'leg entanglement': 'Leg entanglement', 'leg entanglements': 'Leg entanglement', 'leg lock position': 'Leg entanglement',
  'side control': 'Side control', 'mount': 'Mount', 'mounted': 'Mount', 'back control': 'Back', 'back mount': 'Back', 'back': 'Back', 'knee on belly': 'Knee on belly', 'north south': 'North-south',
  'turtle': 'Turtle', 'turtled': 'Turtle', 'turtled up': 'Turtle',
}
const PINS = ['Mount', 'Side control', 'Knee on belly', 'North-south', 'Front headlock']
// Name endings dropped to make the short name you'd say: "Scissor sweep" → "scissor", "Armbar from guard" → "armbar".
const TAILS = ['choke', 'sweep', 'pass', 'escape', 'takedown']
// Short names too common as plain words to count as a move on their own.
const BLOCK = new Set(['hook', 'smash', 'chair', 'float', 'stack', 'muscle', 'balloon', 'overhead', 'single leg defense', 'collar sleeve', 'hip switch half', 'lapel guard', 'spider guard', 'technical stand up', 'kesa gatame', 'lockdown', 'electric', 'old school', 'arm'])

// Words that set who did it and how it went.
const ME = new Set(['i', 'im', 'ive', 'id', 'ill'])
const THEM = new Set(['he', 'she', 'they', 'hes', 'shes', 'theyre', 'partner', 'opponent', 'guy', 'girl', 'dude', 'buddy', 'bro', 'training partner'])
const OBJECTS = new Set(['him', 'her', 'them'])
const OWNERS = { his: 'them', her: 'them', their: 'them', my: 'me' }
const UNDO = new Set(['couldnt', 'didnt', 'failed', 'missed', 'cant', 'wasnt', 'unable', 'never'])
const TRIED = new Set(['tried', 'try', 'trying', 'attempted', 'attempt', 'attempting', 'almost', 'nearly', 'couldnt', 'cant', 'didnt', 'wasnt', 'failed', 'missed', 'lost', 'fishing', 'hunting', 'threatened', 'unable', 'close'])
const TRIED_PAIRS = ['went for', 'go for', 'going for', 'looked for', 'looking for', 'set up', 'no luck', 'not finish', 'never finished', 'too slow']
const LANDED = new Set(['hit', 'got', 'finished', 'finish', 'swept', 'passed', 'took', 'tapped', 'landed', 'secured', 'locked', 'sunk', 'sank', 'used', 'threw', 'choked', 'submitted', 'subbed', 'nailed', 'pulled', 'completed', 'scored', 'did', 'caught', 'snatched', 'won'])
const DEFEND = new Set(['fought', 'hand fought', 'recovered', 'escaped', 'defended', 'blocked', 'stacked', 'popped', 'slipped', 'survived', 'hid', 'stuffed', 'sprawled', 'postured', 'countered', 'broke', 'stripped', 'pulled out', 'got out', 'rolled out'])
const STUCK = new Set(['stuck', 'trapped', 'pinned', 'flattened', 'smashed', 'crushed', 'defending', 'escaping', 'surviving'])
const GAIN = new Set(['got', 'get', 'take', 'took', 'reached', 'secured', 'established', 'ended', 'came', 'went', 'moved', 'transitioned', 'passed', 'swept', 'hit', 'landed', 'settled', 'pulled', 'recovered', 'achieved', 'switched', 'rolled'])
const PASSIVE = new Set(['caught', 'swept', 'passed', 'mounted', 'tapped', 'choked', 'submitted', 'subbed', 'armbarred', 'triangled', 'taken', 'reversed', 'guillotined', 'kimurad', 'heel', 'finished'])
const SPLIT = new Set(['then', 'and', 'but', 'after', 'so', 'before', 'until', 'when', 'while', 'which', 'because', 'also', 'plus', 'eventually', 'finally', 'later', 'afterwards', 'though', 'although', 'where'])
const EARLY = ['early on', 'early', 'at the start', 'at the beginning', 'in the beginning', 'first thing', 'right away', 'to start']
const FILLER = new Set(['a', 'an', 'the', 'his', 'her', 'my', 'their', 'him', 'me', 'them', 'it', 'this', 'that', 'some', 'kind', 'of', 'sort', 'for', 'in', 'with', 'to', 'on', 'nice', 'tight', 'quick', 'sneaky', 'little', 'really', 'good', 'big'])
// Plain words never stretched to a near-miss move name ("sleep" is not "sweep").
const COMMON = new Set(('then that this with when were went want have hard after again came come could couldnt didnt from into just kept keep made make more most over roll rolled round same some still stuck than them they there time took turn very what where which while will would your mine their first early later start started ended ending '
  + 'finally caught tapped finish finished attempt attempted escaped escape defended sweep swept passed guard half choke lock grip grips sleep mouth count month body arms legs head neck knee foot feet hand hands side long good great nice rough tight bigger smaller heavier lighter '
  + 'partner tired gassed smashed flat pressure heavy bottom always never ever eventually able other another around about cause because before being both each even every going gone half held hold holding inside outside instead later maybe minute minutes much once only open position pretty quite really should since sort super though through thing things tried trying under until while whole without worked working move moves second seconds stand stood stayed felt feel last next tapping caught ').split(' '))
// Partner details.
const BELT_WORDS = ['white', 'blue', 'purple', 'brown', 'black']
const HEAVIER = new Set(['bigger', 'heavier', 'larger', 'huge', 'big', 'heavy', 'stronger', 'strong', 'massive', 'giant'])
const LIGHTER = new Set(['smaller', 'lighter', 'little', 'small', 'tiny', 'light', 'skinny'])

// ---------- Index: every name, short name, alias and taught word, as normalized phrases ----------

const TYPE_RANK = { Submission: 0, Sweep: 0, Pass: 0, Takedown: 0, Escape: 1, Transition: 1, Retention: 2, Control: 2, Movement: 4 }
let built = { techs: null, personal: '', index: null }

function shortNames(name) {
  const base = phraseKey(name.replace(/\(.*?\)/g, ''))
  const out = new Set([base])
  let s = base.replace(/ from .*$/, '')
  out.add(s)
  for (const tail of TAILS) if (s.endsWith(' ' + tail)) out.add(s.slice(0, -tail.length - 1))
  const lead = s.match(/^(standing|mounted|flying|high elbow|arm in|far side|step over|spinning|inverted) (.+)$/)
  if (lead) out.add(lead[2])
  return [...out].filter(x => x && !BLOCK.has(x) && !POS_WORDS[x])
}

function buildIndex(techs, personal) {
  const pkey = JSON.stringify(personal || {})
  if (built.techs === techs && built.personal === pkey) return built.index
  const byName = Object.fromEntries(techs.map(t => [t.name, t]))
  const phrases = new Map()
  // A phrase that means several moves keeps them all; where you are picks one. Earlier aliases rank first.
  const add = (p, ids, conf, src) => {
    if (!p || !ids.length) return
    const e = phrases.get(p) || phrases.set(p, { p, ids: [], conf, src, n: p.split(' ').length, order: {} }).get(p)
    e.conf = Math.max(e.conf, conf)
    ids.forEach((id, i) => { if (!e.ids.includes(id)) e.ids.push(id); if (src === 'alias') e.order[id] ??= i; if (src === 'name') e.exact = id })
  }
  techs.forEach(t => {
    const name = phraseKey(t.name.replace(/\(.*?\)/g, ''))
    add(name, [t.id], 1, 'name')
    if (name.includes(' to ')) ['the', 'his', 'her', 'their'].forEach(w => add(name.replace(' to ', ` to ${w} `), [t.id], 0.95, 'alias'))
  })
  techs.forEach(t => shortNames(t.name).forEach(p => add(p, [t.id], 0.9, 'short')))
  techs.forEach(t => (t.aliases || []).forEach(a => add(phraseKey(a), [t.id], 0.95, 'alias')))
  Object.entries(ALIASES).forEach(([p, names]) => add(phraseKey(p), names.map(n => byName[n]?.id).filter(Boolean), GENERIC.has(p) ? 0.5 : 0.95, 'alias'))
  Object.entries(personal || {}).forEach(([p, id]) => { if (techs.some(t => t.id === id)) phrases.set(phraseKey(p), { p: phraseKey(p), ids: [id], conf: 1, src: 'yours', n: phraseKey(p).split(' ').length, order: {} }) })
  const fixes = Object.entries(FIXES).map(([from, to]) => [from.split(' '), to.split(' ')]).sort((a, b) => b[0].length - a[0].length)
  const vocab = new Set([...phrases.keys(), ...Object.keys(POS_WORDS)].flatMap(p => p.split(' ')))
  const index = { phrases, fixes, vocab, byId: Object.fromEntries(techs.map(t => [t.id, t])), list: [...phrases.values()] }
  built = { techs, personal: pkey, index }
  return index
}

// ---------- Tokens, with where each came from in your text ----------

function tokenize(text, index) {
  const raw = [...text.matchAll(/[\p{L}\p{N}’‘'`]+|[.!?\n]+|[,;:()]/gu)].map(m => ({ raw: m[0], s: m.index, e: m.index + m[0].length }))
  const toks = raw.map(t => /^[.!?\n]+$/.test(t.raw) ? { ...t, sep: '.' } : /^[,;:()]$/.test(t.raw) ? { ...t, sep: ',' } : { ...t, w: normWord(t.raw) }).filter(t => t.sep || t.w)
  const out = []
  for (let i = 0; i < toks.length;) {
    const fix = index.fixes.find(([from]) => from.every((w, j) => toks[i + j]?.w === w))
    if (fix) {
      const s = toks[i].s, e = toks[i + fix[0].length - 1].e
      fix[1].forEach(w => out.push({ w, s, e, raw: text.slice(s, e) }))
      i += fix[0].length
    } else out.push(toks[i++])
  }
  return out
}

// "triangled" → "triangle", "shrimping" → "shrimp", "sweeps" → "sweep": only when that makes a move word.
function stem(w, vocab) {
  const tries = [[/(\w)\1ed$/, '$1'], [/(\w)\1ing$/, '$1'], [/ed$/, ''], [/d$/, ''], [/ing$/, ''], [/ing$/, 'e'], [/es$/, ''], [/s$/, '']]
  for (const [re, to] of tries) { const x = w.replace(re, to); if (x !== w && x.length > 2 && vocab.has(x)) return { w: x, verb: /d$/.test(w) } }
  return { w }
}

// Damerau-Levenshtein distance (optimal string alignment), for near misses like "trinagle".
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
  }
  return d[a.length][b.length]
}
const near = (w, x) => w === x || w.length >= 4 && x.length >= 4 && !COMMON.has(w) && Math.abs(w.length - x.length) <= 2 && distance(w, x) <= (x.length >= 8 ? 2 : 1)

// Longest phrase first: a move or a position, exact, then a near miss. "Snapped him down" reads as "snap down".
function matchAt(toks, i, index) {
  const run = [], ends = []
  for (let j = i; j < toks.length && !toks[j].sep && run.length < 6; j++) if (j === i || !OBJECTS.has(toks[j].w)) { run.push(toks[j]); ends.push(j - i + 1) }
  const words = run.map(t => stem(t.w, index.vocab))
  for (let k = run.length; k >= 1; k--) {
    const n = ends[k - 1], m = matchRun(run.slice(0, k), words.slice(0, k), toks, i, index)
    if (m) return { ...m, n }
  }
  for (let n = Math.min(run.length, 4); n >= 1; n--) {
    const ws = words.slice(0, n).map(x => x.w)
    if (n === 1 && ws[0].length < 5) continue
    const hit = index.list.find(e => e.n === n && e.p.split(' ').every((x, k) => near(ws[k], x)) && (n === 1 || e.p.split(' ').some((x, k) => ws[k] === x)))
    if (hit) return { kind: 'move', n: ends[n - 1], entry: hit, phrase: ws.join(' '), fuzzy: true }
  }
  return null
}

// One run of words, as typed or stemmed. Plain "back" and "half" are only positions after "his", "the", "to"...
const LOOSE = { back: ['his', 'her', 'their', 'my', 'the', 'to', 'on'], half: ['his', 'her', 'their', 'my', 'to', 'in', 'into', 'from', 'top', 'bottom'] }
function matchRun(run, words, toks, i, index) {
  const p = words.map(x => x.w).join(' '), plain = run.map(t => t.w).join(' ')
  let pos = POS_WORDS[plain] || POS_WORDS[p]
  if (LOOSE[plain] && !LOOSE[plain].includes(toks[i - 1]?.w)) pos = null
  const mv = index.phrases.get(plain) || index.phrases.get(p)
  if (mv && !(pos && mv.src !== 'yours')) return { kind: 'move', entry: mv, phrase: mv.p, verb: words[words.length - 1].verb, fuzzy: false }
  if (pos) return { kind: 'pos', pos, phrase: p, verb: words[words.length - 1].verb || plain === 'turtled' }
  return null
}

// ---------- Clauses: "then", "and", "but" and punctuation split the story into steps ----------

function clausesOf(toks, index) {
  const items = []
  for (let i = 0; i < toks.length;) {
    const t = toks[i]
    if (t.sep) { items.push({ k: 'sep', strong: t.sep === '.' }); i++; continue }
    const m = !FILLER.has(t.w) && matchAt(toks, i, index)
    if (m) { items.push({ ...m, k: m.kind, s: t.s, e: toks[i + m.n - 1].e, at: i }); i += m.n }
    else { items.push({ k: 'w', w: t.w, raw: t.raw, s: t.s, e: t.e, at: i }); i++ }
  }
  const clauses = []
  let cur = { items: [], conn: '.', sentence: 0 }, sentence = 0
  const close = () => { if (cur.items.length) clauses.push(cur) }
  items.forEach(it => {
    if (it.k === 'sep') { close(); if (it.strong) sentence++; cur = { items: [], conn: it.strong ? '.' : ',', sentence }; return }
    if (it.k === 'w' && SPLIT.has(it.w) && cur.items.some(x => x.k !== 'w' || !SPLIT.has(x.w))) { close(); cur = { items: [], conn: it.w, sentence } }
    if (it.k === 'w' && SPLIT.has(it.w) && !cur.items.length) cur.conn = cur.conn === '.' || cur.conn === ',' ? it.w : cur.conn
    cur.items.push(it)
  })
  close()
  return clauses
}

const wordsOf = c => c.items.filter(x => x.k === 'w').map(x => x.w)
const textOf = c => ' ' + c.items.map(x => x.k === 'w' ? x.w : x.phrase).join(' ') + ' '
const has = (c, set) => wordsOf(c).some(w => set.has(w)) || [...set].some(p => p.includes(' ') && textOf(c).includes(' ' + p + ' '))

// Who did it: the first person named, "me" after the verb ("he caught me"), or a passive ("got swept").
// A passive is only this clause: "I got swept, then recovered guard" is you again.
function subjectOf(c, partners) {
  const ws = c.items.map(x => x.k === 'w' ? x.w : x.k === 'move' && x.phrase.startsWith('took my') ? '@my' : '#')
  const first = c.items.findIndex(x => x.k === 'move')
  for (const [i, w] of ws.entries()) {
    if (first >= 0 && i > first) break
    if (ME.has(w)) return passive(ws, i) ? { who: 'them', passive: true } : { who: 'me' }
    if (THEM.has(w) || partners.has(w)) return passive(ws, i) ? { who: 'me', passive: true } : { who: 'them' }
  }
  if (ws.includes('@my')) return { who: 'them' }
  if (ws.some((w, i) => w === 'me' && i > 0 && !['to', 'for', 'and', 'like'].includes(ws[i - 1]))) return { who: 'them', passive: true }
  if (passive(ws, -1)) return { who: 'them', passive: true }
  return null
}
const passive = (ws, from) => ws.some((w, i) => i > from && (['got', 'get', 'getting', 'was', 'were', 'been'].includes(ws[i - 1]) && PASSIVE.has(w) || w === 'tapped' && ['to', 'out'].includes(ws[i + 1])))

const SIDE_WORDS = { top: 'Top', bottom: 'Bottom', under: 'Bottom', underneath: 'Bottom' }
const rel = (who, role) => who === 'them' ? flip(role) : role

// Your side in a position named in this clause.
function roleFor(c, it, who) {
  if (it.pos === 'Standing') return 'Neutral'
  // "in half guard top he…" is you; "he was on top", "he went for it from half guard top" is whoever the clause is about.
  const at = c.items.indexOf(it), beside = [c.items[at - 1], c.items[at + 1]].map(x => x?.k === 'w' && SIDE_WORDS[x.w]).find(Boolean)
  const side = beside || /^(top|bottom) /.test(it.phrase) && SIDE_WORDS[it.phrase.split(' ')[0]]
  if (side) return c.items.slice(0, at).some(x => THEM.has(x.w)) ? rel(who, side) : side
  const said = wordsOf(c).map(w => SIDE_WORDS[w]).find(Boolean)
  if (said) return rel(who, said)
  const prev = c.items[at - 1], owner = prev?.k === 'w' && OWNERS[prev.w]
  if (owner) {
    const ownerOnTop = PINS.includes(it.pos)
    return (owner === 'them') === ownerOnTop ? 'Bottom' : 'Top'
  }
  const to = prev?.k === 'w' && ['to', 'into', 'onto'].includes(prev.w)
  if (it.pos === 'Turtle' && (it.verb || to)) return rel(who, 'Bottom')
  if (to && has(c, DEFEND)) return rel(who, GUARDS.includes(it.pos) || it.pos === 'Turtle' ? 'Bottom' : 'Top')
  // "He smashed me in side control", "I was stuck in mount": you're the one underneath. "I pinned him": you're on top.
  if (has(c, STUCK)) return who === 'me' && wordsOf(c).some(w => ['him', 'her', 'them'].includes(w)) ? attackerOf(it.pos) : flip(attackerOf(it.pos))
  if (has(c, DEFEND)) return rel(who, flip(attackerOf(it.pos)))
  if (it.verb || to || has(c, GAIN)) return rel(who, attackerOf(it.pos))
  return null
}

// Your side after a move that ends in a position you named: "scissor sweep to mount".
function roleAfter(c, t, pos, who) {
  if (pos === 'Standing') return 'Neutral'
  const side = wordsOf(c).map(w => SIDE_WORDS[w]).find(Boolean)
  if (side) return rel(who, side)
  const defensive = ['Escape', 'Retention'].includes(t?.type)
  const role = defensive ? (GUARDS.includes(pos) || pos === 'Turtle' || pos === 'Leg entanglement' ? 'Bottom' : 'Top')
    : ['Sweep', 'Takedown', 'Pass'].includes(t?.type) || !GUARDS.includes(pos) && pos !== 'Leg entanglement' ? 'Top' : attackerOf(pos)
  return rel(who, role)
}

// The side a move is done from: the game's menu says, else the attacker sweeps and submits, the other side passes and escapes.
const moverRole = (t, pos) => pos === 'Standing' ? 'Neutral' : ['Top', 'Bottom'].find(r => (TABLE[key(pos, r)] || []).some(m => m.id === t.id))
  || (['Escape', 'Pass'].includes(t.type) ? flip(attackerOf(pos)) : attackerOf(pos))

// ---------- Picking the move a phrase means, from where you are ----------

function choose(ev, now, index, usage) {
  const side = now && rel(ev.who, now.role)
  const score = id => {
    const t = index.byId[id]
    let s = -(TYPE_RANK[t.type] ?? 2) * 0.3 - t.name.length / 100 + Math.min(usage[id] || 0, 10) * 0.05 - (ev.order?.[id] || 0) * 0.2 + (ev.exact === id ? 0.8 : 0) + (ev.qual && t.name.toLowerCase().includes(ev.qual) ? 0.5 : 0)
    if (now) {
      if ((TABLE[key(now.pos, side)] || []).some(m => m.id === id)) s += 4
      if (t.position === now.pos) s += 2
      else if (GUARDS.includes(t.position) && GUARDS.includes(now.pos)) s += 1.5
      if (fits(t, { pos: now.pos, role: side })) s += 1
    }
    if (t.type === 'Movement') s -= 3
    return s
  }
  const ranked = ev.ids.map(id => [id, score(id)]).sort((a, b) => b[1] - a[1])
  const close = ranked.length > 1 && ranked[0][1] - ranked[1][1] < 1
  const conf = ev.fuzzy ? 0.6 : Math.min(ev.conf, close ? 0.7 : 1)
  return { techId: ranked[0][0], conf, alts: ranked.slice(1, 4).map(([id]) => id) }
}

// ---------- The whole thing ----------

export function parseRoll(text, { techs = [], personal = {}, partners = [], usage = {} } = {}) {
  const index = buildIndex(techs, personal)
  const partnerSet = new Set(partners.map(p => normWord(p.split(' ')[0])))
  const toks = tokenize(String(text || ''), index)
  const partner = partnerHints(toks, text, partnerSet, index)
  if (partner.name) partnerSet.add(normWord(partner.name.split(' ')[0]))
  const clauses = clausesOf(toks, index)

  // Each clause becomes events: positions and moves, with who did them and how they went.
  // A sentence with no one named is you; inside a sentence the last person named carries on, loosely.
  let who = 'me', mode = 'landed', sentence = -1
  const groups = [], unmatched = [], notes = []
  clauses.forEach((c, ci) => {
    if (c.sentence !== sentence) { sentence = c.sentence; who = 'me'; mode = 'landed' }
    const subject = subjectOf(c, partnerSet), actor = subject?.who || who
    if (subject && !subject.passive) who = subject.who
    const soft = !subject && who === 'them'
    const ownVerb = has(c, TRIED) || has(c, LANDED) || c.items.some(x => x.verb)
    mode = has(c, TRIED) || TRIED_PAIRS.some(p => textOf(c).includes(' ' + p + ' ')) ? 'tried' : ownVerb || !['and', 'or', ','].includes(c.conn) ? 'landed' : mode
    const events = [], moves = c.items.filter(x => x.k === 'move')
    c.items.forEach((it, i) => {
      // "took his back with a seatbelt" is one move; "heel hook from 50/50" says where it happened.
      const grip = it.k === 'move' && it.entry.ids.every(id => index.byId[id].type === 'Control'), prevW = c.items[i - 1]?.w
      if (grip && events.some(e => e.t === 'move') && c.items.slice(Math.max(0, i - 3), i).some(x => x.w === 'with')) return
      if (grip && prevW === 'from') it = { ...it, k: 'pos', pos: index.byId[it.entry.ids[0]].position }
      if (it.k === 'move') {
        const prior = c.items.slice(0, i).filter(x => x.k === 'w').map(x => x.w)
        const mine = it.phrase.startsWith('took my') || prior.slice(-2).includes('me') && prior.includes('caught') || ['ate', 'eat', 'fell'].some(w => prior.slice(-3).includes(w)) ? 'them' : actor
        const ev = { t: 'move', ids: it.entry.ids, order: it.entry.order, exact: it.entry.exact, ci, conf: it.entry.conf, fuzzy: it.fuzzy, phrase: it.phrase, who: mine, outcome: mine === 'them' ? 'caughtBy' : mode, soft, span: [it.s, it.e] }
        // What they tried and didn't get isn't in your chain, but it says where you were.
        if (mine === 'them' && mode === 'tried') { notes.push(it.phrase); events.push({ ...ev, t: 'hint' }); return }
        events.push(ev)
      } else if (it.k === 'pos') {
        const prev = c.items[i - 1], last = events.filter(e => e.t !== 'pos').pop()
        const to = prev?.k === 'w' && ['to', 'into', 'onto', 'in', 'up'].includes(prev.w)
        const ev = { t: 'pos', pos: it.pos, role: roleFor(c, it, actor), vague: it.phrase === 'guard', gain: actor === 'me' && (to || it.verb || has(c, GAIN)), phrase: it.phrase, ci, span: [it.s, it.e] }
        // "scissor sweep to mount": where the move ended. "kimura from closed guard", "guillotine standing": where it started.
        if (last?.t === 'move' && to) last.post = { pos: it.pos, role: roleAfter(c, index.byId[last.ids[0]], it.pos, last.who), span: [it.s, it.e] }
        else if (last && (prev?.k === 'move' || prev?.w === 'from') && events[events.length - 1] === last) { events.splice(events.length - 1, 0, ev); last.qual = it.phrase }
        else events.push(ev)
      }
    })
    // "I passed" with no pass named: you're in side control.
    const ws = wordsOf(c)
    if (!moves.length && ws.includes('passed') && !c.items.some((x, i) => x.k === 'pos' && i > c.items.findIndex(y => y.w === 'passed'))) events.push({ t: 'pos', pos: 'Side control', role: rel(actor, 'Top'), span: spanOf(c, 'passed') })
    // "but he escaped", "couldn't finish", or their defense from the spot your move started in: that move didn't land.
    const prevMove = groups.flat().filter(e => e.t === 'move').pop(), prevTech = prevMove && index.byId[prevMove.ids[0]]
    const defense = events.find(e => e.t === 'move'), defTech = defense && index.byId[defense.ids[0]]
    const undone = !moves.length && actor === 'them' && has(c, DEFEND) || !moves.length && actor === 'me' && has(c, UNDO)
      || defense?.who === 'them' && ['Escape', 'Retention'].includes(defTech?.type) && (c.conn === 'but' || defTech.position === prevTech?.position)
    if (undone && prevMove?.who === 'me' && prevMove.outcome === 'landed') prevMove.outcome = 'tried'
    // "...and tapped": you tapped, so the submission before was theirs.
    if (!moves.length && actor === 'me' && ws.includes('tapped') && !ws.some(w => OBJECTS.has(w)) && prevMove?.outcome !== 'caughtBy' && prevTech?.type === 'Submission') Object.assign(prevMove, { who: 'them', outcome: 'caughtBy' })
    if (!moves.length) unmatched.push(...leftovers(c, text))
    groups.push(events)
    c.early = EARLY.some(p => textOf(c).includes(' ' + p + ' ')) && ci > 0
    c.afterOf = c.conn === 'after' && ci > 0 && clauses[ci - 1].sentence === c.sentence
  })

  // A position named with no side takes the side of the next move made from it, in the order you told it.
  const told = groups.flat()
  told.forEach((ev, i) => {
    if (ev.t !== 'pos' || ev.role) return
    const next = told.slice(i + 1).find(e => e.t === 'move' || e.t === 'hint')
    const t = next && index.byId[choose(next, { pos: ev.pos, role: attackerOf(ev.pos) }, index, usage).techId]
    ev.role = t ? rel(next.who, moverRole(t, ev.pos)) : ev.pos === 'Standing' ? 'Neutral' : attackerOf(ev.pos)
  })

  // Order: "early on" moves go first (after where it started), "X after Y" puts Y first.
  let order = clauses.map((_, i) => i)
  clauses.forEach((c, i) => { if (c.afterOf) { const at = order.indexOf(i); [order[at - 1], order[at]] = [order[at], order[at - 1]] } })
  const early = order.filter(i => clauses[i].early)
  if (early.length) {
    const rest = order.filter(i => !clauses[i].early), first = rest.findIndex(i => groups[i].length)
    const lead = first < 0 ? 0 : first + (groups[rest[first]].every(e => e.t === 'pos') ? 1 : 0)
    order = [...rest.slice(0, lead), ...early, ...rest.slice(lead)]
  }
  const events = order.flatMap(i => groups[i])

  // Walk the story: each move goes from where you are to where it lands, as the chain builder replays it.
  let start = null, now = null
  const steps = []
  const goTo = (at, span) => {
    if (!at?.pos) return
    if (!now) { start = now = { pos: at.pos, role: at.role }; return }
    if (at.pos !== now.pos || at.role !== now.role) { steps.push({ pos: at.pos, role: at.role, span }); now = { pos: at.pos, role: at.role } }
  }
  const onMenu = (id, at, who) => (TABLE[key(at.pos, rel(who, at.role))] || []).some(m => m.id === id)
  const homeOf = (t, who) => POSITIONS.includes(t.position) && { pos: t.position, role: rel(who, moverRole(t, t.position)) }
  events.forEach((ev, i) => {
    if (ev.t === 'pos') {
      // "went to knee on belly" from side control: the library's move for that switch, if it has one.
      const move = now && ev.gain && rel('me', ev.role) === 'Top' && index.list.find(e => e.src === 'name' && e.p === phraseKey(now.pos + ' to ' + ev.pos))
      if (move && now.role === 'Top') {
        steps.push({ techId: move.ids[0], outcome: 'landed', conf: 0.8, alts: [], phrase: ev.phrase, span: ev.span })
        now = { pos: ev.pos, role: ev.role }
        return
      }
      // Plain "guard" takes the guard of the next move made from it: "passed my guard with a toreando" is open guard.
      const next = ev.vague && events.slice(i + 1).find(e => e.t !== 'pos' && e.ci === ev.ci), nt = next && index.byId[choose(next, ev, index, usage).techId]
      return goTo(nt && GUARDS.includes(nt.position) && !onMenu(nt.id, ev, next.who) ? { ...ev, pos: nt.position } : ev, ev.span)
    }
    // Carried over from before ("he gave his back, rear naked choke"): whoever the move suits from here did it.
    if (ev.soft && now) {
      const mine = onMenu(choose({ ...ev, who: 'me' }, now, index, usage).techId, now, 'me')
      const theirs = onMenu(choose({ ...ev, who: 'them' }, now, index, usage).techId, now, 'them')
      if (mine !== theirs) { ev.who = mine ? 'me' : 'them'; ev.outcome = mine ? (ev.outcome === 'caughtBy' ? 'landed' : ev.outcome) : 'caughtBy' }
    }
    const pick = choose(ev, now, index, usage), t = index.byId[pick.techId], home = homeOf(t, ev.who)
    if (ev.t === 'hint') { if (!now && home) goTo(home); return }
    // "Took the back" right after a move that already got you there says the same thing twice.
    const ends = now && landing(t.id, home || now)
    if (ev.ids.some(id => RESTATED.has(index.byId[id]?.name)) && ends && ends.pos === now.pos && rel(ev.who, ends.role) === now.role) return ev.post && goTo(ev.post, ev.post.span)
    if (!now) goTo(home || { pos: 'Standing', role: 'Neutral' })
    else if (home && t.position !== now.pos && !onMenu(t.id, now, ev.who) && !(t.position === 'Standing' && t.type !== 'Takedown' && t.name !== 'Guard pull')) goTo(home)
    steps.push({ techId: t.id, outcome: ev.outcome, conf: pick.conf, alts: pick.alts, phrase: ev.phrase, span: ev.span })
    // Where it lands, as the chain builder replays it. A back take the game doesn't list still ends on the back.
    const lands = ev.outcome !== 'tried' && landing(t.id, ev.outcome === 'caughtBy' ? { ...now, role: flip(now.role) } : now)
    if (lands) now = ev.outcome === 'caughtBy' ? { pos: lands.pos, role: flip(lands.role) } : lands
    else if (ev.outcome !== 'tried' && RESTATED.has(t.name) && !ev.post) goTo({ pos: 'Back', role: rel(ev.who, 'Top') }, ev.span)
    if (ev.post) goTo(ev.post, ev.post.span)
  })

  // The chain in the shape a saved roll keeps, plus how sure each step is.
  let at = start
  const chain = []
  steps.forEach(s => {
    if (!s.techId) { at = { pos: s.pos, role: s.role }; return }
    chain.push({ position: at.pos, role: at.role, techId: s.techId, outcome: s.outcome, who: s.outcome === 'caughtBy' ? 'them' : 'me', confidence: s.conf, alts: s.alts, phrase: s.phrase, span: s.span })
    const lands = s.outcome === 'landed' ? landing(s.techId, at) : s.outcome === 'caughtBy' ? landing(s.techId, { ...at, role: flip(at.role) }) : null
    if (lands) at = s.outcome === 'caughtBy' ? { pos: lands.pos, role: flip(lands.role) } : lands
  })
  const positions = events.flatMap(e => e.t === 'pos' ? [e.span] : e.post ? [e.post.span] : []).filter(Boolean)
  return { position: start?.pos || '', role: start?.role || '', steps, chain, partner, result: resultOf(chain, index, toks), unmatched, notes, positions }
}

const spanOf = (c, w) => { const it = c.items.find(x => x.w === w); return it ? [it.s, it.e] : null }

// Words after "hit", "tried", "went for" that named no move: shown so you can find the move or ignore them.
function leftovers(c, text) {
  const its = c.items, out = []
  its.forEach((it, i) => {
    const pair = it.k === 'w' && its[i + 1]?.k === 'w' && it.w + ' ' + its[i + 1].w
    const verb = it.k === 'w' && ['hit', 'tried', 'attempted', 'landed', 'finished', 'threw', 'used', 'did'].includes(it.w) ? 1 : ['went for', 'go for', 'going for', 'caught me', 'got me'].includes(pair) ? 2 : 0
    if (!verb) return
    const words = []
    for (let j = i + verb; j < its.length && its[j].k === 'w' && words.length < 4; j++) {
      if (FILLER.has(its[j].w) && !words.length) continue
      if (FILLER.has(its[j].w) || SPLIT.has(its[j].w) || ME.has(its[j].w) || THEM.has(its[j].w) || ['from', 'at', 'into', 'but'].includes(its[j].w)) break
      words.push(its[j])
    }
    if (words.some(x => x.w.length >= 4 && !COMMON.has(x.w))) out.push({ text: text.slice(words[0].s, words[words.length - 1].e), phrase: phraseKey(words.map(x => x.w).join(' ')), span: [words[0].s, words[words.length - 1].e] })
  })
  return out.slice(0, 1)
}

// "a bigger blue belt", "rolled with Sam".
function partnerHints(toks, text, partners, index) {
  const ws = toks.map(t => t.w || ''), out = {}
  ws.forEach((w, i) => {
    if (w === 'belt' && BELT_WORDS.includes(ws[i - 1]) && !ws.slice(Math.max(0, i - 4), i).some(x => ['im', 'am', 'as'].includes(x))) out.level ||= ws[i - 1][0].toUpperCase() + ws[i - 1].slice(1)
    const near = ws.slice(i + 1, i + 4).some(x => x === 'belt' || THEM.has(x) || partners.has(x)) || ws.slice(Math.max(0, i - 3), i).some(x => THEM.has(x) || x === 'with')
    if (HEAVIER.has(w) && near) out.size ||= 'Heavier'
    if (LIGHTER.has(w) && near) out.size ||= 'Lighter'
    if ((w === 'size' && ['same', 'similar', 'my'].includes(ws[i - 1]))) out.size ||= 'Similar'
    if (w === 'with' && /^\p{Lu}/u.test(toks[i + 1]?.raw || '') && !ME.has(ws[i + 1]) && !THEM.has(ws[i + 1]) && !index.vocab.has(ws[i + 1]) && !FILLER.has(ws[i + 1])) out.name ||= toks[i + 1].raw
    if (!out.name && partners.has(w) && /^\p{Lu}/u.test(toks[i].raw)) out.name = toks[i].raw
  })
  return out
}

// Worked when you finished them and they didn't finish you; broke when only they did.
function resultOf(chain, index, toks) {
  const sub = m => index.byId[m.techId]?.type === 'Submission'
  const mine = chain.some(m => m.outcome === 'landed' && sub(m)), theirs = chain.some(m => m.outcome === 'caughtBy' && sub(m))
  if (mine && !theirs) return 'worked'
  if (theirs && !mine) return 'broke'
  if (mine && theirs) return 'partial'
  const ws = ' ' + toks.map(t => t.w || '.').join(' ') + ' '
  if (/ (went well|dominated|great roll|good roll|felt great) /.test(ws)) return 'worked'
  if (/ (got smashed|rough|bad roll|fell apart|got destroyed|struggled) /.test(ws)) return 'broke'
  return chain.some(m => m.outcome === 'landed') && chain.some(m => m.outcome !== 'landed') ? 'partial' : ''
}
