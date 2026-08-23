/**
 * The Razorpay purchase chain, end to end, against a stubbed gateway.
 *
 * tests/razorpay.test.js covers the primitives in isolation — the two HMACs and
 * the paise conversion. What it cannot see is whether the routes actually *use*
 * them correctly: a handler that verifies a signature and then activates the
 * wrong row, or grants access before checking the amount, passes every unit
 * test in that file while losing money here.
 *
 * So this exercises the real route handlers, the real activation logic and the
 * real price table. Only two things are fake:
 *
 *   the gateway   `fetch` is stubbed with a Razorpay Orders API that behaves
 *                 like the real one — same auth header, same paise amounts —
 *                 and records what it was sent, so the amount we charge is
 *                 asserted rather than assumed. Its 40-character receipt cap is
 *                 stricter than the live API measured on 2026-08-22, which
 *                 accepted 50; stricter is the safe direction for a stub, and
 *                 the receipts we build are ~22 characters either way.
 *
 *   the database  models are in-memory, as everywhere else in this suite.
 *
 * Signatures are NOT faked. Every signature in here is a genuine HMAC over the
 * genuine payload, computed with the test secrets, so the verification path is
 * the production one.
 *
 * The invariants, in the order money moves through them:
 *   1. the server prices the plan, never the client
 *   2. a payment activates only the order it was signed for, for its own buyer
 *   3. the browser and the webhook may both confirm the same payment, and the
 *      student gets exactly one month for it
 *   4. a renewal stacks on the remaining time instead of discarding it
 */
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const KEY_ID = 'rzp_test_chainsuite';
const KEY_SECRET = 'checkout_secret_material';
const WEBHOOK_SECRET = 'webhook_secret_material';

const oid = () => new mongoose.Types.ObjectId();
const BUYER = oid();
const OTHER_BUYER = oid();

// ---------------------------------------------------------------------------
// In-memory stand-ins for the two collections the chain touches.
// ---------------------------------------------------------------------------

const db = { users: new Map(), requests: [] };

const seedUser = (id, fields = {}) => {
  db.users.set(String(id), { _id: id, tier: 'free', tierExpiresAt: null, ...fields });
  return db.users.get(String(id));
};
const getUser = (id) => db.users.get(String(id));

/**
 * `User.findById(...).select(...).lean()` is the exact shape both the route and
 * activateSubscription call, so the mock has to be chainable rather than a
 * plain resolved value.
 */
const mockUserModel = {
  findById: jest.fn((id) => ({
    select: () => ({ lean: async () => getUser(id) || null }),
  })),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const user = getUser(id);
    if (user) Object.assign(user, update.$set || update);
    return user;
  }),
};

/**
 * A SubscriptionRequest document, complete with the `.save()` that
 * activateSubscription calls to flip its status. Mutations are visible through
 * the shared array, which is what lets a test assert that a rejected payment
 * left the row pending.
 */
const makeRequestDoc = (fields) => {
  const doc = {
    _id: oid(),
    status: 'pending',
    billing: 'monthly',
    provider: 'upi_manual',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: '',
    ...fields,
    save: jest.fn(async function save() { return this; }),
  };
  return doc;
};

const mockSubscriptionRequestModel = {
  create: jest.fn(async (fields) => {
    const doc = makeRequestDoc(fields);
    db.requests.push(doc);
    return doc;
  }),
  // Matches on whatever keys the caller supplied — /verify scopes by user,
  // the webhook looks up by order id alone.
  findOne: jest.fn(async (query) =>
    db.requests.find((doc) =>
      Object.entries(query).every(([key, value]) => String(doc[key]) === String(value))
    ) || null
  ),
  find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) })),
};

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/SubscriptionRequest', () => mockSubscriptionRequestModel);

const mockSentNotifications = [];
jest.mock('../notifications/NotificationService', () => ({
  send: jest.fn(async (user, payload) => { mockSentNotifications.push({ user: String(user), ...payload }); }),
}));
jest.mock('../controllers/notificationController', () => ({ notify: jest.fn(async () => {}) }));

// Auth and rate limiting are not what this file is testing; `req.user` is set
// directly by the caller below.
jest.mock('../middleware/verifyToken', () => (req, res, next) => next());
jest.mock('../middleware/rateLimiters', () => ({ heavyLimiter: (req, res, next) => next() }));

jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// ---------------------------------------------------------------------------
// The stubbed gateway.
// ---------------------------------------------------------------------------

/** Every order POST the server made, so the charged amount can be asserted. */
const gatewayCalls = [];
let orderCounter = 0;

function installGatewayStub() {
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body);
    gatewayCalls.push({ url, body, auth: options.headers.Authorization });

    const expectedAuth =
      'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    if (options.headers.Authorization !== expectedAuth) {
      return jsonResponse(401, { error: { description: 'Authentication failed' } });
    }
    // The real API rejects both of these, and both are silent-failure bugs on
    // our side if we ever send them.
    if (!Number.isInteger(body.amount) || body.amount <= 0) {
      return jsonResponse(400, { error: { description: 'amount must be a positive integer in paise' } });
    }
    if (String(body.receipt).length > 40) {
      return jsonResponse(400, { error: { description: 'receipt is too long' } });
    }

    orderCounter += 1;
    return jsonResponse(200, {
      id: `order_STUB${String(orderCounter).padStart(4, '0')}`,
      entity: 'order',
      amount: body.amount,
      amount_paid: 0,
      currency: body.currency,
      receipt: body.receipt,
      notes: body.notes,
      status: 'created',
    });
  });
}

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

// ---------------------------------------------------------------------------
// Driving the real router without an HTTP server.
// ---------------------------------------------------------------------------

let router;

/**
 * Run a route's middleware chain and resolve with what it answered.
 *
 * Errors handed to `next(err)` are surfaced as a rejection rather than being
 * swallowed — the routes delegate to the app error handler, which does not
 * exist here, and a test that silently saw `undefined` would be worthless.
 */
function callRoute(method, path, { user, body = {}, rawBody, headers = {} } = {}) {
  const layer = router.stack.find(
    (l) => l.route?.path === path && l.route.methods[method.toLowerCase()]
  );
  if (!layer) throw new Error(`No ${method} ${path} route registered`);

  const req = {
    method: method.toUpperCase(),
    body,
    rawBody,
    params: {},
    query: {},
    ...(user ? { user: { userId: String(user) } } : {}),
    get: (name) => headers[name.toLowerCase()],
  };

  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };

    const handlers = layer.route.stack.map((s) => s.handle);
    const run = (i) => (err) => {
      if (err) return reject(err);
      const handler = handlers[i];
      if (!handler) return resolve({ status: 404, body: undefined });
      try {
        const out = handler(req, res, run(i + 1));
        if (out?.catch) out.catch(reject);
      } catch (thrown) {
        reject(thrown);
      }
    };
    run(0)();
  });
}

// ---------------------------------------------------------------------------
// Real signatures over real payloads.
// ---------------------------------------------------------------------------

const checkoutSignature = (orderId, paymentId, secret = KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

/** Builds the webhook body Razorpay actually posts, and signs the raw bytes. */
const webhookEvent = ({ event = 'payment.captured', orderId, paymentId = 'pay_STUB', amount, errorDescription }) => {
  const payload = {
    event,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount,
          currency: 'INR',
          status: event === 'payment.captured' ? 'captured' : 'failed',
          ...(errorDescription ? { error_description: errorDescription } : {}),
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  return {
    body: payload,
    rawBody,
    signature: crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex'),
  };
};

const postWebhook = (evt, { signature = evt.signature } = {}) =>
  callRoute('post', '/webhook', {
    body: evt.body,
    rawBody: evt.rawBody,
    headers: { 'x-razorpay-signature': signature },
  });

/** Walk the full browser path: open an order, then confirm it. */
async function buy(user, { tier = 'pro', billing = 'monthly', extraBody = {} } = {}) {
  const order = await callRoute('post', '/order', { user, body: { tier, billing, ...extraBody } });
  const orderId = order.body.orderId;
  const paymentId = `pay_FOR_${orderId}`;
  const verify = await callRoute('post', '/verify', {
    user,
    body: {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: checkoutSignature(orderId, paymentId),
    },
  });
  return { order, verify, orderId, paymentId };
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
/** Month lengths vary, so expiries are compared with a few days of slack. */
const daysBetween = (a, b) => (new Date(a) - new Date(b)) / (24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------

describe('razorpay purchase chain (stubbed gateway)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.users.clear();
    db.requests.length = 0;
    gatewayCalls.length = 0;
    mockSentNotifications.length = 0;
    orderCounter = 0;

    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

    installGatewayStub();

    jest.resetModules();
    router = require('../routes/subscriptionRoutes');

    seedUser(BUYER);
    seedUser(OTHER_BUYER);
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete global.fetch;
  });

  // -- 1. the server prices the plan ----------------------------------------

  describe('opening an order', () => {
    it('reports the gateway as live and hands the browser the public key id', async () => {
      const res = await callRoute('get', '/config', { user: BUYER });
      expect(res.body).toEqual({ gateway: 'razorpay', keyId: KEY_ID, testMode: true });
    });

    it('charges the price from the server table, in paise', async () => {
      const res = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro', billing: 'monthly' } });

      expect(res.status).toBe(201);
      // ₹149 must reach the gateway as 14900. Sending 149 would charge ₹1.49
      // and every log line in the system would still read "149".
      expect(gatewayCalls[0].body.amount).toBe(14900);
      expect(gatewayCalls[0].body.currency).toBe('INR');
      expect(res.body.amount).toBe(14900);
    });

    it('ignores an amount the browser claims', async () => {
      // The one that matters: without server-side pricing a student buys the
      // Placement Pass for ₹1 by editing the request.
      await callRoute('post', '/order', {
        user: BUYER,
        body: { tier: 'placement', billing: 'onetime', amount: 1, amountPaise: 100 },
      });

      expect(gatewayCalls[0].body.amount).toBe(99900);
      expect(db.requests[0].amountPaid).toBe(999);
    });

    it('forces a tier onto a billing cycle it is actually sold on', async () => {
      // Placement is a one-time pass. Asking for it monthly must not produce a
      // monthly-priced order for a four-month grant.
      await callRoute('post', '/order', { user: BUYER, body: { tier: 'placement', billing: 'monthly' } });

      expect(db.requests[0].billing).toBe('onetime');
      expect(gatewayCalls[0].body.amount).toBe(99900);
    });

    it('rejects a tier that is not sold, without calling the gateway', async () => {
      const res = await callRoute('post', '/order', { user: BUYER, body: { tier: 'enterprise' } });

      expect(res.status).toBe(400);
      expect(gatewayCalls).toHaveLength(0);
    });

    it('keeps the receipt inside the 40 characters the API accepts', async () => {
      await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro', billing: 'yearly' } });
      expect(gatewayCalls[0].body.receipt.length).toBeLessThanOrEqual(40);
    });

    it('records the order as pending before the student pays', async () => {
      const res = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro', billing: 'monthly' } });

      // The row is what the webhook finds when the browser never comes back.
      expect(db.requests[0]).toMatchObject({
        status: 'pending',
        provider: 'razorpay',
        tier: 'pro',
        razorpayOrderId: res.body.orderId,
      });
      expect(getUser(BUYER).tier).toBe('free');
    });

    it('falls back to manual UPI when the keys are absent', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      jest.resetModules();
      router = require('../routes/subscriptionRoutes');

      const config = await callRoute('get', '/config', { user: BUYER });
      expect(config.body.gateway).toBe('manual');
      expect(config.body.keyId).toBeNull();

      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro' } });
      expect(order.status).toBe(503);
      expect(gatewayCalls).toHaveLength(0);
    });
  });

  // -- 2. a payment activates only the order it was signed for ---------------

  describe('confirming from the browser', () => {
    it('grants the plan for a genuine payment', async () => {
      const { verify, paymentId } = await buy(BUYER);

      expect(verify.status).toBe(200);
      expect(getUser(BUYER).tier).toBe('pro');
      expect(daysBetween(getUser(BUYER).tierExpiresAt, Date.now())).toBeGreaterThan(27);
      expect(daysBetween(getUser(BUYER).tierExpiresAt, Date.now())).toBeLessThan(32);

      // The payment id replaces the order id as the reference once captured.
      expect(db.requests[0].status).toBe('approved');
      expect(db.requests[0].razorpayPaymentId).toBe(paymentId);
      expect(getUser(BUYER).subscriptionRef).toBe(paymentId);
    });

    it('grants four months for the placement pass, not one', async () => {
      await buy(BUYER, { tier: 'placement', billing: 'onetime' });

      expect(getUser(BUYER).tier).toBe('placement');
      expect(daysBetween(getUser(BUYER).tierExpiresAt, Date.now())).toBeGreaterThan(115);
    });

    it('grants a year for the yearly plan', async () => {
      await buy(BUYER, { tier: 'pro', billing: 'yearly' });
      expect(daysBetween(getUser(BUYER).tierExpiresAt, Date.now())).toBeGreaterThan(360);
    });

    it('refuses a forged signature and leaves the order pending', async () => {
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro' } });
      const orderId = order.body.orderId;

      const res = await callRoute('post', '/verify', {
        user: BUYER,
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_FORGED',
          razorpay_signature: checkoutSignature(orderId, 'pay_FORGED', 'not_the_real_secret'),
        },
      });

      expect(res.status).toBe(400);
      expect(getUser(BUYER).tier).toBe('free');
      expect(db.requests[0].status).toBe('pending');
    });

    it('refuses a cheap payment presented against an expensive order', async () => {
      // Both orders are real and both signatures are real — the attack is
      // pairing the ₹149 payment with the ₹999 order.
      const cheap = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro', billing: 'monthly' } });
      const dear = await callRoute('post', '/order', { user: BUYER, body: { tier: 'placement' } });
      const paymentId = 'pay_CHEAP';

      const res = await callRoute('post', '/verify', {
        user: BUYER,
        body: {
          razorpay_order_id: dear.body.orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: checkoutSignature(cheap.body.orderId, paymentId),
        },
      });

      expect(res.status).toBe(400);
      expect(getUser(BUYER).tier).toBe('free');
    });

    it('will not let one student redeem another student’s payment', async () => {
      // A valid signature proves the payment is real, not that the person
      // presenting it is the one who made it.
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro' } });
      const orderId = order.body.orderId;
      const paymentId = 'pay_SOMEONE_ELSE';

      const res = await callRoute('post', '/verify', {
        user: OTHER_BUYER,
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: checkoutSignature(orderId, paymentId),
        },
      });

      expect(res.status).toBe(404);
      expect(getUser(OTHER_BUYER).tier).toBe('free');
      expect(getUser(BUYER).tier).toBe('free');
    });
  });

  // -- 3. the webhook is the authority --------------------------------------

  describe('confirming from the webhook', () => {
    it('activates the plan when the browser never came back', async () => {
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro', billing: 'monthly' } });

      const res = await postWebhook(webhookEvent({ orderId: order.body.orderId, amount: 14900 }));

      expect(res.status).toBe(200);
      expect(getUser(BUYER).tier).toBe('pro');
      expect(db.requests[0].status).toBe('approved');
    });

    it('rejects an unsigned or tampered event', async () => {
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro' } });
      const evt = webhookEvent({ orderId: order.body.orderId, amount: 14900 });

      // Same signature, body altered after signing — the signature is over the
      // raw bytes, so this must not validate.
      const tampered = { ...evt, rawBody: evt.rawBody.replace('14900', '100') };
      const res = await postWebhook(tampered);

      expect(res.status).toBe(400);
      expect(getUser(BUYER).tier).toBe('free');
    });

    it('refuses to grant access on an amount that does not match the plan', async () => {
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'placement' } });

      // Correctly signed, genuinely from the gateway, but ₹149 against a ₹999
      // plan. Answers 200 so Razorpay stops retrying; grants nothing.
      const res = await postWebhook(webhookEvent({ orderId: order.body.orderId, amount: 14900 }));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ mismatch: true });
      expect(getUser(BUYER).tier).toBe('free');
      expect(db.requests[0].status).toBe('pending');
    });

    it('marks a failed payment rejected and grants nothing', async () => {
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro' } });

      await postWebhook(webhookEvent({
        event: 'payment.failed',
        orderId: order.body.orderId,
        amount: 14900,
        errorDescription: 'Payment was declined by the bank',
      }));

      expect(getUser(BUYER).tier).toBe('free');
      expect(db.requests[0].status).toBe('rejected');
      expect(db.requests[0].reviewNote).toBe('Payment was declined by the bank');
    });

    it('answers 200 for an order it has never heard of', async () => {
      // A 4xx here would put Razorpay into a retry loop for hours.
      const res = await postWebhook(webhookEvent({ orderId: 'order_UNKNOWN', amount: 14900 }));
      expect(res.status).toBe(200);
    });

    it('answers 200 for events it does not handle', async () => {
      const res = await postWebhook(webhookEvent({ event: 'refund.processed', orderId: 'order_X', amount: 1 }));
      expect(res.status).toBe(200);
    });

    it('is unavailable rather than credulous when the secret is unset', async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      jest.resetModules();
      router = require('../routes/subscriptionRoutes');

      const res = await postWebhook(webhookEvent({ orderId: 'order_X', amount: 14900 }));
      expect(res.status).toBe(503);
    });
  });

  // -- 4. one payment, one month --------------------------------------------

  describe('double confirmation and renewal', () => {
    it('grants one month when the browser and the webhook both confirm', async () => {
      const { orderId, paymentId } = await buy(BUYER);
      const afterBrowser = getUser(BUYER).tierExpiresAt;

      const res = await postWebhook(webhookEvent({ orderId, paymentId, amount: 14900 }));

      expect(res.status).toBe(200);
      expect(getUser(BUYER).tierExpiresAt).toEqual(afterBrowser);
    });

    it('answers the browser without re-granting when the webhook won the race', async () => {
      const order = await callRoute('post', '/order', { user: BUYER, body: { tier: 'pro' } });
      const orderId = order.body.orderId;
      const paymentId = 'pay_RACE';

      await postWebhook(webhookEvent({ orderId, paymentId, amount: 14900 }));
      const afterWebhook = getUser(BUYER).tierExpiresAt;

      const verify = await callRoute('post', '/verify', {
        user: BUYER,
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: checkoutSignature(orderId, paymentId),
        },
      });

      expect(verify.status).toBe(200);
      expect(verify.body.tier).toBe('pro');
      expect(getUser(BUYER).tierExpiresAt).toEqual(afterWebhook);
    });

    it('extends an unexpired plan instead of resetting it', async () => {
      // Renewing on day 25 must not throw away the five days already paid for.
      const remaining = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      seedUser(BUYER, { tier: 'pro', tierExpiresAt: remaining });

      await buy(BUYER, { tier: 'pro', billing: 'monthly' });

      const days = daysBetween(getUser(BUYER).tierExpiresAt, Date.now());
      expect(days).toBeGreaterThan(33);   // 5 remaining + a full month
      expect(days).toBeLessThan(37);
    });

    it('starts fresh when the student switches to a different plan', async () => {
      seedUser(BUYER, { tier: 'pro', tierExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });

      await buy(BUYER, { tier: 'placement', billing: 'onetime' });

      const days = daysBetween(getUser(BUYER).tierExpiresAt, Date.now());
      expect(days).toBeGreaterThan(115);
      expect(days).toBeLessThan(125);     // four months from today, not from the old expiry
    });

    it('does not stack onto a plan that has already lapsed', async () => {
      seedUser(BUYER, { tier: 'pro', tierExpiresAt: new Date(Date.now() - MONTH_MS) });

      await buy(BUYER, { tier: 'pro', billing: 'monthly' });

      const days = daysBetween(getUser(BUYER).tierExpiresAt, Date.now());
      expect(days).toBeGreaterThan(27);
      expect(days).toBeLessThan(32);
    });

    it('tells the student their plan is live, once', async () => {
      const { orderId, paymentId } = await buy(BUYER);
      await postWebhook(webhookEvent({ orderId, paymentId, amount: 14900 }));

      const billing = mockSentNotifications.filter((n) => n.type === 'billing');
      expect(billing).toHaveLength(1);
      expect(billing[0].user).toBe(String(BUYER));
    });
  });
});
