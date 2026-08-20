/**
 * Deliver a signed Razorpay webhook to your own server, locally.
 *
 * Razorpay POSTs webhooks from its own machines, so it cannot reach localhost —
 * which leaves the one path that actually needs a webhook (the student's
 * browser dies between paying and returning) untestable without a tunnel.
 *
 * This builds the real payload shape, signs it with the real
 * RAZORPAY_WEBHOOK_SECRET, and posts it to the real route. The signature check,
 * the amount check and the activation are all genuinely exercised; only the
 * network hop is faked.
 *
 *   node scripts/simulateRazorpayWebhook.js --list
 *   node scripts/simulateRazorpayWebhook.js --create you@example.com
 *   node scripts/simulateRazorpayWebhook.js --create you@example.com --tier placement
 *   node scripts/simulateRazorpayWebhook.js order_xxx
 *   node scripts/simulateRazorpayWebhook.js order_xxx --event payment.failed
 *   node scripts/simulateRazorpayWebhook.js order_xxx --tamper
 *   node scripts/simulateRazorpayWebhook.js order_xxx --url https://x.ngrok.app
 *
 * --create exists because of a chicken-and-egg: a webhook needs an order, and
 * orders are only written when someone starts a checkout in the browser. It
 * opens a genuine Razorpay order through the same code path the app uses, so
 * you can test the webhook before the UI is wired up on your machine.
 */
require('dotenv').config();
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const SubscriptionRequest = require('../models/SubscriptionRequest');
const User = require('../models/User');
const razorpay = require('../payments/razorpay');
const { priceFor, cyclesFor } = require('../subscription/pricing');

const USAGE = `Usage:
  node scripts/simulateRazorpayWebhook.js --list
  node scripts/simulateRazorpayWebhook.js --create <user-email> [--tier pro|placement] [--billing monthly|yearly|onetime]
  node scripts/simulateRazorpayWebhook.js <order_id> [--event payment.captured|payment.failed] [--tamper] [--url <base>]`;

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};

const first = process.argv[2];
const event = arg('--event', 'payment.captured');
const baseUrl = arg('--url', `http://localhost:${process.env.PORT || 5000}`);
const tamper = process.argv.includes('--tamper');
const listMode = process.argv.includes('--list');
const createEmail = arg('--create', null);

/** Print the most recent Razorpay orders so an id is never guesswork. */
async function list() {
  const rows = await SubscriptionRequest.find({ provider: 'razorpay' })
    .sort({ createdAt: -1 }).limit(15)
    .select('razorpayOrderId tier billing amountPaid status createdAt')
    .lean();

  if (!rows.length) {
    console.log('No Razorpay orders yet. Create one with:\n  node scripts/simulateRazorpayWebhook.js --create <your-email>');
    return;
  }
  rows.forEach((r) => {
    console.log(`${r.razorpayOrderId}  ${r.tier}/${r.billing}  ₹${r.amountPaid}  ${r.status}  ${r.createdAt.toISOString().slice(0, 16)}`);
  });
}

/** Open a real order against the configured (test) keys, as /order would. */
async function create(email) {
  if (!razorpay.isConfigured()) {
    console.error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set, so no order can be opened.');
    process.exit(1);
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('_id email').lean();
  if (!user) {
    console.error(`No user with email ${email}.`);
    process.exit(1);
  }

  const tier = arg('--tier', 'pro');
  const allowed = cyclesFor(tier);
  if (!allowed.length) {
    console.error(`Unknown tier "${tier}". Must be pro or placement.`);
    process.exit(1);
  }
  const billing = arg('--billing', allowed[0]);
  const amount = priceFor(tier, billing);
  if (amount === null) {
    console.error(`${tier} is not sold on a ${billing} cycle. Available: ${allowed.join(', ')}`);
    process.exit(1);
  }

  const order = await razorpay.createOrder({
    amountPaise: amount * 100,
    receipt: `sim_${Date.now().toString(36)}`,
    notes: { userId: String(user._id), tier, billing, source: 'simulateRazorpayWebhook' },
  });

  await SubscriptionRequest.create({
    user: user._id,
    tier,
    billing,
    amountPaid: amount,
    provider: 'razorpay',
    razorpayOrderId: order.id,
    paymentRef: order.id,
  });

  console.log(`Opened ${order.id} — ${tier}/${billing}, ₹${amount}, for ${user.email}`);
  console.log(`\nNow deliver the webhook:\n  node scripts/simulateRazorpayWebhook.js ${order.id}`);
}

/** Sign and POST the webhook, then report what it did to the request. */
async function deliver(orderId) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set — the server would answer 503 and nothing would be proven.');
    process.exit(1);
  }

  const request = await SubscriptionRequest.findOne({ razorpayOrderId: orderId }).lean();
  if (!request) {
    console.error(`No SubscriptionRequest found for ${orderId}. Run --list to see the orders that exist.`);
    process.exit(1);
  }
  console.log(`Found ${request.tier}/${request.billing} — ₹${request.amountPaid}, status "${request.status}"`);

  // The amount is read back from the request rather than passed in, because a
  // payload that disagrees with the plan is supposed to be refused — sending a
  // mismatched one by accident would look like the handler is broken.
  const body = JSON.stringify({
    entity: 'event',
    event,
    payload: {
      payment: {
        entity: {
          id: `pay_sim${crypto.randomBytes(6).toString('hex')}`,
          order_id: orderId,
          amount: request.amountPaid * 100,
          currency: 'INR',
          status: event === 'payment.captured' ? 'captured' : 'failed',
          method: 'upi',
          error_description: event === 'payment.failed' ? 'Simulated failure' : null,
        },
      },
    },
  });

  const signature = tamper
    ? crypto.randomBytes(32).toString('hex')
    : crypto.createHmac('sha256', secret).update(body).digest('hex');

  const url = `${baseUrl}/api/subscription/webhook`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
      body,
    });
  } catch (err) {
    console.error(`Could not reach ${url} — is the server running? (${err.message})`);
    process.exit(1);
  }

  console.log(`POST ${url}${tamper ? ' (deliberately bad signature)' : ''}`);
  console.log(`  → ${res.status} ${await res.text()}`);
  if (tamper && res.status !== 400) {
    console.error('  Expected 400. A forged signature was accepted — do not go live.');
    process.exitCode = 1;
  }

  const after = await SubscriptionRequest.findById(request._id).select('status').lean();
  console.log(`Request status: ${request.status} → ${after.status}`);
}

async function main() {
  if (!listMode && !createEmail && (!first || first.startsWith('--'))) {
    console.error(USAGE);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  if (listMode) await list();
  else if (createEmail) await create(createEmail);
  else await deliver(first);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
