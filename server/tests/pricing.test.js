/**
 * Pricing consistency between server and client.
 *
 * The bug this exists to prevent already happened once, in three places at
 * once. Before this change:
 *
 *   - the pricing page advertised 30/250/800 daily AI credits while the server
 *     enforced 500/500/2000;
 *   - trial and pro were both 500, so the paid tier gave no credit advantage
 *     whatsoever over the free trial;
 *   - three different price tables existed — the page said pro=499, the payment
 *     route recorded amountPaid=299, and the MRR report assumed 4799.
 *
 * None of that is catchable by reading one file, which is why it survived. The
 * client table is parsed as text here (it is an ES module, and the server suite
 * is CommonJS) and compared against the server's authoritative values.
 */

const fs = require('fs');
const path = require('path');

const { CREDIT_LIMITS } = require('../ai/usageMeter');
const { CHAT_QUOTAS } = require('../subscription/subscriptionService');
const { TIERS } = require('../subscription/tierHierarchy');
const serverPricing = require('../subscription/pricing');
const { FEATURE_ACCESS, getMinimumTier, FEATURE } = require('../subscription/featureRegistry');

const clientPricingSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'pricing.js'),
  'utf8'
);

/** Pull one `label` row's column value out of the FEATURE_ROWS table. */
function featureRow(label, column) {
  const row = new RegExp(`\\{\\s*label:\\s*'${label}'[^}]*\\}`).exec(clientPricingSrc);
  if (!row) return undefined;
  const cell = new RegExp(`${column}:\\s*'([^']*)'`).exec(row[0]);
  return cell ? cell[1].replace(/,/g, '') : undefined;
}

describe('tier model', () => {
  it('is ranked free → trial → pro → placement', () => {
    expect(TIERS).toEqual(['free', 'trial', 'pro', 'placement']);
  });

  it('no longer references the retired "max" tier anywhere in the model', () => {
    expect(CREDIT_LIMITS.max).toBeUndefined();
    expect(CHAT_QUOTAS.max).toBeUndefined();
    expect(Object.values(FEATURE_ACCESS)).not.toContain('max');
    expect(clientPricingSrc).not.toMatch(/\bmax\b/);
  });

  it('gives every paid tier a strictly better credit allowance than the one below', () => {
    // The original bug: trial and pro were both 500.
    expect(CREDIT_LIMITS.trial).toBeGreaterThan(CREDIT_LIMITS.free);
    expect(CREDIT_LIMITS.pro).toBeGreaterThan(CREDIT_LIMITS.trial);
    expect(CREDIT_LIMITS.placement).toBeGreaterThan(CREDIT_LIMITS.pro);
  });

  it('gives free tier a usable chat allowance', () => {
    // The social features only work with volume, so the free tier is not
    // supposed to feel broken.
    expect(CHAT_QUOTAS.free).toBeGreaterThanOrEqual(20);
  });
});

describe('client pricing table mirrors the server', () => {
  it('advertises exactly the credit limits the server enforces', () => {
    expect(featureRow('AI Credits per day', 'free')).toBe(String(CREDIT_LIMITS.free));
    expect(featureRow('AI Credits per day', 'trial')).toBe(String(CREDIT_LIMITS.trial));
    expect(featureRow('AI Credits per day', 'pro')).toBe(String(CREDIT_LIMITS.pro));
    expect(featureRow('AI Credits per day', 'placement')).toBe(String(CREDIT_LIMITS.placement));
  });

  it('advertises exactly the chat quotas the server enforces', () => {
    expect(featureRow('Dax messages per day', 'free')).toBe(String(CHAT_QUOTAS.free));
    expect(featureRow('Dax messages per day', 'trial')).toBe(String(CHAT_QUOTAS.trial));
    expect(featureRow('Dax messages per day', 'pro')).toBe(String(CHAT_QUOTAS.pro));
    expect(featureRow('Dax messages per day', 'placement')).toBe(String(CHAT_QUOTAS.placement));
  });

  it('quotes exactly the prices the payment route will record', () => {
    const clientPrices = /export const PRICES = \{([\s\S]*?)\};/.exec(clientPricingSrc)[1];
    expect(clientPrices).toContain(`monthly: ${serverPricing.priceFor('pro', 'monthly')}`);
    expect(clientPrices).toContain(`yearly: ${serverPricing.priceFor('pro', 'yearly')}`);
    expect(clientPrices).toContain(`oneTime: ${serverPricing.priceFor('placement', 'onetime')}`);
  });

  it('states no GST, since none is charged', () => {
    // DATAD is not GST-registered; a tax line on the checkout would be wrong.
    expect(clientPricingSrc).not.toMatch(/18%/);
    expect(clientPricingSrc).not.toMatch(/gstOf|totalWithGst/);
  });
});

describe('server pricing helpers', () => {
  it('sells Pro monthly and yearly, and the Placement Pass only as one-time', () => {
    expect(serverPricing.cyclesFor('pro')).toEqual(['monthly', 'yearly']);
    expect(serverPricing.cyclesFor('placement')).toEqual(['onetime']);
    expect(serverPricing.priceFor('placement', 'monthly')).toBeNull();
  });

  it('grants the duration actually purchased', () => {
    // A yearly purchase previously received one month.
    expect(serverPricing.durationMonthsFor('pro', 'monthly')).toBe(1);
    expect(serverPricing.durationMonthsFor('pro', 'yearly')).toBe(12);
    expect(serverPricing.durationMonthsFor('placement', 'onetime')).toBe(3);
  });

  it('computes an expiry that matches the duration', () => {
    const from = new Date('2026-01-15T00:00:00Z');
    expect(serverPricing.expiryFor('pro', 'yearly', from).getFullYear()).toBe(2027);
    expect(serverPricing.expiryFor('placement', 'onetime', from).getMonth()).toBe(3); // April
  });

  it('reports MRR on a monthly-equivalent basis', () => {
    expect(serverPricing.monthlyEquivalent('pro', 'yearly')).toBeCloseTo(1199 / 12, 2);
    expect(serverPricing.monthlyEquivalent('placement', 'onetime')).toBeCloseTo(1299 / 3, 2);
  });
});

describe('feature gating matches the pricing story', () => {
  it('keeps everything students expect free actually free', () => {
    for (const f of [FEATURE.NOTES, FEATURE.PLANNER, FEATURE.JOURNAL, FEATURE.COMMUNITY,
      FEATURE.DIRECTORY, FEATURE.FINANCE, FEATURE.AI_CHAT]) {
      expect(getMinimumTier(f)).toBe('free');
    }
  });

  it('puts every placement-outcome tool behind the Placement Pass', () => {
    // These are the ones with real willingness to pay, and the ones a
    // general-purpose chatbot cannot substitute for.
    for (const f of [FEATURE.RESUME_ATS, FEATURE.AI_INTERVIEW_SIMULATOR,
      FEATURE.INTERVIEW_QUESTIONS, FEATURE.COMPANY_RESEARCH,
      FEATURE.AI_COMPARE_COMPANIES, FEATURE.READINESS_SCORE]) {
      expect(getMinimumTier(f)).toBe('placement');
    }
  });

  it('gives Pro something beyond a bigger quota', () => {
    for (const f of [FEATURE.SEMANTIC_SEARCH, FEATURE.DASHBOARD_INSIGHTS, FEATURE.FINANCE_ASSIST]) {
      expect(getMinimumTier(f)).toBe('pro');
    }
  });
});
