import { Check } from 'lucide-react';
import { IDENTITY } from './identityTokens';

// "Here is what is on the other side of this form."
//
// Signup forms ask before they give. This card is the counterweight — it names
// the four things the account actually unlocks, so the cost of filling in the
// fields has something concrete sitting next to it.
//
// The items are the real post-signup surfaces (readiness score, skill map, Dax
// recommendations, placement intelligence), not aspirational copy, so the card
// is a promise the product keeps on first login.
//
// Entrance is the CSS `identity-rise`/`identity-slide` pair, not Framer — see
// the note in index.css. This card must be readable even if no JS animation
// frame ever runs.
const UNLOCKS = [
  'Career Readiness Score',
  'Personal Skill Map',
  'AI Growth Recommendations',
  'Placement Intelligence',
];

export default function AIPreviewCard({ compact = false, className = '', baseDelay = 0.5 }) {
  return (
    <div
      className={`identity-rise rounded-2xl border p-4 ${className}`}
      style={{
        '--rise-delay': `${baseDelay}s`,
        borderColor: IDENTITY.inkLine,
        // Barely-there glass. The blur is 8px, not 24px: heavy frosting over an
        // animated field turns the nodes into coloured mush and costs a
        // full-size backdrop repaint on every frame of the background.
        background: 'linear-gradient(160deg, rgba(77,124,255,0.10), rgba(124,108,255,0.04))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: IDENTITY.blueSoft }}
      >
        After joining DATAD you unlock
      </p>

      <ul className={`mt-3 ${compact ? 'grid grid-cols-2 gap-x-3 gap-y-2' : 'space-y-2'}`}>
        {UNLOCKS.map((item, i) => (
          <li
            key={item}
            className="identity-slide flex items-center gap-2"
            style={{ '--rise-delay': `${baseDelay + 0.12 + i * 0.08}s` }}
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(77,124,255,0.18)' }}
            >
              <Check className="h-2.5 w-2.5" style={{ color: IDENTITY.blueSoft }} aria-hidden="true" />
            </span>
            <span
              className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-medium leading-tight`}
              style={{ color: IDENTITY.paper }}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
