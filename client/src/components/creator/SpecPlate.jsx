import { IDENTITY, CREATOR } from './creatorTokens';

// The hero's closing statement, set as a spec sheet.
//
// The version of this page that existed before opened with a 128px avatar in a
// blue-purple-pink gradient with a blurred glow behind it. That is the visual
// grammar of a personal brand, and it makes a claim ("look at me") the rest of
// the page then has to earn back. A plate makes the opposite move: it states
// six facts in the typographic register of a datasheet and lets the reader
// decide what they add up to. Confidence is the absence of decoration.
//
// Every row is real and sourced from utils/maker.js or from the page's own
// copy — there is nothing here that would need rewriting if the reader checked.
export default function SpecPlate({ rows, className = '', style }) {
  return (
    <dl
      className={`grid gap-x-10 border-t sm:grid-cols-2 ${className}`}
      style={{ borderColor: IDENTITY.inkLine, ...style }}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 border-b py-3"
          style={{ borderColor: IDENTITY.inkLine }}
        >
          <dt
            className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: '#68717F' }}
          >
            {row.label}
          </dt>
          <dd
            className="min-w-0 text-right text-[13px] font-medium tabular-nums"
            style={{ color: row.accent ? CREATOR.ember : IDENTITY.paper }}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
