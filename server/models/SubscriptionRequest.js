const mongoose = require('mongoose');

const subscriptionRequestSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tier:         { type: String, enum: ['pro', 'placement'], required: true },
    // Which cycle was purchased. Without this the approver cannot know how long
    // to grant, and every approval defaulted to one month — so a yearly Pro
    // purchase delivered a twelfth of what it charged for.
    billing:      { type: String, enum: ['monthly', 'yearly', 'onetime'], default: 'monthly' },
    amountPaid:   { type: Number, required: true },
    paymentRef:   { type: String, required: true, trim: true, maxlength: 100 },
    upiId:        { type: String, trim: true, maxlength: 60 },  // payer UPI (optional)
    note:         { type: String, trim: true, maxlength: 300 },
    status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:   { type: Date, default: null },
    reviewNote:   { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

subscriptionRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SubscriptionRequest', subscriptionRequestSchema);
