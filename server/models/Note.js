const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, required: true, trim: true, maxlength: 60 },
    semester: { type: String, trim: true, maxlength: 30 },
    content: { type: String, default: '', maxlength: 20000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // ⭐ Program Personalization
    program: { type: String, default: null },     // Program ID notes belong to
    contentItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },
    // Attachments: files uploaded or links pasted by the author
    attachments: [{
      name: { type: String, required: true, maxlength: 200 },
      url: { type: String, required: true, maxlength: 1000 },
      fileType: { type: String, default: 'link', maxlength: 50 }, // 'link', 'pdf', 'doc', 'excel', etc.
      size: { type: Number, default: 0 },
    }],
    customSubject: { type: String, default: '', trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
