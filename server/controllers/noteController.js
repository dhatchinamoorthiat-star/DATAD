const Note = require('../models/Note');
const publishService = require('../services/publishing/publishService');
const cloudinary = require('../config/cloudinary');
const docUpload = require('../middleware/docUpload');
const { Readable } = require('stream');

exports.listNotes = async (req, res, next) => {
  try {
    const filter = { author: req.user.userId };  // Only user's own notes

    // ⭐ Filter by program
    const programId = req.user?.program?.id;
    if (programId) {
      filter.program = programId;
    }

    if (req.query.subject) filter.subject = req.query.subject;
    const notes = await Note.find(filter)
      .populate('author', 'name')
      .sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    next(err);
  }
};

exports.getNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).populate('author', 'name');
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    next(err);
  }
};

exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const mimeType = req.file.mimetype;
    const fileType = docUpload.mimeToType[mimeType] || (mimeType.startsWith('image/') ? 'image' : 'file');
    const resourceType = mimeType.startsWith('image/') || mimeType.startsWith('video/') ? 'auto' : 'raw';
    const stream = Readable.from(req.file.buffer);
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'datad/note-attachments', use_filename: true, access_mode: 'public' },
      (err, result) => {
        if (err) return next(err);
        res.json({ url: result.secure_url, name: req.file.originalname, fileType, size: req.file.size });
      }
    );
    stream.pipe(uploadStream);
  } catch (err) {
    next(err);
  }
};

exports.createNote = async (req, res, next) => {
  try {
    const { title, subject, semester, content, customSubject, attachments } = req.body;
    if (!title || !subject) {
      return res.status(400).json({ message: 'Title and subject are required' });
    }
    const resolvedSubject = subject === 'Other' && customSubject ? customSubject : subject;
    const { target: note } = await publishService.publishDirect({
      destinationKey: 'notes',
      meta: {
        title,
        subject: resolvedSubject,
        semester,
        description: (content || '').slice(0, 2000),
        extra: { content: content || '', customSubject: customSubject || '', attachments: attachments || [] },
      },
      user: req.user,
    });
    // Save attachments and program separately since publishDirect may not handle them
    if (attachments && attachments.length) {
      await Note.findByIdAndUpdate(note._id, {
        attachments,
        customSubject: customSubject || '',
        // ⭐ Automatically scope note to user's program
        program: req.user?.program?.id || null,
      });
    } else {
      // Still add program even if no attachments
      await Note.findByIdAndUpdate(note._id, {
        program: req.user?.program?.id || null,
      });
    }
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
};

exports.updateNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!note.author.equals(req.user.userId)) {
      return res.status(403).json({ message: 'Only the author can edit this note' });
    }
    const { title, subject, semester, content, customSubject, attachments } = req.body;
    const resolvedSubject = subject === 'Other' && customSubject ? customSubject : subject;
    Object.assign(note, { title, subject: resolvedSubject, semester, content, customSubject: customSubject || '', attachments: attachments || note.attachments });
    await note.save();
    res.json(note);
  } catch (err) {
    next(err);
  }
};

exports.deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!note.author.equals(req.user.userId)) {
      return res.status(403).json({ message: 'Only the author can delete this note' });
    }
    await note.deleteOne();
    res.json({ message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
};
