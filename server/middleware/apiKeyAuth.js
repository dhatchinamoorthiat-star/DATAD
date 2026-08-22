const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

/**
 * Authenticate a request to the public API (/api/v1) by developer API key.
 *
 * Keys are stored hashed (see models/ApiKey.js), so the presented key is
 * hashed and matched against that. Keys issued before hashing existed are
 * still sitting in the database in plaintext; rather than invalidating them —
 * which would break every integration built against them with no warning —
 * a plaintext match is accepted once and the row is rewritten to its hash on
 * the spot. The key keeps working, and the plaintext stops existing after its
 * owner next uses it.
 */
async function apiKeyAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <key>' });
  }

  const presented = auth.slice(7);

  try {
    const hashed = ApiKey.hash(presented);
    let record = await ApiKey.findOne({ key: hashed, active: true });

    if (!record) {
      // Legacy plaintext row. Matching on the presented value is exactly the
      // old behaviour, kept only until the row is upgraded below.
      const legacy = await ApiKey.findOne({ key: presented, active: true });
      if (legacy) {
        legacy.key = hashed;
        legacy.keyPrefix = legacy.keyPrefix || presented.slice(0, 14);
        await legacy.save();
        logger.info('Upgraded a plaintext API key to its hash', {
          apiKeyId: String(legacy._id),
        });
        record = legacy;
      }
    }

    if (!record) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    await ApiKey.updateOne({ _id: record._id }, { $set: { lastUsedAt: new Date() } });

    req.apiKey = record;
    req.apiUser = record.user;
    req.apiScopes = record.scopes;
    next();
  } catch (err) {
    // Express 4 does not catch a rejected promise from an async middleware.
    // Without this the request would hang until the client gave up, and the
    // failure would surface only as an unhandled rejection.
    next(err);
  }
}

module.exports = apiKeyAuth;
