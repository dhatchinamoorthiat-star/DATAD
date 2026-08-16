# Architecture Deep Dive: Skill, Evidence, Confidence, Relationships, Versioning

---

## 1. Canonical Skill Entity

### Problem
Currently, skills are free-text strings scattered across `StudentIdentity.skills`, `Resume.skills`, `PivotPlan.currentSkills`, and `PivotPlan.skillGaps[].skill`. There is no single source of truth for "what a skill is" — so `"Python"` and `"python"` and `"Python3"` are treated as different skills.

### Design: `Skill` model

```javascript
// server/models/Skill.js
const skillSchema = new mongoose.Schema({
  // Canonical identifier — used by every other model to reference a skill
  name:     { type: String, required: true, unique: true, lowercase: true, trim: true },

  // Human-readable label (displayed in UI)
  label:    { type: String, required: true },

  // Categorisation
  category: { type: String, enum: ['programming', 'domain', 'soft', 'tool', 'language', 'other'], default: 'other' },
  tags:     [{ type: String, trim: true }],   // e.g. ['ml', 'data-science', 'python-ecosystem']

  // Prerequisite skills (references other Skill documents by name)
  prerequisites: [{ type: String, ref: 'Skill' }],

  // Metadata
  aliases:  [{ type: String, trim: true }],   // alternative spellings: 'python3', 'py', 'python-3'
  isActive: { type: Boolean, default: true },  // soft-delete for deprecated skills

  // Enrichment (populated by admin or AI, not by users)
  description:     { type: String, maxlength: 500 },
  typicalProficiency: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'intermediate' },
  commonResources: [{ title: String, url: String, platform: String }],
}, { timestamps: true });
```

### Usage Across Models

All existing models migrate from free-text skill strings → references:

| Model | Field | Migration |
|-------|-------|-----------|
| `StudentIdentity` | `skills[]` | Free text → references to `Skill.name` |
| `PivotPlan` | `skillGaps[].skill` | Free text → reference to `Skill.name` |
| `PivotPlan` | `currentSkills[]` | Free text → references to `Skill.name` |
| `Resume` | `skills[]` | Free text → references to `Skill.name` |

**Migration strategy:** Create a one-time script that normalizes existing free-text skill strings. For each unique skill string across all documents:
1. Lowercase + trim
2. Check if a `Skill` document exists with matching `name` or any `alias`
3. If yes → use that `_id`
4. If no → create a new `Skill` document with `name`, `label`, and appropriate `category`

The migration is additive — existing documents retain their free-text strings until the normalized reference is set. A `skillRef` field on each array item holds the reference while `skill` (the string) is kept for backward compatibility.

### Why This Matters
- **Normalization:** RoadmapItem status can be aggregated per canonical skill
- **Relationships:** Prerequisite chains, skill categories, and role-skill mappings become queryable
- **Confidence:** A single skill's confidence is computed from all evidence across Resume, Practice, Interview — impossible without a canonical reference
- **ROLE_SKILL_MAP** (currently hardcoded in `roadmapService.js`) becomes a database collection of `RoleSkillMap { role, skillRef, importance }`

---

## 2. Evidence Model

### Problem
Currently, progress is binary — a RoadmapItem is either "not-started", "in-progress", or "done". There is no record of *why* it was marked done. If a student's resume shows Python and the roadmap auto-advances Python to "done", that's a different quality of evidence than completing a quiz with 90%.

### Design: Evidentiary Layer

Every action that proves a skill creates an `Evidence` document:

```javascript
// server/models/Evidence.js
const evidenceSchema = new mongoose.Schema({
  user:          { type: ObjectId, ref: 'User', required: true },
  skill:         { type: String, required: true },   // Canonical Skill.name
  source:        { type: String, required: true,
                   enum: ['resume_parse', 'learning_completion', 'practice_quiz',
                          'practice_project', 'interview', 'manual_toggle',
                          'certificate_upload', 'course_completion', 'github_link'] },
  sourceId:      { type: ObjectId },                 // Points to the originating document
  confidence:    { type: Number, min: 0, max: 100 }, // How sure we are (see Section 3)

  // Context — what was actually demonstrated
  description:   { type: String, maxlength: 500 },
  score:         { type: Number, min: 0, max: 100 }, // If source produced a numeric score
  url:           { type: String, maxlength: 500 },   // Link to proof (repo, certificate, screenshot)

  // Metadata
  expiresAt:      { type: Date },    // Some evidence is time-sensitive (e.g., course completion 5 years ago)
  verifiedBy:     { type: String, enum: ['ai', 'peer', 'admin', 'self'], default: 'self' },
}, { timestamps: true });

evidenceSchema.index({ user: 1, skill: 1, source: 1 });
evidenceSchema.index({ user: 1, source: 1, sourceId: 1 });
```

### Evidence Sources (per phase)

| Source | Phase | Creates Evidence | Confidence Weight |
|--------|-------|-----------------|-------------------|
| Resume contains skill | 1 | `{ source: 'resume_parse', score: 100 }` | Medium |
| Student completed all learning resources | 2 | `{ source: 'learning_completion' }` | Low-Medium |
| Student passed practice quiz | 3 | `{ source: 'practice_quiz', score }` | High |
| Student submitted project + AI approved | 3 | `{ source: 'practice_project', score }` | High |
| Student performed well in interview | 5 | `{ source: 'interview', score }` | High |
| Student manually toggled item to "done" | 0 | `{ source: 'manual_toggle' }` | Low |
| Student linked a GitHub repo | 3 | `{ source: 'github_link' }` | Medium |
| Certificate uploaded | 3 | `{ source: 'certificate_upload' }` | Medium |

### How RoadmapItem Uses Evidence

The RoadmapItem's `status` field becomes a **computed** value, not a user-set enum:

```javascript
roadmapItem.status = computeStatus(evidenceDocuments);
// not-started  → no evidence
// in-progress  → evidence exists but none is high-confidence
// done         → at least one high-confidence evidence document
```

The user can still manually toggle status (that creates a `manual_toggle` evidence with low confidence), but the system can override it when higher-confidence evidence arrives.

---

## 3. Confidence Scoring

### Problem
A "done" RoadmapItem could mean anything: the student has a PhD in the subject, skimmed a blog post, or just clicked the checkbox. We need a single number that answers: *"How sure are we that this student actually has this skill?"*

### Design: Continuous Confidence

```javascript
function computeSkillConfidence(evidenceDocs) {
  // Each evidence document has a base weight depending on source type
  const WEIGHTS = {
    resume_parse:          30,    // stated on resume — some signal
    learning_completion:   20,    // consumed content — weak signal
    practice_quiz:         60,    // passed a test — strong signal
    practice_project:      70,    // built something — strongest non-interview signal
    interview:             80,    // demonstrated under evaluation
    certificate_upload:    50,    // third-party validation
    github_link:           40,    // portfolio evidence
    manual_toggle:         10,    // self-reported — weakest signal
    course_completion:     30,    // completed a structured course
  };

  if (evidenceDocs.length === 0) return 0;

  // Decay: older evidence counts less (linear decay over 2 years)
  const now = Date.now();
  const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
  const scores = evidenceDocs.map(ev => {
    const age = now - new Date(ev.createdAt).getTime();
    const decay = Math.max(0, 1 - age / TWO_YEARS);
    const weight = WEIGHTS[ev.source] || 10;
    return (ev.score || 70) / 100 * weight * decay;
  });

  // Sum with diminishing returns for multiple evidence of same type
  // (doing 5 quizzes doesn't mean 5x the confidence)
  const MAX_PER_SOURCE = 100;
  const grouped = {};
  for (const ev of evidenceDocs) {
    grouped[ev.source] = (grouped[ev.source] || 0) + WEIGHTS[ev.source] || 10;
  }
  const cappedSum = Object.values(grouped)
    .reduce((sum, w) => sum + Math.min(w, MAX_PER_SOURCE), 0);

  // Normalize to 0-100
  const maxPossible = Object.keys(WEIGHTS).length * MAX_PER_SOURCE;
  return Math.min(100, Math.round((cappedSum / maxPossible) * 100));
}
```

**Interpretation:**

| Range | Meaning | UI Display |
|-------|---------|------------|
| 0 | No evidence | "Not started" |
| 1-25 | Self-reported or inferred | "In progress (self-reported)" |
| 26-50 | Some verification | "In progress (verified)" |
| 51-75 | Strong evidence | "Practiced" badge |
| 76-100 | Multiple high-confidence sources | "Mastered" badge |

### Where Confidence Renders

- **RoadmapItem** — confidence badge next to status
- **Dashboard** — overall skill confidence as a progress ring (alongside readiness score)
- **Graph** — node opacity represents confidence
- **Resume** — skills with low confidence flagged as "needs verification"

---

## 4. Relationships: Resume → Interview → Practice → RoadmapItem

### The Data Flow

```
                          ┌──────────────────┐
                          │     Resume        │
                          │  (parsed skills)  │
                          └────────┬─────────┘
                                   │ creates Evidence with source:'resume_parse'
                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                     RoadmapItem                                   │
│                                                                   │
│  skill: "Machine Learning"                                        │
│  status: computed from evidence                                   │
│  confidence: computed from evidence                               │
│  evidence: [resume_parse, practice_quiz, interview, ...]          │
│                                                                   │
│  ┌────────────────┐   ┌────────────────┐   ┌──────────────────┐  │
│  │ PracticeSession│   │InterviewSession│   │ LearningResource │  │
│  │ (quiz/project) │──▶│ (scored eval)  │   │ (course/article) │  │
│  └───────┬────────┘   └───────┬────────┘   └────────┬─────────┘  │
│          │                    │                      │            │
│          ▼                    ▼                      ▼            │
│     Evidence             Evidence               Evidence         │
│     source:'quiz'       source:'interview'     source:'learning'  │
└───────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │    Confidence    │
                          │    computed      │
                          └──────────────────┘
```

### Key Relationships

**Resume → RoadmapItem:**
- Resume parsing extracts skills → creates `Evidence(source: 'resume_parse')` per skill
- Evidence feeds into RoadmapItem's confidence computation
- Skills in resume but not on roadmap → system suggests adding them as new RoadmapItems with confidence pre-filled
- No direct foreign key. Source is linked via `Evidence.sourceId` pointing to the Resume document.

**PracticeSession → RoadmapItem:**
- PracticeSession has a `roadmapItemId` field linking it to the specific RoadmapItem
- On practice completion, Evidence is created and RoadmapItem confidence is recomputed
- Multiple PracticeSessions can target the same RoadmapItem (skill)

**InterviewSession → RoadmapItem:**
- InterviewSession has `questions[].skills[]` linking questions to specific skills
- Per-skill scores generate Evidence per skill
- Weak interview areas (score < 6/10) automatically create new RoadmapItems or bump priority

**Evidence → RoadmapItem:**
- Evidence.skill → RoadmapItem.skill (via canonical Skill.name)
- This is a logical join, not a schema-level foreign key
- Query: `Evidence.find({ user, skill })` → compute confidence → update RoadmapItem confidence

### Cross-Phase Query Example

```
Find all RoadmapItems where:
  - Student has high resume confidence but low interview confidence
  → These are "needs interview practice" items

Query:
  const resumeEv = Evidence.find({ user, source: 'resume_parse' }).lean();
  const interviewEv = Evidence.find({ user, source: 'interview' }).lean();
  const gaps = resumeEv.filter(r =>
    !interviewEv.some(i => i.skill === r.skill) ||
    interviewEv.find(i => i.skill === r.skill).confidence < 60
  );
```

---

## 5. Versioning Strategy for RoadmapItems

### Problem
When a student regenerates their roadmap (adds new skills, changes target role), the old RoadmapItems are replaced. This means:
- Practice history is orphaned (PracticeSession references stale item IDs)
- Evidence documents lose their parent context
- Progress is reset

### Design: Immutable Roadmap Versions

```javascript
// server/models/RoadmapVersion.js
const roadmapVersionSchema = new mongoose.Schema({
  user:         { type: ObjectId, ref: 'User', required: true, index: true },
  version:      { type: Number, required: true },
  previousVersion: { type: Number, default: null },

  // Snapshot of the plan at this version
  targetRole:   { type: String },
  targetDomain: { type: String },
  currentSkills: [{ type: String }],

  // Timestamps
  createdAt:    { type: Date, default: Date.now },
  supersededAt: { type: Date },  // set when a newer version replaces this one
  source:       { type: String, enum: ['ai_generated', 'manual_edit', 'resume_sync', 'company_adapt'] },

  // Optional: reason for this version
  changeLog:    { type: String, maxlength: 500 },
}, { timestamps: true });
```

### How It Works

1. **When a roadmap is generated/regenerated:**
   - Current `PivotPlan` data is snapshot into a new `RoadmapVersion` document with incremented `version`
   - `PivotPlan` is updated with the new data (existing behavior)
   - Old RoadmapItem `_id`s are archived in the version snapshot
   - New RoadmapItem `_id`s are created

2. **Evidence documents reference RoadmapVersion + skill name, not RoadmapItem _id:**
   - `Evidence` stores `{ user, skill: "Python", source: "practice_quiz", ... }`
   - This means Evidence survives roadmap regeneration
   - When a new roadmap is generated, existing Evidence is matched by canonical skill name

3. **RoadmapItem status restoration:**
   - On new roadmap generation, for each new item:
     - Query `Evidence.find({ user, skill: item.skill })`
     - Compute confidence from all evidence
     - Set item status + confidence from computed value (not from previous version)

### Migration for Existing Data

Existing `PivotPlan` documents without versioning get version `1` assigned on first read after deployment. A `RoadmapVersion` is backfilled with the current state.

### Access Pattern

```javascript
// Get current roadmap (existing API — unchanged)
GET /api/pivot

// Get version history
GET /api/pivot/versions → [{ version, targetRole, createdAt }]

// Compare with previous version
GET /api/pivot/versions/diff?v1=2&v2=3
  → { added: [...], removed: [...], persisted: [...] }

// Rollback to previous version
POST /api/pivot/versions/2/restore
```

### Why This Matters

- **Evidence survives regenerations** — a quiz passed for "Python" in version 2 still counts in version 4
- **History is queryable** — "show me how my roadmap has changed over time"
- **Rollback is possible** — if a regeneration produces worse results, revert
- **Analytics** — "how many times does the average student regenerate their roadmap before they're satisfied?"

---

## Summary: How These Five Pieces Work Together

```
Student uploads resume
       │
       ▼
Resume Parsing → Evidence(resume_parse, confidence: 30)
       │
       ▼
Roadmap generated → RoadmapVersion(v1)
       │
       ▼
For each RoadmapItem:
  ├── Evidence exists? → compute confidence from all evidence
  ├── No evidence? → status = "not-started"
  │
  ▼
Student practices → PracticeSession(roadmapItemId)
       │
       ▼
Evidence(practice_quiz, score: 85, confidence: 60)
       │
       ▼
RoadmapItem status recomputed → "in-progress" (confidence: 60)
       │
       ▼
Student interviews → InterviewSession(questions[].skills[])
       │
       ▼
Evidence(interview, score: 7.5, confidence: 80)
       │
       ▼
RoadmapItem status recomputed → "done" (confidence: 80)
       │
       ▼
Student regenerates roadmap → RoadmapVersion(v2)
       │
       ▼
New RoadmapItem "Python":
  ├── Evidence.find(user, "Python") → [resume_parse, quiz, interview]
  ├── computeConfidence → 80
  ├── status = "done" (carried forward)
  └── No progress lost.
```

This is the entire architecture in one flow. Every component strengthens the same central object. Nothing branches off into a separate product.
