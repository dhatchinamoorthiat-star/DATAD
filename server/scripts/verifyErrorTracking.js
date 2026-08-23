#!/usr/bin/env node
/**
 * Prove that a production error actually reaches a human.
 *
 * The release gate asks for this and it cannot be answered by reading code: a
 * DSN can be present and wrong, a webhook URL can 404, and both failures look
 * exactly like a quiet week. So this sends one deliberate error through the
 * real `capture()` path — the same path a 500 takes — and reports which sinks
 * were asked to carry it.
 *
 * It does not, and cannot, confirm the event arrived in Sentry's UI. Nothing
 * running here can. Go and look; the event is tagged `source=verification` and
 * carries the nonce printed below, so it is unambiguous which one it is.
 *
 *   node scripts/verifyErrorTracking.js
 *
 * Run it against the deployed environment's env, not a laptop's. A pass on a
 * laptop with no DSN set is a pass for "log", which is what you already had.
 */

require('dotenv').config();

const errorTracker = require('../observability/errorTracker');

const nonce = `verify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  const sinks = errorTracker.status();

  console.log('Error tracking sinks');
  console.log(`  environment : ${sinks.environment}`);
  console.log(`  sentry      : ${sinks.sentry ? 'enabled' : 'not configured'}`);
  console.log(`  webhook     : ${sinks.webhook ? 'enabled' : 'not configured'}`);
  console.log(`  log         : enabled (always)`);
  console.log('');

  const err = new Error(`Deliberate verification error (${nonce})`);
  err.name = 'ErrorTrackingVerification';

  const event = errorTracker.capture(err, {
    source: 'job',
    level: 'error',
    context: { nonce, script: 'verifyErrorTracking' },
  });

  if (!event) {
    console.error('FAIL — capture() returned null, meaning the tracker itself threw.');
    process.exitCode = 1;
    return;
  }

  // The webhook POST and Sentry's transport are both fire-and-forget by design
  // (see capture()); without a pause the process exits before either flushes,
  // and the run reports success for a request that was never sent.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  if (sinks.sentry) {
    try {
      await require('@sentry/node').flush(5000);
    } catch { /* the pause above is the fallback */ }
  }

  console.log(`Sent. nonce = ${nonce}`);
  console.log('');

  if (!sinks.sentry && !sinks.webhook) {
    console.log('INCONCLUSIVE — only the log sink is active, so this proved nothing');
    console.log('an operator would not have to be watching the log stream to see.');
    console.log('Set SENTRY_DSN or ERROR_WEBHOOK_URL and run this again.');
    process.exitCode = 2;
    return;
  }

  console.log('Now confirm it arrived:');
  if (sinks.sentry) console.log(`  Sentry  — search issues for "${nonce}"`);
  if (sinks.webhook) console.log(`  Webhook — the destination channel should show one message`);
  console.log('');
  console.log('If it did not arrive, the tracker is not wired, whatever this script printed.');
}

main().catch((err) => {
  console.error('FAIL —', err.message);
  process.exitCode = 1;
});
