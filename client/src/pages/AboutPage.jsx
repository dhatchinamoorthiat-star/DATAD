import { useCallback, useMemo } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Banknote, Brain, BookOpen, Briefcase, CalendarRange, Users,
} from 'lucide-react';
import { Page } from '../components/common/motion';
import {
  AmbientLight,
  BuildSpine,
  ModuleStrip,
  RefusalList,
  Reveal,
  SpecPlate,
  CREATOR,
  CREATOR_VARS,
  IDENTITY,
  useChapterSpy,
} from '../components/creator';
import { AboutRail, AboutBar, AcronymLadder, ContrastLedger, MemoryFigure } from '../components/about';
import { MAKER } from '../utils/maker';

// ── /about ─────────────────────────────────────────────────────────────────
//
// The About page, rebuilt around the question it was never actually answering.
//
// ── What changed, and why ──────────────────────────────────────────────────
//
// The page this replaces opened with a three-stage animated matrix of the five
// DATAD letters — cards flying in, dashed connectors drawing themselves,
// `animate-ping` dots, and a replay button so you could watch it again. Then
// five statistic cards in five different hues, three gradient "pillar" cards, a
// gradient-filled headline, and a timeline. It was competent and it was a
// template, and it never once said why a student should use this instead of the
// assistant already open in their other tab.
//
// That is the question this version is built to answer, and answering it is now
// possible in a way it was not six months ago: the memory layer shipped. Daily
// profile snapshots, trends computed over them, a ledger of Dax's own forecasts
// resolved against reality, and k-anonymous cohort aggregates. Those are
// structural advantages — a general model cannot have them, because it does not
// hold the data — so chapter 04 states them as mechanics rather than as
// adjectives, and chapter 05 shows the actual shape of the data.
//
// ── Where it sits relative to /creator ─────────────────────────────────────
//
// Same publication. Same `IDENTITY.ink` canvas, same rail with its 26px
// numbered markers, same numeral-and-rule chapter openers, same CSS-first
// entrance discipline, same single ember accent rationed to almost nothing.
// /creator is one person's account of building it; this is the account of what
// was built. A reader should be able to move between them without noticing a
// seam, which is why every shared part is imported from components/creator
// rather than reimplemented a shade off.
//
// Deliberately absent, for the reason the creator page gives: gradient-filled
// headlines, `font-black`, scale-on-hover cards, coloured blur blobs, pill
// eyebrows in six hues, and the 3-up value grid.
//
// ── Copy that was dropped rather than restyled ─────────────────────────────
//
// The old "why data matters" section carried four statistics — "1 in 3 career
// decisions are data-driven", "₹8–30L salary premium for data-literate
// professionals", "90% of all data was created in the last 2 years", "2.5
// quintillion bytes a day" — with no source on any of them, and the middle two
// are not checkable claims at all. A page whose central argument is "this
// product does not overstate what it knows" cannot open with four unsourced
// numbers. The argument survives in chapter 02; the numbers did not.
//
// Nothing on this page is fetched, so there are no loading or error states to
// design. Every figure below is either checkable in the repository or is
// explicitly marked as not yet finished.

const CHAPTERS = [
  { id: 'premise', number: '01', label: 'The premise' },
  { id: 'data', number: '02', label: 'Why data' },
  { id: 'name', number: '03', label: 'The name' },
  { id: 'difference', number: '04', label: 'Why not a chatbot' },
  { id: 'memory', number: '05', label: 'What it remembers' },
  { id: 'system', number: '06', label: 'The system' },
  { id: 'refusals', number: '07', label: 'Refusals' },
  { id: 'record', number: '08', label: 'The record' },
];

const SPEC = [
  { label: 'What it is', value: 'A student operating system' },
  { label: 'Built for', value: 'Indian students, any field' },
  { label: 'Assistant', value: 'Dax — one identity, every surface' },
  { label: 'Surfaces', value: 'Six, one shared memory' },
  { label: 'Business model', value: 'Subscription. Never ads.' },
  { label: 'Your data', value: 'Yours', accent: true },
];

// Discover · Aspire · Transform · Achieve · Develop.
const ACRONYM = [
  {
    letter: 'D',
    word: 'Discover',
    body: 'Find the thing you did not know to look for — a company, a skill gap, a case you would have skipped. Most of what changes a placement season is something nobody told you to search for.',
  },
  {
    letter: 'A',
    word: 'Aspire',
    body: 'Name the target before the season names it for you. Roles, companies, a readiness number you can actually move — written down, where they can be argued with.',
  },
  {
    letter: 'T',
    word: 'Transform',
    body: 'Turn what you have read into something you can do. Cases solved, stories written, a resume that survives a screen. This is the letter the platform spends most of its time on.',
  },
  {
    letter: 'A',
    word: 'Achieve',
    body: 'The offer, the milestone, the semester you did not lose. Recorded, because the version of this you remember in an interview is never the version that happened.',
  },
  {
    letter: 'D',
    word: 'Develop',
    body: 'Keep going after the offer. The habits that got you through the drive are the ones that decide the two years after it.',
  },
];

// The comparison. Every right-hand claim maps to a mechanism in the repository;
// the two that are not finished say so in their own `note` rather than being
// quietly left in as though they were.
const CONTRAST = [
  {
    subject: 'Memory',
    generic:
      'Starts from nothing each conversation, or remembers what you thought to tell it. It has never seen your task list, because your task list is not in it.',
    datad:
      'Reads your planner, notes, resume, applications, study log and stress signals before it answers — then compares today against a daily record of the last fortnight.',
    note: 'Nine collectors on every request; one snapshot per student per day.',
  },
  {
    subject: 'Evidence',
    generic:
      'Fluent about you in general terms. "You seem to have lost some momentum lately" is a sentence it can produce with no information at all.',
    datad:
      'Required to name the number behind any claim about your trajectory — "your consistency is down 34 points since the 9th" — and forbidden from asserting a direction when it has no history to read.',
    note: 'Written into the assistant’s own instructions, not left to the model.',
  },
  {
    subject: 'Accountability',
    generic:
      'Makes a forecast, and the conversation moves on. Nothing records what was predicted, so nothing can ever contradict it.',
    datad:
      'Forward-looking claims are written to a ledger with a date, checked against what actually happened, and shown to you with misses displayed exactly as prominently as hits.',
    note: 'Currently records the forecasts it makes about placement readiness. Claims made in open chat are not captured yet.',
  },
  {
    subject: 'Peers',
    generic:
      'Knows what students do in general, from the public internet. It has never met your batch.',
    datad:
      'Aggregates over students in your batch and college — never a name, never an individual, and nothing at all for a group smaller than five.',
    note: 'Computed nightly and privacy-gated today; not yet quoted inside Dax’s answers.',
  },
  {
    subject: 'Initiative',
    generic:
      'Waits to be opened. It cannot notice that you are eleven days from a drive with three overdue tasks, because it is not running when you are not typing.',
    datad:
      'Sends one message when three things line up at once — the drive is close, work is slipping, and the trend confirms it. Once a day, at most, and only on a real threshold.',
    note: 'One nudge per student per day, hard-capped independently of the thresholds.',
  },
  {
    subject: 'Incentive',
    generic:
      'Free at the point of use, funded somewhere you cannot see, and improving on data you supplied.',
    datad:
      'Paid for by the people using it. No ads, no data sale, no third-party trackers, and export is one click.',
  },
];

const MODULES = [
  { icon: BookOpen, title: 'Notes', body: 'Rich text, tagging, search and a structure that survives a whole semester of it.' },
  { icon: CalendarRange, title: 'Planner', body: 'Weekly planning that understands semester rhythm — not a to-do list with dates on it.' },
  { icon: Banknote, title: 'Finance', body: 'Expenses, budgets, and the ROI maths nobody teaches you before you sign the loan.' },
  { icon: Briefcase, title: 'Career', body: 'Company prep, placement drives, applications and interview tracking in one place.' },
  { icon: Users, title: 'Community', body: 'Announcements, events, skill exchange, and the batch memory that usually lives in a chat group.' },
  { icon: Brain, title: 'Dax', body: 'The layer underneath the rest — it reads context across every surface, and suggests rather than interrupts.' },
];

const REFUSALS = [
  {
    term: 'Ads.',
    body: 'Attention is the one thing a student has less of than money. It is not inventory, and it will not be sold from inside this product.',
    note: 'Never, at any tier',
  },
  {
    term: 'Data selling.',
    body: 'Notes, money and journal entries are the raw material of a life. They stay in the account they were written in, and export is one click away.',
    note: 'Your data, your account',
  },
  {
    term: 'Flattery.',
    body: 'An assistant that only ever agrees with you is a very expensive mirror. Dax is built to show you the number even when the number is not the one you wanted.',
    note: 'Misses shown like hits',
  },
];

const TIMELINE = [
  {
    year: '2024',
    title: 'Notes and Planner',
    body: 'The first two tools, built for one batch during one semester. Classmates started using them without being asked, which is the only product signal worth trusting.',
  },
  {
    year: '2025',
    title: 'Finance and Resume',
    body: 'Expense tracking, budgets, and an ATS-ready resume builder — written in the weeks before placement season, because that is when it became obvious they were missing.',
  },
  {
    year: '2025',
    title: 'Career Hub and Dax',
    body: 'Company prep, a readiness score, daily cases, and the first version of an assistant that could read across all of it instead of answering in a vacuum.',
  },
  {
    year: '2026',
    title: 'The memory layer',
    body: 'Dax stopped being amnesiac. Daily snapshots of every active student, trends computed over them, a ledger that checks its own forecasts, and cohort aggregates that cannot describe an individual.',
  },
  {
    year: 'Now',
    title: 'Still building',
    body: 'Chat-sourced predictions, cohort insight inside answers, and the next thing a batch turns out to need. The list did not stop.',
    open: true,
  },
];

// Section frame — the same rhythm /creator uses: a numeral, a word, a rule, a
// statement, a lede. Kept local in both places because it is a rhythm rather
// than a component, and the two pages are allowed to diverge in what sits under
// the lede without negotiating a shared prop.
function Chapter({ id, index, kicker, title, lede, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t px-6 py-20 sm:px-10 lg:px-14 lg:py-28 xl:px-20"
      style={{ borderColor: IDENTITY.inkLine }}
      aria-labelledby={`${id}-title`}
    >
      <Reveal className="mx-auto w-full max-w-[62rem]">
        <div className="flex items-baseline gap-4">
          <span
            className="text-[11px] font-semibold tabular-nums tracking-[0.2em]"
            style={{ color: IDENTITY.blue }}
          >
            {index}
          </span>
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: '#68717F' }}
          >
            {kicker}
          </span>
          <span className="h-px flex-1" style={{ background: IDENTITY.inkLine }} aria-hidden="true" />
        </div>

        <h2
          id={`${id}-title`}
          className="mt-6 max-w-[22ch] text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[38px] lg:text-[42px]"
          style={{ color: IDENTITY.paper }}
        >
          {title}
        </h2>

        {lede && (
          <p className="mt-5 max-w-[58ch] text-[15.5px] leading-relaxed" style={{ color: IDENTITY.muted }}>
            {lede}
          </p>
        )}
      </Reveal>

      <div className="mx-auto mt-12 w-full max-w-[62rem] lg:mt-16">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  const reduce = useReducedMotion();
  const chapterIds = useMemo(() => CHAPTERS.map((c) => c.id), []);
  const active = useChapterSpy(chapterIds);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  const jump = useCallback(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    },
    [reduce]
  );

  return (
    <Page bare className="min-h-screen">
      <div
        className="relative min-h-screen"
        style={{ ...CREATOR_VARS, background: IDENTITY.ink, color: IDENTITY.paper }}
      >
        <motion.div
          className="fixed inset-x-0 top-0 z-40 h-px origin-left"
          style={{
            scaleX: reduce ? 1 : progress,
            background: `linear-gradient(to right, ${IDENTITY.violet}, ${IDENTITY.blue}, ${IDENTITY.blueSoft})`,
          }}
          aria-hidden="true"
        />
        <AmbientLight />

        <AboutBar />

        <div className="relative z-10 flex">
          <AboutRail chapters={CHAPTERS} active={active} onJump={jump} />

          <main className="min-w-0 flex-1">
            {/* ── 01 The premise ────────────────────────────────────────── */}
            <section
              id="premise"
              className="relative flex min-h-[82vh] scroll-mt-24 items-center px-6 py-20 sm:px-10 lg:min-h-screen lg:px-14 lg:py-24 xl:px-20"
              aria-labelledby="premise-title"
            >
              <div className="relative z-10 w-full max-w-[52rem]">
                <p
                  className="identity-rise text-[11px] font-semibold uppercase tracking-[0.22em]"
                  style={{ '--rise-delay': '0.05s', color: IDENTITY.blueSoft }}
                >
                  About DATAD
                </p>

                {/* Three lines, two paper and one blue — the shape /register and
                    /creator both open with, so all three surfaces start in the
                    same voice before they diverge. */}
                <h1
                  id="premise-title"
                  className="mt-6 text-[clamp(2.2rem,6.2vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.035em]"
                >
                  <span className="identity-rise block" style={{ '--rise-delay': '0.12s', color: IDENTITY.paper }}>
                    Every assistant
                  </span>
                  <span className="identity-rise block" style={{ '--rise-delay': '0.24s', color: IDENTITY.paper }}>
                    forgets you.
                  </span>
                  <span className="identity-rise block" style={{ '--rise-delay': '0.36s', color: IDENTITY.blueSoft }}>
                    This one keeps the receipts.
                  </span>
                </h1>

                <p
                  className="identity-rise mt-8 max-w-[56ch] text-[16px] leading-relaxed"
                  style={{ '--rise-delay': '0.48s', color: IDENTITY.muted }}
                >
                  DATAD is a student operating system: notes, planner, finances,
                  career prep and community in one place, with an assistant
                  called Dax underneath all of it. The difference is not that Dax
                  is cleverer than the model in your other tab. It is that Dax
                  has been paying attention to your semester, keeps a dated
                  record of it, and is required to show you that record before it
                  claims anything about you.
                </p>

                <div
                  className="identity-rise mt-10 flex flex-wrap items-center gap-4"
                  style={{ '--rise-delay': '0.58s' }}
                >
                  <Link
                    to="/register"
                    className="creator-focus group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-semibold transition-transform duration-200"
                    style={{ background: IDENTITY.blue, color: '#050810' }}
                  >
                    Start using it
                  </Link>
                  <button
                    type="button"
                    onClick={() => jump('difference')}
                    className="creator-focus text-[13.5px] font-medium underline-offset-4 transition-colors duration-200 hover:underline"
                    style={{ color: IDENTITY.blueSoft }}
                  >
                    Why not just use a chatbot?
                  </button>
                </div>

                <SpecPlate
                  rows={SPEC}
                  className="identity-rise mt-14 max-w-[46rem]"
                  style={{ '--rise-delay': '0.68s' }}
                />
              </div>
            </section>

            {/* ── 02 Why data ───────────────────────────────────────────── */}
            <Chapter
              id="data"
              index="02"
              kicker="Why data"
              title="Your semester is a dataset nobody is keeping."
              lede="Two years, and a few hundred decisions: which electives, which companies, which skills, which weekends. Each one is a fact about you. Almost all of them evaporate within a week of happening."
            >
              <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
                <Reveal>
                  <p className="max-w-[56ch] text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                    This matters in one specific room. In an interview you are
                    asked to account for two years in about forty minutes, and
                    the honest answer for most students is that they cannot
                    remember. Not because nothing happened — because nothing was
                    written down while it was happening.
                  </p>
                  <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                    The students who walk in confident are rarely the ones who
                    did more. They are the ones who can point at what they did.
                    That is the entire premise: a record is not admin overhead,
                    it is the raw material of every claim you will make about
                    yourself.
                  </p>
                  <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: IDENTITY.paper }}>
                    DATAD is built to keep that record as a side effect of using
                    it, rather than as a chore you are nagged into.
                  </p>
                </Reveal>

                <Reveal delay={120}>
                  <blockquote
                    className="border-l pl-6 text-[17px] leading-[1.55] sm:text-[19px]"
                    style={{ borderColor: IDENTITY.blue, color: IDENTITY.paper }}
                  >
                    Data does not make the decision for you. It gives your
                    instinct something real to argue with.
                  </blockquote>
                  <p className="mt-6 max-w-[42ch] text-[13.5px] leading-relaxed" style={{ color: '#68717F' }}>
                    Which is also why the name starts where it starts — DATAD
                    opens with data, and that was never a coincidence.
                  </p>
                </Reveal>
              </div>
            </Chapter>

            {/* ── 03 The name ───────────────────────────────────────────── */}
            <Chapter
              id="name"
              index="03"
              kicker="The name"
              title="Five letters, and one set of initials."
              lede="DATAD is an acronym for the arc it was built to support, and it carries the initials of the student who built it. Both readings are intentional."
            >
              <AcronymLadder steps={ACRONYM} />

              <Reveal delay={120} className="mt-14 max-w-[62ch]">
                <p className="text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                  The letters <span style={{ color: IDENTITY.paper }}>T</span>,{' '}
                  <span style={{ color: IDENTITY.paper }}>A</span> and{' '}
                  <span style={{ color: IDENTITY.paper }}>D</span> sit at the
                  centre of DA<span style={{ color: IDENTITY.blueSoft }}>TAD</span>, and they are the initials of{' '}
                  <Link to="/creator" className="creator-focus underline-offset-4 hover:underline" style={{ color: IDENTITY.blueSoft }}>
                    {MAKER.legalName}
                  </Link>
                  , who built it as a student, for his own batch, while the
                  problems were still happening.
                </p>
                <p className="mt-5 text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                  Not a tool someone made for students. A tool a student made,
                  with them, for them.
                </p>
              </Reveal>
            </Chapter>

            {/* ── 04 Why not a chatbot ──────────────────────────────────── */}
            <Chapter
              id="difference"
              index="04"
              kicker="Why not a chatbot"
              title="The model is not the advantage. The memory is."
              lede="You can already ask a general assistant to explain a case, rewrite a bullet, or plan a week — and it will do all three well. What it cannot do is any of the six things below, and none of them are a matter of it being a smaller model. They are a matter of where the data lives."
            >
              <ContrastLedger rows={CONTRAST} />

              <Reveal delay={100} className="mt-12 max-w-[62ch]">
                <p className="text-[14px] leading-relaxed" style={{ color: '#68717F' }}>
                  Two rows above are marked as unfinished, and they are marked
                  because a page arguing that this product does not overstate
                  itself would be a strange place to start overstating. What is
                  built is built; what is half-built says so.
                </p>
              </Reveal>
            </Chapter>

            {/* ── 05 What it remembers ──────────────────────────────────── */}
            <Chapter
              id="memory"
              index="05"
              kicker="What it remembers"
              title="One reading a day, and the line it makes."
              lede="Once a day, DATAD writes down where you actually are: streak, consistency, overdue work, applications, resume completeness, stress signals, placement readiness. Not a summary of a conversation — a measurement, dated, kept."
            >
              <Reveal>
                <MemoryFigure />
              </Reveal>

              <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
                {[
                  {
                    head: 'It cannot be backfilled.',
                    body: 'A day that is not recorded is gone. There is no reconstructing last Tuesday from today, and nothing here invents one — which is why the record starts the day you join and not before.',
                  },
                  {
                    head: 'It checks its own forecasts.',
                    body: 'When Dax says your readiness should reach a number by a date, that claim is stored with the date. On the date it is compared against the reading, and marked hit, miss, or — when no reading exists — unresolvable.',
                  },
                  {
                    head: 'It shows the misses.',
                    body: 'Both sides of the record are visible to you, in one list, unranked. An assistant that says "I predicted five weeks and it took eight" is more useful than one that only remembers being right.',
                  },
                ].map((item, i) => (
                  <Reveal key={item.head} delay={i * 100}>
                    <h3 className="text-[15.5px] font-semibold tracking-[-0.01em]" style={{ color: IDENTITY.paper }}>
                      {item.head}
                    </h3>
                    <p className="mt-3 max-w-[38ch] text-[13.5px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                      {item.body}
                    </p>
                  </Reveal>
                ))}
              </div>

              {/* The three rules above are the ones most easily quietly dropped
                  in a refactor — they are all restraint, and restraint does not
                  announce itself when it breaks. Saying they are held by tests
                  belongs here and only here, stated once and without a number:
                  a page that quotes its own coverage figure is arguing for
                  itself rather than describing itself. */}
              <Reveal delay={140} className="mt-12">
                <p className="max-w-[62ch] text-[14px] leading-relaxed" style={{ color: '#68717F' }}>
                  Each of those three is enforced in code and held there by a
                  test that fails if it stops being true.
                </p>
              </Reveal>

              <Reveal delay={120} className="mt-16">
                <div
                  className="rounded-2xl border p-7 sm:p-9"
                  style={{ borderColor: IDENTITY.inkLine, background: CREATOR.plate }}
                >
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#68717F' }}>
                    And what it will not remember
                  </p>
                  <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                    Nothing about another student. Comparisons against your batch
                    are computed as aggregates over five people or more, and a
                    group smaller than that returns nothing at all — not a
                    smaller sample, not a wider bucket quietly substituted.
                    Nobody&rsquo;s individual record is ever readable through
                    yours, and that rule is enforced where the numbers are
                    written, not where they are displayed.
                  </p>
                </div>
              </Reveal>
            </Chapter>

            {/* ── 06 The system ─────────────────────────────────────────── */}
            <Chapter
              id="system"
              index="06"
              kicker="The system"
              title="Six surfaces that share one memory."
              lede="The reason Dax can see your week at all is that these are not six apps with a shared login. They are one system, and every one of them writes into the same record."
            >
              <ModuleStrip modules={MODULES} />
            </Chapter>

            {/* ── 07 Refusals ───────────────────────────────────────────── */}
            <Chapter
              id="refusals"
              index="07"
              kicker="Refusals"
              title="Three things this will not become."
              lede="A product that holds a student's notes, money and reflections has to be specific about what it will never do with them. Specific, and short enough to hold anyone to."
            >
              <RefusalList items={REFUSALS} />
            </Chapter>

            {/* ── 08 The record ─────────────────────────────────────────── */}
            <Chapter
              id="record"
              index="08"
              kicker="The record"
              title="Built one semester at a time."
              lede="Each phase answered something a batch was actually struggling with that term. Nothing here was planned two years out."
            >
              <BuildSpine entries={TIMELINE} />

              <Reveal delay={140} className="mt-20">
                <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
                  <div>
                    <h3
                      className="text-[28px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[34px]"
                      style={{ color: IDENTITY.paper }}
                    >
                      Bring your own semester.
                      <br />
                      <span style={{ color: IDENTITY.blueSoft }}>It starts recording on day one.</span>
                    </h3>
                    <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                      There is no history to import and nothing to migrate. The
                      only thing that cannot be recovered is the time before you
                      start, which is the honest argument for starting now rather
                      than a marketing one.
                    </p>

                    <div className="mt-9 flex flex-wrap items-center gap-5">
                      <Link
                        to="/register"
                        className="creator-focus inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-semibold"
                        style={{ background: IDENTITY.blue, color: '#050810' }}
                      >
                        Create an account
                      </Link>
                      <Link
                        to="/creator"
                        className="creator-focus text-[13.5px] font-medium underline-offset-4 hover:underline"
                        style={{ color: IDENTITY.blueSoft }}
                      >
                        Who built it
                      </Link>
                    </div>
                  </div>

                  <div className="lg:pt-2">
                    <p className="max-w-[44ch] text-[13.5px] leading-relaxed" style={{ color: '#68717F' }}>
                      DATAD is made by {MAKER.legalName} at {MAKER.studio},{' '}
                      {MAKER.place}. It is funded by the people who use it, which
                      is the shortest available explanation for every refusal on
                      this page.
                    </p>
                    <p className="mt-6 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: CREATOR.ember }}>
                      No ads · No trackers · Export is one click
                    </p>
                  </div>
                </div>
              </Reveal>
            </Chapter>
          </main>
        </div>
      </div>
    </Page>
  );
}
