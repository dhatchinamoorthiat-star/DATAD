const mongoose = require('mongoose');

/**
 * One stored analysis run. Append-only history rather than a single current
 * result, so a student can see whether last week's edits moved the number and
 * an improvement to the rules never rewrites what they were told before.
 *
 * `rulesVersion` and `analysisVersion` are what make that safe. The first
 * pins the scoring rules that produced this document; the second pins its
 * shape, so the client can decline to render a payload from a future version
 * rather than half-rendering it.
 *
 * Sub-documents are stored with `_id: false`. These are computed values, not
 * entities — nothing addresses a recommendation by id, and the ids would be
 * meaningless noise in a document that is written whole and read whole.
 */

const sub = (definition) => new mongoose.Schema(definition, { _id: false });

const CONFIDENCE = { type: String, enum: ['high', 'medium', 'low'], default: 'medium' };

const recommendationSchema = sub({
  key: String,
  dimension: String,
  dimensionLabel: String,
  issue: String,
  whyItMatters: String,
  action: String,
  expectedImpact: String,
  pointsAvailable: Number,
  effort: { type: String, enum: ['low', 'medium', 'high'] },
  confidence: CONFIDENCE,
  // True when the fix depends on a fact only the student has (a number, a
  // link, an outcome). The UI asks for it; nothing is invented in its absence.
  needsUserInput: { type: Boolean, default: false },
  evidence: String,
});

/**
 * A before/after rewrite. `after` is only ever populated when the rewrite can
 * be assembled from material already in the profile — `evidenceNeeded` carries
 * the questions whose answers are missing, and the UI shows those instead of a
 * rewrite containing invented achievements.
 */
const rewriteSchema = sub({
  section: String,
  target: String,          // which entry, for per-experience rewrites
  before: String,
  problem: String,
  after: String,
  why: String,
  evidenceNeeded: [String],
  confidence: CONFIDENCE,
});

const linkedInAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    linkedInProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'LinkedInProfile' },

    rulesVersion: { type: String, required: true },
    analysisVersion: { type: Number, required: true },

    // Hash of the profile this ran against. Lets the UI tell the difference
    // between "here is your score" and "here is your score for the text you
    // have since edited", which is the difference between a useful number and
    // a misleading one.
    profileHash: { type: String, maxlength: 64 },

    // Snapshot of the target as it was at analysis time. Stored rather than
    // referenced: a score only means anything next to the target it was
    // measured against, and the student may well change that target later.
    target: {
      role: String,
      secondaryRole: String,
      industry: String,
      seniority: String,
      location: String,
      inferred: Boolean,
      roleMatched: String,   // taxonomy entry actually used, null if none
    },

    score: { type: Number, min: 0, max: 100, required: true },
    dimensions: {
      positioning:   { score: Number, max: Number },
      searchability: { score: Number, max: Number },
      credibility:   { score: Number, max: Number },
      completeness:  { score: Number, max: Number },
      narrative:     { score: Number, max: Number },
      conversion:    { score: Number, max: Number },
    },

    // Every check with its outcome and reason — this is what makes the score
    // explainable rather than asserted.
    checks: [sub({
      key: String,
      dimension: String,
      label: String,
      weight: Number,
      earned: Number,
      status: { type: String, enum: ['pass', 'partial', 'fail', 'skipped'] },
      why: String,
      fix: String,
    })],

    keywords: {
      coverage: Number,
      roleMatched: String,
      missingHigh: [String],
      weakHigh: [String],
      terms: [sub({
        term: String,
        kind: String,
        importance: String,
        present: Boolean,
        weak: Boolean,
        locations: [String],
        recommendedIn: [String],
      })],
      stuffing: sub({
        detected: Boolean,
        headlineIsKeywordList: Boolean,
        headlineSeparators: Number,
        overusedTerms: [String],
      }),
    },

    skills: {
      matchScore: Number,
      strong: [String],
      partial: [sub({ skill: String, note: String })],
      missing: [String],
      provenButUnlisted: [sub({ skill: String, foundIn: [String] })],
      deprioritise: [String],
      placement: [sub({ skill: String, demonstrateIn: String })],
    },

    redFlags: [sub({
      key: String,
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      issue: String,
      note: String,
    })],

    authenticity: {
      assessable: Boolean,
      specificity: Number,
      note: String,
      observations: [sub({ kind: String, detail: String })],
    },

    recommendations: [recommendationSchema],
    actionPlan: {
      fixNow: [recommendationSchema],
      improveNext: [recommendationSchema],
      longTerm: [recommendationSchema],
    },
    upgradePlan: [sub({
      day: Number,
      theme: String,
      tasks: [sub({ key: String, action: String, issue: String, needsUserInput: Boolean })],
    })],

    // ── LLM-authored sections ────────────────────────────────────────────
    // Everything above is deterministic. Everything below came from a model,
    // was schema-validated, and is absent rather than guessed when the model
    // was unavailable or its output failed validation.
    narrative: {
      headline: sub({
        problems: [String],
        recommended: String,
        alternatives: [String],
        keywordsAdded: [String],
        keywordsRemoved: [String],
        explanation: String,
        confidence: CONFIDENCE,
      }),
      about: sub({
        problems: [String],
        structure: [String],
        rewrite: String,
        evidenceNeeded: [String],
        confidence: CONFIDENCE,
      }),
      experience: [rewriteSchema],
      differentiator: sub({
        statement: String,
        reasoning: String,
        buildOn: [String],
        confidence: CONFIDENCE,
      }),
      featured: sub({ suggestions: [sub({ item: String, why: String })] }),
      // Set when the LLM pass did not run or its output was rejected. The UI
      // shows the deterministic analysis and says the writing review is
      // unavailable, rather than silently presenting a partial result.
      unavailable: { type: String, default: null },
    },

    recommendationStrategy: {
      current: Number,
      seniorCount: Number,
      principle: String,
      targets: [sub({ from: String, at: String, about: String, ask: String })],
    },

    jobMatch: {
      overall: Number,
      jdTitle: String,
      titleAligned: Boolean,
      termCount: Number,
      strongMatches: [sub({ term: String, foundIn: [String] })],
      partialMatches: [sub({ term: String, note: String })],
      missingSignals: [String],
      skillsToDevelop: [String],
      emphasise: [sub({ role: String, organization: String, matchedTerms: [String], reason: String })],
      // The JD itself is never stored: it is somebody else's copyrighted
      // posting and has no use after the comparison. Only a label is kept so
      // the student can tell two saved matches apart.
      label: String,
    },

    // Which DATAD sources fed the analysis — shown in the UI so a student can
    // see why a recommendation knows about their resume.
    contextSources: {
      identity: Boolean,
      resume: Boolean,
      career: Boolean,
      jobDescription: Boolean,
    },

    meta: {
      provider: String,
      model: String,
      tokensUsed: Number,
      latencyMs: Number,
      llmSkipped: Boolean,
    },
  },
  { timestamps: true }
);

// The history view: this user's analyses, newest first.
linkedInAnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.LinkedInAnalysis
  || mongoose.model('LinkedInAnalysis', linkedInAnalysisSchema);
