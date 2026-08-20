// Content pools for the three Wellbeing reading pages.
//
// Each list is rotated daily by utils/rotation.js, so the length of a pool is
// how many days a reader goes before seeing a repeat. Keep them at roughly
// three weeks' worth; a four-item list rotates visibly and reads as a shuffle.
//
// Shape: { title, body, link? } where link is { to, label } for the pages that
// have somewhere useful to send the reader. Anything added should be concrete
// enough to act on today — no general encouragement.

export const ROUTINES = [
  { title: 'Sleep is study time', body: 'Memory consolidates during sleep. Six hours before an exam beats two more hours of blurry revision.' },
  { title: 'Daylight before screens', body: 'Five minutes of morning daylight anchors your body clock and steadies energy all day.' },
  { title: 'Move between classes', body: 'A ten-minute walk resets attention better than scrolling. Use it before the subject you dread.' },
  { title: 'One win before bed', body: 'Write down one thing you did today — however small. Your journal is built for this.', link: { to: '/me/journal', label: 'Open Journal' } },
  { title: 'A consistent wake time', body: 'The hour you wake anchors the body clock far more than the hour you sleep. Hold it steady even after a late night — the tiredness passes in a day, a shifted clock takes a week.' },
  { title: 'Caffeine has a long tail', body: 'Half the caffeine in a 4pm coffee is still in you at 10pm. It rarely stops you falling asleep, but it flattens deep sleep — which is the part that consolidates what you studied. Set a cutoff around early afternoon.' },
  { title: 'Eat before the crash, not after', body: 'Skipping lunch to keep working reliably costs the whole afternoon. A dull, regular meal beats a brilliant plan you abandon at 4pm because you cannot think straight.' },
  { title: 'Protein at breakfast, not just carbs', body: 'A carb-only breakfast spikes and drops within two hours — the mid-morning slump most people blame on bad sleep. Adding eggs, curd or dal flattens the curve.' },
  { title: 'Hydration before diagnosis', body: 'Mild dehydration presents exactly like tiredness, irritability and a headache. Before deciding the day is a write-off, drink a glass of water and give it twenty minutes.' },
  { title: 'Phone out of the bedroom', body: 'Not for discipline — for the first ten minutes of the day. Waking into other people\'s demands sets the day\'s tone before you have picked your own. Charge it in the next room and use a real alarm.' },
  { title: 'Screens down, lights down', body: 'The last hour before bed matters more than the eight after it. Dim the room, drop the brightness, and let the body start the process rather than switching it off mid-scroll.' },
  { title: 'Sunlight is a mood input', body: 'Light exposure is one of the few reliable, free levers on mood and alertness. On a day spent entirely indoors under tubelights, energy drops for reasons that have nothing to do with workload.' },
  { title: 'Train for stamina, not aesthetics', body: 'The reason to exercise during a demanding course is that it raises your ceiling for hard days. Three short sessions a week you actually do beats a plan built for someone with more time.' },
  { title: 'Stand up every hour', body: 'Two minutes on your feet each hour does more for afternoon focus than an extra coffee. Attention is partly circulation; sitting for four hours is a concentration problem before it is a health one.' },
  { title: 'Protect one evening a week', body: 'A single evening that is reliably not work — same evening, every week — does more for stamina than occasional collapse. Reliability is what makes it restful; you stop bracing for it to be taken.' },
  { title: 'Name the day\'s one thing', body: 'Before opening anything else, decide the single task that would make today count. Everything else is negotiable. Ending a busy day unsure what you achieved is usually a planning failure, not an effort one.' },
  { title: 'Batch the small stuff', body: 'Replies, forms, admin — do them in one deliberate block rather than sprinkled through the day. Each interruption costs far more than the task itself, because getting back into deep work is the expensive part.' },
  { title: 'Study away from your bed', body: 'Working where you sleep teaches the body that both places mean neither rest nor focus. Even a different chair helps; the point is a boundary the body can recognise.' },
  { title: 'Ten minutes of nothing', body: 'Not a break with a screen in it — actual nothing. Sitting still, walking without headphones. The mind sorts the morning during these gaps, and a day with none of them feels longer than it was.' },
  { title: 'Plan tomorrow before you stop today', body: 'Three lines, written while today\'s context is still in your head, save the first hour of tomorrow. It also lets you stop working — the loop stays closed instead of running all evening.', link: { to: '/me/planner', label: 'Open Planner' } },
  { title: 'One bad night is not a pattern', body: 'A single poor night costs less than the anxiety about it. Keep the wake time, get daylight early, do not nap past twenty minutes — and treat the day as normal rather than writing it off.' },
];

export const STUDY_TECHNIQUES = [
  { title: 'Active recall', body: 'Close the book and write everything you remember, then check. Retrieval — not re-reading — is what builds memory.' },
  { title: 'Spaced repetition', body: 'Review a topic after 1 day, 3 days, then a week. Each spaced review roughly doubles how long it sticks.' },
  { title: 'The Feynman method', body: 'Explain the concept out loud as if teaching a junior. Wherever you stumble is exactly what you don\'t yet understand.' },
  { title: 'One-topic focus blocks', body: 'One subject, 25–45 minutes, phone in another room. Try the timer on the Focus page.', link: { to: '/study/focus', label: 'Open Focus' } },
  { title: 'Fluency is not knowledge', body: 'Re-reading feels excellent because the material becomes familiar, and familiarity is easily mistaken for understanding. The test is whether you can produce it from memory, not whether you recognise it on the page.' },
  { title: 'Interleave your subjects', body: 'Studying one topic in a long block feels efficient and produces weaker retention than mixing two or three. Mixing forces you to identify which method applies — which is precisely what an exam asks.' },
  { title: 'Start with the questions', body: 'Read the exercises before the chapter. You will read differently — hunting rather than absorbing — and you will notice immediately which parts of the chapter actually matter.' },
  { title: 'Write summaries from memory', body: 'A summary written with the book open is transcription. Written with the book closed, it is a diagnostic: the gaps in the page are the gaps in your head, and they are the only thing worth revising.' },
  { title: 'Practise under exam conditions', body: 'Timed, closed-book, in one sitting, at least once. Most exam underperformance is not missing knowledge — it is knowledge that has never been retrieved under time pressure before.' },
  { title: 'Struggle before the answer', body: 'Attempting a problem and failing, then seeing the solution, beats reading the solution first — even though it feels worse and takes longer. The failed attempt is what makes the answer stick.' },
  { title: 'Teach it to someone else', body: 'Study groups work when someone is explaining and the others are allowed to interrupt. They fail when everyone reads silently in the same room and calls it group study.' },
  { title: 'Elaborate: ask why', body: 'For each fact, ask why it is true and how it connects to what you already know. Isolated facts decay fast; facts hung on an existing structure survive because there are several routes back to them.' },
  { title: 'Concrete examples beat definitions', body: 'For any abstract concept, find two real cases and one counter-case. The counter-case is the valuable one — knowing where a framework stops applying is what separates using it from reciting it.' },
  { title: 'Draw the structure', body: 'A one-page map of how a chapter\'s ideas relate is worth more than four pages of linear notes. In an exam you recall the shape first and the details hang off it.' },
  { title: 'Handwrite the important parts', body: 'Typing is fast enough to transcribe without thinking; handwriting is slow enough to force selection. The compression is where the learning happens, so the slower medium usually wins for concepts.' },
  { title: 'Study the marking scheme', body: 'Most papers reward structure heavily — a clear framework and a stated assumption often score more than an extra paragraph of correct content. Read past papers for what earns marks, not only for topics.' },
  { title: 'Review the same day', body: 'Ten minutes revisiting today\'s lecture tonight saves an hour of re-learning next month. Forgetting is steepest in the first twenty-four hours; one pass inside that window changes the entire curve.' },
  { title: 'Two passes beat one long one', body: 'A fast, rough read to get the shape, then a slower one for detail, beats a single careful pass. The first pass builds the frame the second pass hangs things on — and it takes less total time.' },
  { title: 'Keep a question log', body: 'Write down what you did not understand rather than pushing past it. Half resolve themselves by the next lecture; the rest become the sharpest possible list to take to office hours.' },
  { title: 'Do the hard subject first', body: 'Attention is at its best early and gets spent by admin and easy wins. Whatever you have been avoiding gets the first block of the day, not the leftover one.' },
  { title: 'Stop mid-thought', body: 'Ending a session mid-problem rather than at a clean break makes restarting far easier — the unfinished thought stays live, and you skip the twenty minutes of reloading context tomorrow.' },
];

export const MEMORY_TECHNIQUES = [
  { title: 'Chunking', body: 'Group long material into 3–5 item chunks. Frameworks like 4P or SWOT persist because they are pre-chunked.' },
  { title: 'Memory palace', body: 'Place items along a route you know well — your walk to class — and retrieve them by walking it mentally.' },
  { title: 'Make it weird', body: 'The brain keeps what is vivid and strange. An absurd mental image beats a neat, forgettable summary.' },
  { title: 'Acronyms you build yourself', body: 'A mnemonic someone else made is one more thing to memorise. One you built from your own associations is nearly free, because the work of building it was the encoding.' },
  { title: 'Attach to what you already know', body: 'New material sticks in proportion to how much existing knowledge it is tied to. Before memorising a framework, find the thing you already understand that it resembles — you are building an index, not a file.' },
  { title: 'Say it out loud', body: 'Spoken material is remembered better than silently read material, reliably enough that it has a name — the production effect. Reading key definitions aloud once costs seconds.' },
  { title: 'The first and last stick', body: 'You remember the start and end of a session far better than the middle. Two short sessions have four such edges where one long one has two — so put the difficult material at a beginning or an end.' },
  { title: 'Test yourself before you feel ready', body: 'Self-testing while you still get things wrong builds memory faster than testing once you are confident. By the time it feels comfortable, each additional test is teaching you much less.' },
  { title: 'Use numbers as hooks', body: 'Deliberately remember how many items are in a list. Knowing there are five stops you at four and tells you to keep searching — recall fails silently otherwise, and you never notice the gap.' },
  { title: 'Rehearse in the order you will need it', body: 'Memory is direction-sensitive. If you will present a framework start-to-finish, rehearse it that way — practising in a different order than you will use it leaves you fluent in the wrong sequence.' },
  { title: 'Sleep on the hard material', body: 'Reviewing difficult content shortly before sleep is unusually effective; consolidation happens overnight. It is the one time "one more look" genuinely pays rather than eating tomorrow.' },
  { title: 'Change where you study', body: 'Studying the same material in two different places builds more retrieval routes than two sessions in one spot. Context becomes part of the memory, and varying it stops recall depending on the room.' },
  { title: 'Stories over lists', body: 'Turn a list into a sequence where each item causes the next. Narrative is the format memory is best at — a story of six steps is easier to hold than six unconnected bullets.' },
  { title: 'Space it wider each time', body: 'Review after a day, then three, then a week, then a month. Each successful recall at a longer gap buys more durability than the same number of reviews packed close together.' },
  { title: 'Draw it once', body: 'A rough sketch — even a bad one — creates a visual trace alongside the verbal one, and two traces are easier to retrieve than one. The quality of the drawing is irrelevant.' },
  { title: 'Learn the exceptions separately', body: 'Exceptions studied alongside the rule blur into it. Learn the rule until solid, then attack the exceptions as their own small set, explicitly labelled as such.' },
  { title: 'Recall in the exam\'s format', body: 'If the exam asks for a written argument, practise writing arguments — not highlighting. Memory is retrieved best in the form it was practised, so match the rehearsal to the task.' },
  { title: 'Overlearn the core, skim the rest', body: 'The 20% you will need under pressure deserves passes well past the point of knowing it. Everything else needs familiarity, not mastery. Treating all material as equally important is why revision runs out of time.' },
  { title: 'Explain it to the confused version of you', body: 'Aim your explanation at yourself two weeks ago. It forces you to keep the reasoning instead of skipping to the conclusion, and the reasoning is what regenerates a fact you have half-forgotten.' },
  { title: 'Retrieve before you review', body: 'Always try to remember before opening the notes, even when you are sure you have forgotten. The failed attempt primes the material, so re-reading afterwards lands far harder than reading first.' },
  { title: 'Three cues beat one', body: 'A fact tied to an image, a phrase and a place has three ways back. Single-cue memories fail completely when that one cue does not arrive — which is what a blank in an exam actually is.' },
];
