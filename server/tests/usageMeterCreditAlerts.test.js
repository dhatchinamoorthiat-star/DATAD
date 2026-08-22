/**
 * checkAndNotifyCredits was fully implemented but never called from any of
 * the three chargeCredits() sites (aiGateway.js x2, daxService.js) — no
 * student ever saw a credit_alert notification. This covers the function's
 * own thresholds now that it's wired in, independent of the call sites.
 */
jest.mock('../models/AiUsage');
jest.mock('../notifications/NotificationService');

const AiUsage = require('../models/AiUsage');
const notificationService = require('../notifications/NotificationService');
const { checkAndNotifyCredits } = require('../ai/usageMeter');

function mockCreditsUsed(creditsUsed) {
  AiUsage.findOne.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ creditsUsed }) }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  notificationService.send.mockResolvedValue({});
});

describe('checkAndNotifyCredits', () => {
  it('stays silent for a free-tier user (no paid credit pool to alert on)', async () => {
    await checkAndNotifyCredits('user1', 'free');
    expect(notificationService.send).not.toHaveBeenCalled();
  });

  it('sends an exhausted alert once usage reaches the daily limit', async () => {
    mockCreditsUsed(500); // pro limit is 500
    await checkAndNotifyCredits('user1', 'pro');
    expect(notificationService.send).toHaveBeenCalledWith('user1', expect.objectContaining({
      type: 'credit_alert',
      title: 'AI credits exhausted',
      link: '/subscribe',
    }));
  });

  it('sends a low-credit alert once remaining credits drop within 10% of the limit', async () => {
    mockCreditsUsed(460); // 40 of 500 remaining = 8%
    await checkAndNotifyCredits('user1', 'pro');
    expect(notificationService.send).toHaveBeenCalledWith('user1', expect.objectContaining({
      type: 'credit_alert',
      title: 'AI credits running low',
    }));
  });

  it('stays silent while comfortably under the low-credit threshold', async () => {
    mockCreditsUsed(100); // 400 of 500 remaining, well above the 10% band
    await checkAndNotifyCredits('user1', 'pro');
    expect(notificationService.send).not.toHaveBeenCalled();
  });

  it('never throws — a metering failure must not break the caller', async () => {
    AiUsage.findOne.mockImplementation(() => { throw new Error('db down'); });
    await expect(checkAndNotifyCredits('user1', 'pro')).resolves.toBeUndefined();
    expect(notificationService.send).not.toHaveBeenCalled();
  });
});
