/**
 * Hosted albums and their photos.
 *
 * These pin the two things that were actually broken rather than merely
 * unfinished:
 *
 *   - `Album.link` was a required field, so an album that holds uploaded photos
 *     could not be created at all — even though the whole upload pipeline
 *     behind it was already written and mounted-but-unreachable.
 *   - deleting an album left its photos in the database and their files on
 *     Cloudinary, reachable by URL and billed, with nothing left pointing at
 *     them to clean up.
 *
 * Follows the repo's controller-double convention: the logic under test is the
 * controller's, so it is driven directly. Cloudinary is mocked — the assertion
 * is that destroy is *called* for each photo, which is the part that has to be
 * right; whether Cloudinary honours it is not this suite's business.
 *
 * Connects via helpers/testDb rather than MONGODB_URI directly. The older
 * suites here do connect straight to the configured URI and rely on throwaway
 * ids for safety; testDb exists because that is one exported production
 * MONGODB_URI away from a teardown deleting real rows, and this suite writes
 * real Album and Photo documents.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');

jest.mock('../config/cloudinary', () => ({
  uploader: { upload: jest.fn(), destroy: jest.fn().mockResolvedValue({ result: 'ok' }) },
}));
const cloudinary = require('../config/cloudinary');

const HAS_DB = Boolean(process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

const albumController = require('../controllers/albumController');
const photoController = require('../controllers/photoController');

let Album, Photo;
const userId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const user = { userId, name: 'Tester' };

/** Minimal res double: records status and payload. */
function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.payload = body; return res; };
  return res;
}

/** Runs a controller and fails the test on an unexpected next(err). */
async function run(controller, req) {
  const res = mockRes();
  let nextErr;
  await controller(req, res, (err) => { nextErr = err; });
  if (nextErr) throw nextErr;
  return res;
}

beforeAll(async () => {
  if (!HAS_DB) return;
  await connectTestDb();
  Album = require('../models/Album');
  Photo = require('../models/Photo');
  // listAlbums populates createdBy, so the User schema has to be registered
  // even though this suite never reads a user document.
  require('../models/User');
});

afterEach(() => {
  cloudinary.uploader.destroy.mockClear();
});

afterAll(async () => {
  if (!HAS_DB) return;
  await Promise.all([
    Album.deleteMany({ createdBy: { $in: [userId, otherId] } }),
    Photo.deleteMany({ uploadedBy: { $in: [userId, otherId] } }),
  ]);
  await disconnectTestDb();
});

d('albums: hosted and linked', () => {
  test('an album can be created with no link at all', async () => {
    const res = await run(albumController.createAlbum, {
      body: { title: 'Orientation Week' },
      user,
    });
    expect(res.statusCode).toBe(201);
    expect(res.payload.kind).toBe('hosted');
    expect(res.payload.link).toBeUndefined();
    expect(res.payload.photoCount).toBe(0);
  });

  test('a link, when given, still has to be a URL', async () => {
    const res = await run(albumController.createAlbum, {
      body: { title: 'Bad', link: 'not-a-url' },
      user,
    });
    expect(res.statusCode).toBe(400);
  });

  test('an album with a link reports itself as linked', async () => {
    const res = await run(albumController.createAlbum, {
      body: { title: 'Fest', link: 'https://photos.app.goo.gl/abc' },
      user,
    });
    expect(res.statusCode).toBe(201);
    expect(res.payload.kind).toBe('linked');
  });

  test('the list carries a photo count and falls back to the newest photo as cover', async () => {
    const album = await Album.create({ title: 'Trip', createdBy: userId });
    await Photo.create({
      album: album._id, url: 'https://cdn/old.jpg', publicId: 'p/old', uploadedBy: userId,
    });
    const newest = await Photo.create({
      album: album._id, url: 'https://cdn/new.jpg', publicId: 'p/new', uploadedBy: userId,
    });

    const res = await run(albumController.listAlbums, { user });
    const row = res.payload.find((a) => String(a._id) === String(album._id));
    expect(row.photoCount).toBe(2);
    expect(row.cover).toBe(newest.url);
  });
});

d('photos', () => {
  test('a linked album refuses uploads rather than swallowing the file', async () => {
    const album = await Album.create({
      title: 'Linked', link: 'https://photos.app.goo.gl/x', createdBy: userId,
    });
    const res = await run(photoController.uploadPhoto, {
      body: { albumId: String(album._id) },
      file: { mimetype: 'image/png', buffer: Buffer.from('x'), originalname: 'a.png', size: 1 },
      user,
    });
    expect(res.statusCode).toBe(400);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test('a malformed album id is a 400, not a cast error', async () => {
    const res = await run(photoController.uploadPhoto, {
      body: { albumId: 'nonsense' },
      file: { mimetype: 'image/png', buffer: Buffer.from('x'), originalname: 'a.png', size: 1 },
      user,
    });
    expect(res.statusCode).toBe(400);
  });

  test('only the uploader may delete a photo', async () => {
    const album = await Album.create({ title: 'Guarded', createdBy: userId });
    const photo = await Photo.create({
      album: album._id, url: 'https://cdn/x.jpg', publicId: 'p/x', uploadedBy: userId,
    });
    const res = await run(photoController.deletePhoto, {
      params: { id: String(photo._id) },
      user: { userId: otherId },
    });
    expect(res.statusCode).toBe(403);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  test('deleting an album takes its photos and their Cloudinary files with it', async () => {
    const album = await Album.create({ title: 'Doomed', createdBy: userId });
    await Photo.create([
      { album: album._id, url: 'https://cdn/1.jpg', publicId: 'p/1', uploadedBy: userId },
      { album: album._id, url: 'https://cdn/2.jpg', publicId: 'p/2', uploadedBy: userId },
    ]);

    const res = await run(albumController.deleteAlbum, {
      params: { id: String(album._id) },
      user,
    });

    expect(res.payload.photosDeleted).toBe(2);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    expect(cloudinary.uploader.destroy.mock.calls.map((c) => c[0]).sort()).toEqual(['p/1', 'p/2']);
    expect(await Photo.countDocuments({ album: album._id })).toBe(0);
    expect(await Album.findById(album._id)).toBeNull();
  });

  test('a non-owner cannot delete the album out from under its photos', async () => {
    const album = await Album.create({ title: 'Someone else', createdBy: otherId });
    const res = await run(albumController.deleteAlbum, {
      params: { id: String(album._id) },
      user,
    });
    expect(res.statusCode).toBe(403);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
