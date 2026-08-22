/**
 * Public-API key authentication.
 *
 * The property under test is that the plaintext key is never what is matched
 * against storage: keys live in the database as SHA-256 hashes, so a dump of
 * the collection yields nothing that can authenticate. Keys issued before
 * hashing existed are still accepted once, and upgraded in place.
 *
 * No database — the model is mocked, so this runs everywhere.
 */

const crypto = require('crypto');

jest.mock('../models/ApiKey');
jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const ApiKey = require('../models/ApiKey');
const apiKeyAuth = require('../middleware/apiKeyAuth');

const RAW = 'datad_' + 'a'.repeat(64);
const HASH = crypto.createHash('sha256').update(RAW).digest('hex');

// The real static is a pure function; the automock replaces it, so restore it.
ApiKey.hash = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

const makeReq = (auth) => ({ headers: auth ? { authorization: auth } : {} });
const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  ApiKey.updateOne = jest.fn().mockResolvedValue({});
});

describe('rejecting a request outright', () => {
  it.each([
    ['no Authorization header', undefined],
    ['a non-bearer scheme', 'Basic abc'],
    ['a bearer prefix without the space', 'Bearerabc'],
  ])('401s on %s', async (_label, header) => {
    const res = makeRes();
    const next = jest.fn();
    await apiKeyAuth(makeReq(header), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    // Nothing was looked up, so an unauthenticated flood cannot cost queries.
    expect(ApiKey.findOne).not.toHaveBeenCalled();
  });

  it('401s when the key matches nothing', async () => {
    ApiKey.findOne = jest.fn().mockResolvedValue(null);
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(makeReq(`Bearer ${RAW}`), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on an expired key rather than authenticating it', async () => {
    ApiKey.findOne = jest.fn().mockResolvedValue({
      _id: 'k1', user: 'u1', scopes: ['read'],
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(makeReq(`Bearer ${RAW}`), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('matching against the stored hash', () => {
  it('looks the key up by its hash, never by the key itself', async () => {
    ApiKey.findOne = jest.fn().mockResolvedValue({ _id: 'k1', user: 'u1', scopes: ['read'] });
    const req = makeReq(`Bearer ${RAW}`);
    const next = jest.fn();

    await apiKeyAuth(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(ApiKey.findOne).toHaveBeenCalledWith({ key: HASH, active: true });
    // The decisive assertion: the plaintext was never used as a query value.
    const queried = ApiKey.findOne.mock.calls.map(([q]) => q.key);
    expect(queried).not.toContain(RAW);
  });

  it('attaches the caller identity the /api/v1 routes scope every query to', async () => {
    ApiKey.findOne = jest.fn().mockResolvedValue({ _id: 'k1', user: 'u42', scopes: ['read', 'write'] });
    const req = makeReq(`Bearer ${RAW}`);

    await apiKeyAuth(req, makeRes(), jest.fn());

    expect(req.apiUser).toBe('u42');
    expect(req.apiScopes).toEqual(['read', 'write']);
  });

  it('ignores an inactive key', async () => {
    ApiKey.findOne = jest.fn().mockResolvedValue(null);
    await apiKeyAuth(makeReq(`Bearer ${RAW}`), makeRes(), jest.fn());

    // `active: true` is part of both lookups, so a revoked key cannot match.
    for (const [query] of ApiKey.findOne.mock.calls) {
      expect(query.active).toBe(true);
    }
  });
});

describe('legacy plaintext keys', () => {
  it('accepts a pre-hashing key and rewrites it to its hash', async () => {
    const legacy = { _id: 'k1', user: 'u1', scopes: ['read'], key: RAW, save: jest.fn().mockResolvedValue({}) };
    ApiKey.findOne = jest.fn()
      .mockResolvedValueOnce(null)     // no hashed row
      .mockResolvedValueOnce(legacy);  // plaintext row
    const req = makeReq(`Bearer ${RAW}`);
    const next = jest.fn();

    await apiKeyAuth(req, makeRes(), next);

    // The integration keeps working…
    expect(next).toHaveBeenCalledWith();
    expect(req.apiUser).toBe('u1');
    // …and the plaintext stops existing.
    expect(legacy.key).toBe(HASH);
    expect(legacy.save).toHaveBeenCalled();
  });

  it('gives an upgraded row a prefix so the UI can still identify it', async () => {
    const legacy = { _id: 'k1', user: 'u1', scopes: ['read'], key: RAW, save: jest.fn().mockResolvedValue({}) };
    ApiKey.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(legacy);

    await apiKeyAuth(makeReq(`Bearer ${RAW}`), makeRes(), jest.fn());

    expect(legacy.keyPrefix).toBe(RAW.slice(0, 14));
  });

  it('does not fall back to plaintext once a hashed row matches', async () => {
    ApiKey.findOne = jest.fn().mockResolvedValue({ _id: 'k1', user: 'u1', scopes: ['read'] });

    await apiKeyAuth(makeReq(`Bearer ${RAW}`), makeRes(), jest.fn());

    expect(ApiKey.findOne).toHaveBeenCalledTimes(1);
  });
});

describe('failure handling', () => {
  it('passes a database error to next() instead of leaving the request hanging', async () => {
    // Express 4 does not catch a rejected promise from an async middleware, so
    // without the try/catch this rejection would surface as an unhandled
    // rejection and the client would wait until it gave up.
    const boom = new Error('connection lost');
    ApiKey.findOne = jest.fn().mockRejectedValue(boom);
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(makeReq(`Bearer ${RAW}`), res, next);

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.status).not.toHaveBeenCalled();
  });
});
