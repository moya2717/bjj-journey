// LosMoya BJJ Journey: boot, navigation and the one click handler that drives every button.
import { S, load, onChange } from './store.js'
import { UI } from './ui.js'
import { BELT_LOOK } from './vocab.js'
import { $ } from './util.js'
import { currentRank, isSimple } from './model.js'
import { weeksOnTarget } from './analysis.js'
import * as overview from './views/overview.js'
import * as journal from './views/journal.js'
import * as rolls from './views/rolls.js'
import * as matchups from './views/matchups.js'
import * as sequences from './views/sequences.js'
import * as gameplan from './views/gameplan.js'
import * as library from './views/library.js'
import * as sim from './views/sim.js'
import * as study from './views/study.js'
import * as resources from './views/resources.js'
import * as compete from './views/compete.js'
import * as stats from './views/stats.js'
import * as injuries from './views/injuries.js'
import * as athlete from './views/athlete.js'
import * as review from './views/review.js'
import * as goals from './views/goals.js'
import * as hub from './views/hub.js'

const VIEWS = {
  overview: ['Home', overview],
  journal: ['Calendar', journal],
  rolls: ['Rolls', rolls],
  matchups: ['Matchups', matchups],
  review: ['Week', review],
  sequences: ['Sequences', sequences],
  gameplan: ['Game plan', gameplan],
  library: ['Moves', library],
  sim: ['Live roll', sim],
  resources: ['Resources', resources],
  study: ['Study', study],
  athlete: ['Profile', athlete],
  stats: ['Stats', stats],
  injuries: ['Injuries', injuries],
  compete: ['Compete', compete],
}

// Four sections on the bottom bar, each holding one or more screens as sub-tabs.
// Icons are simple 24px line drawings, so they follow the theme's text color.
const SECTIONS = {
  home: { label: 'Home', views: ['overview'], icon: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>' },
  journal: { label: 'Journal', views: ['journal', 'rolls', 'matchups', 'review'], icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  // Your game plan and what you study, together: sequences, the game plan they add up to, Live roll to rehearse them, moves, scenarios and resources.
  learn: { label: 'Learn', views: ['sequences', 'gameplan', 'sim', 'library', 'study', 'resources'], icon: '<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/><path d="M9 7h7"/>' },
  you: { label: 'You', views: ['athlete', 'stats', 'injuries', 'compete'], icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>' },
}
const sectionOf = view => Object.keys(SECTIONS).find(k => SECTIONS[k].views.includes(view))
const lastIn = {}

const actions = Object.assign(
  {
    tab: el => { UI.view = el.dataset.view; UI.sub[UI.view] = ''; scrollTo(0, 0) },
    // Home cards and tiles open their screen at the sub-screen they summarize.
    goto: el => { UI.view = el.dataset.view; UI.sub[UI.view] = el.dataset.anchor || ''; scrollTo(0, 0) },
    // Tapping the section you're in goes back to its first screen, like any iPhone tab bar.
    section: el => {
      const key = el.dataset.section, s = SECTIONS[key]
      if (sectionOf(UI.view) === key) UI.sub = {}
      UI.view = sectionOf(UI.view) === key ? s.views[0] : lastIn[key] || s.views[0]
      scrollTo(0, 0)
    },
  },
  ...Object.values(VIEWS).map(([, view]) => view.actions),
  goals.actions,
  hub.actions,
)

let shownView
function render() {
  renderHeader()
  const [, view] = VIEWS[UI.view]
  const app = $('#app')
  app.innerHTML = view.view()
  view.mount?.(app)
  // A new screen eases in; re-renders of the same screen (after a save or a tap) don't.
  if (shownView && shownView !== UI.view && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    app.animate?.([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.32,.72,0,1)' })
  shownView = UI.view
  // The log button would cover the answer buttons while you're quizzing or reviewing.
  $('.fab').hidden = (UI.view === 'sequences' && !!UI.quiz) || (UI.view === 'study' && !!UI.scenario) || (UI.view === 'sim' && !!UI.sim)
}

// The header is your belt: its color follows your rank, and the tape on the bar
// shows how many of the last 4 weeks you hit your weekly session target.
function renderHeader() {
  const look = S.profile.promotions.length ? BELT_LOOK[currentRank().belt] : null
  if (S.settings.theme) document.documentElement.dataset.theme = S.settings.theme
  else delete document.documentElement.dataset.theme
  const root = document.documentElement.style
  for (const [token, key] of [['--belt', 'belt'], ['--belt-ink', 'ink'], ['--belt-muted', 'muted'], ['--bar', 'bar']]) {
    if (look) root.setProperty(token, look[key])
    else root.removeProperty(token)
  }
  const current = sectionOf(UI.view)
  lastIn[current] = UI.view
  document.documentElement.style.setProperty('--top-h', $('.top').offsetHeight + 'px')
  $('#bottombar').innerHTML = `<div class="bottombar-inner">${Object.entries(SECTIONS).map(([key, s]) =>
    `<button data-act="section" data-section="${key}" ${key === current ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg><span>${s.label}</span></button>`).join('')}</div>`
  // Simple mode hides Matchups from the Journal tabs; Advanced stats still opens it.
  const subviews = SECTIONS[current].views.filter(k => k !== 'matchups' || !isSimple() || k === UI.view)
  $('#subnav').hidden = subviews.length < 2
  $('#subnav').innerHTML = `<div class="subnav-inner">${subviews.map(key =>
    `<button data-act="tab" data-view="${key}" ${key === UI.view ? 'aria-current="page"' : ''}>${VIEWS[key][0]}</button>`).join('')}</div>`
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

async function boot() {
  try {
    await load()
  } catch {
    $('#app').innerHTML = '<div class="empty-state"><h2>Storage is turned off</h2><p>This browser isn’t letting the journal save. On iPhone, turn off Private Browsing, or add the app to your Home Screen.</p></div>'
    return
  }
  onChange(render)
  render()
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // When an update finishes installing, reload once so it shows right away.
    const hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !document.querySelector('#sheet').open) location.reload() })
    navigator.serviceWorker.register('sw.js').catch(() => {})
  }
}

boot()
