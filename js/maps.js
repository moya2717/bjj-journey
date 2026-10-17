import { slug } from './util.js'
import { CATALOG_BY_ID } from './catalog.js'

// Game maps: ready-made decision trees for common positions. Each step is
// [who, what happens, library move (optional), next steps]. "me" is your move, "them" their reaction.
// You can copy any map into Sequences, then edit it to match how you actually play.

const MAPS = [
  {
    id: 'closed-guard-attacks', name: 'Closed guard attack cycle', position: 'Closed guard', role: 'Bottom',
    summary: 'Break posture, then attack whatever they give you. Armbar, triangle and omoplata cover each other.',
    tree: [['me', 'Break posture and control an arm', 'Breaking posture', [
      ['them', 'Posts a hand on your chest or hips', '', [['me', 'Armbar from guard', 'Armbar from guard', [
        ['them', 'Stacks you and pulls the elbow out', '', [['me', 'Switch to the triangle', 'Triangle choke', [
          ['them', 'Postures up and defends the triangle', '', [['me', 'Finish with the triangle armbar', 'Triangle armbar', []]]],
        ]]]],
      ]]]],
      ['them', 'Hides the arms and stays upright', '', [['me', 'Sit up into the hip bump', 'Hip bump sweep', [
        ['them', 'Posts a hand behind', '', [['me', 'Kimura on the posted arm', 'Kimura', []]]],
        ['them', 'Sits heavy and won’t post', '', [['me', 'Guillotine as they come forward', 'Guillotine', []]]],
      ]]]],
      ['them', 'Pulls an arm across and turns', '', [['me', 'Swing into the omoplata', 'Omoplata', []]]],
      ['them', 'Stands up in your guard', '', [['me', 'Grab the ankles and sweep', 'Lumberjack sweep', []]]],
    ]]],
  },
  {
    id: 'half-guard-bottom', name: 'Half guard bottom: the underhook game', position: 'Half guard', role: 'Bottom',
    summary: 'Win the underhook or get flattened. Every branch is about getting to your side and coming up.',
    tree: [['me', 'Knee shield, then fight for the underhook', 'Knee shield', [
      ['them', 'Crossfaces and flattens you', '', [['me', 'Lock down the leg', 'Lockdown', [
        ['them', 'Tries to free the leg', '', [['me', 'Electric chair sweep', 'Electric chair', []]]],
      ]]]],
      ['them', 'Lets you take the underhook', '', [['me', 'Come up to the dogfight', 'Underhook sweep', [
        ['them', 'Whizzers hard', '', [['me', 'Take the back', 'Back take from dogfight', []]]],
        ['them', 'Sprawls the hips back', '', [['me', 'Grab the far ankle', 'Old school sweep', []]]],
      ]]]],
      ['them', 'Stands tall with heavy pressure', '', [['me', 'Dive to deep half', 'Deep half guard entry', [
        ['them', 'Stays on the knees', '', [['me', 'Waiter sweep', 'Waiter sweep', []]]],
      ]]]],
    ]]],
  },
  {
    id: 'knee-cut-system', name: 'Half guard top: knee cut system', position: 'Half guard', role: 'Top',
    summary: 'Crossface and underhook first. The knee cut is the main road; each reaction opens another pass.',
    tree: [['me', 'Crossface and underhook', 'Crossface and underhook', [
      ['me', 'Knee cut', 'Knee cut pass', [
        ['them', 'Frames on your hip', '', [['me', 'Switch to the long step', 'Long step pass', []]]],
        ['them', 'Wins the underhook', '', [['me', 'Whizzer, then back step around', 'Back step pass', []]]],
        ['them', 'Rebuilds the knee shield', '', [['me', 'Clear the shield and slice', 'Knee shield pass', []]]],
        ['them', 'Turns away to turtle', '', [['me', 'Seatbelt and take the back', 'Seatbelt back take', []]]],
      ]],
      ['them', 'Locks down your leg', '', [['me', 'Flatten them and pass the lockdown', 'Lockdown pass', []]]],
    ]]],
  },
  {
    id: 'open-guard-passing', name: 'Open guard passing map', position: 'Open guard', role: 'Top',
    summary: 'Get to headquarters and read the guard. Each guard type has a pass that beats it.',
    tree: [['me', 'Establish headquarters', 'Headquarters', [
      ['them', 'Hooks with De La Riva', '', [['me', 'Pin the hooking leg and pass', 'Leg pin pass', []]]],
      ['them', 'Inserts butterfly hooks', '', [['me', 'Hip switch past the hooks', 'Butterfly pass (hip switch)', []]]],
      ['them', 'Spider or lasso grips', '', [['me', 'Break grips, then pass', 'Spider guard pass (break the grips)', []]]],
      ['them', 'Knees to the chest, feet on hips', '', [['me', 'Torreando to the side', 'Torreando pass', [
        ['them', 'Recovers guard with the legs', '', [['me', 'Leg drag across', 'Leg drag pass', []]]],
      ]]]],
      ['them', 'Shin-to-shin from seated guard', '', [['me', 'Smash the legs and pass', 'Smash pass', []]]],
    ]]],
  },
  {
    id: 'mount-attacks', name: 'Mount attack cycle', position: 'Mount', role: 'Top',
    summary: 'Climb high, then read the arms. When they turn, take the back.',
    tree: [['me', 'Climb to high mount', 'High mount', [
      ['them', 'Pushes on your chest', '', [['me', 'Armbar from mount', 'Armbar from mount', []]]],
      ['them', 'Turns to the side', '', [['me', 'S-mount', 'S-mount', [['me', 'Armbar from S-mount', 'Armbar from S-mount', []]]]]],
      ['them', 'Keeps the elbows tight', '', [['me', 'Cross collar choke', 'Cross collar choke from mount', []], ['me', 'Americana when an arm comes out', 'Americana from mount', []]]],
      ['them', 'Gives up the back', '', [['me', 'Take the back', 'Mount to back take', [['me', 'Rear naked choke', 'Rear naked choke', []]]]]],
    ]]],
  },
  {
    id: 'mount-escapes', name: 'Mount escape map', position: 'Mount', role: 'Bottom',
    summary: 'Frame first, then bridge or shrimp depending on how they base.',
    tree: [['me', 'Frame and keep the elbows in', '', [
      ['them', 'Posts a hand on the mat', '', [['me', 'Trap the arm and bridge', 'Upa (bridge and roll)', []]]],
      ['them', 'Bases wide with both legs', '', [['me', 'Elbow-knee to half guard', 'Elbow-knee escape', []]]],
      ['them', 'Climbs to high mount', '', [['me', 'Kip and shrimp under', 'Kipping escape', []]]],
      ['them', 'Gets low with a crossface', '', [['me', 'Drag the heel and recover half', 'Heel drag escape', []]]],
    ]]],
  },
  {
    id: 'side-control-escapes', name: 'Side control escape map', position: 'Side control', role: 'Bottom',
    summary: 'Build frames, make space, then go back to guard or come up to your knees.',
    tree: [['me', 'Build frames on the neck and hip', '', [
      ['them', 'Drives the crossface in', '', [['me', 'Shrimp and put the guard back', 'Shrimp to guard recovery', []]]],
      ['them', 'Stays heavy on your chest', '', [['me', 'Underhook and come to the knees', 'Underhook escape to knees', [['me', 'Shoot the single leg', 'Turtle to single leg', []]]]]],
      ['them', 'Switches to kesa gatame', '', [['me', 'Escape the scarf hold', 'Kesa gatame escape', []]]],
      ['them', 'Steps over to mount', '', [['me', 'Elbow-knee as they step', 'Elbow-knee escape', []]]],
    ]]],
  },
  {
    id: 'back-attacks', name: 'Back attack system', position: 'Back', role: 'Top',
    summary: 'Seatbelt and hooks keep you there. Hand fighting decides which finish you get.',
    tree: [['me', 'Seatbelt and hooks', 'Seatbelt control', [
      ['them', 'Two-on-one hand fight on the choking arm', '', [['me', 'Trap the arm and choke', 'Arm trap choke', []], ['me', 'Short choke on the jaw', 'Short choke', []]]],
      ['them', 'Slides the shoulder to the mat', '', [['me', 'Follow to mount', 'Technical mount', [['me', 'Armbar from mount', 'Armbar from mount', []]]]]],
      ['them', 'Both hands on the collar (gi)', '', [['me', 'Bow and arrow choke', 'Bow and arrow choke', []]]],
      ['them', 'Hand fights high to protect the neck', '', [['me', 'Armbar from the back', 'Armbar from back', []]]],
    ]]],
  },
  {
    id: 'turtle-attacks', name: 'Turtle attack map', position: 'Turtle', role: 'Top',
    summary: 'Keep chest-to-back pressure and attack the openings their defense creates.',
    tree: [['me', 'Seatbelt from the side', 'Spiral ride', [
      ['them', 'Rolls or opens the hip', '', [['me', 'Insert hooks and take the back', 'Seatbelt back take', []]]],
      ['them', 'Stays tight with the elbows in', '', [['me', 'Clock choke', 'Clock choke', []]]],
      ['them', 'Shells and reaches for a leg', '', [['me', 'Trap the arm and crucifix', 'Crucifix', []]]],
      ['them', 'Sits out', '', [['me', 'Follow and front headlock', 'Front headlock', []]]],
    ]]],
  },
  {
    id: 'takedown-chain', name: 'Standing chain: snap down to takedown', position: 'Standing', role: 'Neutral',
    summary: 'Use the collar tie and snap down to make them react, then shoot where they open up.',
    tree: [['me', 'Collar tie and snap down', 'Snap down', [
      ['them', 'Posts up and stands tall', '', [['me', 'Double leg', 'Double leg', [
        ['them', 'Sprawls', '', [['me', 'Switch to the single', 'Single leg', []], ['me', 'Ankle pick', 'Ankle pick', []]]],
      ]]]],
      ['them', 'Head stays heavy and low', '', [['me', 'Front headlock', 'Front headlock', [['me', 'Go behind', 'Go-behind from front headlock', []], ['me', 'Guillotine', 'High elbow guillotine', []]]]]],
      ['them', 'Pulls guard', '', [['me', 'Step into headquarters and pass', 'Headquarters', []]]],
    ]]],
  },
  {
    id: 'leg-lock-entries', name: 'Leg lock entries (no-gi)', position: 'Leg entanglement', role: 'Bottom',
    summary: 'Enter single-leg X from butterfly, then pick the lock their posture gives you.',
    tree: [['me', 'Butterfly to single-leg X', 'Butterfly to single-leg X', [
      ['them', 'Stands tall', '', [['me', 'Straight ankle lock', 'Straight ankle lock', []]]],
      ['them', 'Turns the knee inward', '', [['me', 'Spin to the saddle', 'Saddle (inside sankaku)', [['me', 'Inside heel hook', 'Inside heel hook', []]]]]],
      ['them', 'Steps the free leg over', '', [['me', 'Outside heel hook', 'Outside heel hook', []]]],
      ['them', 'Sits back into 50/50', '', [['me', 'Fight for the heel first', '50/50', []]]],
    ]]],
  },
  {
    id: 'guard-retention', name: 'Guard retention map', position: 'Open guard', role: 'Bottom',
    summary: 'Keep your knees and feet between you and them. Each pass has its own counter.',
    tree: [['me', 'Frames and hip movement', 'Guard retention (frames and hips)', [
      ['them', 'Passes around to the side', '', [['me', 'Invert and recover', 'Inversion', []]]],
      ['them', 'Slides the knee through', '', [['me', 'Knee shield', 'Knee shield', []]]],
      ['them', 'Drags the legs across', '', [['me', 'Granby roll back to guard', 'Granby roll recovery', []]]],
      ['them', 'Stacks the legs over', '', [['me', 'Shoulder walk away', 'Shoulder walk', []]]],
    ]]],
  },
  {
    id: 'closed-guard-top', name: 'Closed guard top: open and pass', position: 'Closed guard', role: 'Top',
    summary: 'Posture first, break the guard open, then pass before they build a new one.',
    tree: [['me', 'Posture with hands on the hips', 'Posture in closed guard', [
      ['them', 'Breaks your posture down', '', [['me', 'Recover posture and reset grips', 'Posture in closed guard', []]]],
      ['them', 'Keeps the guard locked tight', '', [['me', 'Stand and break the guard', 'Standing guard break', [
        ['them', 'Grabs the ankles to sweep', '', [['me', 'Step back and kneel into the pass', 'Kneeling guard break', []]]],
        ['them', 'Opens the legs', '', [['me', 'Torreando to the side', 'Torreando pass', []]]],
      ]]]],
      ['them', 'Attacks an arm', '', [['me', 'Stack and pull the elbow out', 'Armbar defense (stack)', []], ['me', 'Posture out of the triangle', 'Triangle defense', []]]],
      ['them', 'Guard opens on its own', '', [['me', 'Knee in the middle, then pass', 'Knee in the middle break', [['me', 'Knee cut', 'Knee cut pass', []]]]]],
    ]]],
  },
  {
    id: 'butterfly-game', name: 'Butterfly guard game', position: 'Butterfly guard', role: 'Bottom',
    summary: 'Sit up, get an underhook or arm drag, and use the hooks to elevate.',
    tree: [['me', 'Sit up with hooks in', 'Butterfly guard retention', [
      ['them', 'Leans into you with weight forward', '', [['me', 'Elevate with the hook', 'Butterfly sweep', []]]],
      ['them', 'Pulls back and sits heavy', '', [['me', 'Arm drag to the back', 'Butterfly back take', []]]],
      ['them', 'Overhooks your arm', '', [['me', 'Overhook sweep', 'Overhook butterfly sweep', []]]],
      ['them', 'Head stays low', '', [['me', 'Guillotine', 'Guillotine from butterfly', []]]],
      ['them', 'Stands up', '', [['me', 'Elevate into single-leg X', 'Butterfly to single-leg X', [['me', 'Ankle lock', 'Straight ankle lock', []]]]]],
    ]]],
  },
  {
    id: 'dlr-game', name: 'De La Riva game', position: 'De La Riva', role: 'Bottom',
    summary: 'Hook, sleeve and ankle grips. Off-balance them, then sweep or roll under to the back.',
    tree: [['me', 'De La Riva hook with sleeve and ankle', 'De La Riva hook', [
      ['them', 'Leans back to stay balanced', '', [['me', 'Tripod sweep', 'Tripod sweep', []]]],
      ['them', 'Steps forward to pressure', '', [['me', 'Sickle sweep', 'Sickle sweep', []], ['me', 'De La Riva sweep', 'De La Riva sweep', []]]],
      ['them', 'Turns to knee slice out', '', [['me', 'Roll under with the berimbolo', 'Berimbolo', [['me', 'Take the back', 'Back take from De La Riva', []]]]]],
      ['them', 'Squares up and stands tall', '', [['me', 'Switch to single-leg X', 'De La Riva to single-leg X', []]]],
    ]]],
  },
  {
    id: 'knee-on-belly', name: 'Knee on belly attacks', position: 'Knee on belly', role: 'Top',
    summary: 'Heavy knee, far-side grips. Their escape attempts open the arm or the mount.',
    tree: [['me', 'Heavy knee on belly', 'Knee on belly control', [
      ['them', 'Pushes your knee with both arms', '', [['me', 'Far-side armbar', 'Far-side armbar from knee on belly', []]]],
      ['them', 'Turns in toward you', '', [['me', 'Spin into the armbar', 'Spinning armbar', []]]],
      ['them', 'Turns away to escape', '', [['me', 'Slide to mount', 'Knee on belly to mount', []]]],
      ['them', 'Gives a deep collar', '', [['me', 'Baseball bat choke', 'Baseball bat choke', []]]],
    ]]],
  },
  {
    id: 'front-headlock-attacks', name: 'Front headlock attacks', position: 'Front headlock', role: 'Top',
    summary: 'Control the head and an arm. Where they push decides the choke or the go-behind.',
    tree: [['me', 'Chin strap and arm control', 'Chin strap control', [
      ['them', 'Drives forward into you', '', [['me', 'High elbow guillotine', 'High elbow guillotine', []]]],
      ['them', 'Turns the head to the side', '', [['me', 'Spin behind', 'Front headlock spin behind', []], ['me', 'D’arce choke', 'D’arce choke', []]]],
      ['them', 'Sits back on the heels', '', [['me', 'Snap them down to turtle', 'Go-behind from front headlock', []]]],
      ['them', 'Locks an arm around your waist', '', [['me', 'Anaconda roll', 'Anaconda choke', []]]],
    ]]],
  },
  {
    id: 'takedown-defense', name: 'Takedown defense', position: 'Standing', role: 'Neutral',
    summary: 'Hips back and hands first. Every defense should end with you on top or in front of their head.',
    tree: [['me', 'Stance with hands in front', 'Collar and sleeve grips', [
      ['them', 'Shoots a double leg', '', [['me', 'Sprawl and crossface', 'Crossface sprawl', [['me', 'Go behind to the back', 'Go-behind from front headlock', []]]]]],
      ['them', 'Captures a single leg', '', [['me', 'Limp leg and whizzer', 'Single leg defense (limp leg)', []]]],
      ['them', 'Pummels for a body lock', '', [['me', 'Frame, hips back, re-pummel', 'Underhook pummeling', []]]],
      ['them', 'Ducks under your arm', '', [['me', 'Turn in and downblock', 'Downblock', []]]],
    ]]],
  },
]

const techIdFor = name => {
  if (!name) return ''
  const id = 'c:' + slug(name)
  return CATALOG_BY_ID[id] ? id : ''
}

// Flattens a map tree into the node list Sequences uses.
function toNodes(map) {
  const nodes = []
  let n = 0
  const walk = (steps, parentId) => steps.forEach(([who, label, tech, next]) => {
    const id = `${map.id}-${++n}`
    nodes.push({ id, parentId, who, label, techId: techIdFor(tech), note: '' })
    walk(next, id)
  })
  walk(map.tree, null)
  return nodes
}

export const GAME_MAPS = MAPS.map(m => ({ ...m, nodes: toNodes(m) }))
