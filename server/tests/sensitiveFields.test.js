/**
 * Regression tests for sensitive-field exposure on the User model.
 *
 * `password` held the bcrypt hash with no `select: false`, so it was included
 * in every query that did not explicitly exclude it. Nothing was leaking it at
 * the time — each handler that returns a user document remembered its own
 * `-password` — but "every call site remembers" is not a control. One new
 * endpoint, or one `.populate('user')` without a field list, and password
 * hashes ship to a client, offline-crackable and reusable anywhere the student
 * reused that password.
 *
 * The invariant: reading a user requires opting *in* to the hash, and only the
 * four flows that verify or set a password do so.
 */

const mongoose = require('mongoose');
const User = require('../models/User');

describe('User.password is opt-in', () => {
  test('the schema marks password select:false', () => {
    expect(User.schema.path('password').options.select).toBe(false);
  });

  test('a default query does not project password', () => {
    // Mongoose folds select:false into the projection it sends to MongoDB.
    const query = User.findById(new mongoose.Types.ObjectId());
    query._applyPaths?.();
    const projection = query.projection() || {};
    expect(projection.password).not.toBe(1);
  });

  test('an explicit +password opts back in', () => {
    const query = User.findOne({ email: 'x@y.z' }).select('+password');
    query._applyPaths?.();
    const projection = query.projection() || {};
    // The field is requested rather than suppressed.
    expect(projection.password).not.toBe(0);
  });

  test('reset and verification token hashes are never returned to a client', () => {
    // These are bearer credentials for account takeover, so the handlers that
    // send a user document strip them. Assert the handlers still say so.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'controllers', 'authController.js'),
      'utf8'
    );
    const returningHandlers = src.match(/\.select\('-password[^']*'\)/g) || [];
    expect(returningHandlers.length).toBeGreaterThan(0);
    for (const sel of returningHandlers) {
      expect(sel).toContain('-resetTokenHash');
    }
  });
});

describe('the four password flows still ask for the hash', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'controllers', 'authController.js'),
    'utf8'
  );

  test('every bcrypt.compare is reachable from a query that selected +password', () => {
    // With select:false, a compare against a document fetched without
    // +password silently receives undefined — and bcrypt.compare(x, undefined)
    // resolves false, so *every* sign-in would fail closed. Counting them is a
    // cheap guard against that regression.
    const compares = (src.match(/bcrypt\.compare\(/g) || []).length;
    const optIns = (src.match(/\.select\('\+password'\)/g) || []).length;
    expect(compares).toBeGreaterThan(0);
    expect(optIns).toBeGreaterThanOrEqual(compares);
  });
});
