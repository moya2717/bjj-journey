// node tests/run-parse.js [-v] [--held-out | --blind]: prints each failing case, then the scores.
import { BLIND, CASES, HELD_OUT, runCases } from './score.js'
const { rows, summary } = runCases(process.argv.includes('--held-out') ? HELD_OUT : process.argv.includes('--blind') ? BLIND : CASES)
rows.forEach(r => (!r.ok || process.argv.includes('-v')) && console.log((r.ok ? 'ok   ' : 'FAIL ') + r.text + '\n   want: ' + r.want.join(' → ') + (r.wantStart ? `  [${r.wantStart}]` : '') + '\n   got:  ' + r.got.join(' → ') + `  [${r.start}]` + (r.partner ? '\n   partner: ' + r.partner : '') + (r.result ? '\n   result: ' + r.result : '') + (r.unmatched.length ? '\n   unmatched: ' + r.unmatched.join(', ') : '')))
console.log(summary)
