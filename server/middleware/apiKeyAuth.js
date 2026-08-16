const ApiKey = require('../models/ApiKey');

async function apiKeyAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <key>' });
  }

  const key = auth.slice(7);
  const record = await ApiKey.findOne({ key, active: true });

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
}

module.exports = apiKeyAuth;
