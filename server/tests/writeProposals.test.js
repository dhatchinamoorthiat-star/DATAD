/**
 * Safety properties of the confirmed-write path.
 *
 * These are the guarantees that make it acceptable for a language model to
 * request writes against real student data. Each was verified by hand when the
 * feature was built; they live here so they stay true. If any of these fail,
 * the write path should be considered unsafe to ship, not merely buggy.
 *
 * Uses the configured MONGODB_URI with throwaway user ids and cleans up after
 * itself — there is no in-memory Mongo in this project. Skips entirely when no
 * database is configured so CI without one still passes.
 */

// Jest does not load the server's .env, so MONGODB_URI would be undefined and
// every test below would silently skip. Loaded here rather than via a jest
// setup file to keep the suite runnable with no extra configuration.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');

const HAS_DB = Boolean(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

let Task, ProposedAction, proposalService;
const users = [];

function newUser() {
  const id = new mongoose.Types.ObjectId();
  users.push(id);
  return id;
}

// Dates are computed relative to now: a fixture pinned to a literal year would
// silently start testing "is in the past" once that year elapsed.
const daysFromNow = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  if (!HAS_DB) return;
  await connectTestDb();
  Task = require('../models/Task');
  ProposedAction = require('../models/ProposedAction');
  proposalService = require('../ai/proposalService');
}, 30000);

afterAll(async () => {
  if (!HAS_DB) return;
  await Task.deleteMany({ createdBy: { $in: users } });
  await ProposedAction.deleteMany({ user: { $in: users } });
  await disconnectTestDb();
}, 30000);

const seedTask = (userId, overrides = {}) =>
  Task.create({
    title: 'Mock interview with mentor',
    createdBy: userId,
    assignee: userId,
    status: 'pending',
    type: 'interview-prep',
    dueDate: new Date(daysFromNow(2)),
    ...overrides,
  });

d('Write proposals — safety properties', () => {
  describe('proposing', () => {
    test('records the proposal without mutating anything', async () => {
      const uid = newUser();
      await seedTask(uid);
      const before = await Task.countDocuments({ createdBy: uid });

      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Prep Deloitte case', dueDate: daysFromNow(10) } },
        { tool: 'reschedule_task', args: { title: 'Mock interview with mentor', dueDate: daysFromNow(20) } },
      ]);

      expect(proposal.actions).toHaveLength(2);
      expect(proposal.status).toBe('pending');
      // The whole point: a proposal is a suggestion, not a write.
      expect(await Task.countDocuments({ createdBy: uid })).toBe(before);
    });

    test('rejects invalid actions individually and still cards the valid ones', async () => {
      const uid = newUser();
      await seedTask(uid);

      const { proposal, rejected } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Valid', dueDate: daysFromNow(5) } },
        { tool: 'create_task', args: { title: 'No date given' } },
        { tool: 'reschedule_task', args: { title: 'nonexistent task', dueDate: daysFromNow(5) } },
      ]);

      expect(proposal.actions).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      expect(rejected.every((r) => typeof r.error === 'string' && r.error.length)).toBe(true);
    });

    test('rejects a date in the past', async () => {
      // Regression: asked to schedule "August 15th" in 2026, llama-3.3-70b
      // answered 2024-08-15. Without this the student would have been shown a
      // confirmation card for a deadline two years behind them.
      const uid = newUser();
      const { proposal, rejected } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Backdated', dueDate: daysFromNow(-400) } },
      ]);

      expect(proposal).toBeNull();
      expect(rejected[0].error).toMatch(/past/i);
    });

    test('rejects a non-ISO date rather than guessing at it', async () => {
      const uid = newUser();
      const { proposal, rejected } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Vague', dueDate: 'next Thursday' } },
      ]);

      expect(proposal).toBeNull();
      expect(rejected[0].error).toMatch(/date/i);
    });

    test('card wording is generated server-side, not taken from the model', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Prep case', dueDate: daysFromNow(7) } },
      ]);

      const action = proposal.actions[0];
      expect(action.summary).toContain('Prep case');
      expect(action.summary).toContain(daysFromNow(7));
      expect(action.doneSummary).toBeTruthy();
      expect(action.doneSummary).not.toBe(action.summary);
    });
  });

  describe('confirming', () => {
    test('applies the change', async () => {
      const uid = newUser();
      const task = await seedTask(uid);
      const target = daysFromNow(30);

      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'reschedule_task', args: { title: 'Mock interview with mentor', dueDate: target } },
      ]);
      const { proposal: done } = await proposalService.confirm(uid, String(proposal._id));

      expect(done.status).toBe('executed');
      const after = await Task.findById(task._id).lean();
      expect(after.dueDate.toISOString().slice(0, 10)).toBe(target);
    });

    test('is idempotent — a second confirm does not write again', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Only once', dueDate: daysFromNow(5) } },
      ]);

      await proposalService.confirm(uid, String(proposal._id));
      const second = await proposalService.confirm(uid, String(proposal._id));

      expect(second.alreadyResolved).toBe(true);
      expect(await Task.countDocuments({ createdBy: uid, title: 'Only once' })).toBe(1);
    });

    test('concurrent confirms execute exactly once', async () => {
      // A double-click, or a client retry, must not create two tasks. The
      // pending -> confirming transition is the lock that prevents it.
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Race target', dueDate: daysFromNow(5) } },
      ]);

      await Promise.allSettled([
        proposalService.confirm(uid, String(proposal._id)),
        proposalService.confirm(uid, String(proposal._id)),
      ]);

      expect(await Task.countDocuments({ createdBy: uid, title: 'Race target' })).toBe(1);
    });

    test('another user cannot confirm, and nothing is written', async () => {
      const owner = newUser();
      const attacker = newUser();
      const { proposal } = await proposalService.propose(owner, null, [
        { tool: 'create_task', args: { title: 'Private', dueDate: daysFromNow(5) } },
      ]);

      await expect(proposalService.confirm(attacker, String(proposal._id))).rejects.toThrow(/not found/i);
      expect(await Task.countDocuments({ createdBy: attacker })).toBe(0);
      expect(await Task.countDocuments({ createdBy: owner, title: 'Private' })).toBe(0);
    });

    test('a malformed id is a 404, not a CastError', async () => {
      const uid = newUser();
      await expect(proposalService.confirm(uid, 'not-an-object-id')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    test('an expired proposal is refused and writes nothing', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Stale', dueDate: daysFromNow(5) } },
      ]);
      await ProposedAction.updateOne(
        { _id: proposal._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      await expect(proposalService.confirm(uid, String(proposal._id))).rejects.toThrow(/expired/i);
      expect(await Task.countDocuments({ createdBy: uid, title: 'Stale' })).toBe(0);
    });
  });

  describe('rejecting and undoing', () => {
    test('rejecting writes nothing', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Dismissed', dueDate: daysFromNow(5) } },
      ]);

      const { proposal: rejected } = await proposalService.reject(uid, String(proposal._id));
      expect(rejected.status).toBe('rejected');
      expect(await Task.countDocuments({ createdBy: uid, title: 'Dismissed' })).toBe(0);
    });

    test('undo restores the prior state', async () => {
      const uid = newUser();
      const task = await seedTask(uid);
      const originalDue = task.dueDate.toISOString().slice(0, 10);

      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'reschedule_task', args: { title: 'Mock interview with mentor', dueDate: daysFromNow(40) } },
      ]);
      await proposalService.confirm(uid, String(proposal._id));
      await proposalService.undo(uid, String(proposal._id));

      const restored = await Task.findById(task._id).lean();
      expect(restored.dueDate.toISOString().slice(0, 10)).toBe(originalDue);
    });

    test('undo of a created task removes it', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Undo my creation', dueDate: daysFromNow(5) } },
      ]);
      await proposalService.confirm(uid, String(proposal._id));
      expect(await Task.countDocuments({ createdBy: uid, title: 'Undo my creation' })).toBe(1);

      await proposalService.undo(uid, String(proposal._id));
      expect(await Task.countDocuments({ createdBy: uid, title: 'Undo my creation' })).toBe(0);
    });

    test('undo cannot be replayed', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Undo twice', dueDate: daysFromNow(5) } },
      ]);
      await proposalService.confirm(uid, String(proposal._id));
      await proposalService.undo(uid, String(proposal._id));

      await expect(proposalService.undo(uid, String(proposal._id))).rejects.toThrow();
    });

    test('undo is refused once the window has passed', async () => {
      const uid = newUser();
      const { proposal } = await proposalService.propose(uid, null, [
        { tool: 'create_task', args: { title: 'Too late', dueDate: daysFromNow(5) } },
      ]);
      await proposalService.confirm(uid, String(proposal._id));
      await ProposedAction.updateOne(
        { _id: proposal._id },
        { $set: { undoableUntil: new Date(Date.now() - 1000) } }
      );

      await expect(proposalService.undo(uid, String(proposal._id))).rejects.toThrow(/window/i);
      // The change itself stands — only the ability to reverse it lapsed.
      expect(await Task.countDocuments({ createdBy: uid, title: 'Too late' })).toBe(1);
    });
  });

  describe('model capability gate', () => {
    test('weak models are not offered write tools', () => {
      const { supportsWriteTools } = require('../ai/tools');
      // Observed sending booleans as the string "false" and duplicating calls.
      expect(supportsWriteTools('meta/llama-3.1-8b-instruct')).toBe(false);
    });

    test('capable models are offered write tools', () => {
      const { supportsWriteTools } = require('../ai/tools');
      // meta/llama-3.3-70b-instruct was removed from the registry after a
      // live sweep found it consistently times out on this NVIDIA account
      // (see modelRegistry.js). Using a surviving model above the reasoning
      // threshold (reasoningScore 80 >= MIN_WRITE_REASONING).
      expect(supportsWriteTools('meta/llama-3.1-70b-instruct')).toBe(true);
    });

    test('an unknown model is treated as incapable', () => {
      const { supportsWriteTools } = require('../ai/tools');
      expect(supportsWriteTools('some/model-we-have-never-scored')).toBe(false);
      expect(supportsWriteTools(undefined)).toBe(false);
    });
  });
});
