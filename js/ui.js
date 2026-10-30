import { today, ym } from './util.js'

// What's on screen right now. Not saved; resets on launch.
export const UI = {
  view: 'overview',
  calMonth: ym(new Date()),
  calDay: today(),
  journalQ: '',
  rollPos: '',
  rollRes: '',
  seqSel: null,
  seqNode: null,
  gpPick: {}, // the move each Game plan gap's actions use
  gpAt: '', // the position a Game plan edge jumps to
  quiz: null,
  scenario: null,
  sim: null,
  simSetup: null,
  libQ: '',
  libGroup: '',
  libScope: 'mine',
  partnerFilter: '', // Partners: '' everyone, 'gym' or 'rival'
  loadBy: 'week',
  sub: {}, // the sub-screen each screen shows, '' for its tiles
  more: {}, // how many items each long list shows
}
