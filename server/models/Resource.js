const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, trim: true },
    semester: { type: String, trim: true },
    professor: { type: String, trim: true },
    type: {
      type: String,
      enum: ['pdf', 'word', 'excel', 'ppt', 'zip', 'video', 'link'],
      default: 'link',
    },
    url: { type: String, required: true, trim: true },
    fileSize: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Program personalization; empty means "shown to everyone".
    programs: { type: [{ type: String }], default: [], index: true },
    downloads: { type: Number, default: 0 },
    contentItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
