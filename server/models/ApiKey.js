const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Developer API keys for /api/v1.
 *
 * The `key` column holds a SHA-256 hash, never the key itself. A key is a
 * bearer credential: anything that can read this collection — a database dump,
 * a backup on someone's laptop, a read-only analytics replica, an aggregation
 * pipeline in a support tool — could otherwise authenticate as any developer
 * who ever generated one, and there would be no trace of it. Hashing means a
 * leaked collection yields nothing usable.
 *
 * Plain SHA-256 rather than bcrypt/scrypt on purpose. Password hashes are
 * slowed down because passwords are low-entropy and guessable; these keys are
 * 32 bytes from crypto.randomBytes, so there is nothing to brute-force, and
 * this runs on every request to the public API.
 *
 * The hash goes in the pre-existing `key` field rather than a new column
 * because that field already carries a unique index in the deployed database.
 * Moving to a new field would leave every new row with `key: null`, and a
 * non-sparse unique index permits exactly one null — the second key created
 * after deploy would fail with a duplicate-key error. Hashes are unique, so
 * reusing the column keeps that index correct with no migration.
 */
const apiKeySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    // SHA-256 of the issued key. See the note above — never the key itself.
    key: { type: String, unique: true, required: true },
    // Leading characters of the issued key, so the UI can tell two keys apart
    // in a list without the plaintext existing anywhere. Not a secret: it is
    // far too short to narrow a 32-byte random value.
    keyPrefix: { type: String },
    scopes: { type: [String], default: ['read'] },     // read, write, admin
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Hash a presented key into the form stored in the `key` column. */
apiKeySchema.statics.hash = function (raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
};

/**
 * Issue a new key.
 *
 * The raw key is returned on the resolved document as a non-persisted `raw`
 * property and is not recoverable afterwards — the caller must show it to the
 * developer once. That is the whole point of storing only the hash.
 */
apiKeySchema.statics.generate = async function (name, userId, scopes = ['read']) {
  const raw = `datad_${crypto.randomBytes(32).toString('hex')}`;
  const doc = await this.create({
    name,
    user: userId,
    key: this.hash(raw),
    keyPrefix: raw.slice(0, 14),
    scopes,
  });
  // Attached, not saved: `raw` is not in the schema, so it never reaches Mongo.
  doc.raw = raw;
  return doc;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
