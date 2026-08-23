const mongoose = require('mongoose');

// An album is one of two things, and the difference is whether `link` is set:
//
//   linked  — a pointer to a shared Google Photos album. No files live here.
//   hosted  — a container for photos uploaded to DATAD (see models/Photo.js).
//
// `link` used to be required, which is why hosted albums were impossible even
// though the upload pipeline behind them was already written. It is optional
// now; `kind` reports which sort an album turned out to be so callers don't
// have to re-derive it.
const albumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    link: { type: String, trim: true, maxlength: 600 },
    cover: { type: String, trim: true, maxlength: 600 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

albumSchema.virtual('kind').get(function kind() {
  return this.link ? 'linked' : 'hosted';
});

module.exports = mongoose.model('Album', albumSchema);
