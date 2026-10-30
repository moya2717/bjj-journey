// The words of the sport. Everything the forms offer as a choice lives here.

export const POSITIONS = ['Standing', 'Front headlock', 'Closed guard', 'Half guard', 'Butterfly guard', 'De La Riva', 'Reverse De La Riva', 'X-guard', 'Spider / lasso', 'Lapel guards', 'Open guard', 'Leg entanglement', 'Side control', 'Mount', 'Back', 'Knee on belly', 'North-south', 'Turtle']
export const LIBRARY_GROUPS = [...POSITIONS, 'Solo drills', 'Other']
export const ROLES = ['Top', 'Bottom', 'Neutral']
export const SESSION_TYPES = ['Gi', 'No-gi', 'Open mat', 'Private', 'Competition', 'Drilling only']
export const TECH_TYPES = ['Pass', 'Sweep', 'Submission', 'Escape', 'Retention', 'Takedown', 'Transition', 'Control', 'Movement']
export const BELTS = ['White', 'Blue', 'Purple', 'Brown', 'Black', 'Unknown']
export const RANKS = ['White', 'Blue', 'Purple', 'Brown', 'Black']
export const SIZES = ['Lighter', 'Similar', 'Heavier']
export const STYLES = ['Pressure passer', 'Guard player', 'Wrestler', 'Leg locker', 'Scrambler', 'Strong / athletic', 'Patient / technical']
export const REASONS = ['Grips', 'Posture', 'Base', 'Frames', 'Timing', 'Hip movement', 'Didn’t read the reaction', 'Rushed it', 'Didn’t know the next step', 'Size / strength', 'Cardio']
export const RESULTS = {
  worked: { label: 'Worked', score: 1 },
  partial: { label: 'Partly worked', score: 0.5 },
  broke: { label: 'Broke down', score: 0 },
}
export const ACTIVITY_TYPES = ['Running', 'Strength training', 'Yoga', 'Mobility / stretching', 'Recovery', 'Conditioning', 'Cycling', 'Swimming', 'Other sport']
export const INTENSITIES = ['Easy', 'Moderate', 'Hard']
export const PLACES = ['Gold', 'Silver', 'Bronze', 'No medal']
export const FEELS = ['Drained', 'Flat', 'Okay', 'Good', 'Sharp']
export const ENERGY = { low: 'Low', ok: 'OK', high: 'High' }
export const SLEEP = { poor: 'Poor', ok: 'OK', good: 'Good' }
// Areas of the game, for the quick "what went well / what gave you trouble" questions.
export const AREAS = ['Takedowns', 'Guard retention', 'Sweeps', 'Passing', 'Escapes', 'Top control', 'Back takes', 'Submissions', 'Submission defense', 'Scrambles', 'Cardio and pace', 'Staying calm', 'Learning the technique']
export const PLAN_HIT = ['Stuck to it', 'Partly', 'Went another way']

// Belts look the same in light and dark mode, so these are literal colors.
// Color themes: [key, name]. The first is the default; the colors live in css/app.css.
export const PALETTES = [['violent', 'Violent Violet'], ['violet', 'Purple Belt'], ['jade', 'Jade Dojo'], ['ember', 'Ember'], ['gold', 'Gold Medal'], ['ocean', 'Ocean Deep'], ['rose', 'Midnight Rose']]

// Your theme, or the default for none or a retired one (the old 'mat').
export const paletteOf = key => PALETTES.some(([k]) => k === key) ? key : PALETTES[0][0]

export const BELT_LOOK = {
  White: { belt: '#F1F0EA', ink: '#15202A', muted: '#5A6570', bar: '#111111' },
  Blue: { belt: '#1F4FA0', ink: '#FFFFFF', muted: '#C5D3EC', bar: '#0B0B0B' },
  Purple: { belt: '#5B2A86', ink: '#FFFFFF', muted: '#D6C6E6', bar: '#0B0B0B' },
  Brown: { belt: '#6B4226', ink: '#FFFFFF', muted: '#E0CFC2', bar: '#0B0B0B' },
  Black: { belt: '#000000', ink: '#F1F1EE', muted: '#B9BDC0', bar: '#BF262C' },
}

export const PROMPTS = [
  'When did you feel most in control today, and what made that possible?',
  'What did partners keep doing that you had no answer for?',
  'Where did you hesitate, and what were you waiting for?',
  'What would a higher belt have done differently in your worst exchange?',
  'Which grip or frame decided most of your rounds?',
  'What did you try live for the first time, and what happened?',
  'Where did you spend energy you didn’t need to?',
  'Which position did you avoid today, and why?',
  'If you could replay one exchange, which one, and what would you change?',
  'What did you notice about your breathing and pace?',
  'Did any of today’s technique show up in sparring? Where?',
  'Who gave you the most trouble, and what kind of game do they play?',
  'What did you do today that you couldn’t do three months ago?',
  'What’s one detail you understand now that you didn’t this morning?',
]

export function promptFor(date, shift = 0) {
  let hash = 0
  for (const c of String(date)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return PROMPTS[(hash + shift) % PROMPTS.length]
}
