/**
 * Authorization regression tests for note reading.
 *
 * getNote fetched a note by id and checked only the *program* scope before
 * returning it — never the author. Notes are private: listNotes filters on
 * `author`, updateNote and deleteNote both refuse a non-author, and the schema
 * indexes on author. Only the read path was missing the check, so any
 * authenticated student could read any other student's note — title, the full
 * 20k-character body, and the attachment URLs — by guessing or harvesting an id.
 *
 * The program check could not stand in for it. It skips entirely when the note
 * has no program, or when the *caller* has no program, and it passes outright
 * whenever both sit in the same program — which, in a single-cohort college
 * deployment, is everyone.
 *
 * The invariant: a note is readable only by its author.
 *
 * Models are mocked, so this runs without a database.
 */

const mongoose = require('mongoose');
const Note = require('../models/Note');
const controller = require('../controllers/noteController');

const oid = () => new mongoose.Types.ObjectId();

const AUTHOR = oid();
const OUTSIDER = oid();
const NOTE_ID = oid();

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const makeReq = (userId, program) => ({
  user: { userId: String(userId), ...(program ? { program: { id: program } } : {}) },
  params: { id: String(NOTE_ID) },
});

/**
 * A note doc shaped the way the controller actually receives it.
 *
 * getNote populates `author`, so it arrives as a User *document* — an object
 * carrying `_id`, not an ObjectId. That distinction is the trap: a populated
 * document's .equals() compares against `arg._id`, so .equals(<string userId>)
 * reads undefined and denies the genuine author. Modelling the populated shape
 * here is what makes the owner test able to catch that.
 */
const noteDoc = (author, program = null) => ({
  _id: NOTE_ID,
  title: 'Private WACC notes',
  content: 'SECRET BODY',
  program,
  author: { _id: author, name: 'Author Name' },
  attachments: [{ name: 'cv.pdf', url: 'https://res.cloudinary.com/x/cv.pdf' }],
});

/** getNote calls .populate() on the query, so the mock has to be thenable. */
const mockFindById = (doc) =>
  jest.spyOn(Note, 'findById').mockReturnValue({
    populate: () => Promise.resolve(doc),
  });

beforeEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

describe('getNote object-level authorization', () => {
  test('the author can read their own note', async () => {
    mockFindById(noteDoc(AUTHOR));
    const res = makeRes();
    await controller.getNote(makeReq(AUTHOR), res, (e) => { throw e; });

    expect(res.statusCode).toBe(200);
    expect(res.body.content).toBe('SECRET BODY');
  });

  test('a different student cannot read a note with no program set', async () => {
    mockFindById(noteDoc(AUTHOR, null));
    const res = makeRes();
    await controller.getNote(makeReq(OUTSIDER), res, (e) => { throw e; });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty('content');
  });

  test('a different student in the SAME program cannot read the note', async () => {
    mockFindById(noteDoc(AUTHOR, 'mba'));
    const res = makeRes();
    await controller.getNote(makeReq(OUTSIDER, 'mba'), res, (e) => { throw e; });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty('content');
  });

  test('a caller with no program cannot read a programmed note', async () => {
    mockFindById(noteDoc(AUTHOR, 'mba'));
    const res = makeRes();
    await controller.getNote(makeReq(OUTSIDER), res, (e) => { throw e; });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty('content');
  });

  test('a missing note is not distinguishable from someone else\'s note', async () => {
    mockFindById(null);
    const res = makeRes();
    await controller.getNote(makeReq(OUTSIDER), res, (e) => { throw e; });

    expect(res.statusCode).toBe(404);
  });
});
