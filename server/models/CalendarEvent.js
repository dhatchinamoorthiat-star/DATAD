const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, default: '' },
    type: { type: String, enum: ['event', 'birthday', 'meeting', 'reminder', 'other'], default: 'event' },
    description: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

calendarEventSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
