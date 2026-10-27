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
  quiz: null,
  scenario: null,
  sim: null,
  simSetup: null,
  libQ: '',
  libGroup: '',
  libScope: 'mine',
  loadBy: 'week',
  sub: {}, // the sub-screen each screen shows, '' for its tiles
  more: {}, // how many items each long list shows
}
