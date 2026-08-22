import { useCallback, useMemo } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import {
  Banknote, Brain, BookOpen, Briefcase, CalendarRange, Users,
} from 'lucide-react';
import { Page } from '../components/common/motion';
import {
  AmbientLight,
  BuildSpine,
  Colophon,
  ConvergenceFigure,
  MakerPortrait,
  MakerRail,
  MakerBar,
  ModuleStrip,
  RefusalList,
  Reveal,
  SpecPlate,
  TerraceField,
  TerraceStanzas,
  CREATOR,
  CREATOR_VARS,
  IDENTITY,
  useChapterSpy,
} from '../components/creator';
import { MAKER } from '../utils/maker';

// ── /creator ───────────────────────────────────────────────────────────────
//
// The maker's page, rebuilt as a long-form document.
//
// ── Where it sits relative to /register ────────────────────────────────────
//
// The signup screen runs a permanently dark brand canvas down its left half
// and a theme-aware form beside it. That canvas is a window: you look through
// it while you type. This page is what is on the other side of the window —
// the same near-black `IDENTITY.ink`, the same brand blue and violet, the same
// orbital rings turning behind the artwork, the same 26px numbered markers on
// its rail, the same CSS-first entrance discipline. A reader who signed up
// yesterday should feel they have walked into a room they had only seen from
// the outside.
//
// Committed dark in both themes for the reason HeroVisual gives: it is a brand
// canvas, drawn for near-black, and hairline artwork goes flat and grey on a
// white surface. The rest of the product stays theme-aware; two surfaces out of
// thirty are painted.
//
// ── What is different, and why ─────────────────────────────────────────────
//
// Register is a machine for collecting seven screens of answers, so it is cool,
// symmetrical and evenly paced. This is one person's account of three years, so
// it is asymmetric, it has exactly one warm accent (`CREATOR.ember`, rationed
// to the years and the strike), and its structure is editorial rather than
// modular: a fixed identity rail, a hero built out of the logo's own geometry,
// a scroll-linked spine, a staircase, a strip that can only be open in one
// place at a time, and a colophon instead of a conversion slab.
//
// Deliberately absent, because none of it exists anywhere else in DATAD:
// gradient-filled headlines, `font-black`, scale-on-hover cards, coloured blur
// blobs, pill eyebrows in six different hues, and the 3-up value grid. That was
// the previous page's entire vocabulary.
//
// ── Data ───────────────────────────────────────────────────────────────────
//
// Every figure and date below is carried over unchanged from the page this
// replaces. Nothing here is fetched, so there are no loading or error states to
// design — the only failure this page can actually have is "an animation did
// not run", and every component renders its content regardless. That is what
// the CSS-first rule in index.css buys.

const CHAPTERS = [
  { id: 'maker', number: '01', label: 'The maker' },
  { id: 'origin', number: '02', label: 'Origin' },
  { id: 'method', number: '03', label: 'Method' },
  { id: 'record', number: '04', label: 'The record' },
  { id: 'system', number: '05', label: 'The system' },
  { id: 'refusals', number: '06', label: 'Refusals' },
  { id: 'contact', number: '07', label: 'Contact' },
];

const SPEC = [
  { label: 'Built by', value: MAKER.legalName },
  { label: 'Works as', value: `${MAKER.handle} · ${MAKER.studio}` },
  { label: 'Role', value: MAKER.role },
  { label: 'Based in', value: MAKER.place },
  { label: 'Building since', value: '2022' },
  { label: 'Team size', value: 'One', accent: true },
];

const FIGURES = [
  { value: '50K+', label: 'Lines of code' },
  { value: '25+', label: 'Features shipped' },
  { value: '500+', label: 'Students using it' },
  { value: '3', label: 'Years, solo' },
];

const STANZAS = [
  {
    kicker: 'Psychology first',
    title: 'Designed around attention, not for it.',
    body: 'No infinite scroll. No streak that punishes a bad week. No red badge invented to pull someone back at 11pm. The product is built on what sustains work across a semester, which is usually the opposite of what keeps a session going.',
  },
  {
    kicker: 'Built end to end',
    title: 'One person holding the whole stack.',
    body: 'React on the front, Express and MongoDB behind it, and the pipeline that makes Dax useful rather than merely conversational. Every feature is specified, designed, built and shipped by the same hands — which is slower, and is why nothing here is bolted on.',
  },
  {
    kicker: 'Answerable to students',
    title: 'Built inside the semester it was built for.',
    body: 'Made by a student, in a batch, while the problems were still happening. Every decision has to survive one question, asked out loud: does this actually help the person using it, or does it only look like it does?',
  },
];

const TIMELINE = [
  {
    year: '2022',
    title: 'The problem, written down',
    body: 'Placement season, one batch, five apps that had never heard of each other. I started keeping a list of everything a single system would have to know to make that week survivable.',
  },
  {
    year: '2023',
    title: 'First code',
    body: 'No team, no template, no borrowed framework opinions. A laptop, an empty repository, and the belief that student software could be better than what we were all putting up with.',
  },
  {
    year: '2024',
    title: 'First users',
    body: 'Notes and Planner shipped. Classmates started using them without being asked, which is the only product signal that has ever been worth trusting.',
  },
  {
    year: '2025',
    title: 'The whole system',
    body: 'Finance, Resume, Career Hub, Community and Dax. Six surfaces stopped being separate tools sharing a login and started being one operating system with one memory.',
  },
  {
    year: 'Now',
    title: 'Still building',
    body: 'Unfinished on purpose. The list of things a student needs did not stop in 2025, and neither did the one I started keeping in 2022.',
    open: true,
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
    term: 'Dark patterns.',
    body: 'Nothing here is designed to be hard to leave, hard to cancel, or easier to accept than to read. The upgrade prompt is contextual, and it takes no for an answer.',
    note: 'Leaving is one screen',
  },
];

// Section frame. Kept local because it is a rhythm, not a component: a number,
// a word, a rule, a statement, a lede. Seven of them in a row is what makes a
// long page read as one document rather than seven landing pages stacked up.
function Chapter({ id, index, kicker, title, lede, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t px-6 py-20 sm:px-10 lg:px-14 lg:py-28 xl:px-20"
      style={{ borderColor: IDENTITY.inkLine }}
      aria-labelledby={`${id}-title`}
    >
      <Reveal className="mx-auto w-full max-w-[62rem]">
        {/* A numeral and a rule, never a coloured pill. Seven pills in seven
            hues is most of what made the old page read as a template. */}
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

export default function CreatorPage() {
  const reduce = useReducedMotion();
  const chapterIds = useMemo(() => CHAPTERS.map((c) => c.id), []);
  const active = useChapterSpy(chapterIds);

  // Reading progress, spring-smoothed. This is the whole of the rail's job on
  // phones, where the rail itself is gone: one hairline that costs a pixel of
  // height and answers "how much of this is left" without a word.
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  const jump = useCallback(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      // Move focus as well as the viewport. A keyboard user who activates a
      // rail item and then presses Tab should land inside the chapter they
      // chose, not back on the next rail item.
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

        <MakerBar />

        <div className="relative z-10 flex">
          <MakerRail chapters={CHAPTERS} active={active} onJump={jump} />

          <main className="min-w-0 flex-1">
            {/* ── 01 Hero ───────────────────────────────────────────────── */}
            <section
              id="maker"
              className="relative flex min-h-[86vh] scroll-mt-24 items-center overflow-hidden px-6 py-20 sm:px-10 lg:min-h-screen lg:px-14 lg:py-24 xl:px-20"
              aria-labelledby="maker-title"
            >
              {/* The terrace runs the full width of the hero and the type sits
                  on top of it, the way a title sits on a technical drawing.
                  Two earlier arrangements were worse: full-bleed *behind* a
                  heavy directional scrim erased the artwork the scrim was
                  supposedly protecting, and a right-hand column only works
                  above ~1440px once the rail has taken its 324.

                  It survives the overlap because every stroke in the field is a
                  hairline at 0.1–0.3 alpha over near-black. Measured against
                  the headline it moves the contrast ratio by less than a tenth
                  of a point; what it costs is nothing and what it buys is a
                  hero that is one composition instead of two halves. */}
              {/* Dimmed below lg. On a phone the drawing sits directly behind
                  the body paragraph rather than beside it, and hairlines that
                  are a texture at 1280px are a distraction at 375. */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.55] lg:opacity-100"
                aria-hidden="true"
              >
                <TerraceField />
                {/* Vignette, not a scrim. It seats the drawing in the frame and
                    floors the contrast at the edges where the eyebrow and the
                    spec plate sit, without touching the middle. */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 62% 45%, rgba(8,11,20,0) 0%, rgba(8,11,20,0.35) 58%, rgba(8,11,20,0.88) 100%)',
                  }}
                />
              </div>

              <div className="relative z-10 w-full max-w-[48rem]">
                <p
                  className="identity-rise text-[11px] font-semibold uppercase tracking-[0.22em]"
                  style={{ '--rise-delay': '0.05s', color: IDENTITY.blueSoft }}
                >
                  The maker · {MAKER.studio}
                </p>

                {/* Three lines, two paper and one blue — the same shape as the
                    register headline, so both pages open in the same voice
                    before they diverge. */}
                <h1
                  id="maker-title"
                  className="mt-6 text-[clamp(2.3rem,6.6vw,4.4rem)] font-semibold leading-[1.05] tracking-[-0.035em]"
                >
                  <span className="identity-rise block" style={{ '--rise-delay': '0.12s', color: IDENTITY.paper }}>
                    One student.
                  </span>
                  <span className="identity-rise block" style={{ '--rise-delay': '0.24s', color: IDENTITY.paper }}>
                    Three years.
                  </span>
                  <span className="identity-rise block" style={{ '--rise-delay': '0.36s', color: IDENTITY.blueSoft }}>
                    One operating system.
                  </span>
                </h1>

                <p
                  className="identity-rise mt-7 max-w-[52ch] text-[16px] leading-relaxed sm:text-[17px]"
                  style={{ '--rise-delay': '0.5s', color: IDENTITY.muted }}
                >
                  DATAD is one system for how a student studies, plans, spends,
                  applies and recovers. It was designed, engineered and shipped end
                  to end by <span style={{ color: IDENTITY.paper }}>{MAKER.shortName}</span>,
                  who builds as <span style={{ color: IDENTITY.blueSoft }}>{MAKER.handle}</span>.
                </p>

                {/* The identity block: a datasheet with a photograph on it.
                    The photograph is on the right, not the left, because the
                    hero's whole spine is one left edge — eyebrow, headline,
                    paragraph and spec rows all start at the same x, and a photo
                    in front of the rows would push the only tabular thing on
                    the screen off that line to buy nothing.

                    It stacks above the rows on phones rather than below them: a
                    face under six rows of small caps is buried, and it is worth
                    more as the beat between the paragraph and the record. */}
                <div
                  className="identity-rise mt-12 flex max-w-[46rem] flex-col gap-8 sm:flex-row sm:items-start sm:gap-9"
                  style={{ '--rise-delay': '0.62s' }}
                >
                  <MakerPortrait
                    variant="hero"
                    className="order-first w-[122px] shrink-0 sm:order-last sm:w-[152px] xl:w-[176px]"
                  />
                  <SpecPlate rows={SPEC} className="min-w-0 flex-1" />
                </div>
              </div>
            </section>

            {/* ── Figures ───────────────────────────────────────────────── */}
            <Reveal
              className="border-t px-6 py-10 sm:px-10 lg:px-14 xl:px-20"
              style={{ borderColor: IDENTITY.inkLine }}
            >
              <dl className="mx-auto grid w-full max-w-[62rem] grid-cols-2 gap-y-8 sm:grid-cols-4">
                {FIGURES.map((figure, i) => (
                  <div
                    key={figure.label}
                    className={i ? 'sm:border-l sm:pl-8' : ''}
                    style={i ? { borderColor: IDENTITY.inkLine } : undefined}
                  >
                    {/* Static, no count-up. The product settled that argument
                        once already — see AnimatedNumber in
                        components/common/motion.jsx: per-frame number repaints
                        fight the CSS transforms running beside them and leave
                        paint artifacts behind. */}
                    <dt
                      className="text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em] sm:text-[34px]"
                      style={{ color: IDENTITY.paper }}
                    >
                      {figure.value}
                    </dt>
                    <dd
                      className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: '#68717F' }}
                    >
                      {figure.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            {/* ── 02 Origin ─────────────────────────────────────────────── */}
            <Chapter
              id="origin"
              index="02"
              kicker="Origin"
              title="Nobody was going to build it, so I did."
              lede="I was a psychology student at KCLAS, watching my batch run placement season out of five apps at once. Every one of them was competent at its own job and blind to all the others."
            >
              {/* Portrait, story, diagram — in that order, and in that shape.
                  This is the chapter where the page changes person: everything
                  before it is written about the product, everything from here
                  is "I". A face belongs at exactly that turn, which is why it
                  is here rather than in the hero, where it would have made the
                  opening an introduction instead of an argument.

                  The portrait column spans both rows and sticks, so it stays
                  beside the reader through the story and the diagram both. */}
              <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)]">
                <Reveal className="lg:sticky lg:top-16 lg:row-span-2 lg:self-start">
                  {/* Capped on phones. A full-width 4:5 plate at 375px is 400px
                      tall and pushes the first sentence of the story off the
                      screen — the portrait is an introduction to the voice, not
                      a cover image. */}
                  <MakerPortrait className="max-w-[15rem] lg:max-w-none" />
                </Reveal>

                <Reveal delay={80} className="space-y-5 text-[15px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                  <p>
                    The spreadsheet did not know about the deadline. The group chat
                    did not know about the fee. The sticky note on the monitor was
                    the only thing that knew about both, and it fell off.
                  </p>
                  <p>
                    Student life is not one-dimensional, and the hard part is never
                    any single task — it is the week where four of them land together
                    and nothing on your screen understands that they are related.
                  </p>
                  <p style={{ color: IDENTITY.paper }}>
                    Three years, fifty thousand lines and one person later, DATAD
                    exists. Not as a startup. Not as a side project. As the tool the
                    batch actually needed, built while we still needed it.
                  </p>
                </Reveal>

                <Reveal delay={140}>
                  <ConvergenceFigure />
                </Reveal>
              </div>
            </Chapter>

            {/* ── 03 Method ─────────────────────────────────────────────── */}
            <Chapter
              id="method"
              index="03"
              kicker="Method"
              title="Three commitments. Everything else follows."
              lede="The mark on this product is a disc with a three-step terrace cut out of it. These are the three steps."
            >
              <TerraceStanzas items={STANZAS} />
            </Chapter>

            {/* ── 04 The record ─────────────────────────────────────────── */}
            <Chapter
              id="record"
              index="04"
              kicker="The record"
              title="From a list on a laptop to five hundred students."
              lede="Four years on the record, and one that has not closed."
            >
              <BuildSpine entries={TIMELINE} />
            </Chapter>

            {/* ── 05 The system ─────────────────────────────────────────── */}
            <Chapter
              id="system"
              index="05"
              kicker="The system"
              title="Six surfaces. One account. One memory."
              lede="Everything here was built from scratch, in this order, because each surface needed the one before it to be worth anything."
            >
              <ModuleStrip modules={MODULES} />
            </Chapter>

            {/* ── 06 Refusals ───────────────────────────────────────────── */}
            <Chapter
              id="refusals"
              index="06"
              kicker="Refusals"
              title="Three things this will never do."
              lede="Not values. Constraints — the kind that cost something, written down where they can be held against the product later."
            >
              <RefusalList items={REFUSALS} />
            </Chapter>

            {/* ── 07 Contact ────────────────────────────────────────────── */}
            <section
              id="contact"
              className="scroll-mt-24 border-t px-6 py-20 sm:px-10 lg:px-14 lg:py-28 xl:px-20"
              style={{ borderColor: IDENTITY.inkLine }}
              aria-labelledby="contact-title"
            >
              <Reveal className="mx-auto w-full max-w-[62rem]">
                <div className="flex items-baseline gap-4">
                  <span
                    className="text-[11px] font-semibold tabular-nums tracking-[0.2em]"
                    style={{ color: IDENTITY.blue }}
                  >
                    07
                  </span>
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: '#68717F' }}
                  >
                    Contact
                  </span>
                  <span className="h-px flex-1" style={{ background: IDENTITY.inkLine }} aria-hidden="true" />
                </div>
                {/* The colophon carries its own headline; this one exists so the
                    section has an accessible name that matches the rail. */}
                <h2 id="contact-title" className="sr-only">
                  Contact and colophon
                </h2>
                <div className="mt-12">
                  <Colophon />
                </div>
              </Reveal>
            </section>

            <footer
              className="border-t px-6 py-8 sm:px-10 lg:px-14 xl:px-20"
              style={{ borderColor: IDENTITY.inkLine }}
            >
              <p className="mx-auto w-full max-w-[62rem] text-[11px] leading-relaxed" style={{ color: '#4E5766' }}>
                <span style={{ color: CREATOR.ember }}>{MAKER.studio}</span> · Independent ·
                Community-backed · Written and built in {MAKER.place}
              </p>
            </footer>
          </main>
        </div>
      </div>
    </Page>
  );
}
