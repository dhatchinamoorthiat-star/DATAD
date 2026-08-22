// Who made DATAD — one source of truth, three registers.
//
// The problem this solves: the maker's identity was written out by hand in six
// places (the About page, the Creator page, the legal footer, two Dax prompts,
// the maintenance replies) and every copy said something slightly different.
// One called him "widely recognized as Digital Don", another just "Dhatchina
// Moorthi", another "Founder & Systems Architect". A person's own name is the
// last thing that should drift.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// "Digital Don" is a handle, not a title. Handles are professional the same
// way a stage name or a GitHub handle is — as an alias attached to a real
// person, in a context where handles belong. They stop being professional the
// moment they're used AS a role ("the Don"), or claimed as status ("widely
// recognized as"). Nobody confers a nickname on themselves in a footer.
//
// So the handle is never load-bearing on its own. It appears where a handle
// belongs — the creator page, social links, and Dax's answer when a student
// asks directly — always alongside the real name, never as the job title.
//
// Everywhere formal, the studio mark carries it instead. D² Labs is the quiet
// bridge: it reads as a studio to a recruiter, a university, or an investor,
// and it is the maker's own initials twice over. The swagger is still in
// there. It just doesn't announce itself in the footer.
//
// See MAKER_IDENTITY.md for which register goes where.

export const MAKER = {
  // Formal register. Legal documents, footers, anything institution-facing.
  legalName: 'T. A. Dhatchina Moorthi',
  shortName: 'Dhatchina Moorthi',
  role: 'Founder & Systems Architect',

  // Studio register. Product chrome and maker marks — carries the handle
  // without spending it.
  studio: 'D² Labs',
  studioLine: 'Technology × Psychology × Impact',

  // Community register. The handle, used where handles belong.
  handle: 'Digital Don',

  place: 'Tamil Nadu, India',
};

// Formal credit: "T. A. Dhatchina Moorthi · Founder & Systems Architect".
export const makerCredit = () => `${MAKER.legalName} · ${MAKER.role}`;

// Studio credit for product chrome: "Built by D² Labs".
export const makerStudioCredit = () => `Built by ${MAKER.studio}`;

// The handle, correctly framed — never bare, never as a role. Use this rather
// than writing the handle inline, so the framing can't drift.
export const makerHandle = () => `${MAKER.shortName}, who builds as ${MAKER.handle}`;

// What Dax says when a student asks who made it. First person, factual, no
// self-conferred status, no reverence — Dax works with the student, not for a
// boss. See DAX_NAMING.md for the voice rules this has to satisfy.
export const MAKER_ORIGIN_ANSWER = [
  `I was built by **${MAKER.legalName}**, who builds as **${MAKER.handle}** — an engineer from ${MAKER.place}.`,
  '',
  `He built DATAD as a student, for his own batch, because the tools that existed treated studying, career prep, and money as three unrelated problems. I'm the part that ties them together.`,
  '',
  `The brief he gave me was narrow on purpose: understand context, adapt to the person in front of me, and be genuinely useful rather than merely impressive.`,
].join('\n');
