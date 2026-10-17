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
