/**
 * P7 — does the recommendation engine respond to career domain, or only to
 * profile completeness?
 *
 * The Phase 2 report found zero overlap between two students' recommendations
 * and correctly refused to accept that as proof of personalisation:
 *
 *   Alice (Finance, has a resume)  → Prepare STAR Stories · Expand Your Skills…
 *   Bob   (Marketing, no resume)   → Create Your Resume · Continue Learning…
 *
 * Zero overlap, and every difference explained by "Alice has a resume and Bob
 * does not". Nothing in either set mentioned Finance or Marketing. The engine
 * was responding to what a student had *done*, not to what they wanted to
 * become — and the two students differed in both, so the experiment could not
 * separate them.
 *
 * This is that experiment run properly: two profiles identical in every
 * completeness signal, differing ONLY in career domain. Any difference in the
 * output is therefore attributable to domain and nothing else.
 *
 * The generators are pure functions of a profile object, so this needs no
 * database, no AI provider and no credits — which is also why it can live in
 * the permanent suite rather than being a one-off script.
 */

const focusGen = require('../ai/recommendation-engine/generators/focusGenerator');
const priorityGen = require('../ai/recommendation-engine/generators/priorityGenerator');
const studySessionGen = require('../ai/recommendation-engine/generators/studySessionGenerator');
const weakTopicGen = require('../ai/recommendation-engine/generators/weakTopicGenerator');
const placementGen = require('../ai/recommendation-engine/generators/placementGenerator');
const resumeGen = require('../ai/recommendation-engine/generators/resumeGenerator');
const interviewGen = require('../ai/recommendation-engine/generators/interviewGenerator');
const deadlineGen = require('../ai/recommendation-engine/generators/deadlineGenerator');
const plannerGen = require('../ai/recommendation-engine/generators/plannerGenerator');
const wellnessGen = require('../ai/recommendation-engine/generators/wellnessGenerator');

// `.generate` — each module exports { generate }, and index.js builds its own
// list the same way. The aiActionGenerator is left out deliberately: it is the
// one generator that calls a provider, and this suite must stay free to run.
const GENERATORS = {
  focus: focusGen.generate, priority: priorityGen.generate,
  studySession: studySessionGen.generate, weakTopic: weakTopicGen.generate,
  placement: placementGen.generate, resume: resumeGen.generate,
  interview: interviewGen.generate, deadline: deadlineGen.generate,
  planner: plannerGen.generate, wellness: wellnessGen.generate,
};

/**
 * A profile whose every completeness signal is fixed, parameterised only by
 * career domain.
 *
 * This is the control that the original experiment lacked. Resume state, task
 * counts, scores, streaks — everything the engine reads as "what this student
 * has done" — is identical between the two students, so the only variable left
 * is the domain.
 */
function profileFor({ dreamRole, targetRoles, skills, careerInterests, industries }) {
  return {
    identity: {
      name: 'Test Student',
      dreamRole,
      course: 'MBA',
      specialization: dreamRole,
      graduationYear: 2027,
    },
    memory: {
      targetRoles,
      careerInterests,
      preferredIndustries: industries,
      skills,
    },
    // ── everything below is deliberately identical for both students ──
    scores: {
      careerReadiness: 55,
      academicHealth: 70,
      engagement: 60,
      wellness: 65,
    },
    resume: {
      exists: true,
      completeness: 60,
      hasSummary: true,
      sections: { education: 1, experience: 1, projects: 1, skills: 4 },
      missingSections: ['certifications'],
    },
    planner: {
      hasPivotPlan: false,
      tasksTotal: 6,
      tasksOverdue: 1,
      tasksDueSoon: 2,
    },
    activity: { streak: 4, lastActiveDaysAgo: 0, notesCount: 5, sessionsThisWeek: 3 },
    placement: { applicationsCount: 2, upcomingDrives: 1, interviewsScheduled: 0 },
    academics: { weakTopics: [{ topic: 'Statistics', score: 42 }], semester: 3 },
  };
}

const ALICE_FINANCE = profileFor({
  dreamRole: 'Financial Analyst',
  targetRoles: ['Financial Analyst', 'Investment Analyst'],
  skills: ['Excel', 'Financial Modelling'],
  careerInterests: ['Finance', 'Investment Banking'],
  industries: ['Banking', 'Financial Services'],
});

const BOB_MARKETING = profileFor({
  dreamRole: 'Brand Manager',
  targetRoles: ['Brand Manager', 'Marketing Manager'],
  skills: ['SEO', 'Digital Marketing'],
  careerInterests: ['Marketing', 'Brand Strategy'],
  industries: ['FMCG', 'Advertising'],
});

/** Alice, after changing her stated goal from Finance to Marketing. */
const ALICE_SWITCHED = profileFor({
  dreamRole: 'Brand Manager',
  targetRoles: ['Brand Manager', 'Marketing Manager'],
  skills: ['Excel', 'Financial Modelling'], // skills unchanged: only the GOAL moved
  careerInterests: ['Marketing', 'Brand Strategy'],
  industries: ['FMCG', 'Advertising'],
});

function runAll(profile) {
  const out = [];
  for (const [name, gen] of Object.entries(GENERATORS)) {
    try {
      for (const rec of gen(profile) || []) out.push({ generator: name, ...rec });
    } catch (err) {
      throw new Error(`generator "${name}" threw: ${err.message}`);
    }
  }
  return out;
}

/** All human-readable text of a recommendation set, lowercased. */
const textOf = (recs) =>
  recs.map((r) => [r.title, r.description, r.reason, r.expectedImpact].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();

const FINANCE_TERMS = ['finance', 'financial', 'investment', 'banking', 'excel', 'modelling', 'analyst'];
const MARKETING_TERMS = ['marketing', 'brand', 'seo', 'fmcg', 'advertising', 'digital'];

const countTerms = (text, terms) => terms.filter((t) => text.includes(t)).length;

describe('the engine runs identically for both students', () => {
  it('produces recommendations for both profiles', () => {
    expect(runAll(ALICE_FINANCE).length).toBeGreaterThan(0);
    expect(runAll(BOB_MARKETING).length).toBeGreaterThan(0);
  });

  it('is deterministic — the same profile twice gives the same result', () => {
    // Without this, any difference measured below could be noise.
    expect(textOf(runAll(ALICE_FINANCE))).toBe(textOf(runAll(ALICE_FINANCE)));
  });
});

describe('domain sensitivity, with completeness held constant', () => {
  const alice = runAll(ALICE_FINANCE);
  const bob = runAll(BOB_MARKETING);

  /**
   * Which generators actually respond to the domain.
   *
   * Measured by DIFFERENCING Alice against Bob, not by searching for domain
   * words. Searching gives false positives, and one bit this test on the first
   * run: interviewGenerator emits the fixed sentence "Aim for 20+ cases across
   * strategy, marketing, finance, and operations" for every student alive, so a
   * keyword scan reported it as marketing-aware and finance-aware at once. A
   * generator is domain-aware only if its output CHANGES when the domain does.
   */
  function domainSensitiveGenerators() {
    const byGen = (recs) => {
      const m = new Map();
      for (const r of recs) {
        const text = [r.title, r.description, r.reason, r.expectedImpact].filter(Boolean).join(' ');
        m.set(r.generator, `${m.get(r.generator) || ''}\n${text}`);
      }
      return m;
    };
    const a = byGen(alice);
    const b = byGen(bob);
    const changed = [];
    for (const gen of new Set([...a.keys(), ...b.keys()])) {
      if (a.get(gen) !== b.get(gen)) changed.push(gen);
    }
    return changed.sort();
  }

  it('THE FINDING: the recommendation SET is identical across career domains', () => {
    // The Phase 2 caveat, isolated. The original experiment varied domain AND
    // completeness and saw zero overlap; with completeness held equal, the two
    // students are told to do exactly the same things. Recommendation
    // *selection* does not consider career domain at all — the engine is a
    // state machine over what a student has done.
    //
    // Asserted rather than noted, so that making the engine domain-aware breaks
    // this test and becomes a decision instead of an unremarked change.
    expect(alice.map((r) => r.title).sort()).toEqual(bob.map((r) => r.title).sort());
    expect(alice.map((r) => r.type).sort()).toEqual(bob.map((r) => r.type).sort());
  });

  it('exactly one generator varies its wording with the stated goal', () => {
    // plannerGenerator interpolates the target roles into its description.
    // That is genuine, and it is one sentence in one of six recommendations.
    expect(domainSensitiveGenerators()).toEqual(['planner']);
  });

  it('that one generator names the student\'s own goal and not the other\'s', () => {
    const planner = (recs) => recs.find((r) => r.generator === 'planner');
    expect(planner(alice).description).toContain('Financial Analyst');
    expect(planner(alice).description).not.toContain('Brand Manager');
    expect(planner(bob).description).toContain('Brand Manager');
    expect(planner(bob).description).not.toContain('Financial Analyst');
  });

  it('does not mistake boilerplate for personalisation', () => {
    // Guards the measurement itself. interviewGenerator mentions both
    // "marketing" and "finance" in fixed copy shown to everyone; if this ever
    // starts differing between students it is either real personalisation or a
    // change worth noticing, and either way the assertion above should be the
    // thing that decides it.
    const interviewText = (recs) =>
      recs.filter((r) => r.generator === 'interview').map((r) => r.description).join(' ');
    expect(interviewText(alice)).toBe(interviewText(bob));
    expect(interviewText(alice).toLowerCase()).toContain('marketing');
  });
});

describe('changing the stated goal changes the recommendations', () => {
  const before = runAll(ALICE_FINANCE);
  const after = runAll(ALICE_SWITCHED);

  it('changes the wording when Finance becomes Marketing', () => {
    // The sprint's second experiment. The brief refused to accept "zero
    // overlap" as evidence, so this checks the domain language actually moved.
    const beforeText = textOf(before);
    const afterText = textOf(after);

    expect(beforeText).not.toBe(afterText);
    expect(beforeText).toContain('financial analyst');
    expect(afterText).toContain('brand manager');
    expect(afterText).not.toContain('financial analyst');
  });

  it('BUT the recommendation set is unchanged — only the nouns move', () => {
    // The honest limit of the personalisation, stated as an assertion. A
    // student who changes their entire career goal is told to do exactly the
    // same things. Nothing recommends learning marketing rather than valuation.
    expect(before.map((r) => r.title).sort()).toEqual(after.map((r) => r.title).sort());
    expect(before.map((r) => r.type).sort()).toEqual(after.map((r) => r.type).sort());
  });
});

describe('the variable that DOES drive selection', () => {
  it('changes the recommendation set when career readiness drops', () => {
    // The contrast that proves the engine works as built, and that the domain
    // result above is a real property rather than a dead harness. A readiness
    // score of 20 adds "Placement Readiness Needs Attention" and drops the two
    // interview recommendations.
    const healthy = runAll(ALICE_FINANCE);
    const struggling = runAll({
      ...ALICE_FINANCE,
      scores: { ...ALICE_FINANCE.scores, careerReadiness: 20 },
    });

    expect(struggling.map((r) => r.title).sort()).not.toEqual(healthy.map((r) => r.title).sort());
    expect(struggling.map((r) => r.title)).toContain('Placement Readiness Needs Attention');
  });
});
