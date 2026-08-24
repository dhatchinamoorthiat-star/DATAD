/**
 * P5 regression — the Content-Security-Policy header.
 *
 * Carried forward from the production-readiness audit as "CSP disabled". It was
 * listed separately from "JWT in localStorage", and the two are really one
 * finding: a token in localStorage is readable by any script on the origin, so
 * its only protection is that no attacker script ever runs. CSP is the control
 * that keeps that true when an XSS hole exists. With the header off there was
 * no second layer at all.
 *
 * These tests exist mostly to stop the header being switched off again. It was
 * disabled for a real reason — external cover images — so the first assertion
 * below is that those still load, and the rest is the policy that protects the
 * token.
 */

const express = require('express');
const helmet = require('helmet');
const { startTestServer } = require('./helpers/httpAgent');
const { directives, cspOptions } = require('../config/csp');

/** Parse a CSP header into { directive: [values] }. */
function parse(header) {
  const out = {};
  for (const part of String(header || '').split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    out[name] = values;
  }
  return out;
}

async function headersFrom(env = {}) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  const app = express();
  app.use(helmet({ contentSecurityPolicy: cspOptions() }));
  app.get('/', (req, res) => res.json({ ok: true }));
  const server = await startTestServer(app);

  try {
    const res = await server.request('GET', '/');
    return res.headers;
  } finally {
    await server.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('the CSP header is actually sent', () => {
  it('sets Content-Security-Policy on a response', async () => {
    const headers = await headersFrom({ CSP_REPORT_ONLY: undefined });
    expect(headers['content-security-policy']).toBeTruthy();
  });

  it('can be run in report-only mode for a safe rollout', async () => {
    // A CSP that breaks the app gets turned off, and then this whole file is
    // pointless. Report-only is how it gets rolled out instead.
    const headers = await headersFrom({ CSP_REPORT_ONLY: 'true' });
    expect(headers['content-security-policy-report-only']).toBeTruthy();
    expect(headers['content-security-policy']).toBeUndefined();
  });
});

describe('the policy blocks script injection', () => {
  const d = () => directives();

  it('restricts scripts to same-origin and the payment gateway', () => {
    // Razorpay Checkout is the only third-party script the app loads, and it
    // is pinned to the exact checkout host — not a *.razorpay.com wildcard,
    // which would widen the trusted set to every subdomain they ever run.
    expect(d().scriptSrc).toEqual(["'self'", 'https://checkout.razorpay.com']);
  });

  it("does not allow 'unsafe-inline' or 'unsafe-eval' for scripts", () => {
    // With either of these, the policy is decorative against reflected XSS —
    // which is the exact attack that would read the JWT out of localStorage.
    expect(d().scriptSrc).not.toContain("'unsafe-inline'");
    expect(d().scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('blocks inline event-handler attributes', () => {
    expect(d().scriptSrcAttr).toEqual(["'none'"]);
  });

  it('locks base-uri, so an injected <base> cannot repoint relative scripts', () => {
    // The standard bypass of script-src 'self'.
    expect(d().baseUri).toEqual(["'self'"]);
  });

  it('blocks plugins, and frames anything but the payment window', () => {
    expect(d().objectSrc).toEqual(["'none'"]);
    // Razorpay Checkout renders itself in an api.razorpay.com iframe. Nothing
    // else in the app embeds a frame, so the list stays exactly this long.
    expect(d().frameSrc).toEqual([
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
    ]);
  });

  it('blocks framing, so the app cannot be clickjacked', () => {
    expect(d().frameAncestors).toEqual(["'none'"]);
  });

  it('restricts form submission to this origin and the gateway', () => {
    // Card and netbanking payments POST to Razorpay, which redirects on to the
    // bank. Everything else — anything that could carry a session or a profile
    // off-origin — still has nowhere to go.
    expect(d().formAction).toEqual(["'self'", 'https://api.razorpay.com']);
  });
});

describe('the policy does not break the app', () => {
  it('still allows the external cover images that caused it to be disabled', () => {
    // The original and entirely legitimate objection. Unsplash and Google
    // Photos have to keep working, and an image source cannot execute script.
    expect(directives().imgSrc).toEqual(expect.arrayContaining(['https:', 'data:', 'blob:']));
  });

  it('allows the inline styles Tailwind and the animations emit', () => {
    expect(directives().styleSrc).toContain("'unsafe-inline'");
  });

  it('allows the service worker', () => {
    expect(directives().workerSrc).toEqual(expect.arrayContaining(["'self'", 'blob:']));
  });

  it('allows the API origin when the client is served from a different host', async () => {
    // Vercel client, Render API. Getting this wrong blocks every fetch in
    // production and is the most likely way this policy breaks the deployment.
    const saved = process.env.CLIENT_URL;
    process.env.CLIENT_URL = 'https://datad.app';
    try {
      expect(directives().connectSrc).toContain('https://datad.app');
    } finally {
      if (saved === undefined) delete process.env.CLIENT_URL;
      else process.env.CLIENT_URL = saved;
    }
  });

  it('allows Sentry ingest only when a DSN is configured', () => {
    const saved = process.env.SENTRY_DSN;
    try {
      delete process.env.SENTRY_DSN;
      delete process.env.VITE_SENTRY_DSN;
      expect(directives().connectSrc).not.toContain('https://*.ingest.sentry.io');

      process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
      expect(directives().connectSrc).toContain('https://*.ingest.sentry.io');
    } finally {
      if (saved === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = saved;
    }
  });

  it('does not upgrade insecure requests in development', () => {
    // localhost is served over plain http; this directive would rewrite it.
    const saved = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      expect(directives().upgradeInsecureRequests).toBeUndefined();
      process.env.NODE_ENV = 'production';
      expect(directives().upgradeInsecureRequests).toEqual([]);
    } finally {
      process.env.NODE_ENV = saved;
    }
  });
});

describe('index.js keeps the policy switched on', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs
    .readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('does not disable contentSecurityPolicy', () => {
    // The single line this whole finding was.
    expect(source).not.toMatch(/contentSecurityPolicy:\s*false/);
    expect(source).toMatch(/contentSecurityPolicy:\s*require\('\.\/config\/csp'\)\.cspOptions\(\)/);
  });
});
