# LosMoya BJJ Journey

A private jiu-jitsu training journal that installs on your iPhone like an app, works offline, and needs no account.

Your entries, photos and achievements are stored **only on your phone**. Nobody else can see them, including whoever hosts the app. Each friend who installs it gets their own empty journal.

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

## Moving your entries over from the claude.ai version

1. Open the old journal on claude.ai, go to **Stats → Export as JSON**, and save the file.
2. In the new app, go to **Stats → Restore from a backup** and choose that file.

## Importing from other apps (myBJJ, spreadsheets)

**Stats → Import from another app** reads CSV or JSON exports. It finds the date, mat time, rolls, class type, notes and technique columns on its own and shows a preview first. Mat time can come from one duration column, separate hours/minutes columns, or start and end times. Rolls can be a count, a list inside each session, or a separate rolls file: choose both files together. Any other columns are kept in each session’s notes.

**Photos (myBJJ’s Media folder):** in the Files app, press and hold the **Media** folder and choose **Compress**. Then choose the resulting `.zip` together with the data export. Photos from **Journal** are matched to sessions by file name or date, **Techniques** photos to moves, and the **Profile** photo becomes your profile picture. The preview lists any photo it couldn’t place. Videos are skipped.

Importing the same file again fills in mat time and rolls that an earlier import missed, without duplicating sessions or overwriting your edits. If an app only exports a spreadsheet (.xlsx), save it as CSV first.

## Other training

**Journal → Log other activity** records running, strength training, yoga, mobility, recovery and other sports, with time, duration, distance and intensity. They appear on the calendar as hollow dots and in Stats, and count toward Cross-training achievements, but never toward mat hours.

## Study

- **Review deck:** every move you’ve seen, starred, drilled or put in a sequence becomes a flash card. Recall it, flip it to check against your own notes, and grade yourself. Cards you know come back less often; cards you forget come back tomorrow. Up to 10 new cards a day.
- **Mastery levels:** each move climbs from *seen it* → *drilled it* → *hit it in sparring* → *hit it on a higher belt*. Your logs fill these in (drilling, reps, rolls that worked, submission wins in competition); tap the level on any move to raise it yourself.
- **Video study:** log instructionals and match study with timestamped notes. YouTube timestamps link to that moment, and notes tied to a move are copied into its Library notes.
- **Mistakes and fixes:** every roll cause (grips, base, frames…) has the usual errors behind it, cues to fix it and a drill. Tap a cause on any roll note to open it.

## Compete

Add your next tournament to get a countdown, a prep checklist, an A-game plan (one sequence each for standing, top and bottom, suggested from your best sequences), and the rules for your belt. After the event, log each match: result, how it ended, points and what happened. Your record comes from the matches.

## Quiz

**Sequences → Quiz me** asks multiple-choice questions built from your sequences, the game maps and the move library: “Your partner sprawls. What’s your best answer?” Questions you miss come back more often, and quizzes count toward Study achievements.

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
js/achievements.js    milestone ladders and your own challenges
js/catalog.js         the built-in library of about 350 moves
js/maps.js            ready-made game maps (decision trees) shown in Resources
js/resources.js       curated learning links shown in Resources
js/importer.js        reads CSV/JSON exports from other training apps
js/zip.js             reads and writes .zip files (imports and backups)
js/srs.js             review deck scheduling (spaced repetition)
js/fixes.js           mistake and fix cards for each roll cause
js/views/*.js         one file per tab; each exports view(), an optional mount(), and its actions
```

To add a feature, find the tab it belongs to in `js/views/`, add its markup to `view()` and its buttons to `actions`.
