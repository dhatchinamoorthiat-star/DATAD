// Mirrors server/config/legal.js. The server re-validates every version sent
// here and rejects anything it does not recognise, so a stale bundle fails
// loudly at signup rather than recording a consent to superseded terms.
export const LEGAL_VERSIONS = {
  terms: '2026-07-01',
  privacy: '2026-07-01',
};

export const LEGAL_UPDATED_LABEL = 'July 2026';

// The clauses the signup screen asks about, in order. All three are required:
// an unticked box here means no account, which is the whole point.
export const CONSENT_CLAUSES = [
  {
    id: 'terms',
    label: 'I have read and agree to the Terms of Use.',
    detail: 'Acceptable use, ownership of what you post, and the no-warranty terms.',
    href: '/terms',
    linkLabel: 'Read the Terms of Use',
  },
  {
    id: 'privacy',
    label: 'I have read and agree to the Privacy Policy.',
    detail: 'What DATAD stores about you, where it lives, and how to delete it.',
    href: '/privacy',
    linkLabel: 'Read the Privacy Policy',
  },
  {
    id: 'econtract',
    label: 'I agree to contract electronically, and that ticking these boxes is my signature.',
    detail:
      'Your acceptance is recorded with the document versions above and the time you accepted them. That record is the agreement — there is no paper copy.',
    href: null,
    linkLabel: null,
  },
];

// Condensed, in the same voice as /terms and /privacy — not a replacement for
// them. Every point here links onward to the full page.
export const CONSENT_SUMMARY = [
  {
    heading: 'What you agree to',
    points: [
      'Use DATAD in good faith: nothing illegal, nothing that isn’t yours to share, no attempts to break the platform or reach other students’ data.',
      'Shared spaces — notes, photos, planner, community — are for your batch. What you put there, your batch can see.',
      'You own what you create. You grant DATAD permission to store and display it so the intended people can see it, and you can delete it, or your whole account, at any time.',
    ],
  },
  {
    heading: 'What DATAD does with your data',
    points: [
      'Your registration answers — course, goals, skills, experience — build the intelligence profile the product is. That is the purpose you are consenting to.',
      'Your email address is used to confirm your account, to reach you about the platform, and for nothing else.',
      'Files you upload are stored with the platform’s hosting and media providers. Deleting them here deletes them there.',
    ],
  },
  {
    heading: 'What DATAD does not promise',
    points: [
      'The platform is provided as is. There is no uptime guarantee and no guarantee that data is never lost — keep your own copy of anything that matters, such as a PDF of your resume.',
      'Support contributions are voluntary, non-refundable, and unlock nothing. The platform is free for the batch.',
      'These terms can change. You will be asked to accept again when they do, rather than being bound silently.',
    ],
  },
];


export const CONSENT_CLAUSE_IDS = CONSENT_CLAUSES.map((c) => c.id);
