// Scene script for the /pitch walkthrough.
//
// The page plays these in order like a video: each scene holds for `seconds`,
// then crossfades to the next. Durations are tuned so the whole reel runs just
// under the 3-minute cap the Eureka pitch format allows, with the narration
// lines matching the speaker notes in the deck.
//
// `shot` names a PNG in client/public/pitch/. Capture them with
// `node scripts/capture-pitch-shots.mjs` — the file names there are the source
// of truth for this list. A missing shot degrades to a labelled placeholder
// frame rather than a broken image, so the reel always plays.

export const PITCH_SITE = 'www.datad.online';

export const PITCH_SCENES = [
  {
    id: 'cold-open',
    chapter: 'DATAD',
    kind: 'title',
    seconds: 9,
    title: 'The Student Operating System',
    narration:
      'Study. Career. Finance. Community. Reflection — one calm system, and an AI advisor that actually knows the student.',
    points: ['Live in production', 'Built solo, end to end', 'No ads · No feed · No data sale'],
    // Week-one honesty: the closing scene carries the real usage numbers.
  },
  {
    id: 'problem',
    chapter: 'The problem',
    kind: 'title',
    seconds: 15,
    title: 'A dozen tools that share nothing',
    narration:
      'Notes in one app, deadlines in another, the resume in a Word file, expenses nowhere at all, placement intel in WhatsApp. Nothing shares context — so nothing can advise you. It can only store fragments.',
    points: ['Constant context-switching', 'Advice stays generic', 'Burnout exactly when clarity matters'],
  },
  {
    id: 'briefing',
    chapter: 'Solution',
    kind: 'shot',
    seconds: 16,
    shot: 'briefing.png',
    route: '/briefing',
    title: 'One place the day starts',
    narration:
      'DATAD opens on a briefing: what is due, what moved, what needs a decision today — assembled from the student’s own data, not a feed.',
    points: ['Deadlines, classes and commitments in one view', 'Assembled, not scrolled'],
  },
  {
    id: 'study',
    chapter: 'Study',
    kind: 'shot',
    seconds: 15,
    shot: 'study.png',
    route: '/study/notes',
    title: 'Notes that can be reasoned over',
    narration:
      'Notes, planner and resources sit behind a semantic index — search by meaning, not keywords, so Dax can retrieve what the student actually wrote.',
    points: ['Embedding-based retrieval', 'Planner and assignments in the same system'],
  },
  {
    id: 'career',
    chapter: 'Career',
    kind: 'shot',
    seconds: 17,
    shot: 'career.png',
    route: '/career/resume',
    title: 'A resume that improves across versions',
    narration:
      'The resume builder keeps every iteration. Dax scores it, suggests edits, and tracks whether the next version is actually better — because it remembers the last one.',
    points: ['Versioned resume history', 'Company prep and opportunities alongside'],
  },
  {
    id: 'interviews',
    chapter: 'Career',
    kind: 'shot',
    seconds: 14,
    shot: 'interviews.png',
    route: '/career/questions',
    title: 'Interview practice on demand',
    narration:
      'Mock interviews and STAR stories, coached against the student’s own experience and the company they are actually preparing for.',
    points: ['Company-specific prep', 'Feedback on substance, not just answers'],
  },
  {
    id: 'dax',
    chapter: 'Dax',
    kind: 'shot',
    seconds: 18,
    shot: 'dax.png',
    route: '/dax',
    title: 'The advisor knows the student',
    narration:
      'This is the difference. Dax reads the real resume history, exam calendar, placement timeline and budget, and remembers across sessions. A blank-slate chatbot starts every conversation blind.',
    points: ['Persistent context, not a fresh prompt', 'Tier-based model routing under the hood'],
  },
  {
    id: 'finance',
    chapter: 'Finance',
    kind: 'shot',
    seconds: 12,
    shot: 'finance.png',
    route: '/me/finance',
    title: 'Money visible before the crisis',
    narration:
      'Expenses, budgets and goals tracked in the same system — so financial pressure shows up as a number, not a surprise.',
    points: ['Tracking plus literacy coaching'],
  },
  {
    id: 'community',
    chapter: 'Community',
    kind: 'shot',
    seconds: 14,
    shot: 'community.png',
    route: '/community',
    title: 'The batch’s knowledge stays put',
    narration:
      'Discussions, skill exchange, events and announcements. This is where the network effect lives — every classmate who joins makes the system worth more, and a competitor cannot buy it.',
    points: ['Cohort network effects', 'Built for any college, not one campus'],
  },
  {
    id: 'mobile',
    chapter: 'Reach',
    kind: 'shot',
    seconds: 11,
    shot: 'mobile.png',
    route: 'iOS · Android',
    title: 'Same system, in the pocket',
    narration:
      'The whole platform is packaged as a native shell for iOS and Android — the same account, the same context.',
    points: ['Capacitor shell, store-ready'],
  },
  {
    id: 'close',
    chapter: 'DATAD',
    kind: 'title',
    seconds: 10,
    title: 'Live today. Week one.',
    narration:
      'Not a prototype — deployed and in real use. 10 students testing it in the first week, and 20+ students who now have a professional resume built through DATAD. One batch at a time, then one campus at a time.',
    points: ['10 students testing', '20+ resumes built', PITCH_SITE],
  },
];

export const PITCH_RUNTIME = PITCH_SCENES.reduce((sum, s) => sum + s.seconds, 0);
