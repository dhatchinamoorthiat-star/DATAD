const Album = require('../models/Album');
const Photo = require('../models/Photo');
const cloudinary = require('../config/cloudinary');

const isHttpUrl = (value) => /^https?:\/\/.+/i.test(value || '');

exports.listAlbums = async (req, res, next) => {
  try {
    const albums = await Album.find().populate('createdBy', 'name').sort({ createdAt: -1 });

    // A hosted album's card needs to say how many photos are in it, and its
    // cover falls back to the newest photo when nobody set one. Both come from
    // a single grouped query rather than one lookup per album.
    const counts = await Photo.aggregate([
      { $match: { album: { $in: albums.map((a) => a._id) } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$album', count: { $sum: 1 }, latestUrl: { $first: '$url' } } },
    ]);
    const byAlbum = new Map(counts.map((c) => [String(c._id), c]));

    res.json(
      albums.map((album) => {
        const stats = byAlbum.get(String(album._id));
        return {
          ...album.toJSON(),
          photoCount: stats?.count || 0,
          cover: album.cover || stats?.latestUrl || null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

exports.getAlbum = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id).populate('createdBy', 'name');
    if (!album) return res.status(404).json({ message: 'Album not found' });
    const photoCount = await Photo.countDocuments({ album: album._id });
    res.json({ ...album.toJSON(), photoCount });
  } catch (err) {
    next(err);
  }
};

exports.createAlbum = async (req, res, next) => {
  try {
    const { title, description, link, cover } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    // A link is what makes an album "linked". Omitting it is now a real choice
    // — the album holds uploads instead — so only a link that is present and
    // malformed is an error.
    if (link && !isHttpUrl(link)) {
      return res.status(400).json({ message: 'A valid album link (starting with http) is required' });
    }
    if (cover && !isHttpUrl(cover)) {
      return res.status(400).json({ message: 'The cover must be a valid image URL' });
    }
    const album = await Album.create({
      title,
      description,
      link: link || undefined,
      cover,
      createdBy: req.user.userId,
    });
    res.status(201).json({ ...album.toJSON(), photoCount: 0 });
  } catch (err) {
    next(err);
  }
};

exports.deleteAlbum = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ message: 'Album not found' });
    if (!album.createdBy.equals(req.user.userId)) {
      return res.status(403).json({ message: 'Only the creator can delete this album' });
    }

    // Deleting the album has to take its photos with it, otherwise the files
    // stay on Cloudinary (billed, and still reachable by URL) with no record
    // in DATAD pointing at them and no way left to remove them.
    const photos = await Photo.find({ album: album._id });
    for (const photo of photos) {
      await cloudinary.uploader.destroy(photo.publicId).catch(() => {});
    }
    await Photo.deleteMany({ album: album._id });

    await album.deleteOne();
    res.json({ message: 'Album deleted', photosDeleted: photos.length });
  } catch (err) {
    next(err);
  }
};
