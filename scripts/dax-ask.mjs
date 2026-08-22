#!/usr/bin/env node
/**
 * Ask Dax something from the terminal.
 *
 * The chat surfaces sit behind a login, so checking a wording change meant
 * starting the client, signing in, and clicking into the panel. This runs the
 * SAME modules the app imports — no browser, no server, no account.
 *
 *   node scripts/dax-ask.mjs "explain the career section"
 *   node scripts/dax-ask.mjs --plain "which plan should i choose"
 *   node scripts/dax-ask.mjs --suite      # the regression set, all at once
 *   node scripts/dax-ask.mjs --prompt     # what the LIVE model is told about the app
 *
 * What this does and does not cover:
 *   covered      — the maintenance replies (what students get today), and the
 *                  app-knowledge block handed to the live model.
 *   NOT covered  — how the live model actually answers with that block. Nothing
 *                  offline can tell you that; see the notes under --prompt.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { maintenanceReply, maintenanceReplyPlain, DAX_MAINTENANCE, DAX_MAINTENANCE_PROMPTS } =
  await import(path.join(here, '..', 'client', 'src', 'dax', 'maintenance.js'));

// The questions worth re-checking after any change to the knowledge base or the
// intent list. Each one is here because it either broke during development or
// is a phrasing students actually use.
const SUITE = [
  // Identity and small talk — must not be swallowed by the app-knowledge intents.
  'hi', 'who are you', 'who made you', 'what can you do', 'how are you',
  'thanks', 'bye', 'tell me about yourself', 'are you working', 'can you help me',
  // Sections, by every name a student might reach for.
  'explain the career section', 'what is the growth section', 'tell me about wellbeing',
  'what sections does datad have', 'what is datad',
  // Sub-pages, including the ones whose label nobody types.
  'what is batchvault', 'explain star stories', 'where are my notes',
  'how do i add a task', 'what is skill exchange', 'what is the interview question bank',
  'where is the emi calculator', 'how do i see internships',
  // Intent, not vocabulary — no section is named in these.
  'where do i track my expenses', 'i cant sleep during exams', 'where do i find my classmates',
  // Plans and money.
  'which plan should i choose', 'i need mock interviews which plan',
  'i only need notes and planner which plan', 'i want to try before i buy which plan',
  'how much does pro cost', 'what plans are there', 'how do i pay',
  // The trap: a Finance question that reads like a pricing question.
  'is the degree worth it',
  // Their own data — must admit the limit, not answer with a page description.
  'what are my tasks', 'when is my next deadline', 'review my resume',
  'summarise my note', 'what plan am i on', 'how am i doing', 'my expenses',
  // Account and getting hold of a human. /support is NOT a help desk.
  'how do i reset my password', 'delete my account', 'how do i contact you',
  'my payment didnt activate', 'what is the support page',
  // The rest of the app: info pages, admin, and the tabs nobody names out loud.
  'what is the developer page', 'what is psw', 'explain the brand page',
  'what is the privacy policy', 'what is the subject page', 'what is my program',
  'what is the reflection page', 'what is the admin panel',
  // And the floor.
  'asdkjh random gibberish',
];

const args = process.argv.slice(2);
const plain = args.includes('--plain');
const answer = (q) => (plain ? maintenanceReplyPlain(q) : maintenanceReply(q));

if (args.includes('--prompt')) {
  // CommonJS, so require() rather than import().
  const { formatAppKnowledge } = require(path.join(here, '..', 'server', 'ai', 'appKnowledge.js'));
  console.log(formatAppKnowledge());
  console.log(`\n--- ${formatAppKnowledge().length} chars, roughly ${Math.round(formatAppKnowledge().length / 4)} tokens on every chat turn ---`);
  process.exit(0);
}

if (args.includes('--suite')) {
  let fallbacks = 0;
  for (const q of SUITE) {
    const reply = answer(q);
    // The fallback is the "I can't answer that" text. Counting them is the
    // quickest read on whether a change opened a hole: the suite is written so
    // that exactly one question (the gibberish) should reach it.
    const isFallback = reply.startsWith("I can't answer that one yet");
    if (isFallback) fallbacks += 1;
    console.log(`\n${isFallback ? '·' : '✓'} ${q}\n  ${reply.split('\n')[0].slice(0, 150)}`);
  }
  console.log(`\n${SUITE.length} asked, ${fallbacks} fell through to the fallback (expected: 1 — the gibberish).`);
  process.exit(fallbacks > 1 ? 1 : 0);
}

const question = args.filter((a) => !a.startsWith('--')).join(' ');
if (!question) {
  console.log('Usage: node scripts/dax-ask.mjs "your question"  [--plain] [--suite] [--prompt]');
  console.log(`\nMaintenance mode is currently ${DAX_MAINTENANCE ? 'ON' : 'OFF'}.`);
  console.log(`Chips shown to students: ${DAX_MAINTENANCE_PROMPTS.join(' | ')}`);
  process.exit(1);
}

console.log(answer(question));
