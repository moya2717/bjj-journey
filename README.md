# LosMoya BJJ Journey

A private jiu-jitsu training journal that installs on your iPhone like an app, works offline, and needs no account.

Your entries and photos are stored **only on your phone**. Nobody else can see them, including whoever hosts the app. Each friend who installs it gets their own empty journal.

## Put it on your iPhone

The app has to live at a web address once, so your phone can download it. After that it runs from your phone, even in airplane mode.

### 1. Host it for free on GitHub Pages (one time, about 10 minutes)

1. Create a free account at [github.com](https://github.com).
2. Click **New repository**. Name it `bjj-journey`, choose **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Drag in everything in this folder **except** the `archive` folder: `index.html`, `manifest.webmanifest`, `sw.js`, `README.md`, and the `css`, `js` and `icons` folders. Click **Commit changes**.
5. Open **Settings → Pages**. Under **Branch**, pick `main` and `/ (root)`, then **Save**.
6. After a minute your app is live at `https://YOUR-USERNAME.github.io/bjj-journey/`.

Public here only means people can download the app's code. Your journal never leaves your phone.

### 2. Install it

1. On your iPhone, open that address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open **BJJ Journey** from your Home Screen. It opens full screen like any app.

Always open it from the Home Screen icon. On iPhone, the Home Screen app keeps its own storage, separate from Safari tabs.

### 3. Share with friends

Send them the same address and these install steps. Everyone's journal is separate and private to their own phone.

## Finding your way around

The bar at the bottom has five sections. Each one holds a few screens, shown as tabs under the header:

| Section | Screens |
|---|---|
| **Home** | Your overview: what keeps going wrong, what to work on next, whether you’re improving |
| **Journal** | Calendar · Rolls (roll notes and opponents) · Matchups |
| **Learn** | Sequences (with the quiz) · Game plan · Skill tree · Live roll · Moves · Study (scenario review, video study, fixes) · Resources |
| **Dojo** | Your character: it levels up from time on the mat and the moves you’ve learned |
| **You** | Profile (fighter card, training load, running, challenges, settings) · Stats · Injuries · Compete |

Tap a section twice to go back to its first screen. The round **+** button logs training from anywhere.

**Simple or Advanced.** The whole app starts Simple: Home shows this week, today's focus and one insight; Stats shows your consistency, game map and top moves; Profile your fighter card. Every other chart and analysis is two taps away under **Advanced stats**. Switch to Advanced with the link at the bottom of a screen, or in **You → Profile**, under Settings. Simple only hides things; nothing you log changes.

**Simple or Detailed logging.** The log form follows the mode (Advanced logs in Detailed) until you pick one for it, so you can keep the stats simple and the logs detailed. New to jiu-jitsu? Simple asks for the basics, a note about class, and one thing that worked and one to fix. Everything else (plans, energy and sleep, drills, reflection, rolls move by move) waits behind **Add more detail**. Detailed shows it all. Switch at the top of the log form or in **You → Profile**, under Settings.

## Moving your entries over from the claude.ai version

1. Open the old journal on claude.ai, go to **Stats → Export as JSON**, and save the file.
2. In the new app, go to **Stats → Restore from a backup** and choose that file.

## Importing from other apps (myBJJ, spreadsheets)

**Stats → Import from another app** reads CSV or JSON exports. It finds the date, mat time, rolls, class type, notes and technique columns on its own and shows a preview first. Mat time can come from one duration column, separate hours/minutes columns, or start and end times. Rolls can be a count, a list inside each session, or a separate rolls file: choose both files together. Any other columns are kept in each session’s notes.

**Photos (myBJJ’s Media folder):** in the Files app, press and hold the **Media** folder and choose **Compress**. Then choose the resulting `.zip` together with the data export. Photos from **Journal** are matched to sessions by file name or date, **Techniques** photos to moves, and the **Profile** photo becomes your profile picture. The preview lists any photo it couldn’t place. Videos are skipped.

**Profile:** your name, academy, coach, start date, birthday, weight, current belt and promotion history are read from the export too. Only empty profile fields are filled, and promotions you already have aren’t added twice.

Importing the same file again fills in mat time and rolls that an earlier import missed, without duplicating sessions or overwriting your edits. If an app only exports a spreadsheet (.xlsx), save it as CSV first.

## Class notes, opponents and the Dojo

**Moves from your notes.** Write class notes the way you'd say them (“we drilled the scissor sweep, then armbar from guard”) and the moves and positions you name show up as ticked chips under the note. They save as what class covered, so they count toward each move's mastery, your game map and the Dojo, the same as picking them by hand. Untick anything that's wrong; a guess with a ? offers what else the words could mean. Moves that caught you aren't counted. The “What class covered” picker and drill reps are still there if you'd rather tap.

**Opponents** (Journal → Rolls → Opponents) gives every partner you've named a page: your record (won–even–lost), the latest results as dots, their go-to move and your best answer, and the story of every roll with them, oldest first. Turning points are called out as they happen: a first win, three in a row, the move that caught you a third time, the day you paid it back. Your **nemesis** is the partner you've rolled 3+ times and beaten least, or whoever you pick on their page.

**Dojo** is one character that grows with you. Its level comes from time on the mat (10 XP an hour) and the moves you've learned (5 XP once you've seen a move, 15 drilled, 30 hit in sparring, 50 on a higher belt). It wears your real belt and stripes, a gi or a rashguard depending on which class you log most, and its look changes by itself as it levels: a headband at 5, a glow at 10, sparks at 20, gold at 30. Its stats are your game map.

## Other training

**Journal → Log other activity** records running, strength training, yoga, mobility, recovery and other sports, with time, duration, distance and intensity. They appear on the calendar as hollow dots and in Stats, but never toward mat hours.

**Training load** (You → Profile → Training load, and Home's "this week") counts BJJ only: mat sessions, drilling and competition. Runs and other training stay tracked, with their own Running tile, distance and pace. Tap **All training (incl. runs & other)** on the load chart to see everything stacked by type; the choice is remembered, and the week-over-week spike warning follows it. Readiness on Home always counts runs and other training, since fatigue is fatigue, and says so in its reason ("big run yesterday", "runs included").

**Challenges** (You → Profile → Challenges) are targets you set yourself, like 500 shrimps this month or 10 knee cuts that worked live. Progress fills in from what you log, and challenges behind pace show up on Home under "What should I work on next?".

## Study

- **Scenario review:** up to 5 situations a week from your own rolls: rounds that broke down, experiments you planned, your weakest sequence step and moves you keep getting caught by. Picture your answer, then reveal your notes, the matching fix and what comes next. Answer Got it, Need to drill (plans it for your next session) or Ask coach (adds a coach question).
- **Mastery levels:** each move climbs from *seen it* → *drilled it* → *hit it in sparring* → *hit it on a higher belt*. Your logs fill these in (drilling, reps, rolls that worked, submission wins in competition); tap the level on any move to raise it yourself.
- **Video study:** log instructionals and match study with timestamped notes. YouTube timestamps link to that moment, and notes tied to a move are copied into its Library notes.
- **Mistakes and fixes:** every roll cause (grips, base, frames…) has the usual errors behind it, cues to fix it and a drill. Tap a cause on any roll note to open it.

## Compete

Add your next tournament to get a countdown, a prep checklist, an A-game plan (one sequence each for standing, top and bottom, suggested from your best sequences), and the rules for your belt. After the event, log each match: result, how it ended, points and what happened. Your record comes from the matches.

## Game plan

**Learn → Game plan** is your whole game as one map: Standing → Guard or Passing → Control → Submissions, with Escapes from the bad spots. Logged rolls are the main source. Each roll's chain, in order, gives every move where it happened, how it went (landed, tried, or caught you) and where it led, with the rolls it came from. Older rolls with a single move or a list of moves are read in order from where the roll started. Sequences and Live roll chains add planned edges, marked as planned. Moves your partners caught you with sit on the problem side of each position. Nothing is guessed: where a move led is the next position you logged, else what the Live roll table lists from that exact spot. Anything else shows "Position after: unknown", with a quick way to set it. Moves logged with no position at all are listed apart.

Gaps come first: key positions with no answer (“No escape logged from bottom side control”), only one (“Only one pass from half guard top”), or none that has landed in a roll yet. They're ranked by where you get caught and spend your rolls. Each gap suggests moves the Live roll table lists from that exact spot and side, and one tap adds one to Today’s focus, starts a sequence with it, or searches for an instructional.

## Skill tree

**Learn → Skill tree** shows every move as a star, grouped by position. It starts dark. A move lights up (white) once you log it in any way: drilled, in a sequence, marked as seen, or used in a roll. Live successes raise it through the belt colors: blue at 3, purple at 10, brown at 25, black at 50. Live successes are moves landed in rolls and positional rounds, plus submission wins in competition. Being caught by a move never raises it; a move that keeps catching you gets a red marker. Drag or pinch the map, tap a position to open it, and zoom in to tap a single move. Each position shows how much of it you've explored and its best color, and **Blind spots** lists the kinds of moves you haven't touched, like “No escapes from bottom side control explored”. Advanced mode adds counts per color, live wins and catches. The thresholds live in `js/skills.js` (`THRESHOLDS`).

**BJJ level** is one number from 1 to 100, shown on the Skill tree and your Profile. Each belt is a band (white 1–20, blue 21–40, purple 41–60, brown 61–80). Stripes raise where you start in the band, and your skill tree fills the rest, so you can't pass the top of your band until you're promoted. Level 100 is your black belt. After that a new track starts: Black Belt Lv 1+, ten levels per degree.

## Live roll

**Learn → Live roll** is a turn-based roll against a simulated partner. Pick where it starts and who you’re rolling with, then choose one move per turn from options that fit your position. Points follow IBJJF scoring (2 for a takedown, sweep or knee on belly, 3 for a pass, 4 for mount or the back) and only count once you stabilize; a near miss earns an advantage, and a submission ends it. Your partner counters with moves that fit the position, and when they attack a submission you can defend it. Moves you’ve mastered in your journal land more often, and moves from your sequences (or the game maps) draw the reactions you mapped, with your answer offered next. Some options are moves for the other person, like a sweep when you’re on top: spot them, or pay for it. After the game, chains of moves that worked back to back and scored (or ended in the tap) can be saved as a sequence, or added as a branch to one that already starts with the same move, so you can drill them before your next session.

**Your game.** Once you log rolls, Live roll learns from them. "Where you usually start" offers your three most-logged starting positions, and "Recreate my last roll" starts where your last logged roll did, against a partner as tough as that partner's belt and size were for you. With "Use the moves I log", each turn gives one of your logged moves for that spot a slot, marked "Your move". A logged move the game doesn't list yet joins in only if it fits that side of the position: either the game lists it from a sibling spot (another open guard, another pin), where it lands the same way, or the library files it under that position, where it keeps you in place. A move logged in the wrong spot, like a rear naked choke from closed guard, stays out. "Rehearse my problem spots" makes your partner go for the moves that have caught you from each spot.

Every position and role the game can reach has its own menu in `js/sim.js`. To check it after editing, run `import('./js/simcheck.js').then(m => m.checkSim())` in the browser console: it checks every move's landing, role and points, then plays a few thousand random games looking for dead ends and impossible scores.

## Quiz

**Sequences → Quiz me** asks multiple-choice questions built from your sequences, the game maps and the move library: “Your partner sprawls. What’s your best answer?” Questions you miss come back more often.

## Backups

Because everything lives on your phone, a lost or wiped phone means a lost journal. Back up once in a while. A backup is a `.zip` with your journal and every photo as a normal image file:

- **Stats → Back up now**, then choose **Save to Files** and put it in iCloud Drive.
- To restore on a new phone, install the app, then use **Stats → Restore from a backup**.

Backups include your photos.

## Coaching review with Claude

On the Overview page, **Copy for Claude** packs your last 60 days of notes with a coaching prompt. Paste it into the Claude app to get patterns, blind spots and questions to test. Nothing is sent anywhere unless you paste it yourself.

## Updating the app

Change the files, then raise the version at the top of `sw.js` (for example `bjj-journey-v1` → `bjj-journey-v2`) and upload the changed files to GitHub. Phones pick up the new version the next time the app opens with a connection, and the change shows on the launch after that. Your journal data is never touched by an update.

## Running it on your computer

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## How the code is organized

Plain HTML, CSS and JavaScript modules: no framework, no build step, no dependencies. Edit a file, reload, done.

```
index.html            the page shell
css/app.css           all styles; colors are tokens at the top, with light and dark themes
sw.js                 offline caching
js/app.js             boot, tabs, and the one click handler: buttons name an action with data-act
js/store.js           IndexedDB storage; the whole journal is loaded into memory at launch
js/model.js           lookups: moves, sequences, partners, rank
js/analysis.js        the numbers behind Overview, Matchups and Stats
js/goals.js           challenges you set yourself and how their progress is counted
js/load.js            training load (BJJ only, or all training) and run stats
js/catalog.js         the built-in library of about 350 moves
js/maps.js            ready-made game maps (decision trees) shown in Resources
js/resources.js       curated learning links shown in Resources
js/importer.js        reads CSV/JSON exports from other training apps
js/zip.js             reads and writes .zip files (imports and backups)
js/scenarios.js       scenario review: weekly situations from your rolls
js/fixes.js           mistake and fix cards for each roll cause
js/views/*.js         one file per tab; each exports view(), an optional mount(), and its actions
```

To add a feature, find the tab it belongs to in `js/views/`, add its markup to `view()` and its buttons to `actions`.
