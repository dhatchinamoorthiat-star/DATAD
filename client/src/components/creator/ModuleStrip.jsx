import { useState } from 'react';
import { IDENTITY, CREATOR } from './creatorTokens';

// The six surfaces, as slats that open — not as a card grid.
//
// A 3×2 grid of feature cards says "here are six products". That is the exact
// opposite of what this page is claiming, which is that there is one system and
// these are its parts. So the six live in a single strip that is always the
// same total width: opening one closes another, the way a system has a fixed
// amount of attention to spend. You cannot look at all six at once, and the
// component will not let you pretend otherwise.
//
// Interaction is deliberately cheap to discover — hover, focus or tap, all
// three do the same thing, and one slat is always open so there is no empty
// state to design around. Focus works because each slat is a real <button>,
// which also means the whole strip is walkable with Tab and needs no arrow-key
// choreography that a reader would have to be told about.
//
// The collapsed slats set their titles vertically (`writing-mode`), which is
// what makes the strip read as a spine of tabs at a glance instead of six grey
// columns. Below 1024px the whole thing becomes hairline rows that expand
// downward — a vertical title in a 44px-tall row is unreadable, and the
// horizontal room a phone lacks is exactly what the strip trades in.
export default function ModuleStrip({ modules, className = '' }) {
  const [active, setActive] = useState(0);

  return (
    <div className={className}>
      <div className="creator-slats">
        {modules.map((module, i) => {
          const Icon = module.icon;
          const isActive = i === active;
          return (
            <button
              key={module.title}
              type="button"
              data-active={isActive ? 'true' : 'false'}
              aria-expanded={isActive}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              style={{
                '--grow': isActive ? 3.6 : 1,
                background: CREATOR.plate,
                borderColor: isActive ? 'rgba(77, 124, 255, 0.42)' : IDENTITY.inkLine,
              }}
              className="creator-slat creator-focus group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-300 sm:p-5"
            >
              {/* Lit only while open. A tint on every slat would turn the strip
                  into six coloured boxes, which is the grid this replaces. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
                style={{
                  opacity: isActive ? 1 : 0,
                  background: 'linear-gradient(165deg, rgba(77,124,255,0.13), rgba(124,108,255,0.03) 60%, transparent)',
                }}
              />

              <span className="relative flex items-center gap-3">
                <Icon
                  className="h-[18px] w-[18px] shrink-0 transition-colors duration-300"
                  style={{ color: isActive ? IDENTITY.blueSoft : IDENTITY.muted }}
                  aria-hidden="true"
                />
                <span
                  className="text-[10.5px] font-semibold tabular-nums tracking-[0.18em]"
                  style={{ color: isActive ? IDENTITY.blue : '#5C6474' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </span>

              {/* Collapsed title, running up the slat. Desktop only. */}
              <span
                className="creator-slat-rail relative mt-5 text-[13px] font-semibold tracking-[0.02em]"
                style={{ color: IDENTITY.muted }}
                aria-hidden="true"
              >
                {module.title}
              </span>

              <span className="creator-slat-open relative mt-4 block lg:mt-auto">
                <span
                  className="block text-[16px] font-semibold leading-tight tracking-[-0.01em] sm:text-[17px]"
                  style={{ color: IDENTITY.paper }}
                >
                  {module.title}
                </span>
                <span className="creator-slat-body block">
                  <span className="block">
                    <span
                      className="mt-2 block max-w-[30ch] text-[13px] leading-relaxed"
                      style={{ color: IDENTITY.muted }}
                    >
                      {module.body}
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11.5px]" style={{ color: '#5C6474' }}>
        <span className="hidden lg:inline">Hover or tab through the strip.</span>
        <span className="lg:hidden">Tap a row to open it.</span>{' '}
        Six surfaces, one account, one set of data behind them —{' '}
        <span style={{ color: CREATOR.ember }}>built in that order, on purpose.</span>
      </p>
    </div>
  );
}
