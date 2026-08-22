/**
 * CORS origin allow-list.
 *
 * The rule these protect: a browser's Origin header is always exactly
 * `scheme://host[:port]` with no path and no trailing slash, while CLIENT_URL
 * is typed by a human into a hosting dashboard. Those two only meet if the
 * configured value is normalised — and the failure when they don't is
 * production-only and badly misleading, because emailed links keep working.
 */

const ORIGINAL = process.env.CLIENT_URL;
const ORIGINAL_ENV = process.env.NODE_ENV;

// The module reads process.env on every call, so no cache reset is needed —
// but each test must restore what it changed.
const clientUrl = require('../utils/clientUrl');

afterEach(() => {
  process.env.CLIENT_URL = ORIGINAL;
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe('isAllowedCorsOrigin', () => {
  it('accepts an exactly-matching origin', () => {
    process.env.CLIENT_URL = 'https://datad.app';
    expect(clientUrl.isAllowedCorsOrigin('https://datad.app')).toBe(true);
  });

  it('accepts every entry in a comma-separated allow-list', () => {
    process.env.CLIENT_URL = 'https://datad.app,https://www.datad.app,http://localhost:5173';
    expect(clientUrl.isAllowedCorsOrigin('https://www.datad.app')).toBe(true);
    expect(clientUrl.isAllowedCorsOrigin('http://localhost:5173')).toBe(true);
  });

  it('tolerates a trailing slash in the configured value', () => {
    // The regression this file exists for. A browser never sends the slash, so
    // without normalisation this configuration rejects the real front end.
    process.env.CLIENT_URL = 'https://datad.app/';
    expect(clientUrl.isAllowedCorsOrigin('https://datad.app')).toBe(true);
  });

  it('tolerates surrounding whitespace after a comma', () => {
    process.env.CLIENT_URL = 'https://datad.app, https://www.datad.app/';
    expect(clientUrl.isAllowedCorsOrigin('https://www.datad.app')).toBe(true);
  });

  it('still rejects a host that merely looks similar', () => {
    process.env.CLIENT_URL = 'https://datad.app';
    expect(clientUrl.isAllowedCorsOrigin('https://datad.app.evil.com')).toBe(false);
    expect(clientUrl.isAllowedCorsOrigin('https://notdatad.app')).toBe(false);
    // Protocol is part of the origin, not decoration.
    expect(clientUrl.isAllowedCorsOrigin('http://datad.app')).toBe(false);
  });

  it('rejects an empty or missing origin', () => {
    process.env.CLIENT_URL = 'https://datad.app';
    process.env.NODE_ENV = 'production';
    expect(clientUrl.isAllowedCorsOrigin('')).toBe(false);
    expect(clientUrl.isAllowedCorsOrigin(undefined)).toBe(false);
  });

  it('allows a dev tunnel outside production, never inside it', () => {
    process.env.CLIENT_URL = 'https://datad.app';

    process.env.NODE_ENV = 'development';
    expect(clientUrl.isAllowedCorsOrigin('https://abc-123.ngrok-free.app')).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(clientUrl.isAllowedCorsOrigin('https://abc-123.ngrok-free.app')).toBe(false);
  });
});

describe('primaryClientUrl', () => {
  it('is the first entry, normalised', () => {
    process.env.CLIENT_URL = 'https://datad.app/,https://www.datad.app';
    expect(clientUrl.primaryClientUrl()).toBe('https://datad.app');
  });

  it('agrees with the CORS check on the same configuration', () => {
    // The invariant the module header claims: the emailed-link host and the
    // CORS allow-list cannot drift apart.
    for (const configured of ['https://datad.app', 'https://datad.app/', ' https://datad.app/ ']) {
      process.env.CLIENT_URL = configured;
      const emailed = clientUrl.primaryClientUrl();
      expect(clientUrl.isAllowedCorsOrigin(emailed)).toBe(true);
    }
  });

  it('falls back to the local dev origin when unset', () => {
    delete process.env.CLIENT_URL;
    expect(clientUrl.primaryClientUrl()).toBe('http://localhost:5174');
  });
});
