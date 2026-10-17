// LosMoya BJJ Journey: boot, navigation and the one click handler that drives every button.
import { S, load, onChange } from './store.js'
import { UI } from './ui.js'
import { BELT_LOOK } from './vocab.js'
import { $, toast } from './util.js'
import { currentRank } from './model.js'
import { weeksOnTarget } from './analysis.js'
import { titleOf, unlockedIds } from './achievements.js'
import * as overview from './views/overview.js'
import * as journal from './views/journal.js'
import * as rolls from './views/rolls.js'
import * as matchups from './views/matchups.js'
import * as sequences from './views/sequences.js'
import * as library from './views/library.js'
import * as resources from './views/resources.js'
import * as achievements from './views/achievements.js'
import * as stats from './views/stats.js'

const VIEWS = {
  overview: ['Overview', overview],
  journal: ['Journal', journal],
  rolls: ['Rolling analysis', rolls],
  matchups: ['Matchups', matchups],
  sequences: ['Sequences', sequences],
  library: ['Library', library],
  resources: ['Resources', resources],
  achievements: ['Achievements', achievements],
  stats: ['Stats', stats],
}

const actions = Object.assign(
  { tab: el => { UI.view = el.dataset.view; scrollTo(0, 0) } },
  ...Object.values(VIEWS).map(([, view]) => view.actions),
)

function render() {
  renderHeader()
  const [, view] = VIEWS[UI.view]
  const app = $('#app')
  app.innerHTML = view.view()
  view.mount?.(app)
  $('.fab').hidden = UI.view === 'sequences' && !!UI.quiz
}

// The header is your belt: its color follows your rank, and the tape on the bar
// shows how many of the last 4 weeks you hit your weekly session target.
function renderHeader() {
  const look = S.profile.promotions.length ? BELT_LOOK[currentRank().belt] : null
  const root = document.documentElement.style
  for (const [token, key] of [['--belt', 'belt'], ['--belt-ink', 'ink'], ['--belt-muted', 'muted'], ['--bar', 'bar']]) {
    if (look) root.setProperty(token, look[key])
    else root.removeProperty(token)
  }
  $('#tabs').innerHTML = Object.entries(VIEWS).map(([key, [label]]) =>
    `<button class="tab" data-act="tab" data-view="${key}" ${UI.view === key ? 'aria-current="page"' : ''}>${label}</button>`).join('')
  $('.tab[aria-current]').scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const weeks = weeksOnTarget(), hits = weeks.filter(Boolean).length, target = S.settings.weeklyTarget || 3
  $('#rankbar').innerHTML = weeks.map(on => `<span class="stripe ${on ? 'on' : ''}"></span>`).join('')
  $('#rankbar').setAttribute('aria-label', `${hits} of the last 4 weeks at your target of ${target} sessions. Open stats.`)
  $('#rank-label').innerHTML = `${hits} of last 4 weeks<br>at ${target}+ sessions`
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]')
  const action = el && actions[el.dataset.act]
  if (!action) return
  if (await action(el) !== false) render()
})

// Celebrate anything that unlocks as a result of a save.
let unlocked = new Set()
function announceUnlocks() {
  const now = unlockedIds(), fresh = [...now].filter(id => !unlocked.has(id))
  unlocked = now
  if (!fresh.length) return
  setTimeout(() => toast(fresh.length === 1 ? `Achievement unlocked: ${titleOf(fresh[0])}` : `${fresh.length} achievements unlocked`), 900)
}

async function boot() {
  try {
    await load()
  } catch {
    $('#app').innerHTML = '<div class="empty-state"><h2>Storage is turned off</h2><p>This browser isn’t letting the journal save. On iPhone, turn off Private Browsing, or add the app to your Home Screen.</p></div>'
    return
  }
  unlocked = unlockedIds()
  onChange(() => { render(); announceUnlocks() })
  render()
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {})
}

boot()
