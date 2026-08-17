/**
 * Service-level tests: career-intent resolution and LLM output validation.
 *
 * These two are what stand between a useful analysis and a harmful one. Intent
 * resolution decides what the profile is measured against — get it wrong and
 * every recommendation optimises for the wrong job. Output validation decides
 * what the model is allowed to put in front of the student — get it wrong and
 * DATAD writes a fabricated achievement into a real LinkedIn profile that a
 * recruiter will ask about in an interview.
 *
 * Both are pure functions, so neither needs a database or a provider.
 */

const { resolveTarget, validateNarrative } = require('../services/linkedinService');
const { strongProfile } = require('./fixtures/linkedin.sample');

describe('career intent resolution', () => {
  it('prefers what the student explicitly asked for', () => {
    const out = resolveTarget(
      { target: { role: 'Stored Role' } },
      { dreamRole: 'Identity Role' },
      { role: 'Requested Role' }
    );
    expect(out.role).toBe('Requested Role');
    expect(out.inferred).toBe(false);
    expect(out.confident).toBe(true);
  });

  it('falls back to the stored target before the DATAD profile', () => {
    const out = resolveTarget({ target: { role: 'Stored Role' } }, { dreamRole: 'Identity Role' }, {});
    expect(out.role).toBe('Stored Role');
  });

  it('infers from the DATAD profile and marks the result as inferred', () => {
    const out = resolveTarget(null, { dreamRole: 'Product Analyst', preferredIndustries: ['SaaS'] }, {});
    expect(out.role).toBe('Product Analyst');
    expect(out.industry).toBe('SaaS');
    // Inferred intent is shown back for confirmation and lowers the confidence
    // of anything derived from it — never presented as certain.
    expect(out.inferred).toBe(true);
    expect(out.confident).toBe(false);
  });

  it('asks rather than guessing when there is nothing to infer from', () => {
    const out = resolveTarget(null, null, {});
    expect(out.role).toBe('');
    expect(out.needsInput).toBe(true);
  });

  it('defaults an undergraduate to intern-level and a working professional to mid', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(resolveTarget(null, { dreamRole: 'X', graduationYear: nextYear }, {}).seniority).toBe('intern');
    expect(resolveTarget(null, { dreamRole: 'X', studentType: 'experienced', workExYears: 5 }, {}).seniority).toBe('mid');
  });
});

describe('narrative validation', () => {
  const profile = strongProfile();

  it('keeps a rewrite whose figures come from the profile', () => {
    // 12% appears in this student's own experience description, so a rewrite
    // may repeat it.
    const out = validateNarrative({
      about: { rewrite: 'Rebuilt the onboarding funnel report, improving activation by 12%.' },
    }, profile);

    expect(out.about.rewrite).toContain('12%');
  });

  it('drops a rewrite that invents a figure the profile never claimed', () => {
    const out = validateNarrative({
      about: { rewrite: 'Drove a 47% increase in revenue across three product lines.' },
    }, profile);

    // The whole rewrite goes, not just the number: a sentence built around a
    // fabricated result cannot be salvaged by deleting the digits, and a
    // student copying it into LinkedIn could not defend it in an interview.
    expect(out.about.rewrite).toBe('');
  });

  it('drops a fabricated figure from an experience rewrite and from a headline', () => {
    const out = validateNarrative({
      headline: { recommended: 'Product Analyst | 89% faster reporting' },
      experience: [{ target: 'Zoho', before: 'Worked on reports', after: 'Cut reporting time by 73%.' }],
    }, profile);

    expect(out.headline.recommended).toBe('');
    expect(out.experience[0].after).toBe('');
    // The diagnosis survives even when the rewrite does not — the student
    // still learns what was wrong with the line.
    expect(out.experience[0].before).toBe('Worked on reports');
  });

  it('leaves an unquantified rewrite alone', () => {
    const text = 'Analysed campaign performance in GA4 and identified the conversion bottleneck that informed the next campaign.';
    expect(validateNarrative({ about: { rewrite: text } }, profile).about.rewrite).toBe(text);
  });

  it('normalises a missing or invalid confidence to medium', () => {
    const out = validateNarrative({ about: { confidence: 'extremely high' }, headline: {} }, profile);
    expect(out.about.confidence).toBe('medium');
    expect(out.headline.confidence).toBe('medium');
  });

  it('returns a usable empty shape when the model returns nonsense', () => {
    for (const junk of [null, 'a string', 42, []]) {
      const out = validateNarrative(junk, profile);
      // Arrays and primitives are not the object shape the schema expects; a
      // non-object is rejected outright rather than half-parsed.
      if (out.unavailable) expect(typeof out.unavailable).toBe('string');
      else expect(out.headline).toBeDefined();
    }
  });

  it('caps oversized model output rather than storing it', () => {
    const out = validateNarrative({
      about: { rewrite: 'x'.repeat(20000), problems: Array(50).fill('problem') },
    }, profile);

    expect(out.about.rewrite.length).toBeLessThanOrEqual(3000);
    expect(out.about.problems.length).toBeLessThanOrEqual(6);
  });

  it('keeps the questions the model needs answered before it can rewrite', () => {
    const out = validateNarrative({
      about: { rewrite: '', evidenceNeeded: ['What measurable result did the campaign work produce?'] },
    }, profile);

    expect(out.about.evidenceNeeded[0]).toMatch(/measurable result/);
  });
});
