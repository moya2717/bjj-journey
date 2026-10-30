import { slug } from './util.js'

// Videos to learn from: deep links into bjj.tips, and a short list of free official videos.
// Every link here was opened and checked on the date in `verified`: the YouTube title and channel
// match what's written, and the channel is the creator's own (or their publisher's). No re-uploads.
// Add a video only after checking it the same way; never guess a YouTube id.
const CHECKED = '2026-10-30'
const watch = id => 'https://www.youtube.com/watch?v=' + id

// creator: the filter it sits under. by: the channel or store that publishes it.
// position: one of POSITIONS, only when the video is clearly about that position. moves: catalog names.
const v = (creator, by, id, title, position = '', moves = [], tags = []) =>
  ({ id, creator, by, url: watch(id), kind: 'video', title, position, techIds: moves.map(m => 'c:' + slug(m)), tags, verified: CHECKED })
const channel = (creator, by, url, title, note) => ({ id: url, creator, by, url, kind: 'channel', title, note, position: '', techIds: [], tags: [], verified: CHECKED })
const course = (creator, by, handle, title, position = '', moves = []) =>
  ({ id: handle, creator, by, url: 'https://bjjfanatics.com/products/' + handle, kind: 'course', paid: true, title, position, techIds: moves.map(m => 'c:' + slug(m)), tags: [], verified: CHECKED })

const GA = 'Gracie Academy', JD = 'John Danaher', MMA = 'MMA legends'
const GJA = 'Gracie Jiu-jitsu Academy', GB = 'GracieBreakdown', BF = 'BJJ Fanatics', BFB = 'Bernardo Faria BJJ Fanatics'

export const CREATORS = [GA, JD, MMA]

export const VIDEOS = [
  channel(GA, GJA, 'https://www.youtube.com/@GracieAcademy', 'Gracie Jiu-jitsu Academy channel', 'Ryron and Rener Gracie’s original channel from the Torrance academy.'),
  channel(GA, GB, 'https://www.youtube.com/@GracieBreakdown', 'GracieBreakdown channel', 'Technique lessons and Gracie Breakdown fight analysis.'),
  v(GA, GB, 'pHB553YG6co', 'Gracie Combatives 2.0, Lesson 1 (full lesson): trap and roll escape', 'Mount', ['Upa (bridge and roll)'], ['fundamentals', 'full lesson']),
  v(GA, GB, 'XaGK4aYox3g', 'Gracie Combatives 2.0, Lesson 2 (full lesson): Americana', 'Mount', ['Americana from mount'], ['fundamentals', 'full lesson']),
  v(GA, GB, 'HruAUe79bqY', 'Gracie Combatives 2.0, Lesson 3 (full lesson): mount control', 'Mount', [], ['fundamentals', 'full lesson']),
  v(GA, GJA, 'SlPrqwwiaOY', 'Gracie Insider: Americana from the mount', 'Mount', ['Americana from mount']),
  v(GA, GJA, 'CixH-SzPI5w', 'Americana counters', '', ['Americana']),
  v(GA, GJA, 'orME_zh22WA', 'Gracie Insider: armlock from the guard', 'Closed guard', ['Armbar from guard']),
  v(GA, GJA, 'bXHxZ_nO_BE', 'Gracie Insider: armlock from the mount, breaking the grip', 'Mount', ['Armbar from mount']),
  v(GA, GJA, 'H014jcfbJU0', 'Gracie Insider: armlock from the back', 'Back', ['Armbar from back']),
  v(GA, GJA, 'HA-2NRuTLkw', 'Gracie Insider: the kimura', '', ['Kimura']),
  v(GA, GJA, 'xqSdVL82QVk', 'Gracie Insider: kimura from the guard', 'Closed guard', ['Kimura']),
  v(GA, GJA, 'IwN-E7LO3bM', 'Gracie Insider: triangle choke', '', ['Triangle choke']),
  v(GA, GB, '-8uhoxoGwwc', 'Triangle choke: do not make this mistake', '', ['Triangle choke']),
  v(GA, GJA, 'jTggeOsMVyc', 'Gracie Insider: guillotine choke', '', ['Guillotine']),
  v(GA, GJA, 'PPV9k8PTHyU', 'Gracie Insider: guillotine defense, standing and when they pull guard', 'Standing', ['Guillotine defense']),
  v(GA, GB, 'cmR0Fy237mc', 'Rear naked choke: the most common mistake', 'Back', ['Rear naked choke']),
  v(GA, GB, 'UQO3V3Uo3t4', 'Three rear choke defenses', 'Back'),
  v(GA, GJA, 'aWs63-ghiVY', 'Gracie Insider: taking the back from the guard', 'Closed guard'),
  v(GA, GJA, 'eRKaM2Podzw', 'Gracie Insider: taking the back when they roll over', 'Back'),
  v(GA, GJA, '_SDPvk5Brpo', 'Gracie Insider: hook sweep from open guard', 'Open guard', ['Hook sweep']),
  v(GA, GJA, '1SHqZc_PEOw', 'Gracie Insider: elevator hook sweep', '', ['Elevator sweep']),
  v(GA, GJA, 'A4G2dRUb77M', 'Gracie Insider: open guard pass', 'Open guard'),
  v(GA, GJA, 'JJqXqD_Wy64', 'Gracie Insider: side mount triangle-armbar combo', 'Side control'),
  v(GA, GJA, '9p6m7zyCRvQ', 'Gracie Insider: thrusting mount escape counter', 'Mount'),
  v(GA, GJA, 'zTnoUU6Rwms', 'Gracie Insider: footlock', '', ['Straight ankle lock']),
  { id: 'gracie-university', creator: GA, by: 'Gracie University', url: 'https://www.gracieuniversity.com/', kind: 'course', paid: true, title: 'Gracie University online curriculum', position: '', techIds: [], tags: [], verified: CHECKED },

  channel(JD, BF, 'https://www.youtube.com/@BJJ.Fanatics', 'BJJ Fanatics channel', 'Free clips from Danaher’s instructionals, published by his publisher.'),
  channel(JD, BFB, 'https://www.youtube.com/@BernardoFariaBJJ', 'Bernardo Faria BJJ Fanatics channel', 'Long free lessons, including many with John Danaher.'),
  v(JD, BFB, 'QBqwipFt0Ww', 'The 3 most important techniques for a white belt'),
  v(JD, BFB, 'EMEueexp9zU', 'How to do the perfect mount escape', 'Mount'),
  v(JD, BFB, 'cuXq-k__9lQ', 'How to do the perfect side control escape', 'Side control'),
  v(JD, BFB, 'l8-JI7NND3E', 'How to perform the perfect rear naked choke', 'Back', ['Rear naked choke']),
  v(JD, BF, '-lMabjvtaLk', 'Entries into the rear triangle back position', 'Back', ['Back triangle']),
  v(JD, BFB, 'otskR_OjuBU', 'How to build the perfect closed guard game', 'Closed guard'),
  v(JD, BF, 'pQ43Oy5k9yQ', 'Arm bar from guard', 'Closed guard', ['Armbar from guard']),
  v(JD, BF, 'FChiT98_Cgg', 'Opening the closed guard: knee post method', 'Closed guard'),
  v(JD, BFB, 'E8x1Cva8hJ8', 'How to build the perfect half guard game', 'Half guard'),
  v(JD, BFB, 'Jz4oLDOHxLM', 'How to do the perfect half guard passing', 'Half guard'),
  v(JD, BF, 'eA9MZmfVrmA', 'Setting a crossface: a crucial skill of half guard passing', 'Half guard'),
  v(JD, BF, 'KFOhcg0n0Cc', 'Clearing a high knee shield', 'Half guard', ['Knee shield pass']),
  v(JD, BF, 'FY46hN7uHTE', 'Guard retention: the first skill', 'Open guard', ['Guard retention (frames and hips)']),
  v(JD, BF, 'su5aJYVr3hc', 'The butterfly guard sweep sumi gaeshi', 'Butterfly guard', ['Butterfly sweep']),
  v(JD, BFB, 'Swoni-e1CFg', 'Best takedowns for jiu-jitsu', 'Standing', [], ['takedowns']),
  v(JD, BF, 'hDpRFfU_Wos', 'Head inside double leg', 'Standing', ['Double leg'], ['takedowns']),
  v(JD, BF, 'VXIrPE5kTwY', 'Wrap around double leg', 'Standing', ['Double leg'], ['takedowns']),
  v(JD, BF, 'gCOp_HE3p-Q', 'Arm drag to low double leg', 'Standing', ['Arm drag', 'Double leg'], ['takedowns']),
  { id: 'john-danaher', creator: JD, by: BF, url: 'https://bjjfanatics.com/collections/john-danaher', kind: 'course', paid: true, title: 'All John Danaher instructionals', position: '', techIds: [], tags: [], verified: CHECKED },
  course(JD, BF, 'closed-guard-bjj-fundamentals-go-further-faster-by-john-danaher', 'Closed Guard: BJJ Fundamentals, Go Further Faster', 'Closed guard'),
  course(JD, BF, 'half-guard-bjj-fundamentals-go-further-faster-by-john-danaher', 'Half Guard: BJJ Fundamentals, Go Further Faster', 'Half guard'),
  course(JD, BF, 'guard-retention-bjj-fundamentals-go-further-faster-by-john-danaher', 'Guard Retention: BJJ Fundamentals, Go Further Faster', 'Open guard', ['Guard retention (frames and hips)']),
  course(JD, BF, 'passing-the-guard-bjj-fundamentals-go-further-faster-by-john-danaher', 'Passing the Guard: BJJ Fundamentals, Go Further Faster', 'Open guard'),
  course(JD, BF, 'pin-escapes-turtle-escapes-bjj-fundamentals-go-further-faster-by-john-danaher', 'Pin Escapes & Turtle Escapes: BJJ Fundamentals, Go Further Faster', 'Side control'),
  course(JD, BF, 'back-attacks-enter-the-system-by-john-danaher', 'Back Attacks: Enter the System', 'Back', ['Rear naked choke']),
  course(JD, BF, 'leglocks-enter-the-system-by-john-danaher', 'Leglocks: Enter the System', 'Leg entanglement'),
  course(JD, BF, 'standing2ground-takedowns-standing-skills-for-jiu-jitsu-by-john-danaher', 'Standing2Ground: Takedowns & Standing Skills for Jiu Jitsu', 'Standing'),

  channel(MMA, 'UFC', 'https://www.youtube.com/@ufc', 'UFC channel', 'Official free fights and highlights.'),
  channel(MMA, 'Henry Cejudo', 'https://www.youtube.com/@HenryCejudoTripleC', 'Henry Cejudo channel', 'Cejudo’s own channel, with a weekly technique video.'),
  v(MMA, BF, '_y7ZXxjJNJw', 'Georges St-Pierre: fake cross to double leg takedown', 'Standing', ['Double leg'], ['takedowns', 'Georges St-Pierre']),
  v(MMA, BF, 'avpFtByJEH4', 'Georges St-Pierre: fake cross to single leg to chest pressure', 'Standing', ['Single leg'], ['takedowns', 'Georges St-Pierre']),
  v(MMA, 'Hayabusa', '-jafY5733Vs', 'Georges St-Pierre: double leg takedown with ankle trip', 'Standing', ['Double leg'], ['takedowns', 'Georges St-Pierre']),
  v(MMA, GB, 'koCBxtoZnj4', 'Gracie Breakdown: GSP success secrets (UFC 154)', '', [], ['breakdown', 'Georges St-Pierre']),
  v(MMA, GB, 'As2YAwFwS2U', 'Gracie Breakdown: GSP success secrets, vol. 2 (UFC 158)', '', [], ['breakdown', 'Georges St-Pierre']),
  v(MMA, 'UFC', 'tvovnBdRcxo', 'Georges St-Pierre vs Carlos Condit, full fight (UFC 154)', '', [], ['full fight', 'Georges St-Pierre']),
  v(MMA, 'UFC', 'S5ZqBX9SMeQ', 'Georges St-Pierre: UFC Greatest Hits', '', [], ['highlights', 'Georges St-Pierre']),
  v(MMA, 'UFC', 'UHpQZEopWnA', 'Khabib Nurmagomedov sets the takedown record (21 at UFC 160)', 'Standing', [], ['takedowns', 'Khabib Nurmagomedov']),
  v(MMA, BFB, 'ma1Y9ZnY69g', 'Khabib Nurmagomedov teaches how to “smesh”', '', [], ['top control', 'Khabib Nurmagomedov']),
  v(MMA, BF, 's4OLLnXBgKw', 'Khabib Nurmagomedov: mounted triangle', 'Mount', ['Mounted triangle'], ['Khabib Nurmagomedov']),
  v(MMA, GB, '3bibDBtfawA', 'Gracie Breakdown: Khabib vs Gaethje, full fight', 'Mount', ['Mounted triangle'], ['breakdown', 'Khabib Nurmagomedov']),
  v(MMA, GB, 'oHvq2WlPkmg', 'Gracie Breakdown: Khabib vs Poirier, full fight (UFC 242)', '', ['Rear naked choke', 'Guillotine'], ['breakdown', 'Khabib Nurmagomedov']),
  v(MMA, GB, 'WlJfo6pGs_I', 'Gracie Breakdown: McGregor vs Khabib (UFC 229)', '', [], ['breakdown', 'Khabib Nurmagomedov']),
  v(MMA, 'UFC', 'hIpyHEgXfm4', 'Khabib Nurmagomedov vs Dustin Poirier, full fight (UFC 242)', '', [], ['full fight', 'Khabib Nurmagomedov']),
  v(MMA, 'UFC', 'ib-qGDrgbQ8', 'Daniel Cormier: top finishes', '', [], ['highlights', 'Daniel Cormier']),
  v(MMA, 'UFC', '0UYEVxvh2kI', 'Jon Jones vs Daniel Cormier 2, full fight (UFC 214)', '', [], ['full fight', 'Daniel Cormier']),
  v(MMA, 'UFC', 'g6-ijAuuUMw', 'Kamaru Usman vs Hayder Hassan, UFC debut, free fight', '', [], ['full fight', 'Kamaru Usman']),
  v(MMA, 'UFC', 'tA6sPKyI4sY', 'Kamaru Usman: greatest year', '', [], ['highlights', 'Kamaru Usman']),
  v(MMA, 'UFC', '_-dxHXd9B2Y', 'Islam Makhachev vs Arman Tsarukyan, full fight', '', [], ['full fight', 'Islam Makhachev']),
  v(MMA, 'UFC', 'XG4Hhd4rqhA', 'Unstoppable Islam Makhachev moments', '', [], ['highlights', 'Islam Makhachev']),
  v(MMA, GB, 'W57CCjkE2Dg', 'Gracie Breakdown: Makhachev is here to stay', '', [], ['breakdown', 'Islam Makhachev']),
  v(MMA, 'Henry Cejudo', 'UDsUynhPvZQ', 'Henry Cejudo teaches Demetrious Johnson the inside trip', 'Standing', ['Inside trip'], ['takedowns', 'Henry Cejudo']),
  v(MMA, 'Henry Cejudo', 'dbJdRf2T7jQ', 'Henry Cejudo: off-balance arm drag takedown setup', 'Standing', ['Arm drag'], ['takedowns', 'Henry Cejudo']),
  v(MMA, 'Henry Cejudo', 'BQOMst_Nbvo', 'Henry Cejudo and Demetrious Johnson: superman jab takedown setup', 'Standing', [], ['takedowns', 'Henry Cejudo']),
  v(MMA, BFB, 'Bc0kJX1T060', 'Henry Cejudo: a different way to finish the single leg', 'Standing', ['Single leg'], ['takedowns', 'Henry Cejudo']),
  v(MMA, BFB, 'm0jQ8ae8_g8', 'Henry Cejudo: how to take down a bigger opponent', 'Standing', [], ['takedowns', 'Henry Cejudo']),
  v(MMA, 'UFC', 'zqGyCQVtMb4', 'Henry Cejudo: UFC Greatest Hits', '', [], ['highlights', 'Henry Cejudo']),
]

// bjj.tips is a directory of videos and courses sorted by position and instructor. We link to its
// pages rather than copy its lists. The first page is the closest match; the rest are its variations.
export const TIPS = 'https://www.bjj.tips/'
const TIPS_PAGES = {
  'back-control': 'Back Control', 'closed-guard': 'Closed Guard', 'half-guard': 'Half Guard', 'mount': 'Mount', 'side-control': 'Side Control', 'turtle': 'Turtle',
  'butterfly-guard': 'Butterfly Guard', 'crab-ride': 'Crab Ride', 'de-la-riva-guard': 'De La Riva Guard', 'front-headlock': 'Front Headlock', 'guard-head-quarters': 'Guard Head Quarters',
  'inverted-guard': 'Inverted Guard', 'k-guard': 'K Guard', 'knee-on-belly': 'Knee On Belly', 'kesa-gatame': 'Kesa Gatame', 'lasso-guard': 'Lasso Guard', 'north-south': 'North South',
  'octopus-guard': 'Octopus Guard', 'open-guard': 'Open Guard', 'reverse-de-la-riva-guard': 'Reverse De La Riva Guard', 'spider-guard': 'Spider Guard', 'x-guard': 'X Guard', 'z-guard': 'Z Guard',
}
const TIPS_FOR = {
  'Front headlock': ['front-headlock'], 'Closed guard': ['closed-guard'], 'Half guard': ['half-guard', 'z-guard', 'octopus-guard'], 'Butterfly guard': ['butterfly-guard'],
  'De La Riva': ['de-la-riva-guard', 'crab-ride'], 'Reverse De La Riva': ['reverse-de-la-riva-guard'], 'X-guard': ['x-guard'], 'Spider / lasso': ['spider-guard', 'lasso-guard'],
  'Open guard': ['open-guard', 'k-guard', 'guard-head-quarters', 'inverted-guard'], 'Side control': ['side-control', 'kesa-gatame'], 'Mount': ['mount'], 'Back': ['back-control'],
  'Knee on belly': ['knee-on-belly'], 'North-south': ['north-south'], 'Turtle': ['turtle'],
}
// [label, url] for each bjj.tips page on a position; none for Standing, Lapel guards and Leg entanglement.
export const tipsFor = pos => (TIPS_FOR[pos] || []).map(k => [TIPS_PAGES[k], `${TIPS}positions/${k}.html`])
export const TIPS_INSTRUCTORS = ['Adam Wardzinski', 'Andre Galvao', 'Bernardo Faria', 'Brian Glick', 'Craig Jones', 'Dan Vallimont', 'Firas Zahabi', 'Giancarlo Bodoni', 'Gordon Ryan', 'Heath Pedigo',
  'Jeff Glover', 'John Danaher', 'Junny Ocasio', 'Lachlan Giles', 'Matt D’Aquino', 'Mikey Musumeci', 'Neil Melanson', 'Pete Letsos', 'Roy Dean', 'Ryan Hall', 'Tom DeBlass', 'Travis Stevens']
  .map(name => [name, `${TIPS}instructors/${slug(name)}.html`])

// The 11-character id of a YouTube link, or '' for anything else. Only YouTube's own hosts count.
export function youtubeId(url) {
  let u
  try { u = new URL(String(url).trim()) } catch { return '' }
  const host = u.hostname.replace(/^(www|m|music)\./, ''), path = u.pathname.split('/').filter(Boolean)
  const id = host === 'youtu.be' ? path[0]
    : ['youtube.com', 'youtube-nocookie.com'].includes(host) ? (u.searchParams.get('v') || (['embed', 'shorts', 'live', 'v'].includes(path[0]) ? path[1] : ''))
    : ''
  return /^[\w-]{11}$/.test(id || '') ? id : ''
}
