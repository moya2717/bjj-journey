// Mistake and fix cards: one for each cause you can tick when a roll goes wrong.
// Each has the errors that usually sit behind it, coaching cues, and a drill to fix it.

export const FIXES = {
  'Grips': {
    summary: 'You’re fighting their grips instead of making them fight yours.',
    errors: ['Letting them get the first grip and reacting to it', 'Gripping with fingers only, so grips get stripped easily', 'Holding a dead grip that controls nothing', 'Starting a move before breaking the grip that stops it'],
    cues: ['Win the first grip, or break theirs before doing anything else', 'Two-on-one beats one: use both hands to break a grip', 'Every grip needs a purpose: control a sleeve, a collar, a leg', 'If a grip isn’t working, let go and re-grip'],
    drill: 'Grip fighting rounds: 2 minutes from standing or seated guard. You score by getting your two favourite grips and holding them for 3 seconds. Reset after every score.',
  },
  'Posture': {
    summary: 'Your spine and head are in a position where you can be pulled or broken down.',
    errors: ['Head lower than the hips in their guard', 'Back rounded, so they can pull you forward', 'Hands on the mat or reaching where they can be grabbed', 'Looking down instead of up'],
    cues: ['Head up, spine straight, hips forward', 'Hands on their hips or belt, elbows tight', 'Look at the ceiling when you feel your head being pulled down', 'Rebuild posture before you try to open or pass'],
    drill: 'Closed guard posture rounds: partner only tries to break your posture and control your head. You win by staying upright for 1 minute.',
  },
  'Base': {
    summary: 'You can be tipped over because your weight and support points are in the wrong place.',
    errors: ['Knees close together on top', 'Weight too far forward, so a sweep finishes the work', 'Posting with a straight arm, which gets trapped', 'Standing tall with feet in line'],
    cues: ['Wide knees, hips low, weight centred over them', 'Post with a hand or foot in the direction you’re being swept', 'When in doubt, sprawl the hips back', 'Feel where your weight is before you move'],
    drill: 'Sweep resistance: partner on bottom only tries to sweep you, no submissions. You stay on top for 1 minute without passing, adjusting your base.',
  },
  'Frames': {
    summary: 'You’re pushing instead of building structure, so you tire out and they flatten you.',
    errors: ['Pushing with straight arms, which gets armbarred or collapsed', 'Frames on the chest, where they can drive through', 'Making space with frames but not moving the hips into it', 'Framing too late, after they’re already settled'],
    cues: ['Bone on bone: forearm across the neck or collarbone, other hand on the hip', 'Frames hold distance; hips make it. Frame, then shrimp', 'Frame early, before their weight lands', 'Keep the elbows bent and close to your body'],
    drill: 'Side control and mount frames: partner settles on top at 50%. You build frames and recover guard. Swap after each recovery.',
  },
  'Timing': {
    summary: 'The move was right, but you started it too early or too late.',
    errors: ['Attacking when they’re balanced and braced', 'Waiting so long the opening closes', 'Committing to a move with no reaction to work off', 'Moving at the same pace all the time'],
    cues: ['Move when they move: attack during their weight shift', 'Use a fake to draw the reaction you need', 'Chain two attacks so the defence to one opens the other', 'Change speed: slow setup, fast finish'],
    drill: 'Action-reaction drilling: partner gives one specific reaction at random. You hit the move only when it appears. Build up to 75% resistance.',
  },
  'Hip movement': {
    summary: 'Your hips are flat or stuck, so you can’t make angles or escape.',
    errors: ['Lying flat on the back', 'Moving the shoulders but not the hips', 'Shrimping straight back instead of to an angle', 'Feet planted too far from the hips to push'],
    cues: ['Get on your side: flat is dead', 'Hips follow feet: place the foot, then move the hips', 'Shrimp to the side you want to face', 'Small, constant hip adjustments beat one big escape'],
    drill: 'Solo: 3 × 30 seconds each of shrimps, reverse shrimps and hip switches. Then guard retention rounds: partner walks around your legs, you keep facing them.',
  },
  'Didn’t read the reaction': {
    summary: 'They reacted and you kept going with plan A instead of switching.',
    errors: ['Forcing a move after the defence is already in place', 'Watching hands instead of hips and head', 'Not knowing the 2 or 3 common reactions to your move', 'Pausing to think after the reaction'],
    cues: ['Learn each move’s top 3 reactions (map them in Sequences)', 'Watch the hips and head: they show where the weight is going', 'If you meet resistance twice, switch', 'Decide your answer before you start the move'],
    drill: 'Run the quiz on your sequence, then drill it with a partner who picks a reaction at random. Say the answer out loud before you do it.',
  },
  'Rushed it': {
    summary: 'You skipped the steps that make the move work.',
    errors: ['Attacking before you have control', 'Finishing before the setup grip is set', 'Scrambling instead of settling', 'Spending energy fast and gassing out'],
    cues: ['Position before submission', 'Count a full second of control before you attack', 'Slow is smooth, smooth is fast', 'Breathe out on effort and in when you settle'],
    drill: 'Hold-and-attack rounds: you must hold each position for 5 seconds before you can attack. Partner resists at 50%.',
  },
  'Didn’t know the next step': {
    summary: 'You reached a position and had no plan from there.',
    errors: ['Knowing a move but not what follows it', 'No answer for the common reaction', 'Freezing in a position you rarely reach', 'Only knowing one attack per position'],
    cues: ['Map it: add the reaction to a sequence and give it an answer', 'Ask your coach the exact question while it’s fresh', 'Learn one attack, one escape and one transition per position', 'Have a default: if lost, improve position'],
    drill: 'Add the missing step to a sequence (or copy a game map), then drill just that branch 20 times before your next roll.',
  },
  'Size / strength': {
    summary: 'You tried to match their strength instead of using leverage and angles.',
    errors: ['Pushing directly against their strength', 'Staying square in front of a bigger partner', 'Letting them settle their full weight', 'Trying to muscle a submission'],
    cues: ['Move yourself, not them: angle off before you push', 'Use your whole body against one of their limbs', 'Frame early and keep moving so their weight never settles', 'Against strength, chain attacks rather than force one'],
    drill: 'Positional rounds against bigger or stronger partners at 70%. Your only goal is to escape or create an angle, not to win the position.',
  },
  'Cardio': {
    summary: 'You ran out of gas, so technique fell apart late in the round.',
    errors: ['Holding your breath under pressure', 'Gripping hard the whole round', 'Moving at full speed with no plan', 'Too little mat time or conditioning'],
    cues: ['Exhale on effort; breathe through the nose when you can', 'Relax every grip you don’t need', 'Rest in safe positions; work in good ones', 'Pace yourself across the round, not the first minute'],
    drill: 'Long rounds at 60% with a focus on breathing. Add 2 to 3 conditioning sessions a week and log them under Other activity.',
  },
}
