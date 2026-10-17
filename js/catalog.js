import { slug } from './util.js'

// The built-in move library, grouped by where the move happens and what it does.
// Ids come from the name ("c:knee-cut-pass"), so never rename a move here: your logs point at it.
// Moving a move to another group or type is safe.
const MOVES = {
  'Standing': {
    Takedown: ['Double leg', 'Blast double', 'Single leg', 'Low single', 'Sweep single', 'High crotch', 'Ankle pick', 'Knee tap', 'Body lock takedown', 'Fireman’s carry', 'Inside trip', 'Outside trip', 'Lateral drop', 'Suplex', 'Head and arm throw', 'Hip toss',
      'Osoto gari', 'Ouchi gari', 'Kouchi gari', 'Kosoto gari', 'Seoi nage', 'Ippon seoi nage', 'Drop seoi nage', 'Uchi mata', 'Harai goshi', 'O goshi', 'Koshi guruma', 'Tai otoshi', 'Hiza guruma', 'Sasae tsurikomi ashi', 'De ashi barai (foot sweep)', 'Sumi gaeshi', 'Tomoe nage', 'Yoko tomoe nage', 'Tani otoshi', 'Snap down'],
    Transition: ['Guard pull', 'Sit-down guard pull', 'Jumping closed guard', 'Arm drag', 'Duck under', 'Collar drag', 'Russian tie', 'Two-on-one', 'Slide by', 'Shuck', 'Butt scoot'],
    Control: ['Collar and sleeve grips', 'Collar tie', 'Underhook pummeling', 'Over-under clinch', 'Body lock', 'Inside tie (wrist control)'],
    Escape: ['Sprawl', 'Whizzer (standing)', 'Downblock', 'Crossface sprawl', 'Single leg defense (limp leg)'],
    Submission: ['Arm-in guillotine', 'Flying armbar', 'Flying triangle', 'Standing guillotine'],
  },
  'Front headlock': {
    Control: ['Front headlock', 'Chin strap control'],
    Submission: ['High elbow guillotine', 'Japanese necktie', 'Peruvian necktie'],
    Transition: ['Go-behind from front headlock', 'Front headlock spin behind'],
    Escape: ['Front headlock escape'],
  },
  'Closed guard': {
    Sweep: ['Hip bump sweep', 'Scissor sweep', 'Flower sweep', 'Lumberjack sweep', 'Overhead sweep', 'Kimura sweep', 'Muscle sweep'],
    Submission: ['Armbar from guard', 'Triangle choke', 'Kimura', 'Omoplata', 'Guillotine', 'Cross collar choke', 'Single collar choke', 'Loop choke', 'Gogoplata', 'Wristlock from guard', 'Triangle armbar', 'Inverted armbar', 'Monoplata', 'Baratoplata', 'Tarikoplata', 'Biceps slicer'],
    Control: ['High guard', 'Overhook guard', 'Breaking posture', 'Williams guard', 'Shoulder clamp', 'Rubber guard', 'Two-on-one from guard'],
    Transition: ['Arm drag to back', 'Kimura grip to back'],
    Pass: ['Standing guard break', 'Kneeling guard break', 'Knee in the middle break'],
    Retention: ['Posture in closed guard'],
    Escape: ['Armbar defense (stack)', 'Triangle defense', 'Kimura defense', 'Guillotine defense'],
  },
  'Half guard': {
    Sweep: ['Underhook sweep', 'Old school sweep', 'Electric chair', 'Waiter sweep', 'Deep half sweep', 'Coyote half sweep', 'John Wayne sweep', 'Homer Simpson sweep', 'Kimura sweep from half guard', 'Plan B sweep'],
    Retention: ['Knee shield', 'Lockdown', 'Deep half guard entry', 'Z guard', 'Quarter guard recovery'],
    Transition: ['Back take from half guard', 'Switch base to mount', 'Back take from dogfight'],
    Pass: ['Knee cut pass', 'Back step pass', 'Tripod pass', 'Underhook half pass', 'Shin slide', 'Hip switch half pass', 'Knee shield pass', 'Lockdown pass', 'Deep half pass'],
    Control: ['Crossface and underhook', 'Dogfight', 'Flat half guard control'],
    Escape: ['Whizzer'],
    Submission: ['Kimura from half guard', 'D’arce choke', 'Arm triangle from half guard', 'Triangle from knee shield', 'Toe hold from half guard top'],
  },
  'Butterfly guard': {
    Sweep: ['Butterfly sweep', 'Arm drag sweep', 'Elevator sweep', 'Overhook butterfly sweep', 'Shoulder crunch sweep'],
    Transition: ['Butterfly to single-leg X', 'Butterfly back take', 'Butterfly ashi entry'],
    Submission: ['Guillotine from butterfly'],
    Retention: ['Butterfly guard retention', 'Shoulder crunch'],
    Pass: ['Butterfly pass (hip switch)', 'Knee pin pass'],
  },
  'De La Riva': {
    Sweep: ['De La Riva sweep', 'Tripod sweep', 'Sickle sweep', 'Single leg from De La Riva'],
    Transition: ['Berimbolo', 'Back take from De La Riva', 'De La Riva to single-leg X', 'Matrix back take', 'Crab ride'],
    Submission: ['De La Riva omoplata'],
    Retention: ['De La Riva hook'],
    Pass: ['De La Riva pass (knee slide out)', 'Leg pin pass'],
  },
  'Reverse De La Riva': {
    Sweep: ['Reverse De La Riva sweep'],
    Transition: ['Kiss of the dragon', 'Baby bolo', 'Reverse De La Riva back take', 'Reverse De La Riva to single-leg X'],
    Retention: ['Reverse De La Riva hook'],
    Pass: ['Reverse De La Riva pass'],
  },
  'X-guard': {
    Sweep: ['X-guard sweep', 'X-guard stand-up sweep', 'X-guard back roll sweep', 'Single-leg X sweep'],
    Transition: ['X-guard entry', 'X-guard to leg drag'],
    Pass: ['X-guard pass'],
  },
  'Spider / lasso': {
    Sweep: ['Spider guard sweep', 'Lasso sweep', 'Balloon sweep', 'Spider guard overhead sweep'],
    Submission: ['Triangle from spider', 'Omoplata from lasso'],
    Transition: ['Lasso to back take'],
    Retention: ['Spider guard retention'],
    Pass: ['Spider guard pass (break the grips)', 'Lasso pass'],
  },
  'Lapel guards': {
    Control: ['Worm guard', 'Squid guard', 'Ringworm guard'],
    Sweep: ['Lapel guard sweep'],
    Pass: ['Lapel guard pass'],
  },
  'Open guard': {
    Pass: ['Long step pass', 'Leg drag pass', 'Torreando pass', 'Over-under pass', 'Double under pass', 'Stack pass', 'X-pass', 'Leg weave pass', 'Smash pass', 'Headquarters', 'Float pass', 'Folding pass', 'Body lock pass', 'Cartwheel pass'],
    Sweep: ['Collar sleeve sweep', 'X-guard sweep from open guard', 'Shin-to-shin sweep', 'Double ankle sweep', 'Chair sweep', 'Hook sweep'],
    Retention: ['Guard retention (frames and hips)', 'Inversion', 'Granby roll recovery', 'Shoulder walk'],
    Control: ['Collar sleeve guard', 'K guard', 'Seated guard'],
    Transition: ['Technical stand-up from guard', 'Shin-to-shin entry', 'Wrestle up'],
  },
  'Leg entanglement': {
    Submission: ['Straight ankle lock', 'Inside heel hook', 'Outside heel hook', 'Kneebar', 'Toe hold', 'Estima lock', 'Calf slicer', 'Aoki lock'],
    Control: ['Single-leg X', 'Ashi garami', '50/50', 'Saddle (inside sankaku)', 'Outside ashi', 'Cross ashi', 'Backside 50/50'],
    Transition: ['Imanari roll', 'Reap from half guard'],
    Escape: ['Heel hook defense', 'Boot escape', 'Clear the knee line'],
  },
  'Side control': {
    Submission: ['Americana', 'Kimura from side control', 'Arm triangle', 'Paper cutter choke', 'Baseball bat choke', 'Far-side armbar', 'Step-over armbar', 'Bread cutter choke', 'Ezekiel from side control'],
    Control: ['Crossface control', 'Kesa gatame', 'Reverse kesa gatame', 'Near-side underhook control', 'Hip switch side control'],
    Transition: ['Side control to mount', 'Side control to knee on belly', 'Side control to north-south'],
    Escape: ['Shrimp to guard recovery', 'Underhook escape to knees', 'Ghost escape', 'Kesa gatame escape', 'Running escape'],
  },
  'Mount': {
    Submission: ['Armbar from mount', 'Arm triangle from mount', 'Ezekiel choke', 'Cross collar choke from mount', 'Americana from mount', 'Gift wrap', 'Mounted triangle', 'Armbar from S-mount', 'Mounted guillotine'],
    Control: ['High mount', 'S-mount', 'Technical mount', 'Low mount', 'Grapevine mount'],
    Transition: ['Mount to back take'],
    Escape: ['Upa (bridge and roll)', 'Elbow-knee escape', 'Kipping escape', 'Heel drag escape'],
  },
  'Back': {
    Submission: ['Rear naked choke', 'Bow and arrow choke', 'Collar choke from back', 'Short choke', 'Armbar from back', 'Arm trap choke', 'Back triangle'],
    Control: ['Seatbelt control', 'Body triangle', 'Hooks in', 'Straight jacket'],
    Escape: ['Back escape (shoulder to the mat)', 'Body triangle escape', 'Back escape to guard'],
  },
  'Knee on belly': {
    Control: ['Knee on belly control'],
    Submission: ['Far-side armbar from knee on belly', 'Spinning armbar'],
    Transition: ['Knee on belly to mount'],
    Escape: ['Knee on belly escape'],
  },
  'North-south': {
    Submission: ['North-south choke', 'Kimura from north-south', 'Armbar from north-south'],
    Control: ['North-south control'],
    Escape: ['North-south escape'],
  },
  'Turtle': {
    Submission: ['Clock choke', 'Anaconda choke', 'Crucifix', 'Calf slicer from the truck'],
    Transition: ['Seatbelt back take', 'Spiral ride', 'Back take from turtle (hooks in)', 'Truck entry', 'Twister'],
    Escape: ['Sit-out', 'Turtle to guard recovery', 'Granby roll escape', 'Turtle to single leg'],
    Sweep: ['Peterson roll'],
  },
  'Solo drills': {
    Movement: ['Shrimp', 'Reverse shrimp', 'Bridge', 'Technical stand-up', 'Forward roll', 'Backward roll', 'Granby roll', 'Sprawl drill', 'Breakfall', 'Sit-out drill', 'Hip switch', 'Hip heist', 'Penetration step', 'Leg circles', 'Bear crawl', 'Crab walk', 'Gator walk', 'Pummeling drill'],
  },
}

export const CATALOG = Object.entries(MOVES).flatMap(([position, byType]) =>
  Object.entries(byType).flatMap(([type, names]) =>
    names.map(name => ({ id: 'c:' + slug(name), kind: 'tech', name, position, type, notes: '', link: '', builtIn: true }))))

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map(t => [t.id, t]))

// Solo movements are what the rep counter and rep achievements track by default.
export const SOLO_DRILLS = CATALOG.filter(t => t.position === 'Solo drills')

// Every move gets a one-tap video search, even before you save your own link.
export const videoSearch = name => 'https://www.youtube.com/results?search_query=' + encodeURIComponent('bjj ' + name)
