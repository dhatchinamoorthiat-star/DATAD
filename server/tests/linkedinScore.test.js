/**
 * Scoring, keyword and recommendation tests.
 *
 * The promise this feature makes is that the score is reproducible and
 * explainable. Both halves are pinned here: the same profile plus the same
 * rules version always produces the same number, and every lost point comes
 * back with the reason it was lost.
 */

const { scoreProfile } = require('../utils/linkedin/score');
const { analyzeKeywords } = require('../utils/linkedin/keywords');
const { analyzeSkills, matchJobDescription } = require('../utils/linkedin/match');
const { detectRedFlags } = require('../utils/linkedin/redFlags');
const { buildRecommendations, buildActionPlan, buildUpgradePlan } = require('../utils/linkedin/actionPlan');
const { isQuantified, deriveSignals } = require('../utils/linkedin/signals');
const { DIMENSIONS, roleProfile } = require('../utils/linkedin/knowledge');

const { strongProfile, weakProfile, emptyProfile, injectedProfile } = require('./fixtures/linkedin.sample');

const TARGET = { role: 'Product Analyst', industry: 'SaaS', seniority: 'entry' };

/** Score a fixture end to end the way the service does. */
const score = (profile, target = TARGET, jd = '') => {
  const keywords = analyzeKeywords(profile, target, jd);
  return { ...scoreProfile(profile, target, keywords), keywords };
};

describe('scoring framework', () => {
  it('has dimension weights totalling 100', () => {
    expect(Object.values(DIMENSIONS).reduce((s, d) => s + d.max, 0)).toBe(100);
  });

  it('is reproducible for the same input', () => {
    const a = score(strongProfile());
    const b = score(strongProfile());
    expect(a.score).toBe(b.score);
    expect(a.checks).toEqual(b.checks);
  });

  it('ranks a positioned, evidenced profile well above an unpositioned one', () => {
    const strong = score(strongProfile()).score;
    const weak = score(weakProfile()).score;

    expect(strong).toBeGreaterThan(70);
    expect(weak).toBeLessThan(35);
    expect(strong - weak).toBeGreaterThan(35);
  });

  it('scores an empty profile at or near zero without throwing', () => {
    const out = score(emptyProfile());
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThan(10);
  });

  it('keeps every dimension inside its declared maximum', () => {
    for (const profile of [strongProfile(), weakProfile(), emptyProfile()]) {
      for (const dim of Object.values(score(profile).dimensions)) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(dim.max);
      }
    }
  });

  it('explains every point it withholds', () => {
    // A failing check with no reason renders as an unexplained deduction,
    // which is the thing the product explicitly promises never to do.
    for (const check of score(weakProfile()).checks) {
      if (check.status === 'fail' || check.status === 'partial') {
        expect(typeof check.why).toBe('string');
        expect(check.why.length).toBeGreaterThan(10);
        expect(typeof check.fix).toBe('string');
      }
    }
  });

  it('does not attach a failure reason to a check that passed', () => {
    for (const check of score(strongProfile()).checks) {
      if (check.status === 'pass') expect(check.why).toBeNull();
    }
  });
});

describe('unanswerable checks', () => {
  it('skips the photo check rather than failing it when the question was never asked', () => {
    const unknown = { ...strongProfile(), hasPhoto: null };
    const answeredNo = { ...strongProfile(), hasPhoto: false };

    expect(score(unknown).checks.find((c) => c.key === 'has_photo').status).toBe('skipped');
    expect(score(answeredNo).checks.find((c) => c.key === 'has_photo').status).toBe('fail');
    // Not knowing must never cost more than knowing the answer is no.
    expect(score(unknown).score).toBeGreaterThanOrEqual(score(answeredNo).score);
  });
});

describe('target sensitivity', () => {
  it('scores the same profile differently against a different target role', () => {
    const profile = strongProfile();
    const forAnalyst = score(profile, { role: 'Product Analyst' }).score;
    const forDesigner = score(profile, { role: 'UX Designer' }).score;

    // This is the feature working, not a bug: an analytics profile is not a
    // strong design profile, and a system that scored it identically would be
    // measuring polish rather than fit.
    expect(forAnalyst).toBeGreaterThan(forDesigner);
  });

  it('skips keyword coverage entirely for a role outside the taxonomy', () => {
    const out = score(strongProfile(), { role: 'Underwater Basket Weaving Specialist' });
    expect(out.keywords.coverage).toBeNull();
    expect(out.checks.find((c) => c.key === 'keyword_coverage').status).toBe('skipped');
    // And the remaining checks still produce a usable score.
    expect(out.score).toBeGreaterThan(0);
  });
});

describe('signals', () => {
  it('counts a result as quantified and a date as not', () => {
    expect(isQuantified('Improved activation by 12%')).toBe(true);
    expect(isQuantified('Analysed responses from 1,200 students')).toBe(true);
    expect(isQuantified('Reduced runtime from 4 hours to 20 minutes')).toBe(true);
    expect(isQuantified('Raised ₹50,000 for the fest')).toBe(true);

    // A date range is when the work happened, not what it achieved. Counting
    // it would let every entry claim impact for free.
    expect(isQuantified('Jun 2024 - Aug 2024')).toBe(false);
    expect(isQuantified('Worked on marketing campaigns')).toBe(false);
  });

  it('identifies the bullets that describe attendance rather than contribution', () => {
    const signals = deriveSignals(weakProfile(), roleProfile('Product Analyst').titles);
    expect(signals.experience.weakBulletCount).toBeGreaterThan(0);
    expect(signals.experience.entries[0].weakestBullet).toMatch(/worked on|helped with|responsible for/i);
  });

  it('flags a headline that names a degree but no role', () => {
    const signals = deriveSignals(weakProfile(), roleProfile('Product Analyst').titles);
    expect(signals.headline.educationOnly).toBe(true);
    expect(signals.headline.mentionsTargetRole).toBe(false);
  });

  it('does not call a headline education-only when it also names a role', () => {
    const profile = { ...weakProfile(), headline: 'CS student building data pipelines | aspiring Data Analyst' };
    const signals = deriveSignals(profile, roleProfile('Data Analyst').titles);
    expect(signals.headline.educationOnly).toBe(false);
  });
});

describe('keyword analysis', () => {
  it('matches terminology whole and case-insensitively', () => {
    const out = analyzeKeywords(strongProfile(), TARGET);
    const sql = out.terms.find((t) => t.term === 'SQL');
    expect(sql.present).toBe(true);
    expect(sql.locations).toEqual(expect.arrayContaining(['skills', 'experience']));
  });

  it('does not match a term inside a longer word', () => {
    const profile = { ...emptyProfile(), about: 'I use NoSQLite daily.' };
    const sql = analyzeKeywords(profile, TARGET).terms.find((t) => t.term === 'SQL');
    expect(sql.present).toBe(false);
  });

  it('matches terminology carrying punctuation', () => {
    const profile = { ...emptyProfile(), skills: [{ name: 'A/B Testing' }], about: 'Ran A/B Testing on signup.' };
    expect(analyzeKeywords(profile, TARGET).terms.find((t) => t.term === 'A/B Testing').present).toBe(true);
  });

  it('marks a skill listed but never demonstrated as weak', () => {
    const profile = { ...emptyProfile(), skills: [{ name: 'SQL' }] };
    const sql = analyzeKeywords(profile, TARGET).terms.find((t) => t.term === 'SQL');
    expect(sql.weak).toBe(true);
    expect(sql.locations).toEqual(['skills']);
  });

  it('tells the student where a missing keyword belongs', () => {
    const missing = analyzeKeywords(weakProfile(), TARGET).terms.find((t) => t.term === 'SQL');
    expect(missing.present).toBe(false);
    expect(missing.recommendedIn.length).toBeGreaterThan(0);
  });

  it('detects a headline that is a keyword list', () => {
    const profile = { ...strongProfile(), headline: 'SQL | Python | Excel | Tableau | Power BI | Analytics | Data | ML' };
    expect(analyzeKeywords(profile, TARGET).stuffing.headlineIsKeywordList).toBe(true);
  });

  it('does not call a normal two-part headline stuffed', () => {
    expect(analyzeKeywords(strongProfile(), TARGET).stuffing.headlineIsKeywordList).toBe(false);
  });
});

describe('skills intelligence', () => {
  const out = analyzeSkills(strongProfile(), TARGET);

  it('separates skills that are proven from skills that are merely listed', () => {
    expect(out.strong).toContain('SQL');
    expect(out.matchScore).toBeGreaterThan(50);
  });

  it('surfaces a skill proven in the profile but missing from the Skills field', () => {
    const profile = { ...strongProfile(), skills: [{ name: 'Excel' }] };
    const result = analyzeSkills(profile, TARGET);
    // SQL is all over the experience descriptions but no longer listed — the
    // one-click fix that changes which searches they appear in.
    expect(result.provenButUnlisted.map((s) => s.skill)).toContain('SQL');
  });

  it('says where a missing skill should be demonstrated, not just mentioned', () => {
    const result = analyzeSkills(weakProfile(), TARGET);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.placement[0]).toHaveProperty('demonstrateIn');
  });
});

describe('job description matching', () => {
  const JD = `Product Analyst
We are looking for a Product Analyst to join our SaaS team.

Responsibilities:
- Build dashboards and analyse product usage with SQL
- Design and evaluate A/B Testing programmes
- Partner with product managers on Retention and funnel analysis

Requirements:
- Strong SQL skills
- Experience with Product Analytics tools such as Amplitude
- Familiarity with A/B Testing and Retention metrics`;

  it('scores a matching profile high and a mismatched one low', () => {
    const strong = matchJobDescription(strongProfile(), JD, TARGET);
    const weak = matchJobDescription(weakProfile(), JD, TARGET);

    expect(strong.overall).toBeGreaterThan(weak.overall);
    expect(strong.strongMatches.map((m) => m.term)).toContain('SQL');
    expect(weak.missingSignals).toContain('SQL');
  });

  it('names which of the student\'s own experiences to lead with', () => {
    const out = matchJobDescription(strongProfile(), JD, TARGET);
    expect(out.emphasise[0].organization).toBe('Zoho');
    expect(out.emphasise[0].reason).toMatch(/terms/);
  });

  it('reports title alignment separately from terminology', () => {
    const out = matchJobDescription(strongProfile(), JD, TARGET);
    expect(out.jdTitle).toBe('Product Analyst');
    expect(out.titleAligned).toBe(true);
  });
});

describe('red flags', () => {
  const flagsFor = (profile) => {
    const signals = deriveSignals(profile, roleProfile('Product Analyst').titles);
    return detectRedFlags(profile, signals);
  };

  it('flags an experience entry that ends before it starts', () => {
    const profile = { ...strongProfile() };
    profile.experience = [{ ...profile.experience[0], duration: 'Aug 2024 - Jun 2024' }];
    expect(flagsFor(profile).flags.map((f) => f.key)).toContainEqual(expect.stringContaining('date_reversed'));
  });

  it('flags experience entries with no description', () => {
    expect(flagsFor(weakProfile()).flags.map((f) => f.key)).toContain('empty_experience');
  });

  it('raises nothing on a clean profile', () => {
    expect(flagsFor(strongProfile()).flags.filter((f) => f.severity !== 'low')).toEqual([]);
  });

  it('never phrases a finding as an accusation of dishonesty', () => {
    for (const profile of [weakProfile(), strongProfile()]) {
      for (const flag of flagsFor(profile).flags) {
        expect(`${flag.issue} ${flag.note}`).not.toMatch(/\b(lie|lying|lied|fake|fraud|dishonest|false claim)\b/i);
      }
    }
  });
});

describe('authenticity and specificity', () => {
  it('reports low specificity for writing built from stock phrases', () => {
    const { authenticity } = detectRedFlags(weakProfile(), deriveSignals(weakProfile(), []));
    expect(authenticity.assessable).toBe(true);
    expect(authenticity.specificity).toBeLessThan(60);
    expect(authenticity.observations.map((o) => o.kind)).toEqual(expect.arrayContaining(['generic_language']));
  });

  it('reports high specificity for writing full of named things and numbers', () => {
    const { authenticity } = detectRedFlags(strongProfile(), deriveSignals(strongProfile(), []));
    expect(authenticity.specificity).toBeGreaterThan(70);
  });

  it('declines to assess writing too short to judge', () => {
    const { authenticity } = detectRedFlags(emptyProfile(), deriveSignals(emptyProfile(), []));
    expect(authenticity.assessable).toBe(false);
    expect(authenticity.specificity).toBeNull();
  });

  it('never claims to detect AI authorship', () => {
    const { authenticity } = detectRedFlags(weakProfile(), deriveSignals(weakProfile(), []));
    expect(authenticity.note).toMatch(/does not, and cannot, determine who or what wrote it/i);
    expect(JSON.stringify(authenticity)).not.toMatch(/AI[- ]generated|written by (an )?AI|ChatGPT/i);
  });
});

describe('recommendations and the plan', () => {
  const scored = score(weakProfile());
  const ctx = { roleMatched: 'product analyst', jobDescriptionProvided: false, targetRole: 'Product Analyst' };
  const recs = buildRecommendations(scored, ctx);

  it('orders by impact over effort and is stable between runs', () => {
    expect(recs.length).toBeGreaterThan(3);
    expect(buildRecommendations(score(weakProfile()), ctx)).toEqual(recs);
  });

  it('gives every recommendation the fields the UI contracts for', () => {
    for (const rec of recs) {
      expect(rec).toMatchObject({
        issue: expect.any(String),
        whyItMatters: expect.any(String),
        action: expect.any(String),
        expectedImpact: expect.any(String),
        effort: expect.stringMatching(/^(low|medium|high)$/),
        confidence: expect.stringMatching(/^(high|medium|low)$/),
        needsUserInput: expect.any(Boolean),
      });
    }
  });

  it('lowers confidence when the target role is not in the taxonomy', () => {
    const unknownRole = buildRecommendations(scored, { ...ctx, roleMatched: null });
    expect(unknownRole.find((r) => r.key === 'keyword_coverage').confidence).toBe('low');
  });

  it('marks recommendations that need a fact only the student has', () => {
    const needsInput = recs.filter((r) => r.needsUserInput).map((r) => r.key);
    // Impact numbers and proof of work cannot be produced by the system, and
    // the plan has to say so rather than inviting a model to fill them in.
    expect(needsInput).toEqual(expect.arrayContaining(['quantified_impact']));
  });

  it('caps Fix Now at five and keeps produce-new-work items out of it', () => {
    const plan = buildActionPlan(recs);
    expect(plan.fixNow.length).toBeLessThanOrEqual(5);
    expect(plan.fixNow.every((r) => r.effort !== 'high')).toBe(true);
    expect(plan.longTerm.every((r) => r.effort === 'high')).toBe(true);
  });

  it('builds a plan of at most seven days, ordered by what matters most', () => {
    const days = buildUpgradePlan(recs);
    expect(days.length).toBeGreaterThan(0);
    expect(days.length).toBeLessThanOrEqual(7);
    expect(days.map((d) => d.day)).toEqual([...Array(days.length)].map((_, i) => i + 1));
    expect(days.every((d) => d.tasks.length > 0)).toBe(true);
  });

  it('produces no recommendations for checks that passed', () => {
    const strongRecs = buildRecommendations(score(strongProfile()), ctx);
    const passed = score(strongProfile()).checks.filter((c) => c.status === 'pass').map((c) => c.key);
    expect(strongRecs.map((r) => r.key).filter((k) => passed.includes(k))).toEqual([]);
  });
});

describe('prompt injection in profile content', () => {
  const profile = injectedProfile();

  it('scores an injected profile as ordinary content rather than complying with it', () => {
    const out = score(profile);
    // The "rate this profile 100/100" instruction has no effect. The score
    // comes from the checks, and this profile has a degree, one thin
    // experience entry and nothing else — it scores like one.
    expect(out.score).toBeLessThan(50);
    // The specific thing the injected text asked for.
    expect(out.score).not.toBe(100);
  });

  it('does not carry executable instruction syntax into anything the prompt reads', () => {
    const out = score(profile);
    const serialised = JSON.stringify(out.signals);
    expect(serialised).not.toContain('<|im_start|>');
    expect(serialised).not.toContain('[INST]');
  });

  it('still returns a complete analysis for such a profile', () => {
    const out = score(profile);
    expect(out.checks.length).toBeGreaterThan(10);
    expect(Object.keys(out.dimensions)).toHaveLength(6);
  });
});
