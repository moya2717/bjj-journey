// Example entries so a fresh journal shows what it does. All marked example: true, removable from You → Profile.
import { S } from './store.js'
import { FEELS, PLAN_HIT, PROMPTS } from './vocab.js'
import { byDateAsc, daysAgo, ym } from './util.js'

const T = key => ({ kc: 'c:knee-cut-pass', hb: 'c:hip-bump-sweep', ki: 'c:kimura', gu: 'c:guillotine', ls: 'c:long-step-pass', uh: 'c:underhook-sweep', ek: 'c:elbow-knee-escape', rn: 'c:rear-naked-choke' }[key])

// [days ago, type, minutes, rounds, focus, drilled, worked, went wrong, lesson]
const SESSIONS = [[68,'Gi',90,5,['Half guard'],['kc'],'Knee cut felt crisp in drilling.','Kept getting underhooked as soon as I cut.','Win the underhook before cutting.'],[64,'No-gi',60,4,['Half guard','Turtle'],['kc'],'Got to turtle twice off the cut.','Couldn’t hold the crossface without the gi.','Shoulder pressure first, then cut.'],[61,'Gi',90,5,['Closed guard'],['hb','ki'],'Kimura off the hip bump landed in drilling.','Partners sat back and I had nothing.','I need a plan for when they won’t post.'],[57,'Open mat',120,7,['Half guard','Mount'],[],'Long rounds, cardio held up.','Stuck under mount for half a round.','Frame before they settle.'],[54,'Gi',90,5,['Half guard'],['kc','ls'],'Long step when they frame worked twice.','Underhook again. Same mistake.','Kill the underhook with the crossface arm.'],[50,'Gi',75,4,['Mount'],['ek'],'Elbow-knee escape felt smooth.','Tired by round three.',''],[47,'No-gi',60,5,['Half guard'],['kc','uh'],'Passed a blue belt.','Got swept from the dogfight.','Whizzer early, don’t wait.'],[43,'Gi',90,5,['Closed guard'],['hb','gu'],'Guillotine caught someone posting down.','Got stacked on the guillotine.',''],[40,'Gi',90,5,['Half guard'],['kc'],'Passed three times in rolls.','',''],[36,'Competition',45,3,['Standing','Half guard'],[],'Won the first match on points.','Lost the second to a guard pull I didn’t expect.','Have a plan for guard pulls.'],[33,'Gi',90,5,['Back'],['rn'],'Back takes from turtle are getting easier.','',''],[29,'No-gi',60,5,['Half guard','Turtle'],['kc'],'','Knee shield shut me down all night.','Ask coach about knee shield passes.'],[26,'Gi',90,5,['Closed guard'],['hb','ki'],'Hip bump into kimura in a live roll.','',''],[22,'Open mat',120,6,['Half guard'],['kc','ls'],'Whizzer timing is better.','Stalled against a brown belt.',''],[19,'Gi',90,5,['Half guard'],['kc'],'Two passes and a back take.','',''],[15,'Gi',90,5,['Closed guard'],['gu'],'','Couldn’t stop people standing in my guard.','Find a standing guard answer.'],[12,'No-gi',60,4,['Half guard','Back'],['kc','rn'],'Whizzer early worked every time.','',''],[8,'Gi',90,5,['Half guard'],['kc'],'','Knee shield again.',''],[5,'Gi',90,6,['Closed guard','Mount'],['hb'],'Kimura and guillotine both landed.','',''],[2,'Open mat',105,6,['Half guard'],['kc','ls'],'Passed a purple belt with the cut.','Brown belt still stalls me.','Stay heavy, don’t rush the second cut.'],[27,'Drilling only',45,0,['Half guard'],['kc'],'','',''],[20,'Drilling only',45,0,['Closed guard'],['hb'],'','',''],[13,'No-gi',60,4,['Turtle','Back'],['rn'],'Back takes felt automatic.','',''],[10,'Drilling only',45,0,['Half guard'],['kc','ls'],'','',''],[6,'Drilling only',45,0,['Half guard'],['kc'],'','',''],[3,'Gi',90,5,['Mount'],['ek'],'','Still slow to frame under mount.','']]

// [days ago, belt, position, role, sequence, step, move, result, causes, what happened, try next, status]
const ROLLS = [[68,'Blue','Half guard','Top','A','a4','','broke',['Grips','Didn’t read the reaction'],'Cut too early, he underhooked and came up.','Crossface first, then cut','worked'],[64,'Purple','Half guard','Top','A','a4','','broke',['Base'],'Lost the crossface and ended up in a dogfight.','Whizzer as soon as the underhook comes','worked'],[61,'White','Closed guard','Bottom','B','b3','','worked',[],'Hip bump, he posted, kimura.','',''],[61,'Blue','Closed guard','Bottom','B','b4','','broke',['Didn’t know the next step'],'He sat heavy and I just held closed guard.','Guillotine when he postures down','worked'],[57,'Brown','Mount','Bottom','','','ek','broke',['Frames','Cardio'],'Couldn’t get the elbow in, he climbed high.','Frame on the hip before he settles','open'],[57,'Blue','Half guard','Top','A','a4','','broke',['Grips'],'Underhook again.','',''],[54,'Blue','Half guard','Top','A','a3','','worked',[],'He framed, I long-stepped to side control.','',''],[54,'Purple','Half guard','Top','A','a4','','partial',['Timing'],'Had the crossface but he still came up.','',''],[50,'White','Mount','Bottom','','','ek','worked',[],'Escaped to half guard.','',''],[47,'Blue','Half guard','Top','A','a5','','broke',['Rushed it','Base'],'Whizzered late and he took my back.','Sprawl the hips before he gets to his knees','open'],[47,'White','Half guard','Top','A','a1','','worked',[],'Clean pass.','',''],[43,'Blue','Closed guard','Bottom','B','b5','','partial',['Posture'],'Caught it but got stacked.','Close the guard and arch, don’t pull straight','open'],[40,'Blue','Half guard','Top','A','a1','','worked',[],'Passed.','',''],[36,'Unknown','Standing','Neutral','','','','broke',['Didn’t read the reaction'],'He pulled guard and I froze.','Break grips and step to a passing stance','open'],[29,'Purple','Half guard','Top','A','a6','','broke',['Didn’t know the next step'],'He kept rebuilding the knee shield.','Ask coach about knee shield passes','open'],[26,'Blue','Closed guard','Bottom','B','b3','','worked',[],'Hip bump into kimura, live.','',''],[22,'Brown','Half guard','Top','A','a5','','partial',['Base'],'Kept the whizzer but stalled.','',''],[22,'Blue','Half guard','Top','A','a3','','worked',[],'Long step to side control.','',''],[19,'Blue','Half guard','Top','A','a1','','worked',[],'Passed straight through.','',''],[19,'Purple','Back','Top','A','a8','','worked',[],'Turtle to seatbelt to choke.','',''],[15,'Blue','Closed guard','Bottom','B','b6','','broke',['Didn’t know the next step'],'He stood and broke my guard open.','Learn an answer to standing in closed guard','open'],[12,'Blue','Half guard','Top','A','a5','','worked',[],'Whizzer early, re-pummeled and passed.','',''],[8,'Purple','Half guard','Top','A','a6','','partial',['Grips'],'Knee shield again, got halfway.','',''],[8,'White','Mount','Bottom','','','ek','worked',[],'Elbow-knee to half guard.','',''],[5,'Blue','Closed guard','Bottom','B','b3','','worked',[],'Kimura on the post.','',''],[5,'Blue','Closed guard','Bottom','B','b5','','worked',[],'Guillotine, closed guard, arched. Tap.','',''],[2,'Purple','Half guard','Top','A','a1','','worked',[],'Cut through clean.','',''],[2,'Brown','Half guard','Top','A','a4','','partial',['Base'],'He came up but I stopped the sweep.','','']]


const PARTNERS = {
  Marco: ['Heavier', ['Pressure passer', 'Strong / athletic']],
  Tom: ['Heavier', ['Wrestler', 'Strong / athletic']],
  Dani: ['Similar', ['Guard player']],
  Chris: ['Heavier', ['Strong / athletic']],
  Sam: ['Similar', ['Scrambler']],
  Lee: ['Lighter', ['Guard player', 'Patient / technical']],
  Alex: ['Lighter', ['Scrambler']],
}

function partnerFor(belt, step, i) {
  if (belt === 'Brown') return 'Marco'
  if (belt === 'Purple') return step === 'a6' ? 'Dani' : 'Tom'
  if (belt === 'Blue') return ['a4', 'a5', 'b6'].includes(step) ? 'Chris' : i % 2 ? 'Sam' : 'Lee'
  return belt === 'White' ? 'Alex' : ''
}

const node = (id, parentId, who, label, tech) => ({ id, parentId, who, label, techId: tech ? T(tech) : '', note: '' })

const SEQUENCES = [
  { id: 'seq_exA', name: 'Knee cut series', position: 'Half guard', role: 'Top', notes: 'Win the underhook battle before cutting.', nodes: [
    node('a1', null, 'me', 'Knee cut with crossface and underhook', 'kc'), node('a2', 'a1', 'them', 'Frames on my hip and blocks the knee'),
    node('a3', 'a2', 'me', 'Switch to long step', 'ls'), node('a4', 'a1', 'them', 'Wins the underhook and comes up'),
    node('a5', 'a4', 'me', 'Whizzer, sprawl the hips, re-pummel'), node('a6', 'a1', 'them', 'Pulls the knee shield back in'),
    node('a7', 'a1', 'them', 'Turns away to turtle'), node('a8', 'a7', 'me', 'Seatbelt and take the back', 'rn')] },
  { id: 'seq_exB', name: 'Hip bump game', position: 'Closed guard', role: 'Bottom', notes: '', nodes: [
    node('b1', null, 'me', 'Hip bump sweep', 'hb'), node('b2', 'b1', 'them', 'Posts the hand behind'),
    node('b3', 'b2', 'me', 'Kimura on the posted arm', 'ki'), node('b4', 'b1', 'them', 'Sits heavy and won’t post'),
    node('b5', 'b4', 'me', 'Guillotine as they posture down', 'gu'), node('b6', 'b1', 'them', 'Stands up in my guard')] },
]

export function exampleRecords() {
  const created = d => Date.now() - d * 864e5
  const sessions = SESSIONS.map(([d, type, minutes, rounds, focus, drilled, worked, struggled, lesson], i) => ({
    id: 'session_ex' + i, kind: 'session', example: true, date: daysAgo(d), type, minutes, rounds, focus,
    drilled: drilled.map(T), worked, struggled, lesson, createdAt: created(d),
    reps: i % 3 === 0 ? [{ techId: 'c:shrimp', count: 40 }, { techId: 'c:technical-stand-up', count: 20 }] : i % 3 === 1 ? [{ techId: 'c:bridge', count: 30 }] : [],
  }))
  // Each session plans around the lesson from the one before it.
  ;[...sessions].sort(byDateAsc).forEach((s, i, all) => {
    s.feel = FEELS[(i * 3 + 2) % 5]
    if (all[i - 1]?.lesson && s.type !== 'Drilling only') { s.plan = all[i - 1].lesson; s.planHit = PLAN_HIT[i % 3] }
  })
  const AREA_FOR = { 'Half guard': 'Passing', 'Closed guard': 'Sweeps', 'Mount': 'Escapes', 'Back': 'Back takes', 'Turtle': 'Back takes', 'Standing': 'Takedowns' }
  sessions.forEach(s => {
    const areas = s.focus.map(p => AREA_FOR[p]).filter(Boolean)
    s.wentWell = s.worked ? areas.slice(0, 1).concat(s.minutes >= 105 ? ['Cardio and pace'] : []) : []
    s.trouble = s.struggled ? areas.slice(-1).concat(/tired|cardio/i.test(s.struggled) ? ['Cardio and pace'] : []) : []
  })
  const kneeShield = sessions.find(s => s.date === daysAgo(29))
  Object.assign(kneeShield, { coachQ: 'How do I pass a knee shield that keeps coming back?', reflectQ: PROMPTS[1], reflectA: 'Purple belts rebuild the knee shield every time I back off to re-grip. I give them the space myself.' })
  const sessionOn = d => sessions.find(s => s.date === daysAgo(d))?.id || ''

  const rolls = ROLLS.map(([d, level, position, role, seq, step, tech, result, reasons, what, tryNext, tryStatus], i) => {
    const partner = partnerFor(level, step, i), [size, styles] = PARTNERS[partner] || ['', []]
    return { id: 'roll_ex' + i, kind: 'roll', example: true, date: daysAgo(d), sessionId: sessionOn(d), partner, size, styles, level, position, role,
      seqId: seq ? 'seq_ex' + seq : '', nodeId: step, techId: tech ? T(tech) : '', result, reasons, what, tryNext, tryStatus, createdAt: created(d) + i }
  })

  const month = ym(new Date())
  const goals = [
    { id: 'goal_ex1', title: '1,000 shrimps', metric: 'reps', target: 1000, techId: 'c:shrimp', from: daysAgo(70) },
    { id: 'goal_ex2', title: 'Pass half guard 5 times live this month', metric: 'rollsWorked', target: 5, position: 'Half guard', role: 'Top', from: month + '-01', until: '' },
    { id: 'goal_ex3', title: 'Drill the knee cut in 8 sessions', metric: 'drilled', target: 8, techId: T('kc'), from: daysAgo(70) },
  ].map(g => ({ kind: 'goal', example: true, position: '', role: '', until: '', manual: 0, ...g }))

  const techs = [
    { id: T('kc'), kind: 'tech', example: true, starred: true, notes: 'Crossface and underhook first, then slide the knee across the thigh.' },
    { id: T('hb'), kind: 'tech', example: true, starred: true, notes: 'Open the guard, sit up on the elbow, post the hand, drive the hip.' },
  ]

  const profile = S.profile.createdAt ? [] : [{
    id: 'profile_main', kind: 'profile', example: true, name: '', gym: '', startDate: daysAgo(980),
    promotions: [[980, 'White', 0, 'First class.'], [760, 'White', 2, ''], [560, 'White', 4, ''], [430, 'Blue', 0, 'Promoted after the spring open. Didn’t see it coming.'], [200, 'Blue', 1, '']]
      .map(([d, belt, stripes, note], i) => ({ id: 'pr_ex' + i, date: daysAgo(d), belt, stripes, note })),
    tournaments: [
      { id: 'tc_ex1', date: daysAgo(450), name: 'Spring Open', division: 'Adult White Gi, middleweight', place: 'Gold', wins: 3, losses: 0, subs: 2, notes: 'Closed guard and kimura carried the day.' },
      { id: 'tc_ex2', date: daysAgo(36), name: 'Fall Open', division: 'Adult Blue Gi, middleweight', place: 'Bronze', wins: 1, losses: 1, subs: 0, notes: 'Won the first on points. Lost the second to a guard pull I didn’t expect.' },
    ],
  }]

  return [...techs, ...SEQUENCES.map(s => ({ ...s, kind: 'seq', example: true })), ...sessions, ...rolls, ...goals, ...profile]
}
