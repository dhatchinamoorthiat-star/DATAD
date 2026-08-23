/**
 * M2 — Student A must not be able to read Student B's onboarding answers.
 *
 * `getDirectory` ran `UserProfile.find(filter)` with no projection. In mongoose
 * that means every field, so `difficultSubjects`, `dreamRole`, `learningStyle`
 * and `goals` were served to any authenticated member who opened the member
 * list. That data was collected to personalise a student's own experience; a
 * classmate reading what they struggle with is a different product.
 *
 * Student B's private fields carry canary strings. The test is that no canary
 * reaches Student A through any surface, asserted against the SERIALISED
 * RESPONSE rather than against a field list — a leak through an unexpected
 * field, a nested object, or a stray populate is still a leak, and only
 * searching the whole payload catches those.
 *
 * The database is mocked: the subject is the projection and the serialisation,
 * both of which are decided in the controller.
 */

const directory = require('../controllers/directoryController');
const visibility = require('../models/profileVisibility');

/** Unique enough that a match cannot be a coincidence. */
const CANARY = {
  difficultSubjects: 'CANARY-DIFFICULT-77301',
  favouriteSubjects: 'CANARY-FAVOURITE-77302',
  dreamRole: 'CANARY-DREAMROLE-77303',
  learningStyle: 'Kinesthetic',
  goals: 'CANARY-GOAL-77305',
  careerInterests: 'CANARY-CAREER-77306',
  preferredIndustries: 'CANARY-INDUSTRY-77307',
  semester: 'CANARY-SEMESTER-77308',
  experience: 'CANARY-PASTDOMAIN-77309',
  email: 'canary-b-77310@example.edu',
};

/** Student B, as stored: public fields plus every private one, all canaried. */
const STUDENT_B = {
  _id: 'profileB',
  user: { _id: 'userB', name: 'Student B', avatarUrl: 'b.png', email: CANARY.email },
  // public
  skills: ['Python'],
  specialization: 'Data Science',
  bio: 'Second year, likes graphs.',
  college: 'Example Institute',
  // private — none of these may reach Student A
  difficultSubjects: [CANARY.difficultSubjects],
  favouriteSubjects: [CANARY.favouriteSubjects],
  dreamRole: CANARY.dreamRole,
  learningStyle: CANARY.learningStyle,
  goals: { placement: true, note: CANARY.goals },
  careerInterests: [CANARY.careerInterests],
  preferredIndustries: [CANARY.preferredIndustries],
  semester: CANARY.semester,
  experience: { years: 2, type: 'intern', pastDomain: CANARY.experience },
};

/**
 * A mongoose-shaped query that records the projection it was given and then
 * honours it, so the test exercises the real `.select()` the controller passes
 * rather than trusting it.
 */
function mockQuery(doc) {
  const state = { projection: null, userFields: null };
  const q = {
    select(p) { state.projection = p; return q; },
    populate(_path, fields) { state.userFields = fields; return q; },
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    lean() {
      const fields = String(state.projection || '').split(/\s+/).filter(Boolean);
      const projected = { _id: doc._id };
      for (const f of fields) {
        if (f === 'user') continue;
        if (doc[f] !== undefined) projected[f] = doc[f];
      }
      const uf = String(state.userFields || '').split(/\s+/).filter(Boolean);
      projected.user = { _id: doc.user._id };
      for (const f of uf) if (doc.user[f] !== undefined) projected.user[f] = doc.user[f];
      return Promise.resolve([projected]);
    },
  };
  return { q, state };
}

jest.mock('../models/UserProfile', () => ({ find: (...a) => global.__mockFind(...a) }));
jest.mock('../models/User', () => ({ find: () => ({ select: () => ({ limit: () => ({ lean: async () => [] }) }) }) }));
jest.mock('../services/studentIdentityService', () => ({ updateIdentity: async () => {} }));

/** Run getDirectory and hand back the JSON the controller produced. */
async function fetchDirectoryAsStudentA() {
  const { q } = mockQuery(STUDENT_B);
  global.__mockFind = () => q;

  let payload;
  const res = { json: (v) => { payload = v; } };
  const req = { query: {}, user: { userId: 'userA' } };
  await directory.getDirectory(req, res, (err) => { throw err; });
  return payload;
}

describe('Student A reading the directory', () => {
  let body;

  beforeAll(async () => {
    body = JSON.stringify(await fetchDirectoryAsStudentA());
  });

  it.each(Object.entries(CANARY))('does not leak %s', (_field, canary) => {
    expect(body).not.toContain(canary);
  });

  it('leaks no canary at all, by any route', () => {
    // The same assertion stated over the whole payload, so a leak through a
    // field nobody thought to list still fails.
    for (const canary of Object.values(CANARY)) {
      expect(body).not.toContain(canary);
    }
  });

  it('still returns the public profile, so the directory works', () => {
    const [profile] = JSON.parse(body);
    expect(profile.skills).toEqual(['Python']);
    expect(profile.specialization).toBe('Data Science');
    expect(profile.bio).toBe('Second year, likes graphs.');
    expect(profile.user.name).toBe('Student B');
    // avatarUrl, not avatar: the model has always called it avatarUrl, while
    // the directory populated 'avatar' and the client read `.avatar`, so every
    // member rendered with initials instead of their photo.
    expect(profile.user.avatarUrl).toBe('b.png');
  });

  it('does not include the member\'s email address', () => {
    // A directory is the natural place to harvest a cohort mailing list.
    const [profile] = JSON.parse(body);
    expect(profile.user.email).toBeUndefined();
  });

  it('returns no field outside the public allowlist', () => {
    const [profile] = JSON.parse(body);
    const allowed = new Set([...visibility.PUBLIC, 'user', '_id']);
    for (const key of Object.keys(profile)) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});

describe('the visibility classes themselves', () => {
  it('classifies every field the report named as private', () => {
    for (const field of [
      'difficultSubjects', 'favouriteSubjects', 'dreamRole',
      'goals', 'learningStyle', 'careerInterests', 'preferredIndustries',
    ]) {
      expect(visibility.PRIVATE).toContain(field);
      expect(visibility.isPublicField(field)).toBe(false);
    }
  });

  it('never lists a field as both public and private', () => {
    const overlap = visibility.PUBLIC.filter((f) => visibility.PRIVATE.includes(f));
    expect(overlap).toEqual([]);
  });

  it('withholds a field nobody has classified yet', () => {
    // The default is the architecture. A field added to UserProfile.js and
    // forgotten here must be withheld — a reported bug — rather than published,
    // which is how dreamRole reached the directory in the first place.
    const out = visibility.toPublicProfile({
      _id: 'p1',
      user: { _id: 'u1', name: 'N' },
      somethingAddedNextSprint: 'CANARY-FUTURE-99999',
    });
    expect(JSON.stringify(out)).not.toContain('CANARY-FUTURE-99999');
  });

  it('does not reach inside goals or experience to publish a sub-field', () => {
    const out = visibility.toPublicProfile({
      _id: 'p1',
      user: { _id: 'u1', name: 'N' },
      goals: { placement: true },
      experience: { years: 2, pastDomain: 'CANARY-NESTED-88888' },
    });
    expect(JSON.stringify(out)).not.toContain('CANARY-NESTED-88888');
    expect(out.goals).toBeUndefined();
  });

  it('keeps the fields the directory filters on public', () => {
    // A field you can filter by is discoverable whether or not it is projected,
    // so withholding it would be theatre.
    expect(visibility.isPublicField('specialization')).toBe(true);
    expect(visibility.isPublicField('skills')).toBe(true);
  });

  it('never returns the User email through the public user fields', () => {
    expect(visibility.PUBLIC_USER_FIELDS).not.toContain('email');
  });
});
