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
    // How the money arrived. 'upi_manual' is the original flow — the student
    // transfers by UPI and an admin verifies the reference by hand.
    provider:     { type: String, enum: ['upi_manual', 'razorpay'], default: 'upi_manual', index: true },
    // For a Razorpay purchase this starts as the order id (the only identifier
    // that exists before the student pays) and is replaced by the payment id
    // once the payment is captured. It is what lands in User.subscriptionRef.
    paymentRef:   { type: String, required: true, trim: true, maxlength: 100 },
    razorpayOrderId:   { type: String, trim: true, index: true, sparse: true },
    razorpayPaymentId: { type: String, trim: true },
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
