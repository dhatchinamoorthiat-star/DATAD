const mongoose = require('mongoose');

// System of record for every upload made through the Content Studio.
// Target modules (Note, Resource, Photo, Announcement…) keep their own
// schemas; publishing creates the target record and links back here.
const contentItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        'uploaded',
        'analyzing',
        'ready_for_review',
        'draft',
        'scheduled',
        'published',
        'rejected',
        'failed',
      ],
      default: 'uploaded',
    },

    file: {
      originalName: { type: String, trim: true },
      url: String, // Cloudinary secure_url
      publicId: String, // Cloudinary public_id (delete/replace)
      resourceType: String, // Cloudinary resource_type (image|video|raw)
      mime: String,
      type: {
        type: String,
        enum: ['pdf', 'word', 'excel', 'ppt', 'image', 'zip', 'video', 'audio', 'markdown', 'text'],
      },
      size: Number,
      hash: { type: String, index: true }, // sha256 for exact dedupe
      pageCount: Number,
    },

    // AI-suggested values. Never edited — the review screen copies these
    // into `meta` and the admin edits the copy.
    analysis: {
      title: String,
      description: String,
      summary: String,
      subject: String,
      semester: String,
      course: String,
      company: String,
      category: String,
      keywords: [String],
      language: String,
      handwritten: Boolean,
      ocrText: { type: String, maxlength: 20000, select: false },
      thumbnailUrl: String,
      confidence: Number, // 0–1
      suggestedDestination: String, // destinationRegistry key
      model: String, // provider/model that produced this
    },

    // Admin-confirmed values, prefilled from `analysis` on the review screen.
    meta: {
      title: { type: String, trim: true, maxlength: 200 },
      description: { type: String, trim: true, maxlength: 2000 },
      subject: { type: String, trim: true, maxlength: 60 },
      semester: { type: String, trim: true, maxlength: 30 },
      course: { type: String, trim: true, maxlength: 100 },
      company: { type: String, trim: true, maxlength: 100 },
      category: { type: String, trim: true, maxlength: 60 },
      tags: [{ type: String, trim: true }],
      visibility: { type: String, enum: ['public', 'members', 'admins'], default: 'members' },
      extra: { type: mongoose.Schema.Types.Mixed, default: {} }, // destination-specific fields
    },

    destination: {
      key: String, // destinationRegistry key, e.g. 'notes'
      targetModel: String, // e.g. 'Note'
      targetId: mongoose.Schema.Types.ObjectId, // set on publish
    },

    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },
    duplicateKind: { type: String, enum: ['exact', 'similar'] },
    version: { type: Number, default: 1 },
    supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },

    embedding: { type: [Number], select: false },
    scheduledFor: Date,
    publishedAt: Date,
    rejectedReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

contentItemSchema.index(
  { 'meta.title': 'text', 'analysis.title': 'text', 'analysis.summary': 'text', 'meta.tags': 'text' }
);
contentItemSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContentItem', contentItemSchema);
