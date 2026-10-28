// "Describe the roll": type it, or say it with the keyboard's mic, and the chain builder fills in from
// your words. All on the phone (parse.js), nothing sent anywhere. The chain builder is where you check it,
// and nothing is saved until you save the roll.
import { S } from './store.js'
import { RESULTS } from './vocab.js'
import { $, esc } from './util.js'
import { allTechs, partnerNames, sizeLabel, techUsage } from './model.js'
import { parseRoll } from './parse.js'
import { addChainStep, findMove, learnWord, loadChain } from './picker.js'

const EXAMPLE = 'Started in closed guard, hit a scissor sweep to mount, he bridged out to half guard, I passed with a knee cut and finished an arm triangle. Got caught in a triangle early on.'

// prefix names the roll's fields in a form with several ("r0_"), as the chain builder's does.
export const describeBox = prefix => `<div class="describe" data-describe="${esc(prefix)}">
  <label class="field"><span class="field-label">Describe the roll <span class="hint">Type it, or tap the mic on your keyboard and say it</span></span>
    <textarea rows="3" data-desc placeholder="${esc(EXAMPLE)}"></textarea></label>
  <div class="describe-go"><button type="button" class="btn sm" data-desc-build>Build chain</button><span class="small muted">Fills in the moves below. Nothing saves until you save the roll.</span></div>
  <div data-desc-review aria-live="polite"></div>
</div>`

export function wireDescribe(form) {
  form.addEventListener('click', e => {
    const wrap = e.target.closest('[data-describe]')
    if (!wrap) return
    if (e.target.closest('[data-desc-build]')) build(form, wrap)
    const miss = e.target.closest('[data-miss]')
    if (!miss) return
    const u = JSON.parse(miss.dataset.miss), box = chainOf(wrap)
    if (e.target.closest('[data-desc-ignore]')) miss.remove()
    if (e.target.closest('[data-desc-find]')) findMove({ title: `“${u.text}” is…`, onPick: id => {
      if (!id) return
      addChainStep(box, id, 'me')
      learnWord(u.phrase, id)
      miss.remove()
    } })
  })
}

const chainOf = wrap => wrap.parentElement.querySelector('[data-chain]')

function build(form, wrap) {
  const text = $('[data-desc]', wrap).value.trim(), review = $('[data-desc-review]', wrap)
  if (!text) { review.innerHTML = '<p class="small muted">Write or say a sentence or two first.</p>'; return }
  const got = parseRoll(text, { techs: allTechs(), personal: S.settings.moveWords || {}, partners: partnerNames(), usage: techUsage() })
  if (!got.position) { review.innerHTML = '<p class="small muted">No moves or positions found in that. Name the moves, like “knee cut” or “armbar”.</p>'; return }
  loadChain(chainOf(wrap), { pos: got.position, role: got.role, steps: got.steps.map(({ span, ...s }) => s) })
  const filled = fillDetails(form, wrap.dataset.describe, got, text)
  const moves = got.chain.length, unsure = got.chain.filter(m => m.confidence < 0.75).length
  review.innerHTML = `<p class="desc-marks">${marked(text, got)}</p>
    <p class="small muted">${moves ? `${moves} move${moves > 1 ? 's' : ''} in the chain below${unsure ? `, ${unsure} to check` : ''}.` : 'Only the position this time.'} Tap a move to switch landed, tried or caught by.${filled.length ? ` Filled in: ${esc(filled.join(', '))}.` : ''}</p>
    ${got.unmatched.length ? `<p class="field-label">Not matched</p><div class="miss-chips">${got.unmatched.map(u => `<span class="miss-chip" data-miss="${esc(JSON.stringify(u))}">“${esc(u.text)}” <button type="button" class="mini" data-desc-find>Find move</button><button type="button" class="mini" data-desc-ignore>Ignore</button></span>`).join('')}</div>` : ''}`
}

// Your words with each matched move marked and numbered in chain order, positions underlined.
function marked(text, got) {
  const spans = [...got.chain.map((m, i) => ({ s: m.span?.[0], e: m.span?.[1], cls: 'o-' + m.outcome + (m.confidence < 0.75 ? ' unsure' : ''), n: i + 1 })),
    ...got.positions.map(([s, e]) => ({ s, e, cls: 'pos' })), ...got.unmatched.map(u => ({ s: u.span[0], e: u.span[1], cls: 'miss' }))]
    .filter(x => x.s != null).sort((a, b) => a.s - b.s)
  let out = '', at = 0
  spans.forEach(x => {
    if (x.s < at) return
    out += esc(text.slice(at, x.s)) + `<mark class="${x.cls}">${esc(text.slice(x.s, x.e))}${x.n ? `<sup>${x.n}</sup>` : ''}</mark>`
    at = x.e
  })
  return out + esc(text.slice(at))
}

// Partner, result and the note, from what you said. A partner you named fills in from your last roll with them first.
function fillDetails(form, prefix, got, text) {
  const el = name => form.elements[prefix + name], p = got.partner, filled = []
  if (p.name && el('partner') && !el('partner').value.trim()) {
    el('partner').value = p.name
    el('partner').dispatchEvent(new Event('change', { bubbles: true }))
    filled.push(p.name)
  }
  if (p.level && el('level')) { el('level').value = p.level; filled.push(p.level.toLowerCase() + ' belt') }
  if (p.size && el('size')) { el('size').value = p.size; filled.push(sizeLabel(p.size)) }
  const radio = got.result && form.querySelector(`input[name="${CSS.escape(prefix + 'result')}"][value="${got.result}"]`)
  if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); filled.push(RESULTS[got.result].label.toLowerCase()) }
  if (el('what') && !el('what').value.trim()) { el('what').value = text; filled.push('what happened') }
  return filled
}
