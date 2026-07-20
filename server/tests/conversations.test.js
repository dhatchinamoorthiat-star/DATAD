/**
 * Conversation scoping guarantees.
 *
 * Before conversations existed server-side, ChatMessage carried only a `user`
 * reference: the model's working context was the last 12 messages across every
 * conversation a student had ever had, so resume talk in one thread leaked into
 * an unrelated thread in another, and nothing synced across devices.
 *
 * These tests pin the properties that fixed it. The localStorage import in
 * particular must stay idempotent — a retry that duplicated a student's history
 * would be very hard to unpick after the fact.
 *
 * Uses the configured MONGODB_URI with throwaway user ids and cleans up after
 * itself; skips when no database is configured.
 */

// Jest does not load the server's .env, so MONGODB_URI would be undefined and
// every test below would silently skip. Loaded here rather than via a jest
// setup file to keep the suite runnable with no extra configuration.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const HAS_DB = Boolean(process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

let ChatMessage, Conversation, daxService;
const users = [];

function newUser() {
  const id = new mongoose.Types.ObjectId();
  users.push(id);
  return id;
}

beforeAll(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(process.env.MONGODB_URI);
  ChatMessage = require('../models/ChatMessage');
  Conversation = require('../models/Conversation');
  daxService = require('../ai/daxService');
}, 30000);

afterAll(async () => {
  if (!HAS_DB) return;
  await ChatMessage.deleteMany({ user: { $in: users } });
  await Conversation.deleteMany({ user: { $in: users } });
  await mongoose.disconnect();
}, 30000);

d('Conversations', () => {
  describe('isolation', () => {
    test('messages do not leak between a user\'s own conversations', async () => {
      const uid = newUser();
      const a = await daxService.createConversation(uid, { title: 'Resume thread' });
      const b = await daxService.createConversation(uid, { title: 'Finance thread' });

      await ChatMessage.insertMany([
        { user: uid, conversation: a._id, role: 'user', content: 'AAA-resume-topic' },
        { user: uid, conversation: a._id, role: 'assistant', content: 'about the resume' },
        { user: uid, conversation: b._id, role: 'user', content: 'BBB-finance-topic' },
      ]);

      const fetchedA = await daxService.getConversation(uid, String(a._id));
      const fetchedB = await daxService.getConversation(uid, String(b._id));

      expect(fetchedA.messages).toHaveLength(2);
      expect(fetchedB.messages).toHaveLength(1);
      expect(fetchedA.messages.some((m) => m.content.includes('BBB'))).toBe(false);
      expect(fetchedB.messages.some((m) => m.content.includes('AAA'))).toBe(false);
    });

    test('another user cannot read a conversation', async () => {
      const owner = newUser();
      const attacker = newUser();
      const conv = await daxService.createConversation(owner, { title: 'Private' });

      await expect(daxService.getConversation(attacker, String(conv._id))).rejects.toThrow(/not found/i);
    });

    test('a malformed id is a 404, not a CastError', async () => {
      const uid = newUser();
      await expect(daxService.getConversation(uid, 'not-an-object-id')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    test('deleting a conversation removes its messages', async () => {
      const uid = newUser();
      const conv = await daxService.createConversation(uid, { title: 'Doomed' });
      await ChatMessage.insertMany([
        { user: uid, conversation: conv._id, role: 'user', content: 'hello' },
        { user: uid, conversation: conv._id, role: 'assistant', content: 'hi' },
      ]);

      await daxService.deleteConversation(uid, String(conv._id));
      expect(await ChatMessage.countDocuments({ conversation: conv._id })).toBe(0);
    });
  });

  describe('resolution', () => {
    test('a new chat starts its own thread instead of joining the most recent', async () => {
      // Regression: resolving a missing id to "most recent conversation" meant
      // pressing New chat and sending appended to the previous thread — the
      // exact defect conversation scoping was introduced to fix.
      const uid = newUser();
      const existing = await daxService.createConversation(uid, { title: 'Old thread' });
      await ChatMessage.create({ user: uid, conversation: existing._id, role: 'user', content: 'old topic' });

      const fresh = await daxService.resolveConversation(uid, undefined, 'local-client-id-1');
      expect(String(fresh._id)).not.toBe(String(existing._id));
    });

    test('the same client id always resolves to the same conversation', async () => {
      const uid = newUser();
      const first = await daxService.resolveConversation(uid, undefined, 'local-client-id-2');
      const second = await daxService.resolveConversation(uid, undefined, 'local-client-id-2');

      expect(String(first._id)).toBe(String(second._id));
      expect(await Conversation.countDocuments({ user: uid })).toBe(1);
    });

    test('an explicit id is honoured', async () => {
      const uid = newUser();
      const conv = await daxService.createConversation(uid, { title: 'Target' });
      const resolved = await daxService.resolveConversation(uid, String(conv._id));

      expect(String(resolved._id)).toBe(String(conv._id));
    });

    test('another user\'s conversation id cannot be posted into', async () => {
      const owner = newUser();
      const attacker = newUser();
      const conv = await daxService.createConversation(owner, { title: 'Not yours' });

      await expect(daxService.resolveConversation(attacker, String(conv._id))).rejects.toThrow(/not found/i);
    });

    test('the legacy no-id contract continues the most recent thread', async () => {
      // The pre-conversations /dax {task:'chat'} callers pass no id at all and
      // must keep working rather than spawning a conversation per message.
      const uid = newUser();
      const existing = await daxService.createConversation(uid, { title: 'Only thread' });

      const resolved = await daxService.resolveConversation(uid, undefined, undefined);
      expect(String(resolved._id)).toBe(String(existing._id));
      expect(await Conversation.countDocuments({ user: uid })).toBe(1);
    });
  });

  describe('localStorage import', () => {
    const local = (id) => ({
      id,
      title: 'Resume help',
      pinned: true,
      updatedAt: Date.now(),
      messages: [
        { role: 'user', content: 'review my resume', createdAt: Date.now() - 5000 },
        { role: 'assistant', content: 'here is feedback', createdAt: Date.now() - 4000 },
        // Neither of these is a real exchange and both should be dropped.
        { role: 'assistant', content: '', status: 'error' },
        { role: 'assistant', content: '   ' },
      ],
    });

    test('imports conversations and drops empty or errored messages', async () => {
      const uid = newUser();
      const { created, skipped } = await daxService.importConversations(uid, {
        conversations: [local('loc-1')],
      });

      expect(created).toBe(1);
      expect(skipped).toBe(0);
      expect(await ChatMessage.countDocuments({ user: uid })).toBe(2);
    });

    test('is idempotent — re-importing cannot duplicate history', async () => {
      const uid = newUser();
      const payload = { conversations: [local('loc-2')] };

      await daxService.importConversations(uid, payload);
      const second = await daxService.importConversations(uid, payload);

      expect(second.created).toBe(0);
      expect(second.skipped).toBe(1);
      expect(await Conversation.countDocuments({ user: uid })).toBe(1);
      expect(await ChatMessage.countDocuments({ user: uid })).toBe(2);
    });

    test('preserves pin state, title, and message order', async () => {
      const uid = newUser();
      await daxService.importConversations(uid, { conversations: [local('loc-3')] });

      const conv = await Conversation.findOne({ user: uid, clientId: 'loc-3' }).lean();
      expect(conv.pinned).toBe(true);
      expect(conv.title).toBe('Resume help');

      const messages = await ChatMessage.find({ conversation: conv._id }).sort({ createdAt: 1 }).lean();
      expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    });

    test('rejects a payload with no conversations array', async () => {
      const uid = newUser();
      await expect(daxService.importConversations(uid, {})).rejects.toThrow();
      await expect(daxService.importConversations(uid, { conversations: 'nope' })).rejects.toThrow();
    });

    test('an empty array is a no-op, not an error', async () => {
      // A student with nothing stored locally still runs the migration once.
      // Failing that call would surface as an error on their first visit and
      // leave the migration flag unset, so it would retry forever.
      const uid = newUser();
      await expect(daxService.importConversations(uid, { conversations: [] })).resolves.toMatchObject({
        created: 0,
        skipped: 0,
      });
    });

    test('skips entries with no client id rather than failing the batch', async () => {
      const uid = newUser();
      const { created, skipped } = await daxService.importConversations(uid, {
        conversations: [{ title: 'No id', messages: [] }, local('loc-4')],
      });

      expect(created).toBe(1);
      expect(skipped).toBe(1);
    });
  });
});
