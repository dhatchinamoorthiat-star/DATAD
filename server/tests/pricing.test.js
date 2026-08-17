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
const { TIERS, getRank } = require('../subscription/tierHierarchy');
const serverPricing = require('../subscription/pricing');
const { FEATURE_ACCESS, getMinimumTier, FEATURE } = require('../subscription/featureRegistry');
const { canAccessFeature } = require('../subscription/permissionEngine');

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
    expect(serverPricing.durationMonthsFor('placement', 'onetime')).toBe(4);
  });

  it('computes an expiry that matches the duration', () => {
    const from = new Date('2026-01-15T00:00:00Z');
    expect(serverPricing.expiryFor('pro', 'yearly', from).getFullYear()).toBe(2027);
    expect(serverPricing.expiryFor('placement', 'onetime', from).getMonth()).toBe(4); // May
  });

  it('reports MRR on a monthly-equivalent basis', () => {
    expect(serverPricing.monthlyEquivalent('pro', 'yearly')).toBeCloseTo(1199 / 12, 2);
    expect(serverPricing.monthlyEquivalent('placement', 'onetime')).toBeCloseTo(999 / 4, 2);
  });
});

describe('feature gating matches the pricing story', () => {
  it('keeps everything students expect free actually free', () => {
    for (const f of [FEATURE.NOTES, FEATURE.PLANNER, FEATURE.JOURNAL, FEATURE.COMMUNITY,
      FEATURE.DIRECTORY, FEATURE.FINANCE, FEATURE.AI_CHAT, FEATURE.CAREER_BASIC]) {
      expect(getMinimumTier(f)).toBe('free');
    }
  });

  it('gives Pro the career tools with recurring, year-round use', () => {
    // Pro previously added only semantic search, dashboard insights and finance
    // assist over the free trial, while every tool a student actually wanted sat
    // behind the Pass. That made Pro a rung with no reason to exist: the rational
    // student ran the trial, dropped to free, and waited for placement season.
    // These are the tools you come back to all year, so they carry the
    // subscription.
    for (const f of [FEATURE.RESUME_ATS, FEATURE.INTERVIEW_QUESTIONS,
      FEATURE.COMPANY_RESEARCH, FEATURE.LINKEDIN_ENHANCER, FEATURE.SEMANTIC_SEARCH,
      FEATURE.DASHBOARD_INSIGHTS, FEATURE.FINANCE_ASSIST, FEATURE.MULTI_WORKSPACE,
      FEATURE.ADVANCED_AI_MEMORY]) {
      expect(getMinimumTier(f)).toBe('pro');
    }
  });

  it('keeps the bursty, season-specific tools in the Placement Pass', () => {
    // You mock interview for three weeks, not three terms. These are also the
    // ones a general-purpose chatbot cannot substitute for, because they run on
    // DATAD's own campus/company data.
    for (const f of [FEATURE.AI_INTERVIEW_SIMULATOR, FEATURE.READINESS_SCORE,
      FEATURE.AI_COMPARE_COMPANIES, FEATURE.AI_CAREER_ADVICE,
      FEATURE.COMPANY_PREMIUM, FEATURE.MARKET_INTELLIGENCE,
      FEATURE.CAREER_ROADMAP]) {
      expect(getMinimumTier(f)).toBe('placement');
    }
  });

  it('prices the Pass below a year of Pro', () => {
    // At ₹1299 for 3 months the Pass cost more than the ₹1199 annual Pro plan
    // sitting next to it on the same page, which made the ladder read as broken.
    expect(serverPricing.priceFor('placement', 'onetime'))
      .toBeLessThan(serverPricing.priceFor('pro', 'yearly'));
  });

  it('keeps the trial a strict subset of Pro', () => {
    // A trial that matches Pro gives nobody a reason to convert.
    const trialFeatures = Object.entries(FEATURE_ACCESS)
      .filter(([, t]) => t === 'trial')
      .map(([f]) => f);
    expect(trialFeatures.length).toBeGreaterThan(0);
    for (const f of trialFeatures) {
      expect(getRank(getMinimumTier(f))).toBeLessThan(getRank('pro'));
    }
  });

  it('gives every paid rung strictly more features than the rung below', () => {
    // The structural version of "Pro is a dead rung": if a tier adds nothing,
    // it should not be on the pricing page.
    const counts = Object.fromEntries(TIERS.map((t) => [t, 0]));
    for (const minTier of Object.values(FEATURE_ACCESS)) {
      if (counts[minTier] !== undefined) counts[minTier] += 1;
    }
    for (const t of ['trial', 'pro', 'placement']) {
      expect(counts[t]).toBeGreaterThan(0);
    }
  });
});

describe('the pricing page only sells what the app enforces', () => {
  // Rows were advertised for features nothing in the codebase gates —
  // "Multiple Workspaces" (the app's own nav), "Advanced AI Memory" (baseline
  // Dax behaviour for every user), Market Intelligence and Knowledge Graph
  // (unbuilt). A student could pay for Pro or the Pass and never receive them.
  const UNENFORCED = [
    FEATURE.MULTI_WORKSPACE, FEATURE.ADVANCED_AI_MEMORY,
    FEATURE.KNOWLEDGE_GRAPH, FEATURE.AUTONOMOUS_AI, FEATURE.CASE_GENERATOR,
  ];

  const LABELS = {
    [FEATURE.MULTI_WORKSPACE]: 'Multiple Workspaces',
    [FEATURE.ADVANCED_AI_MEMORY]: 'Advanced AI Memory',
    [FEATURE.KNOWLEDGE_GRAPH]: 'Knowledge Graph',
    [FEATURE.AUTONOMOUS_AI]: 'Autonomous AI',
    [FEATURE.CASE_GENERATOR]: 'Case Generator',
  };

  it('lists no feature that has no enforcement point', () => {
    for (const f of UNENFORCED) {
      expect(clientPricingSrc).not.toContain(`label: '${LABELS[f]}'`);
    }
  });

  it('still has these as registry roadmap slots, so re-adding a row is deliberate', () => {
    for (const f of UNENFORCED) expect(getMinimumTier(f)).toBeTruthy();
  });
});

describe('the capability map the client receives', () => {
  const { getFeaturesForTier } = require('../subscription/featureRegistry');
  const { getAvailableCapabilities } = require('../subscription/permissionEngine');

  it('never reports admin features as unlocked for a student', () => {
    // getRank('admin') is undefined → 0, so a plain rank test passes for free.
    for (const tier of TIERS) {
      const caps = getFeaturesForTier(tier);
      for (const f of [FEATURE.ADMIN_STUDIO, FEATURE.ADMIN_USERS,
        FEATURE.ADMIN_ANALYTICS, FEATURE.ADMIN_AUTOMATION, FEATURE.ADMIN_SUBSCRIPTIONS]) {
        expect(caps[f]).toBe(false);
      }
    }
  });

  it('agrees with canAccessFeature for every feature and tier', () => {
    // The map drives what the UI shows; canAccessFeature drives what the API
    // allows. If they disagree, the student sees a control that then 403s.
    for (const tier of TIERS) {
      const caps = getAvailableCapabilities({ tier, role: 'member' });
      for (const f of Object.values(FEATURE)) {
        expect(caps[f]).toBe(canAccessFeature({ tier, role: 'member' }, f));
      }
    }
  });

  it('unlocks everything for an admin', () => {
    const caps = getAvailableCapabilities({ tier: 'free', role: 'admin' });
    for (const f of Object.values(FEATURE)) expect(caps[f]).toBe(true);
  });

  it('grows monotonically as the tier rises', () => {
    let previous = -1;
    for (const tier of TIERS) {
      const unlocked = Object.values(getFeaturesForTier(tier)).filter(Boolean).length;
      expect(unlocked).toBeGreaterThan(previous);
      previous = unlocked;
    }
  });
});

describe('gates cannot silently enforce a different tier than they name', () => {
  it('maps each tier in checkTier to a feature that actually belongs to it', () => {
    // `pro: INTERVIEW_QUESTIONS` while interview questions were Placement-tier
    // meant every checkTier('pro') route demanded the Pass.
    const checkTier = require('../middleware/checkTier');
    const map = checkTier.TIER_FEATURE_MAP;
    for (const [tier, feature] of Object.entries(map)) {
      expect(getMinimumTier(feature)).toBe(tier);
    }
  });

  it('mirrors the server registry in the client feature table', () => {
    // TierGate picks its lock label from the client mirror; if it drifts, a gate
    // names the wrong plan and sends the student to buy the wrong thing.
    const clientFeaturesSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'planFeatures.js'),
      'utf8'
    );
    const table = /export const FEATURE_MIN_TIER = \{([\s\S]*?)\n\};/.exec(clientFeaturesSrc)[1];
    const mirrored = {};
    for (const [, key, tier] of table.matchAll(/\[FEATURE\.(\w+)\]:\s*'(\w+)'/g)) {
      mirrored[FEATURE[key]] = tier;
    }

    // Every non-admin server feature must appear, with the same tier.
    for (const [feature, tier] of Object.entries(FEATURE_ACCESS)) {
      if (tier === 'admin') continue;
      expect(mirrored[feature]).toBe(tier);
    }
  });

  it('never advertises a feature at a tier that cannot actually reach it', () => {
    // A `pro: true` cell against a Placement-only feature is exactly how the
    // pricing page came to promise things the API then refused.
    const ROW_TO_FEATURE = {
      'Resume ATS Score': FEATURE.RESUME_ATS,
      'Interview Questions': FEATURE.INTERVIEW_QUESTIONS,
      'Company Research': FEATURE.COMPANY_RESEARCH,
      'LinkedIn Enhancer': FEATURE.LINKEDIN_ENHANCER,
      'Semantic Search': FEATURE.SEMANTIC_SEARCH,
      'Dashboard Insights': FEATURE.DASHBOARD_INSIGHTS,
      'Finance Assist': FEATURE.FINANCE_ASSIST,
      'Interview Simulator': FEATURE.AI_INTERVIEW_SIMULATOR,
      'Career Readiness Score': FEATURE.READINESS_SCORE,
      'Compare Companies': FEATURE.AI_COMPARE_COMPANIES,
      'Career Advice': FEATURE.AI_CAREER_ADVICE,
      'Salary Bands & Hiring Rounds': FEATURE.COMPANY_PREMIUM,
      'Market Intelligence': FEATURE.MARKET_INTELLIGENCE,
      'Career Roadmap Generator': FEATURE.CAREER_ROADMAP,
      'AI Summarise': FEATURE.AI_SUMMARISE,
      'Resume Review': FEATURE.AI_RESUME_REVIEW,
      'Planner Suggestions': FEATURE.AI_PLANNER_SUGGEST,
    };

    for (const [label, feature] of Object.entries(ROW_TO_FEATURE)) {
      const row = new RegExp(`\\{\\s*label:\\s*'${label}'[^}]*\\}`).exec(clientPricingSrc);
      expect(row).not.toBeNull();
      const needed = getRank(getMinimumTier(feature));
      for (const tier of TIERS) {
        const cell = new RegExp(`\\b${tier}:\\s*(true|false)`).exec(row[0]);
        if (!cell) continue;
        // Advertised as included ⇒ that tier must actually rank high enough.
        if (cell[1] === 'true') expect(getRank(tier)).toBeGreaterThanOrEqual(needed);
      }
    }
  });
});
