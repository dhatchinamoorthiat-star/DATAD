/**
 * Web Push — the channel that reaches a phone whose PWA is closed.
 *
 * What matters here is not that a push arrives. It is that nothing else breaks
 * when one doesn't. Push delivery hangs off notification creation, and
 * notification creation hangs off ordinary requests — a student applying to a
 * company, a payment landing. So the properties worth pinning down are the
 * failure ones:
 *
 *   - with no VAPID keys configured (every dev machine, and CI), the whole
 *     channel is inert and silent rather than throwing;
 *   - a dead endpoint from an uninstalled app is pruned, not retried forever;
 *   - a transient failure keeps the subscription;
 *   - one device failing does not stop the others receiving;
 *   - only the types the registry marks push-worthy ever ring a phone.
 */

const mockSend = jest.fn();

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: (...args) => mockSend(...args),
}));

const mockFind = jest.fn();
const mockDeleteMany = jest.fn(() => ({ catch: () => {} }));
const mockUpdateMany = jest.fn(() => ({ catch: () => {} }));

jest.mock('../models/PushSubscription', () => ({
  find: (...args) => mockFind(...args),
  deleteMany: (...args) => mockDeleteMany(...args),
  updateMany: (...args) => mockUpdateMany(...args),
}));

function loadPushService({ keys = true } = {}) {
  jest.resetModules();
  if (keys) {
    // Any non-empty pair — web-push is mocked, so these are never validated.
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  } else {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  }
  return require('../notifications/PushService');
}

const sub = (endpoint) => ({
  endpoint,
  keys: { p256dh: 'p', auth: 'a' },
});

const pushable = { _id: 'n1', type: 'placement_apply', title: 'Shortlisted', body: '', link: '/x' };

beforeEach(() => {
  mockSend.mockReset();
  mockFind.mockReset();
  mockDeleteMany.mockClear();
  mockUpdateMany.mockClear();
  mockFind.mockReturnValue({ lean: () => Promise.resolve([]) });
});

describe('without VAPID keys configured', () => {
  test('the channel reports itself unavailable instead of half-working', () => {
    const push = loadPushService({ keys: false });
    expect(push.isEnabled()).toBe(false);
    expect(push.getPublicKey()).toBeNull();
  });

  test('sending is a no-op that never touches the database or the network', async () => {
    const push = loadPushService({ keys: false });

    await expect(push.sendToUser('u1', pushable)).resolves.toBe(0);

    expect(mockFind).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('type gating', () => {
  test('only rings for types the registry marks push-worthy', async () => {
    const push = loadPushService();

    // `reaction` is deliberately push: false — ambient social noise must not
    // wake a phone.
    await expect(push.sendToUser('u1', { type: 'reaction', title: 'x' })).resolves.toBe(0);
    expect(mockFind).not.toHaveBeenCalled();

    expect(push.shouldPush('placement_apply')).toBe(true);
    expect(push.shouldPush('reaction')).toBe(false);
  });
});

describe('delivery', () => {
  test('sends to every registered device for the user', async () => {
    const push = loadPushService();
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([sub('https://push/1'), sub('https://push/2')]),
    });
    mockSend.mockResolvedValue({ statusCode: 201 });

    await expect(push.sendToUser('u1', pushable)).resolves.toBe(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  test('carries a payload the service worker can render and route', async () => {
    const push = loadPushService();
    mockFind.mockReturnValue({ lean: () => Promise.resolve([sub('https://push/1')]) });
    mockSend.mockResolvedValue({ statusCode: 201 });

    await push.sendToUser('u1', pushable);

    const payload = JSON.parse(mockSend.mock.calls[0][1]);
    expect(payload).toMatchObject({
      id: 'n1',
      type: 'placement_apply',
      title: 'Shortlisted',
      link: '/x',
    });
  });

  test('one dead device does not stop the others receiving', async () => {
    const push = loadPushService();
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([sub('https://push/dead'), sub('https://push/ok')]),
    });
    mockSend
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({ statusCode: 201 });

    await expect(push.sendToUser('u1', pushable)).resolves.toBe(1);
  });
});

describe('endpoint hygiene', () => {
  test('prunes an endpoint the push service says is permanently gone', async () => {
    const push = loadPushService();
    mockFind.mockReturnValue({ lean: () => Promise.resolve([sub('https://push/gone')]) });
    mockSend.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    await push.sendToUser('u1', pushable);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      endpoint: { $in: ['https://push/gone'] },
    });
  });

  test('keeps a subscription that failed for a transient reason', async () => {
    const push = loadPushService();
    mockFind.mockReturnValue({ lean: () => Promise.resolve([sub('https://push/flaky')]) });
    mockSend.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 503 }));

    await expect(push.sendToUser('u1', pushable)).resolves.toBe(0);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  test('a database failure loading subscriptions is swallowed, not thrown', async () => {
    const push = loadPushService();
    mockFind.mockReturnValue({ lean: () => Promise.reject(new Error('mongo down')) });

    await expect(push.sendToUser('u1', pushable)).resolves.toBe(0);
  });
});

describe('subscribing', () => {
  test('rejects a malformed subscription rather than storing an unusable row', async () => {
    const push = loadPushService();

    await expect(push.saveSubscription('u1', { endpoint: 'https://x' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(push.saveSubscription('u1', null))
      .rejects.toMatchObject({ status: 400 });
  });
});
