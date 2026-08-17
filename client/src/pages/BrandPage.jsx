import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Stagger } from '../components/common/motion';
import Logo, {
  DatadGlyph,
  DatadMark,
  MARK_PATH,
  MARK_PATH_SMALL,
} from '../components/common/Logo';

// The story of the DATAD mark ("Terrace"), for anyone curious about why the
// logo looks the way it does.
//
// Every specimen on this page renders from the real components in
// components/common/Logo.jsx rather than from screenshots or copied SVG. That
// is deliberate: if the mark is ever adjusted, this page follows it
// automatically and can never document a logo the product no longer uses.

const BRAND = [
  { hex: '#080B14', name: 'Near-black', role: 'The ground. Backgrounds, and the mark itself in print.' },
  { hex: '#4D7CFF', name: 'Intelligent blue', role: 'The mark, links, and anything the product wants you to act on.' },
  { hex: '#E8EAF0', name: 'Paper', role: 'Type and surfaces sitting on the near-black.' },
];

const MASTERS = [
  { file: 'datad-mark-blue.svg', use: 'Primary master. The default, on light or dark.' },
  { file: 'datad-mark-black.svg', use: 'Light backgrounds and print, where blue is unavailable.' },
  { file: 'datad-mark-white.svg', use: 'Dark backgrounds and photography.' },
  { file: 'datad-mark-currentcolor.svg', use: 'Inherits the surrounding text colour — the one to drop into code.' },
  { file: 'favicon.svg · favicon-32.png · favicon-16.png', use: 'Browser tabs. Uses the two-step cut.' },
  { file: 'datad-appicon-1024/512/180.png', use: 'Home screens and app stores.' },
];

function Section({ eyebrow, title, children }) {
  return (
    <section className="border-t border-gray-200 py-14 dark:border-gray-800">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-primary-600 dark:text-primary-400">
        {eyebrow}
      </p>
      <h2 className="mb-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="space-y-5 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">{children}</div>
    </section>
  );
}

function Panel({ label, className = '', children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <div className={`flex min-h-[190px] items-center justify-center p-8 ${className}`}>{children}</div>
      {label && (
        <div className="border-t border-gray-200 px-4 py-3 font-mono text-[11px] leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-500">
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * A given cut shown at 16px beside a magnified copy of the same drawing.
 *
 * This deliberately takes an explicit path rather than using DatadGlyph,
 * because DatadGlyph swaps to the two-step cut under 24px on its own — which
 * is exactly the behaviour being illustrated, and would otherwise make both
 * panels show the same thing.
 */
function Specimen({ path }) {
  return (
    <div className="flex items-end gap-6">
      {[16, 64].map((px) => (
        <svg key={px} viewBox="0 0 120 120" width={px} height={px} aria-hidden="true" className={px > 16 ? 'opacity-40' : ''}>
          <path fill="#4D7CFF" fillRule="evenodd" d={path} />
        </svg>
      ))}
    </div>
  );
}

/**
 * The mark drawn on its own construction grid — the same path the components
 * use, with the terrace's turning points called out. This is what makes the
 * "one path, 120 units" claim legible rather than something to take on faith.
 */
function ConstructionDiagram() {
  const ticks = [0, 20, 40, 60, 80, 100, 120];
  const corners = [
    [26, 86], [26, 74], [46, 74], [46, 62], [66, 62], [66, 50], [86, 50], [86, 86],
  ];
  return (
    <svg viewBox="-26 -16 160 152" className="w-full max-w-[380px]" role="img" aria-label="The mark on its 120-unit construction grid">
      <defs>
        <pattern id="brandgrid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0 H0 V10" fill="none" stroke="currentColor" strokeWidth="0.4" className="text-gray-300 dark:text-gray-700" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="120" height="120" fill="url(#brandgrid)" />
      <rect x="0" y="0" width="120" height="120" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-gray-400 dark:text-gray-600" />

      {/* The mark itself, faint, so the geometry reads on top of it. */}
      <path
        d="M60 12 A48 48 0 1 0 60 108 A48 48 0 1 0 60 12 Z M26 86 V74 H46 V62 H66 V50 H86 V86 Z"
        fillRule="evenodd"
        className="fill-primary-500/25 dark:fill-primary-400/25"
      />
      {/* The disc's true circle: centre 60,60 · radius 48. */}
      <circle cx="60" cy="60" r="48" fill="none" strokeDasharray="3 3" strokeWidth="0.7" stroke="currentColor" className="text-gray-500" />
      {/* The terrace outline. */}
      <path
        d="M26 86 V74 H46 V62 H66 V50 H86 V86 Z"
        fill="none"
        strokeWidth="1.2"
        stroke="currentColor"
        className="text-primary-600 dark:text-primary-400"
      />
      {corners.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" className="fill-primary-600 dark:fill-primary-400" />
      ))}
      {ticks.map((t) => (
        <text key={t} x={t} y="-4" textAnchor="middle" className="fill-gray-400 font-mono" style={{ fontSize: 6 }}>
          {t}
        </text>
      ))}
      <text x="-4" y="60" textAnchor="end" dominantBaseline="middle" className="fill-gray-400 font-mono" style={{ fontSize: 6 }}>
        r48
      </text>
    </svg>
  );
}

export default function BrandPage() {
  useDocumentTitle('The DATAD mark — brand');

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center" aria-label="DATAD — home">
            <DatadMark size="sm" />
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <Stagger className="py-16 text-center">
          <div className="mb-8 flex justify-center">
            <Logo size={96} variant="stacked" />
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            A disc with a staircase cut out of it.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-500 dark:text-gray-400">
            The DATAD mark is called <strong className="font-semibold text-gray-700 dark:text-gray-300">Terrace</strong>.
            It is one shape, drawn once, on a grid of 120 units — and everything else you see, from the
            favicon in your browser tab to the icon on your home screen, is that same shape at a
            different size.
          </p>
        </Stagger>

        <Section eyebrow="The idea" title="Steps, not a letterform">
          <p>
            Most product logos reach for their first letter. A <em>D</em> in a rounded square would have
            been the obvious move — and it is, in fact, exactly what DATAD used before this mark existed.
            The problem with a letter is that it says the name and nothing else. It is a label.
          </p>
          <p>
            Terrace says something about what the product is for. The steps climb from left to right in
            three even rises, and they are cut <em>out</em> of the disc rather than drawn on top of it —
            the shape you actually read is the space where material has been removed. That is the closest
            a logo gets to describing what a student operating system does: you arrive with a full,
            undifferentiated mass of things to do, and progress is what gets carved out of it, one step at
            a time.
          </p>
          <p>
            The ascent is the whole argument. Read left to right, the way you read everything else on this
            page, the mark only ever goes up.
          </p>
          <div className="grid gap-5 pt-3 sm:grid-cols-2">
            <Panel label="The mark, at rest" className="bg-[#080B14]">
              <DatadGlyph size={112} tone="brand" />
            </Panel>
            <Panel label="Cut, not drawn — the steps are negative space" className="bg-white dark:bg-gray-900">
              <DatadGlyph size={112} className="text-gray-900 dark:text-gray-100" />
            </Panel>
          </div>
        </Section>

        <Section eyebrow="Construction" title="One path, 120 units">
          <p>
            The mark is a single path with an even-odd fill rule. The outer disc is centred at 60,60 with a
            radius of 48; the terrace is a second contour inside it, and because the fill rule is even-odd,
            that inner contour becomes a hole rather than a shape. There is no second colour, no mask, and
            no overlay — which is why the mark works as a one-colour print, an embroidery file, or a
            silhouette on a photograph without being redrawn.
          </p>
          <p>
            Each step is 20 units wide and 12 tall, and the terrace sits on a baseline 34 units up from the
            bottom of the grid. Those numbers are the reason the vector and raster masters are identical
            rather than merely similar: every exported file is generated from this path, not traced from a
            picture of it.
          </p>
          <div className="flex justify-center pt-3">
            <ConstructionDiagram />
          </div>
        </Section>

        <Section eyebrow="Lockups" title="The mark with its name">
          <p>
            The wordmark is set in Syne ExtraBold. Both lockups derive their spacing from the mark&rsquo;s size
            rather than from fixed pixel values, so they hold together at any scale.
          </p>
          <div className="grid gap-5 pt-3 sm:grid-cols-2">
            <Panel label="Horizontal — gap is one third of the mark's width, tracking +20" className="bg-[#080B14] text-white">
              <DatadMark size={64} />
            </Panel>
            <Panel label="Stacked — gap is one quarter of the mark's height, tracking +60" className="bg-[#080B14] text-white">
              <Logo size={64} variant="stacked" />
            </Panel>
          </div>
          <p>
            In the horizontal lockup the mark&rsquo;s height equals the wordmark&rsquo;s cap height plus 55%, so the
            disc reads as slightly larger than the letters — matching cap height exactly would make it look
            undersized, because a circle&rsquo;s optical weight sits below its measured edge. In the stacked
            lockup the tracking opens up until the word&rsquo;s width approaches the disc&rsquo;s diameter, which is
            what makes the two feel like one object instead of a mark with a caption.
          </p>
        </Section>

        <Section eyebrow="Small sizes" title="The two-step cut">
          <p>
            Below roughly 24px the three-step cut stops working. The rises are 12 units on a 120-unit grid
            — a tenth of the mark — and at favicon sizes that is well under a pixel of separation, so the
            steps fill in and the mark turns into a disc with a smudge in it.
          </p>
          <p>
            So the mark has a second, simpler drawing for small sizes: two steps instead of three, each one
            wider and taller. It is not a different logo, it is the same idea drawn with fewer teeth, and
            it is what the favicon and the app icon actually use. The components switch to it automatically
            under 24px, so nothing has to remember to do it by hand.
          </p>
          <div className="grid gap-5 pt-3 sm:grid-cols-2">
            <Panel label="Three-step cut at 16px — the steps close up" className="bg-[#080B14]">
              <Specimen path={MARK_PATH} />
            </Panel>
            <Panel label="Two-step cut at 16px — the terrace survives" className="bg-[#080B14]">
              <Specimen path={MARK_PATH_SMALL} />
            </Panel>
          </div>
        </Section>

        <Section eyebrow="Clear space & minimum size" title="Room to breathe">
          <p>
            Clear space on all four sides equals one sixth of the mark — 20 units on the construction grid.
            Nothing else sits inside that margin. The minimum size is 16px on screen and 8mm in print, and
            below 24px the two-step cut takes over.
          </p>
          <div className="flex justify-center pt-3">
            <div className="rounded-xl border border-dashed border-primary-400/50 p-[18px]">
              <DatadGlyph size={108} tone="brand" />
            </div>
          </div>
        </Section>

        <Section eyebrow="Colour" title="Three values, and no gradient">
          <p>
            The previous DATAD wordmark was a gradient. This one is not, and that is a practical decision
            rather than a stylistic one: a gradient has no single value to fall back to, so it cannot be
            embroidered, etched, faxed, or printed in one ink without someone inventing a substitute.
          </p>
          <div className="grid gap-4 pt-3 sm:grid-cols-3">
            {BRAND.map((c) => (
              <div key={c.hex} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-3 h-14 w-full rounded-lg border border-gray-200/60 dark:border-gray-700/60" style={{ background: c.hex }} />
                <p className="font-mono text-xs text-gray-900 dark:text-gray-100">{c.hex}</p>
                <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{c.name}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-500">{c.role}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="The files" title="Which master to reach for">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400">File</th>
                  <th className="py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400">Use it for</th>
                </tr>
              </thead>
              <tbody>
                {MASTERS.map((m) => (
                  <tr key={m.file} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="py-3 pr-4 align-top font-mono text-[12px] text-gray-700 dark:text-gray-300">{m.file}</td>
                    <td className="py-3 align-top text-gray-500 dark:text-gray-400">{m.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-2">
            One caveat worth knowing: in the lockups the letters are live Syne text, not outlines. Before
            the logo goes to a printer or a third party, the type has to be converted to paths in a vector
            editor, or a machine without Syne installed will quietly substitute a fallback font and hand
            back something that is not the logo.
          </p>
        </Section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400 dark:border-gray-800">
        DATAD · Built by Dhatchina Moorthi
      </footer>
    </div>
  );
}
