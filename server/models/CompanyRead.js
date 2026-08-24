const mongoose = require('mongoose');

// Records that a user opened a company prep card — one per (user, company).
// Powers the "company research" slice of the placement readiness score.
const companyReadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

companyReadSchema.index({ user: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('CompanyRead', companyReadSchema);
