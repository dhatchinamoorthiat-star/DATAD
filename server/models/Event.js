const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, trim: true },
    online: { type: Boolean, default: false },
    meetLink: { type: String, trim: true },
    organizer: { type: String, trim: true },
    category: {
      type: String,
      enum: ['academic', 'social', 'career', 'sports', 'other'],
      default: 'other',
    },
    image: { type: String, trim: true },
    registrationOpen: { type: Boolean, default: true },
    maxAttendees: { type: Number },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // ⭐ Program Personalization
    program: { type: String, default: null },     // Program ID event belongs to
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });
eventSchema.index({ program: 1, date: 1 });

module.exports = mongoose.model('Event', eventSchema);
