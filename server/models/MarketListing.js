const mongoose = require('mongoose');

const marketListingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      enum: ['books', 'electronics', 'stationery', 'clothing', 'prep-material', 'other'],
      default: 'other',
    },
    condition: { type: String, enum: ['new', 'like-new', 'good', 'fair'], default: 'good' },
    images: [{ type: String }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contact: { type: String, trim: true },
    sold: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    // ⭐ Program Personalization
    program: { type: String, default: null },     // Program ID this listing belongs to
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketListing', marketListingSchema);
