const crypto = require('crypto');
const Resource = require('../models/Resource');
const cloudinary = require('../config/cloudinary');
const docUpload = require('../middleware/docUpload');
const { mergeWithProgramsFilter } = require('../utils/programFilter');
const studioUpload = require('../middleware/studioUpload');
const publishService = require('../services/publishing/publishService');

exports.list = async (req, res, next) => {
  try {
    const base = {};
    if (req.query.type) base.type = req.query.type;
    if (req.query.subject) base.subject = new RegExp(req.query.subject, 'i');
    if (req.query.semester) base.semester = req.query.semester;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      base.$or = [{ title: re }, { professor: re }, { tags: re }];
    }
    // Search already owns `$or`, so this combines under `$and` rather than
    // overwriting it — otherwise searching would drop the program scope.
    const filter = mergeWithProgramsFilter(req.user, base);
    const sort = req.query.sort === 'downloads' ? { downloads: -1 } : { createdAt: -1 };
    const resources = await Resource.find(filter).populate('uploadedBy', 'name').sort(sort);
    res.json(resources);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, subject, semester, professor, type, url, fileSize, tags } = req.body;
    if (!title || !url) return res.status(400).json({ message: 'Title and URL are required' });
    const resource = await Resource.create({
      title, subject, semester, professor, type, url, fileSize, tags: tags || [],
      uploadedBy: req.user.userId,
      // Scoped to the uploader's program. Admin-curated material is seeded with
      // an empty array instead, which shares it across every program.
      programs: req.user?.program?.id ? [req.user.program.id] : [],
    });
    res.status(201).json(resource);
  } catch (err) { next(err); }
};

const RESOURCE_UPDATABLE_FIELDS = ['title', 'subject', 'semester', 'professor', 'type', 'url', 'fileSize', 'tags'];

exports.update = async (req, res, next) => {
  try {
    const item = await Resource.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.uploadedBy.equals(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }
    RESOURCE_UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await Resource.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.uploadedBy.equals(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const { title, subject, semester, professor, tags } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'datad/resources',
      resource_type: 'auto',
      public_id: `${Date.now()}-${req.file.originalname.replace(/[^a-z0-9]/gi, '_')}`,
    });

    // Delegate record creation to the central publishing engine (Content
    // Studio) so this upload shows up in Recent Uploads and dedupe checks.
    const { target: resource } = await publishService.publishDirect({
      file: {
        originalName: req.file.originalname,
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        mime: req.file.mimetype,
        type: studioUpload.detectType(req.file) || 'text',
        size: req.file.size,
        hash: crypto.createHash('sha256').update(req.file.buffer).digest('hex'),
      },
      destinationKey: 'resources',
      meta: {
        title, subject, semester,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        extra: { professor, resourceType: docUpload.mimeToType[req.file.mimetype] || 'link' },
      },
      user: req.user,
    });
    res.status(201).json(resource);
  } catch (err) { next(err); }
};

exports.incrementDownload = async (req, res, next) => {
  try {
    await Resource.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
