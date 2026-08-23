import { IDENTITY } from '../creator/creatorTokens';
import Reveal from '../creator/Reveal';

// The comparison, set as a ledger instead of a feature matrix.
//
// This is the section a reader arrives for — "why this and not the assistant I
// already have open in another tab" — and the temptation is a tick-and-cross
// table with a competitor's name across the top. That form is doing rhetoric,
// not information: every row is engineered so one column wins, and a reader who
// has ever seen a pricing page knows it.
//
// So: no ticks, no crosses, no product names, and the left column is written
// straight. A general assistant genuinely cannot see a student's overdue task
// count — that is a fact about where the data lives, not a failing, and saying
// it plainly is what makes the right column believable. The two columns are
// weighted by type rather than by colour: the same size, the left in `muted`,
// the right in `paper`.
//
// `note` is where a claim gets qualified. Anything on this page that is partly
// built says so in that line, because a comparison that overstates by one row
// costs the reader's trust in all of them.
export default function ContrastLedger({ rows, className = '' }) {
  return (
    <div className={className}>
      {/* Column headings, stated once. Repeating them per row is what turns a
          ledger back into a scorecard. */}
      <div
        className="hidden grid-cols-2 gap-x-10 border-b pb-3 sm:grid"
        style={{ borderColor: IDENTITY.inkLine }}
        aria-hidden="true"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#68717F' }}>
          A general assistant
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: IDENTITY.blueSoft }}>
          Dax, inside DATAD
        </span>
      </div>

      <dl className="grid">
        {rows.map((row, i) => (
          <Reveal
            key={row.subject}
            delay={i * 80}
            className="grid gap-x-10 gap-y-3 border-b py-6 sm:grid-cols-2"
            style={{ borderColor: IDENTITY.inkLine }}
          >
            <div>
              <dt
                className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: '#68717F' }}
              >
                {row.subject}
              </dt>
              <dd className="mt-2 max-w-[44ch] text-[14px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                <span className="sr-only">A general assistant: </span>
                {row.generic}
              </dd>
            </div>

            <div className="sm:border-l sm:pl-10" style={{ borderColor: IDENTITY.inkLine }}>
              {/* Repeated on small screens only, where the two halves stack and
                  the column headings above are gone. Hidden from assistive tech
                  because the `sr-only` prefix below already says it — without
                  this, a screen reader on a phone announces the column twice. */}
              <p
                aria-hidden="true"
                className="text-[10.5px] font-semibold uppercase tracking-[0.16em] sm:hidden"
                style={{ color: IDENTITY.blueSoft }}
              >
                Dax, inside DATAD
              </p>
              <p
                className="mt-2 max-w-[44ch] text-[14.5px] leading-relaxed sm:mt-0"
                style={{ color: IDENTITY.paper }}
              >
                <span className="sr-only">Dax, inside DATAD: </span>
                {row.datad}
              </p>
              {row.note && (
                <p className="mt-3 text-[12px] leading-relaxed" style={{ color: '#68717F' }}>
                  {row.note}
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </dl>
    </div>
  );
}
