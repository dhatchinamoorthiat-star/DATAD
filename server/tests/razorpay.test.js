/**
 * Razorpay integration guards.
 *
 * Everything protecting real money here rests on two HMACs and one unit
 * conversion, and all three fail silently when they are wrong: a broken
 * signature check accepts forged payments, and an amount passed in rupees
 * instead of paise charges ₹1.49 for a ₹149 plan while every log line looks
 * fine. None of that is visible from reading the call site.
 */
const crypto = require('node:crypto');

const KEY_ID = 'rzp_test_abc123';
const KEY_SECRET = 'secret_key_material';
const WEBHOOK_SECRET = 'webhook_secret_material';

describe('razorpay signatures', () => {
  let razorpay;

  beforeEach(() => {
    jest.resetModules();
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    razorpay = require('../payments/razorpay');
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  const checkoutSig = (orderId, paymentId, secret = KEY_SECRET) =>
    crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  it('accepts the signature Checkout returns for an order', () => {
    expect(
      razorpay.verifyCheckoutSignature({
        orderId: 'order_XYZ',
        paymentId: 'pay_ABC',
        signature: checkoutSig('order_XYZ', 'pay_ABC'),
      })
    ).toBe(true);
  });

  it('rejects a payment id swapped onto someone else’s order', () => {
    // The signature is over both ids together, so a valid signature for one
    // pairing must not validate another — otherwise a student could pay ₹149
    // and present that payment against a ₹999 order.
    expect(
      razorpay.verifyCheckoutSignature({
        orderId: 'order_EXPENSIVE',
        paymentId: 'pay_ABC',
        signature: checkoutSig('order_CHEAP', 'pay_ABC'),
      })
    ).toBe(false);
  });

  it('rejects a signature forged with the wrong secret', () => {
    expect(
      razorpay.verifyCheckoutSignature({
        orderId: 'order_XYZ',
        paymentId: 'pay_ABC',
        signature: checkoutSig('order_XYZ', 'pay_ABC', 'not_the_secret'),
      })
    ).toBe(false);
  });

  it('rejects missing or empty signatures rather than treating them as absent checks', () => {
    expect(razorpay.verifyCheckoutSignature({ orderId: 'o', paymentId: 'p', signature: '' })).toBe(false);
    expect(razorpay.verifyCheckoutSignature({ orderId: 'o', paymentId: 'p' })).toBe(false);
    expect(razorpay.verifyWebhookSignature(Buffer.from('{}'), undefined)).toBe(false);
  });

  it('verifies a webhook over the raw bytes, keyed on the webhook secret', () => {
    const raw = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');

    expect(razorpay.verifyWebhookSignature(raw, sig)).toBe(true);
    // The two secrets are not interchangeable — a webhook signed with the API
    // key secret is not one of ours.
    const wrongSecret = crypto.createHmac('sha256', KEY_SECRET).update(raw).digest('hex');
    expect(razorpay.verifyWebhookSignature(raw, wrongSecret)).toBe(false);
  });

  it('cannot be satisfied by re-serialised JSON', () => {
    // This is why index.js keeps req.rawBody. Parsing and re-stringifying the
    // body produces equivalent JSON with different bytes, and the HMAC is over
    // bytes — so a handler reading req.body would reject every real webhook.
    const raw = Buffer.from('{"event":"payment.captured",  "id":"evt_1"}');
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(raw.toString())));

    expect(razorpay.verifyWebhookSignature(raw, sig)).toBe(true);
    expect(razorpay.verifyWebhookSignature(reserialised, sig)).toBe(false);
  });

  it('treats an unconfigured gateway as closed, not as open', () => {
    jest.resetModules();
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const unconfigured = require('../payments/razorpay');

    expect(unconfigured.isConfigured()).toBe(false);
    expect(unconfigured.isWebhookConfigured()).toBe(false);
    // A missing secret must never make a signature check pass by default.
    expect(unconfigured.verifyCheckoutSignature({ orderId: 'o', paymentId: 'p', signature: 'x' })).toBe(false);
    expect(unconfigured.verifyWebhookSignature(Buffer.from('{}'), 'x')).toBe(false);
  });
});

describe('razorpay order amounts', () => {
  let razorpay;
  let fetchSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    razorpay = require('../payments/razorpay');
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'order_1', amount: 14900, currency: 'INR' }),
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it('sends the amount in paise and the currency as INR', async () => {
    await razorpay.createOrder({ amountPaise: 149 * 100, receipt: 'sub_1' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.amount).toBe(14900);
    expect(body.currency).toBe('INR');
  });

  it('truncates the receipt to the 40 characters Razorpay allows', async () => {
    await razorpay.createOrder({ amountPaise: 100, receipt: 'x'.repeat(80) });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.receipt).toHaveLength(40);
  });

  it('refuses a non-integer or non-positive amount before calling out', async () => {
    await expect(razorpay.createOrder({ amountPaise: 149.5, receipt: 'r' })).rejects.toThrow(/Invalid order amount/);
    await expect(razorpay.createOrder({ amountPaise: 0, receipt: 'r' })).rejects.toThrow(/Invalid order amount/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces the gateway’s error description rather than a bare status', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: 'Receipt is too long' } }),
    });
    await expect(razorpay.createOrder({ amountPaise: 100, receipt: 'r' })).rejects.toThrow('Receipt is too long');
  });
});

describe('renewal expiry', () => {
  const { nextExpiry } = require('../subscription/activation');
  const now = new Date('2026-03-01T00:00:00Z');

  it('stacks a renewal on the time already paid for', () => {
    // Renewing Pro monthly with five days left must add a month to the end of
    // those five days, not overwrite them.
    const user = { tier: 'pro', tierExpiresAt: new Date('2026-03-06T00:00:00Z') };
    expect(nextExpiry(user, 'pro', 'monthly', now).toISOString()).toBe('2026-04-06T00:00:00.000Z');
  });

  it('starts fresh when the current plan has already lapsed', () => {
    const user = { tier: 'pro', tierExpiresAt: new Date('2026-02-01T00:00:00Z') };
    expect(nextExpiry(user, 'pro', 'monthly', now).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('starts fresh when switching to a different tier', () => {
    // Trial time is not credited against a purchase, and buying the Placement
    // Pass while on Pro does not inherit Pro's remaining days.
    const user = { tier: 'trial', tierExpiresAt: new Date('2026-03-10T00:00:00Z') };
    expect(nextExpiry(user, 'placement', 'onetime', now).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('handles a user who has never had a paid plan', () => {
    expect(nextExpiry({ tier: 'free' }, 'pro', 'yearly', now).getFullYear()).toBe(2027);
  });
});
