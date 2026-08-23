/**
 * Who may see which profile field.
 *
 * `getDirectory` ran `UserProfile.find(filter)` with no projection, so every
 * field on the schema went to any authenticated student who asked. The
 * onboarding block is the part that matters: `difficultSubjects` is a student
 * telling the product what they struggle with, `goals` is what they are trying
 * to become, `learningStyle` came out of an assessment flow. None of it was
 * collected to be published to their classmates, and a member directory is
 * exactly where a classmate looks.
 *
 * The fix is a projection, but the *architecture* is the allowlist below, and
 * specifically its default. PUBLIC names every field that may leave the server
 * for another student; anything not named is private. So the failure mode of
 * adding a field to UserProfile.js and forgetting this file is that the new
 * field is withheld — a bug someone reports — rather than published, which is a
 * bug nobody sees until it is in a screenshot. The original code had the
 * opposite default, which is why `dreamRole` shipped to the directory the day it
 * was added, without anyone deciding that it should.
 *
 * The four classes the remediation sprint asked for:
 *
 *   PUBLIC           any authenticated member may see it. The "find people to
 *                    work with" surface: skills, links, cohort, what they are
 *                    looking for.
 *   PRIVATE          the owner only. Onboarding and assessment answers.
 *   ROLE_RESTRICTED  the owner, plus staff acting in a role that needs it.
 *   INTERNAL         never serialised to any client, at any role. Derived
 *                    intelligence, scores, model features.
 */

/**
 * Visible to other members.
 *
 * Deliberately close to the set a student can edit on the "public profile"
 * screen, because that screen is where they formed their expectation about who
 * can see this. `specialization` and `skills` must stay here regardless: the
 * directory filters on them, and a field you can filter by is discoverable
 * whether or not it is projected.
 */
const PUBLIC = Object.freeze([
  'skills',
  'interests',
  'clubs',
  'languages',
  'linkedin',
  'github',
  'portfolio',
  'batch',
  'specialization',
  'bio',
  'lookingFor',
  'priorDomain',
  'college',
  'course',
  'department',
  'graduationYear',
]);

/**
 * The owner's own, and nobody else's.
 *
 * Every one of these was in the directory response before this module existed.
 * `goals` and `experience` are objects, so they are excluded wholesale — a
 * projection that reaches inside them would have to be revisited every time a
 * sub-field is added, and would be forgotten.
 */
const PRIVATE = Object.freeze([
  'dreamRole',
  'favouriteSubjects',
  'difficultSubjects',
  'learningStyle',
  'goals',
  'experience',
  'semester',
  'careerInterests',
  'preferredIndustries',
]);

/** The owner, and staff whose job needs it. Not another student, ever. */
const ROLE_RESTRICTED = Object.freeze(['email']);

/**
 * Never leaves the server. Derived signals — scores, model features, the
 * intelligence layer's working state — which are about the student rather than
 * from them, and which nobody agreed to publish.
 */
const INTERNAL = Object.freeze([
  'intelligence',
  'assessment',
  'scores',
  'embedding',
  'features',
]);

/**
 * Fields on the User document that may accompany a public profile.
 *
 * `email` is absent on purpose: the directory is the natural place to harvest a
 * mailing list for the whole cohort.
 *
 * `avatarUrl`, not `avatar`. The field on the User model has always been
 * `avatarUrl`; the directory populated `'name avatar'` and the client read
 * `p.user?.avatar`, so both sides agreed on a name that does not exist and
 * every member in the directory rendered with initials instead of their photo.
 * Nothing errored — mongoose projects an unknown field as absent — which is why
 * it survived to a release audit.
 */
const PUBLIC_USER_FIELDS = Object.freeze(['name', 'avatarUrl']);

/** A mongoose projection string for the public fields, plus the owner ref. */
function publicProjection() {
  return ['user', ...PUBLIC].join(' ');
}

/**
 * Drop everything that is not PUBLIC from an already-fetched profile.
 *
 * The projection is the real control; this is for call sites that already hold
 * a document. Both exist because a projection is easy to lose in a refactor and
 * a second, cheap check is worth having.
 *
 * @param {object} profile  a lean profile document
 * @returns {object} a new object containing only public fields
 */
function toPublicProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  const out = { _id: profile._id };

  for (const field of PUBLIC) {
    if (profile[field] !== undefined) out[field] = profile[field];
  }

  // `user` is populated, so it needs the same treatment rather than being
  // copied across whole.
  const user = profile.user;
  if (user && typeof user === 'object') {
    out.user = { _id: user._id };
    for (const field of PUBLIC_USER_FIELDS) {
      if (user[field] !== undefined) out.user[field] = user[field];
    }
  } else if (user !== undefined) {
    out.user = user;
  }

  return out;
}

/** True when a field may be shown to a member who is not its owner. */
function isPublicField(field) {
  return PUBLIC.includes(field);
}

/**
 * Cohort aggregation — the rules for saying something about a *group* of
 * students without saying anything about any one of them.
 *
 * This lives here rather than in a parallel privacy module on purpose. There is
 * one allowlist in this codebase and this is it; a second one would drift, and
 * the drift would be silent in exactly the direction that leaks.
 */

/**
 * The smallest cohort that may produce a statistic (k-anonymity).
 *
 * Below this, an aggregate stops being about a group: in a cohort of two, "the
 * average is 40" plus knowing your own 30 tells you the other person's 50. The
 * answer for an undersized cohort is nothing at all — never a smaller sample,
 * never a wider bucket silently substituted.
 */
const COHORT_MIN_MEMBERS = 5;

/**
 * Fields a cohort may be *defined* by.
 *
 * Restricted to PUBLIC fields, and checked rather than assumed: grouping by a
 * private field would publish it. Learning that "students who marked
 * Kinesthetic convert at 40%" tells you something about every classmate who
 * ticked that box, which is precisely what PRIVATE meant.
 */
const COHORT_DIMENSIONS = Object.freeze(['batch', 'college', 'program']);

/**
 * Signals that may be averaged across a cohort.
 *
 * All are behavioural counters the student can see about themselves, and none
 * identifies anybody once averaged over COHORT_MIN_MEMBERS people. Scores that
 * are INTERNAL for an individual stay out: aggregating a field nobody agreed to
 * publish does not make it publishable, it makes it publishable in bulk.
 */
const COHORT_AGGREGATABLE = Object.freeze([
  'careerReadiness',
  'applicationsCount',
  'resumeCompletion',
  'consistency',
  'streak',
  'studyMinutes',
]);

/** True when a cohort may be grouped by this field. */
function isCohortDimension(field) {
  // `program` is a User field, not a profile field, and is public by nature —
  // it is the product surface the student is already on. The rest must be
  // PUBLIC on the profile.
  if (field === 'program') return true;
  return COHORT_DIMENSIONS.includes(field) && PUBLIC.includes(field);
}

/** True when this signal may be averaged and reported for a cohort. */
function isCohortAggregatable(metric) {
  return COHORT_AGGREGATABLE.includes(metric);
}

/** True when a cohort is large enough to be reported on at all. */
function meetsCohortMinimum(memberCount) {
  return typeof memberCount === 'number' && memberCount >= COHORT_MIN_MEMBERS;
}

module.exports = {
  PUBLIC,
  PRIVATE,
  ROLE_RESTRICTED,
  INTERNAL,
  PUBLIC_USER_FIELDS,
  publicProjection,
  toPublicProfile,
  isPublicField,
  COHORT_MIN_MEMBERS,
  COHORT_DIMENSIONS,
  COHORT_AGGREGATABLE,
  isCohortDimension,
  isCohortAggregatable,
  meetsCohortMinimum,
};
