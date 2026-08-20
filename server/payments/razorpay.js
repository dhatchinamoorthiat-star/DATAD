/**
 * Razorpay primitives: configuration, order creation, and the two signature
 * checks that everything else depends on.
 *
 * This talks to the REST API over fetch rather than pulling in the `razorpay`
 * SDK. The entire surface we need is one POST and two HMACs, and payments are
 * additive to an app that already works — a missing or broken optional
 * dependency must never be able to stop the server from booting.
 *
 * Two different signatures are involved and they are not interchangeable:
 *
 *   checkout signature  HMAC(order_id + "|" + payment_id, KEY_SECRET)
 *                       returned to the browser by Checkout, proves the
 *                       payment the client is reporting really belongs to the
 *                       order we created.
 *
 *   webhook signature   HMAC(raw request body, WEBHOOK_SECRET)
 *                       proves the POST came from Razorpay. Keyed on a
 *                       *different* secret, and computed over the raw bytes —
 *                       re-serialising the parsed JSON will not reproduce it.
 */
const crypto = require('node:crypto');
const logger = require('../utils/logger');

const API_BASE = 'https://api.razorpay.com/v1';

const keyId = () => (process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = () => (process.env.RAZORPAY_KEY_SECRET || '').trim();
const webhookSecret = () => (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

/** Checkout can only be offered when both halves of the API key are present. */
function isConfigured() {
  return Boolean(keyId() && keySecret());
}

/** Webhooks are configured separately — you can go live without them. */
function isWebhookConfigured() {
  return Boolean(webhookSecret());
}

/** The key id is public by design: Checkout needs it in the browser. */
function publicKeyId() {
  return keyId();
}

/** `true` while pointed at test keys, which is worth showing in the UI. */
function isTestMode() {
  return keyId().startsWith('rzp_test');
}

function hmac(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Compare in constant time. A plain `===` on a signature leaks, through timing,
 * how many leading bytes an attacker guessed correctly.
 */
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/**
 * Create an order. `amountPaise` is in the smallest currency unit — Razorpay
 * rejects rupees, and passing 149 instead of 14900 charges ₹1.49.
 */
async function createOrder({ amountPaise, receipt, notes = {} }) {
  if (!isConfigured()) throw new Error('Razorpay is not configured');
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error(`Invalid order amount: ${amountPaise}`);
  }

  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay caps the receipt at 40 characters and rejects the order
      // outright if it is longer.
      receipt: String(receipt).slice(0, 40),
      notes,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.description || `Razorpay responded ${res.status}`;
    logger.error('Razorpay order creation failed', { status: res.status, message });
    throw new Error(message);
  }
  return body;
}

/** Verify the signature Checkout hands back to the browser. */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  return safeEqual(hmac(`${orderId}|${paymentId}`, keySecret()), signature);
}

/**
 * Verify a webhook. `rawBody` must be the exact bytes Razorpay sent — see the
 * `verify` hook on express.json in index.js, which is what captures them.
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!isWebhookConfigured() || !rawBody || !signature) return false;
  return safeEqual(hmac(rawBody, webhookSecret()), signature);
}

module.exports = {
  isConfigured,
  isWebhookConfigured,
  publicKeyId,
  isTestMode,
  createOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
};
