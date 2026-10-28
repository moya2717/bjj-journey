// Scores the parser on the cases: move recall (expected moves it found), outcomes, order and start.
import { CATALOG } from '../js/catalog.js'
import { parseRoll } from '../js/parse.js'
import { BLIND, CASES, HELD_OUT } from './parse-cases.js'

const idOf = name => CATALOG.find(t => t.name === name)?.id || '?' + name
const nameOf = id => CATALOG.find(t => t.id === id)?.name || id

export { BLIND, CASES, HELD_OUT }
export function runCases(cases = CASES, techs = CATALOG) {
  let expected = 0, found = 0, outcomes = 0, extra = 0, starts = 0, inOrder = 0
  const rows = cases.map(c => {
    const got = parseRoll(c.text, { techs })
    const ids = got.chain.map(m => m.techId), want = c.chain.map(([n, o]) => [idOf(n), o])
    const hits = want.filter(([id]) => ids.includes(id))
    expected += want.length; found += hits.length
    outcomes += want.filter(([id, o]) => got.chain.some(m => m.techId === id && m.outcome === o)).length
    const extras = ids.filter(id => !want.some(([w]) => w === id))
    extra += extras.length
    const startOk = !c.start || got.position === c.start[0] && got.role === c.start[1]
    starts += startOk
    const order = ids.filter(id => want.some(([w]) => w === id)).join() === want.filter(([id]) => ids.includes(id)).map(([id]) => id).join()
    inOrder += order
    const partnerOk = !c.partner || Object.entries(c.partner).every(([k, v]) => got.partner[k] === v)
    const resultOk = !c.result || got.result === c.result
    const ok = !extras.length && hits.length === want.length && want.every(([id, o]) => got.chain.some(m => m.techId === id && m.outcome === o)) && startOk && order && partnerOk && resultOk
    return { ok, text: c.text, want: c.chain.map(([n, o]) => n + ' ' + o), got: got.chain.map(m => nameOf(m.techId) + ' ' + m.outcome + (m.confidence < 0.75 ? ' (?)' : '')),
      start: got.position + ' ' + got.role, wantStart: c.start?.join(' '), partner: partnerOk ? '' : JSON.stringify(got.partner), result: resultOk ? '' : got.result + ' ≠ ' + c.result, unmatched: got.unmatched.map(u => u.text) }
  })
  const pct = n => Math.round(n / expected * 1000) / 10
  return { rows, summary: { cases: cases.length, passed: rows.filter(r => r.ok).length, recall: pct(found), outcomes: pct(outcomes), extra, starts, inOrder, expected, found } }
}
