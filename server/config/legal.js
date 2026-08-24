/**
 * The legal documents a person must accept before an account exists.
 *
 * Versions are dates, not integers, because that is what an acceptance record
 * has to prove: *which text* was on screen when someone clicked accept. Bump a
 * version whenever the corresponding page's wording changes materially — the
 * old acceptance stays on the user document, so the audit trail keeps pointing
 * at the text that was actually agreed to rather than at today's revision.
 *
 * The client mirrors this file (client/src/constants/legal.js). The server is
 * the authority: registration rejects an acceptance that names a version this
 * file does not recognise, so a stale cached bundle cannot smuggle through a
 * consent to superseded terms.
 */
const LEGAL_DOCS = {
  terms: { id: 'terms', label: 'Terms of Use', version: '2026-07-01', path: '/terms' },
  privacy: { id: 'privacy', label: 'Privacy Policy', version: '2026-07-01', path: '/privacy' },
};

// Every clause the signup screen asks about, in the order it asks. `required`
// is what makes an account impossible without it; a non-required clause would
// be an opt-in (marketing, say) and must never gate registration.
const CONSENT_CLAUSES = [
  { id: 'terms', required: true, doc: 'terms' },
  { id: 'privacy', required: true, doc: 'privacy' },
  { id: 'econtract', required: true, doc: null },
];

const REQUIRED_CLAUSES = CONSENT_CLAUSES.filter((c) => c.required).map((c) => c.id);

const CURRENT_VERSIONS = {
  terms: LEGAL_DOCS.terms.version,
  privacy: LEGAL_DOCS.privacy.version,
};

/**
 * Validate a consent payload from the signup form.
 *
 * Returns a problem string, or null when the acceptance is good enough to
 * record. Deliberately strict about versions: "they ticked a box once" is not
 * the same claim as "they accepted these terms", and only the second one is
 * worth anything if it is ever questioned.
 */
function consentProblem(consent) {
  if (!consent || typeof consent !== 'object') {
    return 'You must accept the Terms of Use and Privacy Policy to create an account';
  }

  const accepted = consent.accepted && typeof consent.accepted === 'object' ? consent.accepted : {};
  const missing = REQUIRED_CLAUSES.filter((id) => accepted[id] !== true);
  if (missing.length > 0) {
    return 'You must accept the Terms of Use, the Privacy Policy and the electronic agreement to create an account';
  }

  for (const key of Object.keys(CURRENT_VERSIONS)) {
    if (String(consent.versions?.[key] || '') !== CURRENT_VERSIONS[key]) {
      return 'The terms have been updated since this page loaded — please reload and read the current version';
    }
  }

  return null;
}

/**
 * Whether an account's stored acceptance still covers the documents we publish
 * today. False for the two cases that both mean "this person has not agreed to
 * what is currently in force":
 *
 *   - an account created before consent was collected at all, and
 *   - an account whose acceptance names a version that has since been bumped.
 *
 * Login calls this and holds the session back until it is true. Deliberately
 * not "has any consent at all": a policy change that nobody is asked to accept
 * is a policy change nobody has agreed to, so the re-consent gate has to key on
 * the version rather than on mere presence.
 */
function consentIsCurrent(consent) {
  if (!consent || !consent.acceptedAt) return false;
  if (!REQUIRED_CLAUSES.every((id) => consent[id] === true)) return false;
  return Object.keys(CURRENT_VERSIONS).every(
    (key) => String(consent.versions?.[key] || '') === CURRENT_VERSIONS[key]
  );
}

module.exports = {
  LEGAL_DOCS, CONSENT_CLAUSES, REQUIRED_CLAUSES, CURRENT_VERSIONS,
  consentProblem, consentIsCurrent,
};
