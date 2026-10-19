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
  review: null,
  libQ: '',
  libGroup: '',
  libScope: 'mine',
}
