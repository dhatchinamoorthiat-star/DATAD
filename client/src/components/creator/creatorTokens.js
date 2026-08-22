// Palette for the creator ("maker") page.
//
// The creator page is the register hero's dark canvas, entered. On /register
// that near-black panel is a window you look through while you type; here you
// are standing inside it, so the canvas tokens are the same literals rather
// than a second dark palette that drifts a shade off. Anything reused comes
// straight from identityTokens — imported, not copied, so a brand tweak lands
// on both surfaces at once.
//
// Two values exist only here:
//
//   ember  The one warm accent in the DATAD system. Register is cool the whole
//          way through, because a signup form is a machine. This page is about
//          a person who made something by hand over three years, and a single
//          low-chroma brass tone is what separates "instrument panel" from
//          "hand-built instrument". It is rationed hard — years on the spine,
//          the strike through the refusals, and nothing else.
//          Contrast on `ink`, computed: 10.8:1. Clears AAA for normal text.
//
//   plate  A hair above `ink`. Plates on this page are machined surfaces, and
//          `inkRaised` is a big enough step to read as a card — which is the
//          exact SaaS look this page is getting away from.
import { IDENTITY } from '../register/identityTokens';

export { IDENTITY };

export const CREATOR = {
  ember: '#E8B87A',
  emberFaint: 'rgba(232, 184, 122, 0.16)',
  plate: '#0B101B',
  live: '#5BB974', // success-400 — the only status colour on the page
};

// Same values as CSS custom properties, spread onto the page root.
//
// The page needs both forms: JSX reads the JS object, and the handful of
// effects that can only be written in CSS (the ::after strike on the refusal
// list, the slat grid transition) read the variables. One source, two shapes.
export const CREATOR_VARS = {
  '--c-ink': IDENTITY.ink,
  '--c-plate': CREATOR.plate,
  '--c-hair': IDENTITY.inkLine,
  '--c-blue': IDENTITY.blue,
  '--c-blue-soft': IDENTITY.blueSoft,
  '--c-violet': IDENTITY.violet,
  '--c-paper': IDENTITY.paper,
  '--c-muted': IDENTITY.muted,
  '--c-ember': CREATOR.ember,
};
