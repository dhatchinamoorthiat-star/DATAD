const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    key: { type: String, unique: true, required: true },
    scopes: { type: [String], default: ['read'] },     // read, write, admin
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

apiKeySchema.statics.generate = function (name, userId, scopes = ['read']) {
  const raw = `datad_${crypto.randomBytes(32).toString('hex')}`;
  return this.create({ name, user: userId, key: raw, scopes });
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
