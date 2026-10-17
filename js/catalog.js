import { slug } from './util.js'

// The built-in move library, grouped by where the move happens and what it does.
// Ids are stable ("c:knee-cut-pass") so your notes and logs keep pointing at the right move.
const MOVES = {
  'Standing': {
    Takedown: ['Double leg', 'Single leg', 'High crotch', 'Ankle pick', 'Body lock takedown', 'Osoto gari', 'Ouchi gari', 'Kouchi gari', 'Seoi nage', 'Uchi mata', 'Harai goshi', 'Tai otoshi', 'De ashi barai (foot sweep)', 'Sumi gaeshi', 'Tomoe nage', 'Snap down'],
    Transition: ['Guard pull', 'Arm drag', 'Duck under', 'Collar drag'],
    Control: ['Collar and sleeve grips', 'Front headlock', 'Underhook pummeling'],
    Escape: ['Sprawl', 'Whizzer (standing)'],
    Submission: ['Arm-in guillotine'],
  },
  'Closed guard': {
    Sweep: ['Hip bump sweep', 'Scissor sweep', 'Flower sweep', 'Lumberjack sweep'],
    Submission: ['Armbar from guard', 'Triangle choke', 'Kimura', 'Omoplata', 'Guillotine', 'Cross collar choke', 'Loop choke'],
    Control: ['High guard', 'Overhook guard', 'Breaking posture'],
    Transition: ['Arm drag to back'],
    Pass: ['Standing guard break', 'Kneeling guard break'],
    Retention: ['Posture in closed guard'],
  },
  'Half guard': {
    Sweep: ['Underhook sweep', 'Old school sweep', 'Electric chair', 'Waiter sweep', 'Deep half sweep'],
    Retention: ['Knee shield', 'Lockdown', 'Deep half guard entry'],
    Transition: ['Back take from half guard', 'Switch base to mount'],
    Pass: ['Knee cut pass', 'Back step pass', 'Tripod pass'],
    Control: ['Crossface and underhook'],
    Escape: ['Whizzer'],
    Submission: ['Kimura from half guard', 'D’arce choke'],
  },
  'Butterfly guard': {
    Sweep: ['Butterfly sweep', 'Arm drag sweep', 'Elevator sweep'],
    Transition: ['Butterfly to single-leg X', 'Butterfly back take'],
    Submission: ['Guillotine from butterfly'],
    Retention: ['Butterfly guard retention'],
    Pass: ['Butterfly pass (hip switch)'],
  },
  'De La Riva': {
    Sweep: ['De La Riva sweep', 'Reverse De La Riva sweep', 'Tripod sweep', 'Sickle sweep'],
    Transition: ['Berimbolo', 'Back take from De La Riva', 'De La Riva to single-leg X'],
    Retention: ['De La Riva hook'],
    Pass: ['De La Riva pass (knee slide out)'],
  },
  'Spider / lasso': {
    Sweep: ['Spider guard sweep', 'Lasso sweep', 'Balloon sweep'],
    Submission: ['Triangle from spider', 'Omoplata from lasso'],
    Retention: ['Spider guard retention'],
    Pass: ['Spider guard pass (break the grips)'],
  },
  'Open guard': {
    Pass: ['Long step pass', 'Leg drag pass', 'Torreando pass', 'Over-under pass', 'Double under pass', 'Stack pass', 'X-pass', 'Leg weave pass', 'Smash pass', 'Headquarters'],
    Sweep: ['Collar sleeve sweep', 'X-guard sweep', 'Shin-to-shin sweep'],
    Retention: ['Guard retention (frames and hips)', 'Inversion', 'Granby roll recovery'],
    Transition: ['Technical stand-up from guard', 'Shin-to-shin entry'],
  },
  'Leg entanglement': {
    Submission: ['Straight ankle lock', 'Inside heel hook', 'Outside heel hook', 'Kneebar', 'Toe hold', 'Estima lock', 'Calf slicer'],
    Control: ['Single-leg X', 'Ashi garami', '50/50', 'Saddle (inside sankaku)'],
    Transition: ['Imanari roll'],
    Escape: ['Heel hook defense'],
  },
  'Side control': {
    Submission: ['Americana', 'Kimura from side control', 'Arm triangle', 'Paper cutter choke', 'Baseball bat choke', 'Far-side armbar'],
    Control: ['Crossface control', 'Kesa gatame', 'Reverse kesa gatame'],
    Transition: ['Side control to mount', 'Side control to knee on belly'],
    Escape: ['Shrimp to guard recovery', 'Underhook escape to knees', 'Ghost escape'],
  },
  'Mount': {
    Submission: ['Armbar from mount', 'Arm triangle from mount', 'Ezekiel choke', 'Cross collar choke from mount', 'Americana from mount', 'Gift wrap'],
    Control: ['High mount', 'S-mount', 'Technical mount'],
    Escape: ['Upa (bridge and roll)', 'Elbow-knee escape', 'Kipping escape'],
  },
  'Back': {
    Submission: ['Rear naked choke', 'Bow and arrow choke', 'Collar choke from back', 'Short choke', 'Armbar from back'],
    Control: ['Seatbelt control', 'Body triangle', 'Hooks in'],
    Escape: ['Back escape (shoulder to the mat)'],
  },
  'Knee on belly': {
    Control: ['Knee on belly control'],
    Submission: ['Far-side armbar from knee on belly', 'Spinning armbar'],
    Escape: ['Knee on belly escape'],
  },
  'North-south': {
    Submission: ['North-south choke', 'Kimura from north-south'],
    Control: ['North-south control'],
    Escape: ['North-south escape'],
  },
  'Turtle': {
    Submission: ['Clock choke', 'Anaconda choke', 'Crucifix'],
    Transition: ['Seatbelt back take', 'Spiral ride'],
    Escape: ['Sit-out', 'Turtle to guard recovery'],
    Sweep: ['Peterson roll'],
  },
  'Solo drills': {
    Movement: ['Shrimp', 'Bridge', 'Technical stand-up', 'Forward roll', 'Backward roll', 'Granby roll', 'Sprawl drill', 'Breakfall', 'Sit-out drill', 'Hip switch', 'Penetration step', 'Leg circles'],
  },
}

export const CATALOG = Object.entries(MOVES).flatMap(([position, byType]) =>
  Object.entries(byType).flatMap(([type, names]) =>
    names.map(name => ({ id: 'c:' + slug(name), kind: 'tech', name, position, type, notes: '', link: '', builtIn: true }))))

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map(t => [t.id, t]))

// Solo movements are what the rep counter and rep achievements track by default.
export const SOLO_DRILLS = CATALOG.filter(t => t.position === 'Solo drills')
