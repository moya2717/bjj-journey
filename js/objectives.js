// Objectives for each position and side: what to work on there, in priority order, while you drill or roll.
// Written for this app from general, long-established principles (position before submission, inside
// position, frames before hips, hands before hips on the back). Nothing here is copied from an instructional.
// Keys are the Live roll table's 'Position|Role' (sim.js); in a leg entanglement, Bottom attacks the legs.
//
// goals: [id, text], first things first. The id keeps your ticks and ratings when the wording changes.
// details: principles that make the goals work. mistakes: [text, cause] where cause names a card in
// fixes.js. theirs: what the other side wants, so you know what to shut down.
// game: a positional round for it, a GAMES key from rounds.js or [your goal, their goal].
import { GUARDS } from './sim.js'

export const OBJECTIVES = {
  'Standing|Neutral': {
    goals: [['stance', 'Keep a balanced stance: knees bent, head up, hips under you'], ['grips', 'Win the grip fight: get your grips first, break or block theirs'],
      ['off', 'Move them or make an angle before you commit to a shot or throw'], ['finish', 'Finish the takedown, or pull guard on your terms'], ['follow', 'Land in a top position and settle it before they recover']],
    details: ['Change levels with your legs, not by bending at the waist', 'Your head stays up and in front of you, never below their hips', 'Draw a reaction first (a push, a pull, a fake) and attack what it opens',
      'If you pull guard, keep a grip that controls their posture so they can’t pass right away'],
    mistakes: [['Shooting from too far out with no setup', 'Timing'], ['Bending at the waist with your head down', 'Posture'], ['Accepting their grips and reacting to them', 'Grips'], ['Feet in line, standing square and tall', 'Base']],
    theirs: ['Take you down, or snap you down to a front headlock', 'Get their grips and bend your posture', 'Sprawl on your shot and get around you'],
    game: 'standing',
  },
  'Front headlock|Top': {
    goals: [['head', 'Keep their head below your chest: control the head and one arm'], ['hips', 'Keep your hips back and your weight on their head and shoulders'],
      ['angle', 'Snap them down and circle to the side, out of their reach'], ['attack', 'Attack the neck, or go behind to the back'], ['reset', 'If they come up, snap them down again or return to standing']],
    details: ['Your chest presses down on the back of their head and neck', 'Sprawl the hips back the moment they drive forward', 'Control a wrist or the near arm so they can’t reach your legs', 'Circle; staying square in front of them invites a shot'],
    mistakes: [['Hips close enough for them to grab a leg', 'Base'], ['Letting their head come up level with yours'], ['Diving for the choke before the head is controlled', 'Rushed it']],
    theirs: ['Lift their head and posture back up', 'Reach a leg or come up to standing', 'Roll or spin out to guard'],
    game: ['Finish or go behind', 'Head up and stand, or reach a leg'],
  },
  'Front headlock|Bottom': {
    goals: [['neck', 'Protect your neck: chin down, a hand ready on the choking arm'], ['posture', 'Bring your head back up and square your shoulders'],
      ['clear', 'Clear the grip on your head before they settle it'], ['up', 'Come up to your feet, or reach a leg'], ['flat', 'Don’t settle flat on your stomach']],
    details: ['Hands defend the neck first; the escape comes second', 'Elbows tight, so they can’t thread an arm under your armpit', 'Bring your knees under you and rise as their weight comes off your head'],
    mistakes: [['Reaching for their legs while your neck is open', 'Rushed it'], ['Head and hips low, stuck on your knees', 'Posture']],
    theirs: ['Choke you: guillotine, anaconda, d’arce', 'Go behind you to the back', 'Keep you flat and heavy'],
    game: ['Stand up or reach a leg', 'Finish or go behind'],
  },
  'Closed guard|Bottom': {
    goals: [['break', 'Break their posture: pull them down with your legs and grips'], ['control', 'Control an arm and the head or collar so they can’t sit back up'],
      ['angle', 'Hip out to make an angle; don’t attack from straight underneath'], ['attack', 'Attack: armbar, triangle, kimura, a collar choke, a sweep or the back'], ['chain', 'Chain attacks: their defence to one opens the next']],
    details: ['Pull your knees toward your chest as you pull with your grips', 'Turn on your side to make angles; flat on your back you have little', 'Keep the guard closed until you have a reason to open it', 'React the moment they get two hands on your hips with a straight back'],
    mistakes: [['Lying flat, just holding them', 'Hip movement'], ['Attacking while their posture is strong', 'Timing'], ['Grips that hold on but control nothing', 'Grips'], ['Opening the guard with no plan, so they pass', 'Didn’t know the next step']],
    theirs: ['Posture up and control your hips', 'Break your grips and open your legs', 'Pass once your legs open'],
    game: ['Sweep or submit', 'Open the guard and pass'],
  },
  'Closed guard|Top': {
    goals: [['posture', 'Posture: head up, back straight, hips forward'], ['grips', 'Break their grips, then control their hips or biceps'],
      ['arms', 'Both arms in or both out: one in and one out gives them a triangle'], ['open', 'Open the guard, kneeling or standing'], ['pass', 'Control the legs as they open and start the pass']],
    details: ['Elbows in, close to your body, away from armbars and kimuras', 'A wide base on your knees, or feet wide when you stand', 'Never post a hand on the mat or reach for their neck with one arm', 'Fix grips and posture before working the legs'],
    mistakes: [['Posture broken, head pulled down', 'Posture'], ['Reaching forward with one arm', 'Posture'], ['Trying to open the legs while they hold strong grips', 'Grips'], ['Knees narrow, easy to sweep', 'Base']],
    theirs: ['Break your posture', 'Isolate an arm for an armbar, triangle or kimura', 'Hip out to an angle and sweep'],
    game: ['Open the guard and pass', 'Sweep or submit'],
  },
  'Open guard|Bottom': {
    goals: [['inside', 'Keep your knees and feet between you and them'], ['face', 'Frame and hip escape so you always face them'],
      ['grips', 'Grip to control distance: sleeves, collar, pants or ankles'], ['attack', 'Off-balance them to sweep, or come up to your feet'], ['guard', 'Move into a guard you know instead of waiting']],
    details: ['Your feet connect to their hips, biceps or knees and follow where they go', 'Stay on your side or seated, never flat', 'When a leg gets passed, bring the knee back inside before they settle', 'Too close and they smash you; too far and they walk around you'],
    mistakes: [['Flat on your back as they circle', 'Hip movement'], ['Framing late, after their chest is on you', 'Frames'], ['Holding grips without moving them', 'Grips'], ['Waiting with no plan to sweep', 'Didn’t know the next step']],
    theirs: ['Get past your legs to side control or knee on belly', 'Pin your legs or hips and flatten you', 'Break your grips'],
    game: 'guard',
  },
  'Open guard|Top': {
    goals: [['safe', 'Stay safe: keep your posture and distance until their grips are gone'], ['grips', 'Break or clear their grips and feet'],
      ['control', 'Control their legs or hips before you pass'], ['past', 'Get past the knees to an angle, then chest to chest'], ['settle', 'Settle the pin before moving on']],
    details: ['Hips back and head up at distance; low and heavy once you’re close', 'Pass to an angle: straight in runs into their legs', 'Threaten one side to pass to the other', 'Each step should leave their legs with less to do'],
    mistakes: [['Passing at the legs with no control of the hips', 'Rushed it'], ['Letting them set grips and hooks', 'Grips'], ['Leaning in so a sweep finishes you', 'Base'], ['Moving on before the pin is settled', 'Rushed it']],
    theirs: ['Keep their guard: frames, hips and feet', 'Sweep or take your back', 'Attack a leg or a triangle'],
    game: 'guard',
  },
  'Half guard|Bottom': {
    goals: [['side', 'Get on your side, facing them; flat is where half guard dies'], ['underhook', 'Win the underhook, or hold a knee shield frame'],
      ['head', 'Keep your head off the mat; don’t let them crossface you'], ['up', 'Come up: sweep or take the back from the underhook'], ['recover', 'Or recover full guard; stay on the attack']],
    details: ['Head tight to their chest, not below it', 'A knee shield keeps their chest off yours while you work', 'Hold the trapped leg tight so the pass takes time', 'If you lose the underhook, frame and recover before going again'],
    mistakes: [['Flat on your back under a crossface', 'Hip movement'], ['Losing the underhook battle and doing nothing', 'Grips'], ['Holding on with no plan to come up', 'Didn’t know the next step']],
    theirs: ['Crossface and win the underhook to flatten you', 'Free their leg: knee cut, back step, step out', 'Kimura or d’arce as you reach'],
    game: 'half',
  },
  'Half guard|Top': {
    goals: [['flat', 'Flatten them: crossface and take the underhook'], ['heavy', 'Keep your chest on theirs and your hips low'],
      ['free', 'Free your trapped leg: knee cut, back step or step out'], ['pass', 'Pass to side control or mount, and settle'], ['watch', 'Watch the kimura and back take when they get an underhook']],
    details: ['The crossface turns their head away so they can’t follow you', 'Control the far arm or hip so they can’t come to their side', 'Keep a wide base: the underhook sweep tips you over a narrow one', 'Flatten first, free the leg second'],
    mistakes: [['Letting them win the underhook', 'Grips'], ['Working the leg before they’re flat', 'Rushed it'], ['Sitting up tall with a narrow base', 'Base']],
    theirs: ['Underhook and come up to their side', 'Sweep you or take your back', 'Recover full guard or attack a leg'],
    game: 'half',
  },
  'Butterfly guard|Bottom': {
    goals: [['sit', 'Sit up, chest close to theirs; don’t fall onto your back'], ['upper', 'Control the upper body: underhook, overhook or an arm drag'],
      ['hooks', 'Hooks inside their thighs, ready to lift'], ['sweep', 'Pull them off balance to one side and lift with a hook to sweep'], ['recover', 'If they flatten you, move to half guard or another guard']],
    details: ['Hooks lift; upper body grips do the steering', 'Off-balance them toward the side you sweep to', 'Head higher than theirs, never pushed under their chest'],
    mistakes: [['Leaning back, flat on your back', 'Posture'], ['Sweeping with hooks but no upper body grip', 'Grips'], ['Lifting straight up instead of to the side']],
    theirs: ['Push you flat and pin your hooks', 'Pass: knee pin, hip switch, body lock', 'Win the underhooks'],
    game: ['Sweep or take the back', 'Flatten and pass'],
  },
  'Butterfly guard|Top': {
    goals: [['base', 'Stay balanced: hips low, weight back over your knees'], ['flat', 'Put their back on the mat'],
      ['hooks', 'Pin or clear a hook: knee to the mat, or switch your hips'], ['pass', 'Pass around the legs and settle the pin']],
    details: ['Don’t let them get both underhooks', 'A body lock or your own underhooks keep them flat', 'Widen your knees when they try to lift'],
    mistakes: [['Weight forward over their hooks', 'Base'], ['Giving them the underhook or arm drag', 'Grips'], ['Passing before they’re flat', 'Rushed it']],
    theirs: ['Lift and sweep you', 'Arm drag to the back', 'Enter a leg entanglement or a guillotine'],
    game: ['Pass', 'Sweep or take the back'],
  },
  'Leg entanglement|Bottom': {
    goals: [['knee', 'Control the knee line: their knee stays trapped between your legs'], ['balance', 'Keep them off balance so they can’t stand or step over'],
      ['heel', 'Get the foot or heel under control'], ['finish', 'Finish slowly, with your hips, and let go at the tap'], ['re', 'If the knee comes free, re-enter or sweep']],
    details: ['Control the leg before you grab the foot', 'Squeeze with your knees and use your feet on their hips', 'In training, apply pressure slowly: knee ligaments can tear before it hurts'],
    mistakes: [['Grabbing the foot before the leg is controlled', 'Rushed it'], ['Letting their knee slide past your hips'], ['Cranking fast in training']],
    theirs: ['Clear their knee past your hips', 'Hide the heel and pull the foot out', 'Stand up and pass, or counter with a leg lock'],
    game: ['Finish a foot lock', 'Clear the knee and escape'],
  },
  'Leg entanglement|Top': {
    goals: [['heel', 'Hide the heel: keep your foot flexed and out of their grip'], ['knee', 'Clear the knee line: get your knee past their hips'],
      ['grips', 'Break the grip on the foot'], ['out', 'Free the leg and come up to a passing position'], ['tap', 'Tap early: a caught knee gives little warning']],
    details: ['Never roll out without knowing which way loads the knee', 'Deal with the hips and knee line before the hands', 'Keep your weight over the trapped leg; don’t let them stretch it'],
    mistakes: [['Rolling out with the heel exposed', 'Rushed it'], ['Fighting the grip while the knee stays trapped']],
    theirs: ['Control your knee line', 'Expose your heel or foot', 'Finish, or sweep you'],
    game: ['Clear the knee and escape', 'Finish a foot lock'],
  },
  'Side control|Top': {
    goals: [['pin', 'Pin the hips and shoulders: chest heavy, crossface, underhook or hip control'], ['frames', 'Shut down their frames and hip escape: keep their knee out'],
      ['arm', 'Isolate the near arm'], ['advance', 'Advance: mount, knee on belly or north-south'], ['attack', 'Submit from the isolated arm or the neck']],
    details: ['Weight through your chest, not your knees', 'The crossface turns their head away; they can’t turn in to you', 'Move your hips to block each hip escape', 'Change position as they move, not after they’ve moved'],
    mistakes: [['Attacking before the pin is settled', 'Rushed it'], ['Letting them frame and get a knee in'], ['High on your knees, easy to roll', 'Base']],
    theirs: ['Frame and make space', 'Hip escape back to guard or half guard', 'Turn to their knees, or underhook and come up'],
    game: ['Hold, advance or submit', 'Recover guard or come up'],
  },
  'Side control|Bottom': {
    goals: [['protect', 'Protect your neck and arms: elbows tight, near arm inside'], ['frames', 'Build frames: forearm at the neck or collarbone, other hand on the hip'],
      ['side', 'Turn on your side, facing them'], ['guard', 'Hip escape and put a knee back in to recover guard'], ['up', 'Or underhook and come up to your knees']],
    details: ['Frames hold the distance; your hips make the space', 'Keep the elbows bent: straight arms get collapsed or armbarred', 'Move as they move: transitions open the escape', 'Breathe and wait for the moment rather than burning out'],
    mistakes: [['Flat on your back', 'Hip movement'], ['Pushing with straight arms', 'Frames'], ['Exploding before there is space', 'Timing']],
    theirs: ['Crossface and pin your hips', 'Isolate an arm', 'Move to mount or knee on belly, or submit'],
    game: ['Recover guard or come up', 'Hold, advance or submit'],
  },
  'Mount|Top': {
    goals: [['stay', 'Stay mounted: low and heavy, knees tight to their hips'], ['arms', 'Get their elbows away from their sides'],
      ['climb', 'Climb higher as their elbows come free'], ['attack', 'Attack: armbar, americana, a collar choke or arm triangle'], ['back', 'Take the back if they turn away']],
    details: ['Post a hand or foot wide when they bridge', 'Stay off their stomach; sit low on their hips or climb high', 'Isolate an arm before you attack it', 'Keep your hands away from their sides, where they can be trapped'],
    mistakes: [['Sitting tall, so a bridge tips you', 'Base'], ['Hands close to their body, ready to be trapped', 'Base'], ['Attacking with no arm isolated', 'Rushed it']],
    theirs: ['Trap an arm and leg and bridge you over', 'Elbow-knee escape to half guard', 'Keep their elbows tight'],
    game: 'mount',
  },
  'Mount|Bottom': {
    goals: [['protect', 'Protect: elbows tight, hands up, never push with straight arms'], ['bridge', 'Bridge to knock their balance and make space'],
      ['trap', 'Trap and roll: trap an arm and the leg on the same side, bridge that way'], ['elbow', 'Elbow-knee escape: shrimp and get a knee inside'], ['guard', 'Recover guard or half guard, then work up']],
    details: ['Feet close to your hips so the bridge has power', 'Bridge and shrimp together: one makes space for the other', 'Never turn your back to escape'],
    mistakes: [['Pushing their chest with straight arms', 'Frames'], ['Turning to your stomach', 'Hip movement'], ['Bridging without trapping first']],
    theirs: ['Isolate an arm and climb high', 'Submit', 'Take the back as you turn'],
    game: 'mount',
  },
  'Back|Top': {
    goals: [['seatbelt', 'Keep the seatbelt and your chest tight to their back'], ['hooks', 'Keep the hooks in, or lock a body triangle'],
      ['hands', 'Control the near hand and break their defensive grip'], ['finish', 'Finish the choke'], ['retake', 'Re-take the back if they turn']],
    details: ['Your hips stay tight to theirs: space lets them slide down', 'Your head beside theirs keeps them from turning in', 'Win the hand fight before the choke, not during it', 'If they get their shoulders to the mat, follow to mount or re-take'],
    mistakes: [['Chasing the choke before the hands are beaten', 'Rushed it'], ['Losing the chest connection so they slide out'], ['Crossing your feet in front, an easy ankle lock']],
    theirs: ['Hand-fight to protect their neck', 'Clear a hook and get their shoulders to the mat', 'Turn in to you'],
    game: 'back',
  },
  'Back|Bottom': {
    goals: [['hands', 'Protect your neck: chin down, both hands on the choking arm'], ['low', 'Slide down so your shoulders are lower than theirs'],
      ['hook', 'Clear a hook'], ['mat', 'Get your back and shoulders to the mat'], ['turn', 'Turn in to them: half guard, guard or top']],
    details: ['Hands first, hips second', 'Fight with two hands on one: one hand loses the hand fight', 'Turning away from them gives them more back'],
    mistakes: [['Fighting the choke with one hand', 'Grips'], ['Escaping before your neck is safe', 'Rushed it'], ['Lying still while they adjust', 'Hip movement']],
    theirs: ['Break your grip and choke you', 'Lock a body triangle', 'Re-take the back when you turn'],
    game: 'back',
  },
  'Knee on belly|Top': {
    goals: [['place', 'Knee across their belly, shin angled across them, far foot posted wide'], ['grips', 'Grip the far collar or sleeve and the near hip or belt'],
      ['ride', 'Ride their movement and stay on top as they shrimp'], ['attack', 'Attack what their push gives you: the far-side armbar or a choke'], ['mount', 'Step to mount as they turn or push the knee']],
    details: ['Weight on the knee, but stay light enough to move', 'It’s a moving position: use it to transition, not to sit', 'Keep your head up and your posted foot wide'],
    mistakes: [['Holding it still until they push you off'], ['Posted foot too close to them', 'Base']],
    theirs: ['Push the knee off', 'Shrimp away and recover guard', 'Grab your leg or come to their knees'],
    game: ['Hold, then mount or submit', 'Recover guard or come up'],
  },
  'Knee on belly|Bottom': {
    goals: [['protect', 'Keep your arms close: a straight push gives up the far-side armbar'], ['frame', 'Frame on the knee and hip'],
      ['turn', 'Turn on your side and shrimp away from the knee'], ['guard', 'Bring your knee back in for guard'], ['up', 'Or come up to your knees']],
    details: ['Frame with bent arms', 'Move your hips, not just your hands', 'Their weight on one knee is a chance to off-balance them'],
    mistakes: [['Pushing the knee with straight arms', 'Frames'], ['Staying flat', 'Hip movement']],
    theirs: ['Take mount', 'Far-side armbar or a choke', 'Stay heavy on your belly'],
    game: ['Recover guard or come up', 'Hold, then mount or submit'],
  },
  'North-south|Top': {
    goals: [['heavy', 'Chest heavy on their chest, hips low'], ['arms', 'Control their arms, so they can’t frame or reach your legs'],
      ['follow', 'Move with their hips as they turn'], ['attack', 'Attack: north-south choke or kimura'], ['move', 'Move back to side control when they turn']],
    details: ['Your weight goes through their chest, not your knees', 'Keep their elbows away from their body', 'Small steps keep you over them as they move'],
    mistakes: [['Hips high, so they make space under you', 'Base'], ['Attacking before their arms are controlled', 'Rushed it']],
    theirs: ['Frame on your hips and turn', 'Bring their knees in for guard', 'Come up to their knees'],
    game: ['Hold or submit', 'Recover guard or come up'],
  },
  'North-south|Bottom': {
    goals: [['neck', 'Protect your neck: a hand or forearm between their chest and your throat'], ['frame', 'Frame on their hips or shoulders'],
      ['turn', 'Turn to your side and bring your knees in'], ['guard', 'Recover guard'], ['up', 'Or come up to your knees']],
    details: ['Elbows tight so they can’t kimura you', 'Turn to one side; flat you can’t move', 'Their legs are far away: your hips are freer than they feel'],
    mistakes: [['Flat with your arms outside', 'Hip movement'], ['Pushing with straight arms', 'Frames']],
    theirs: ['North-south choke', 'Kimura', 'Back to side control or mount'],
    game: ['Recover guard or come up', 'Hold or submit'],
  },
  'Turtle|Top': {
    goals: [['behind', 'Stay behind and to the side, chest on their back'], ['grip', 'Take a seatbelt, or control the near arm or far hip'],
      ['break', 'Break them down flat, or roll them'], ['hooks', 'Get your hooks in and take the back'], ['attack', 'Attack: clock choke, crucifix, or a front headlock']],
    details: ['Stay off to the side: in front, they reach your legs', 'Weight on their back, not your knees', 'Watch for the sit-out and the roll'],
    mistakes: [['Hooks in before your upper body is attached', 'Rushed it'], ['Too far in front, so they reach your legs', 'Base']],
    theirs: ['Sit out or come up to standing', 'Grab a leg', 'Roll to guard'],
    game: ['Take the back', 'Stand up or recover guard'],
  },
  'Turtle|Bottom': {
    goals: [['tight', 'Close the gaps: elbows to knees, neck protected'], ['hands', 'Hand-fight: don’t let them settle a seatbelt or hooks'],
      ['go', 'Don’t stay: sit out, roll to guard or reach a leg'], ['up', 'Come up to your feet or a single leg']],
    details: ['Turtle is a moment, not a place to rest', 'Keep your elbows inside your knees so no hook gets in', 'Face them when you can'],
    mistakes: [['Staying in turtle and waiting', 'Didn’t know the next step'], ['Gaps between elbows and knees']],
    theirs: ['Seatbelt and hooks to take your back', 'Clock choke or crucifix', 'Break you down flat'],
    game: ['Stand up or recover guard', 'Take the back'],
  },
}

// The guards without their own page share the open guard's objectives.
GUARDS.filter(p => !['Closed guard', 'Half guard', 'Butterfly guard', 'Open guard'].includes(p)).forEach(p => {
  OBJECTIVES[p + '|Bottom'] = { ...OBJECTIVES['Open guard|Bottom'], shared: 'Open guard' }
  OBJECTIVES[p + '|Top'] = { ...OBJECTIVES['Open guard|Top'], shared: 'Open guard' }
})

// Best place to be first: the back, then the pins, then top in a guard, standing, guard bottom, the bad spots.
const ORDER = ['Back|Top', 'Mount|Top', 'Knee on belly|Top', 'Side control|Top', 'North-south|Top', 'Turtle|Top', 'Front headlock|Top', 'Half guard|Top']
const BAD = ['Back|Bottom', 'Mount|Bottom', 'Knee on belly|Bottom', 'Side control|Bottom', 'North-south|Bottom', 'Front headlock|Bottom', 'Turtle|Bottom', 'Half guard|Bottom']
export const rank = k => ORDER.includes(k) ? ORDER.indexOf(k) : BAD.includes(k) ? 100 - BAD.indexOf(k) : k.endsWith('|Top') ? 10 : k.startsWith('Standing') ? 20 : k.startsWith('Leg') ? 25 : 30
