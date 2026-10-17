// Curated places to learn. Video channels link to a YouTube search, so the link keeps working
// even if a channel changes its handle.
const youtube = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q)

export const RESOURCE_GROUPS = [
  {
    title: 'Maps and study guides',
    items: [
      { name: 'Roadmap for BJJ (free book)', url: 'https://www.grapplearts.com/', note: 'Stephan Kesting’s free beginner book on the six key positions, with the highest-percentage escapes and submissions for each. Sign up on Grapplearts to get it.' },
      { name: 'BJJ Flowcharts', url: 'https://www.bjjflowcharts.com/pages/the-app', note: 'Interactive flowcharts paired with video. The first chapters are free.' },
      { name: 'House of Grapplers technique index', url: 'https://www.houseofgrapplers.com/pokedex', note: 'Techniques sorted by belt level and by the position they start from.' },
      { name: 'Kingz technique library', url: 'https://www.kingz.com/pages/learn-techniques', note: 'Step-by-step breakdowns of guards, sweeps, passes, escapes and submissions.' },
    ],
  },
  {
    title: 'Video instruction',
    items: [
      { name: 'Chewjitsu', url: youtube('Chewjitsu'), note: 'Concepts, training advice and fundamentals.' },
      { name: 'Gracie Breakdown', url: youtube('Gracie Breakdown'), note: 'Ryron and Rener Gracie break down techniques in real fights and matches.' },
      { name: 'Grapplearts', url: youtube('Grapplearts Stephan Kesting'), note: 'Clear technique lessons and principles.' },
      { name: 'Lachlan Giles', url: youtube('Lachlan Giles BJJ'), note: 'Guard retention, half guard and leg locks, explained systematically.' },
      { name: 'Bernardo Faria', url: youtube('Bernardo Faria BJJ'), note: 'Simple, high-percentage fundamentals and half guard.' },
      { name: 'Knight Jiu-Jitsu', url: youtube('Knight Jiu Jitsu'), note: 'Short, focused technique videos.' },
      { name: 'B-Team Jiu-Jitsu', url: youtube('B-Team Jiu Jitsu technique'), note: 'Modern no-gi technique and match study.' },
    ],
  },
  {
    title: 'Instructionals and courses',
    items: [
      { name: 'BJJ Fanatics', url: 'https://bjjfanatics.com/', note: 'The largest store of digital instructionals, from beginner to advanced.' },
      { name: 'Gracie University', url: 'https://www.gracieuniversity.com/', note: 'Structured online curriculum, including a beginner program.' },
    ],
  },
  {
    title: 'Competition and rules',
    items: [
      { name: 'IBJJF', url: 'https://ibjjf.com/', note: 'Gi and no-gi tournaments, the rule book and points system.' },
      { name: 'ADCC', url: 'https://adcombat.com/', note: 'Submission grappling’s biggest stage, with its own rules.' },
      { name: 'NAGA', url: 'https://www.nagafighter.com/', note: 'Beginner-friendly tournaments across the US.' },
      { name: 'Smoothcomp', url: 'https://smoothcomp.com/', note: 'Registration and brackets for many local events.' },
      { name: 'FloGrappling', url: 'https://www.flograppling.com/', note: 'Live and replayed matches to study.' },
    ],
  },
  {
    title: 'Reading and history',
    items: [
      { name: 'BJJ Heroes', url: 'https://www.bjjheroes.com/', note: 'Fighter profiles, records, lineage and technique articles.' },
      { name: 'Jiu-Jitsu Times', url: 'https://www.jiujitsutimes.com/', note: 'News, training articles and opinion.' },
    ],
  },
]

// Belt checklists: the moves most coaches expect before the next belt.
// Every item is a library move, so ticking one marks that move as learned.
export const CHECKLISTS = [
  {
    id: 'white-blue', title: 'White to blue belt',
    note: 'Survival, escapes and one attack from each main position.',
    moves: ['Shrimp', 'Bridge', 'Technical stand-up', 'Breakfall', 'Upa (bridge and roll)', 'Elbow-knee escape', 'Shrimp to guard recovery', 'Underhook escape to knees',
      'Back escape (shoulder to the mat)', 'Posture in closed guard', 'Standing guard break', 'Hip bump sweep', 'Scissor sweep', 'Flower sweep', 'Armbar from guard',
      'Triangle choke', 'Kimura', 'Guillotine', 'Cross collar choke', 'Knee shield', 'Underhook sweep', 'Knee cut pass', 'Torreando pass', 'Crossface control',
      'Americana', 'Side control to mount', 'Armbar from mount', 'Seatbelt control', 'Rear naked choke', 'Double leg', 'Guard pull', 'Sprawl'],
  },
  {
    id: 'blue-purple', title: 'Blue to purple belt',
    note: 'Build a guard game, a passing system and chains between attacks.',
    moves: ['Butterfly sweep', 'De La Riva hook', 'Tripod sweep', 'Sickle sweep', 'X-guard sweep', 'Single-leg X', 'Lockdown', 'Old school sweep', 'Deep half guard entry',
      'Omoplata', 'Triangle armbar', 'Loop choke', 'Leg drag pass', 'Long step pass', 'Over-under pass', 'Smash pass', 'Body lock pass', 'Headquarters',
      'Knee on belly control', 'Baseball bat choke', 'North-south choke', 'Bow and arrow choke', 'Body triangle', 'Arm drag to back', 'Seatbelt back take',
      'Straight ankle lock', 'Guard retention (frames and hips)', 'Granby roll recovery', 'Single leg', 'Snap down'],
  },
]

export const GLOSSARY = [
  ['Base', 'Your stability: how hard you are to sweep or knock over.'],
  ['Posture', 'Spine straight and head up. Keeps you safe in someone’s guard.'],
  ['Frame', 'A rigid arm or leg structure that holds distance, as opposed to pushing.'],
  ['Underhook', 'Your arm under their armpit. Usually the most important grip in a scramble.'],
  ['Overhook / whizzer', 'Your arm wrapped over theirs, often to stop an underhook or a single leg.'],
  ['Crossface', 'Shoulder or forearm across their face, turning their head away so they can’t turn in.'],
  ['Guard', 'Any position where your legs are between you and your partner.'],
  ['Pass', 'Getting past the legs to side control, mount or knee on belly.'],
  ['Sweep', 'Reversing from bottom to top, starting from guard.'],
  ['Reversal', 'Coming from bottom to top from a position other than guard.'],
  ['Kuzushi', 'Breaking their balance before a sweep or throw. From judo.'],
  ['Hooks', 'Your feet hooked inside their legs, as in back control or butterfly guard.'],
  ['Seatbelt', 'One arm over the shoulder and one under the armpit, hands clasped on their chest.'],
  ['Knee line', 'An imaginary line through the knee. Get past it to control a leg; keep it hidden to defend leg locks.'],
  ['Inside position', 'Your hands, knees or feet inside theirs. Whoever has it controls the exchange.'],
  ['Pummel', 'Swimming your arms inside to win underhooks.'],
  ['Shrimp', 'Hip escape: moving your hips away along the mat to make space.'],
  ['Bridge', 'Driving your hips up off the mat to off-balance whoever is on top.'],
  ['Stack', 'Driving their hips over their own head. A defense against armbars and triangles, and a pass.'],
  ['Turtle', 'On knees and elbows, curled up, usually after escaping a pass.'],
  ['Scramble', 'A fast exchange where neither person has a stable position.'],
  ['Positional hierarchy', 'Back, then mount, then side control, then guard. Improve your position before you submit.'],
  ['Position before submission', 'Secure control first so a failed submission doesn’t cost you the position.'],
  ['Ashi garami', 'A leg entanglement where you control one of their legs between yours.'],
  ['Flow roll', 'Light, cooperative rolling to practice movement without fighting for wins.'],
  ['Positional sparring', 'Live rounds that start from one position, with a reset when it ends.'],
  ['Tap', 'Patting your partner or the mat (or saying “tap”) to end a submission. Always respect it immediately.'],
  ['Oss', 'An all-purpose greeting or acknowledgment in many academies.'],
]

// IBJJF points. Check the current rule book before you compete; rules get updated.
export const POINTS = {
  table: [['Takedown', 2], ['Sweep', 2], ['Knee on belly', 2], ['Guard pass', 3], ['Mount', 4], ['Back control (with hooks)', 4]],
  notes: [
    'A position has to be held for 3 seconds to score.',
    'Advantages come from nearly scoring: an almost-sweep, a close submission, a near pass. They break ties on points.',
    'Penalties (stalling, illegal grips, fleeing the mat) break ties after advantages.',
    'Adult match length usually grows with belt: 5 minutes at white up to 10 at black. Check your event’s rules.',
    'ADCC and many no-gi events use different scoring, with no points early in the match.',
  ],
}
