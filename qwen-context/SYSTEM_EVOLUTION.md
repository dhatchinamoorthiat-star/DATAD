# DATAD System Evolution Blueprint (12 Months)

**Objective:** Evolve from Skill Roadmap → Career Intelligence Platform  
**Central object:** `RoadmapItem`  
**Constraint:** Preserve all existing architecture. No rewrites. No parallel systems.  
**Principle:** Every new capability creates, enriches, updates, validates, or completes RoadmapItems.

---

## Architecture: The RoadmapItem

**Current definition** (in `PivotPlan.skillGaps` sub-schema):

```
skillGaps: [{
  skill, status,           ← existing core
  itemType, link, notes, sortOrder  ← from Week 1 enrichment
}]
```

**Target definition** (evolved over 12 months):

```
skillGaps: [{
  // ── Existing core (unchanged) ──
  skill, status, itemType, link, notes, sortOrder,

  // ── Phase 1: Resume Intelligence ──
  resumeMatchPct,          // how much does the resume cover this skill?
  resumeGapFlags,          // explicitly missing from resume → high priority

  // ── Phase 2: Learning Engine ──
  learningObjectives[],    // what "knowing this" means
  estimatedHours,          // time to close this gap
  difficulty,              // beginner / intermediate / advanced
  curatedResources[],      // { url, title, platform, duration, free }
  aiExplanation,           // AI-generated "why this matters for your target role"

  // ── Phase 3: Practice Engine ──
  practiceCompletions[],   // ref → PracticeSession
  evidenceLinks[],         // { url, type: github | certificate | screenshot }
  quizScore,               // latest quiz result

  // ── Phase 4: Job Intelligence ──
  companyRelevance,        // how important this skill is for the target company

  // ── Phase 5: Interview Intelligence ──
  interviewScore,          // latest AI-evaluated score for this skill
  interviewWeaknessFlags,  // skills that performed poorly → auto-elevate priority

  // ── Phase 6: Career Intelligence Graph ──
  graphConnections[],      // linked RoadmapItem IDs (prerequisites, follow-ups)
}]
```

Every field on this object is **optional** and **additive**. Existing pivot plans without any of these fields continue to work identically. The schema evolution is purely additive — no migrations, no breaking changes.

---

## Phase 1: Resume Intelligence

### Goal
Connect the student's existing resume to their roadmap so that skills already present in the resume are marked "done" automatically and genuine gaps are highlighted.

### User Journey
1. Student uploads their resume (PDF/DOCX) on the roadmap page or settings
2. System parses: skills, experience, education, certifications, projects
3. System matches parsed skills against RoadmapItem.skill fields
4. Matched items auto-advance to "done" with `resumeMatchPct`
5. Unmatched RoadmapItems get `resumeGapFlags` → prioritized in the UI
6. Resume score computed and shown as enrichment on the roadmap hero

### UX Flow
- **Resume upload button** appears on the roadmap hero (next to "Generate my roadmap")
- Upload uses existing Cloudinary infrastructure (PDF/image → extract text)
- During upload: show progress bar ("Parsing resume...")
- After parse: show diff view — "We found 4 of 7 skills in your resume. 3 skills need attention."
- Roadmap items update in-place (no page refresh needed)
- Resume score appears in the StudentSnapshot dashboard tile

### Backend Architecture
- **New:** `server/services/resumeParserService.js`
  - Uses AI (existing runner.js) to extract structured data from raw text
  - Sends resume text + existing prompt → structured JSON output
  - No new ML infrastructure needed
- **Modified:** `server/services/roadmapService.js`
  - New function `syncResumeToRoadmap(userId)` after parse completes
  - Iterates RoadmapItems, matches against extracted skills
  - Auto-advances matches to "done", flags gaps
- **Reused:** `cloudinary.js` for file upload (already handles PDFs? — currently image-only)
  - Extend `upload.js` middleware to accept `application/pdf`

### Database Models
- **Modified:** `PivotPlan.skillGaps` sub-document
  - Add optional fields: `resumeMatchPct: Number`, `resumeGapFlag: Boolean`
- **Modified:** `Resume.js` — already exists with `skills`, `education`, `experience` arrays
  - No schema changes needed; the parser populates existing fields
  - Add optional `lastParsedAt`, `parsedFromRoadmap` for tracking

### APIs
```
POST /api/resume/parse       → parse resume + sync to roadmap (modified)
GET  /api/resume/roadmap-sync → compare resume skills vs roadmap (new)
```

### AI Pipeline
1. Student uploads PDF → multer reads to buffer
2. Text extraction (pdf-parse or Cloudinary OCR) → plain text
3. Send to AI via `run({ system: resumeExtractPrompt, user: text, json: true })`
4. AI returns: `{ skills[], experience[], education[], certifications[], projects[] }`
5. Business logic: intersect with RoadmapItems → auto-advance matches

**Prompt** (new entry in `server/ai/prompts/index.js`):
```
resumeExtract: ({ rawText }) => ({
  system: withDaxIdentity(`Extract structured career data from resumes.`),
  user: `Extract skills, experience, education, certifications, and projects from this resume...`
})
```

### Integration Points
- **Roadmap service:** `syncResumeToRoadmap()` called after parse
- **Existing Resume model:** Parser populates `Resume.skills`, `.experience`, `.education`
- **Dashboard:** Resume score tile uses existing `getReadiness` endpoint (already scores resume)

### Security
- Resume upload uses existing `upload.js` middleware — extend to allow `application/pdf`
- File stored on Cloudinary (existing pattern), URL only persisted
- Resume text sent to AI provider — same risk as existing AI calls (prompt data leak)

### Analytics Events
- `resume_uploaded` — file uploaded
- `resume_parsed` — AI extraction completed
- `roadmap_items_auto_completed` — count of items advanced by resume match
- `resume_gaps_identified` — count of items not found in resume

### Estimated Complexity
**2 weeks** (1 week backend + 1 week frontend)

### Dependencies
- Existing Cloudinary config (may need to enable PDF support)
- Existing AI runner (no changes needed)
- Existing RoadmapItem schema (additive fields only)

### Risks
- Low: PDF parsing quality varies. Mitigation: always show parse results to user for confirmation before auto-advancing.
- Medium: AI cost for parsing resumes. One-time cost per upload (~2K tokens) — negligible.

### Migration Strategy
No migration needed. New fields are optional. Existing resumes continue to work.

### Backward Compatibility
- Existing `PivotPlan` documents without `resumeMatchPct` or `resumeGapFlag` render same as today
- Existing `Resume` documents continue to work
- `GET /api/resume` unchanged; new fields are additive

---

## Phase 2: Learning Engine

### Goal
Attach structured learning resources to each RoadmapItem so students know *how* to close each gap, not just *what* the gap is.

### User Journey
1. Student generates a roadmap (existing flow)
2. Each RoadmapItem now shows: difficulty, estimated time, learning objectives, curated resources
3. Student clicks a resource → opens external link (Coursera, YouTube, blog, etc.)
4. Student marks resource as "started" / "completed"
5. Completion of all resources for a RoadmapItem auto-advances its status

### UX Flow
- Roadmap items expand to show learning details when clicked
- "Resources" section lists 2-4 curated links per item with platform badges
- "Objectives" section shows what "mastering this" means
- "Time" label shows estimated hours (e.g., "~8 hours")
- Progress bar per item: "2 of 4 resources completed"
- DO NOT build a learning platform — every link opens externally

### Backend Architecture
- **Modified:** `server/ai/prompts/index.js` — extend `skillRoadmap` prompt to include learning objectives, resources, difficulty in output schema
- **Modified:** `server/services/roadmapService.js` — parse the extended AI output into new RoadmapItem fields
- **No new models.** All enrichment lives on the existing RoadmapItem sub-document.

### Database Models
- **Modified:** `PivotPlan.skillGaps` sub-document
  - Add: `learningObjectives: [String]`
  - Add: `estimatedHours: Number`
  - Add: `difficulty: String` (enum: `beginner | intermediate | advanced`)
  - Add: `curatedResources: [{ title, url, platform, duration, isFree, completed }]`

### APIs
```
PATCH /api/pivot/items/:itemId/resources/:resourceIndex  → toggle resource completion
```

This is the **only** new API call. Everything else flows through existing endpoints.

### AI Pipeline
The existing `skillRoadmap` prompt already generates recommendations. Extend its output schema:

```
// Current output
{ items: [{ skill, recommendationType, description, rationale, resourceLink, suggestedOrder }] }

// Extended output
{ items: [{
  skill, recommendationType, description, rationale, resourceLink, suggestedOrder,
  learningObjectives: ["Understand gradient descent", "Implement backpropagation from scratch"],
  estimatedHours: 12,
  difficulty: "intermediate",
  curatedResources: [
    { title: "Andrew Ng's ML Course", url: "https://coursera.org/...", platform: "Coursera", duration: "12h", isFree: true },
    { title: "3Blue1Brown - Neural Networks", url: "https://youtube.com/...", platform: "YouTube", duration: "1.5h", isFree: true },
  ]
}] }
```

### Integration Points
- **Roadmap display:** PivotPage shows expandable items with resource lists
- **Roadmap completion:** Resource completion → auto-advance item status

### Security
- All resource links are external URLs provided by the AI — no user-generated links stored
- Risk: AI could hallucinate fake URLs. Mitigation: show platform badge + link preview; let user confirm

### Analytics Events
- `resource_opened` — user clicked external resource link
- `resource_completed` — user marked resource as done
- `roadmap_item_enriched` — learning details added to an item

### Estimated Complexity
**1.5 weeks** (schema extension + prompt update + frontend expansion)

### Dependencies
- Phase 1 should be complete first (resume data enriches which items need resources)
- Existing prompt infrastructure

### Risks
- Low: AI-generated resources may be low quality. Mitigation: prefer well-known platforms (Coursera, YouTube, Kaggle, freeCodeCamp).
- Low: URLs may break. Acceptable for beta; AI regeneration fixes stale links.

### Migration Strategy
Existing RoadmapItems without learning fields render as today. Only newly generated roadmaps get enrichment.

### Backward Compatibility
- All new fields are optional sub-document properties
- UI checks for `item.learningObjectives?.length` before rendering expandable section
- Resource completion only affects items with the extended schema

---

## Phase 3: Practice Engine

### Goal
For each RoadmapItem, provide a lightweight practice mechanism (mini-projects, quizzes) that lets students *prove* they've closed the gap.

### User Journey
1. Student is on a RoadmapItem and clicks "Practice"
2. Sees 1-2 mini-project ideas or a 5-question quiz
3. For projects: student builds it, uploads evidence (link, screenshot, or repo URL)
4. For quizzes: AI generates questions, student answers, AI evaluates
5. Practice completion → RoadmapItem auto-advances to "done" with higher confidence

### UX Flow
- Each RoadmapItem has a "Practice" expandable section
- Two tabs: "Mini Projects" | "Knowledge Check"
- Projects show: title, description, suggested approach, evidence upload button
- Quizzes show: 5 MCQs or short-answer questions, submit button, score display
- After passing: item shows "✓ Practiced" badge + auto-advance

### Backend Architecture
- **New:** `server/models/PracticeSession.js` — lightweight model storing practice attempts
- **New:** `server/services/practiceService.js` — quiz generation + evidence validation
- **Modified:** `server/services/roadmapService.js` — `completePractice()` → updates RoadmapItem status
- **Modified:** `server/ai/prompts/index.js` — add `quizGenerate` and `projectSuggest` prompts

### Database Models
- **New:** `PracticeSession`
  ```
  { user, roadmapItemId, type: 'quiz' | 'project',
    status: 'in-progress' | 'passed' | 'failed',
    questions: [{ question, options, correctAnswer, userAnswer, isCorrect }],
    score, evidenceUrl, evaluatedAt, aiFeedback }
  ```
- **Modified:** `PivotPlan.skillGaps` sub-document
  - Add: `practiceCompletions: [{ practiceSessionId, type, passed, completedAt }]`

### APIs
```
POST   /api/practice/generate   → AI generates quiz or project for a RoadmapItem
POST   /api/practice/submit     → submit quiz answers or project evidence
GET    /api/practice/sessions   → list practice sessions for a roadmap item
```

### AI Pipeline
1. `POST /api/practice/generate` with `{ roadmapItemId }`
2. Fetch the RoadmapItem skill + learning objectives
3. Call AI: `run({ system: quizGenerate, user: context, json: true })`
4. AI returns `{ questions[] }` or `{ projectTitle, description, approach }`
5. `POST /api/practice/submit`:
   - For quizzes: compare answers → score → AI evaluates
   - For projects: AI reviews evidence → score

**Prompt** (extends existing `quizGenerate`):
```
practiceQuiz: ({ skill, objectives, difficulty }) => ({
  system: withDaxIdentity(`Generate practice questions for skill assessment.`),
  user: `Generate 5 questions to test "${skill}"...`
})
```

### Integration Points
- **Roadmap:** Practice completion → `roadmapService.completeItem()` → item status → "done"
- **Dashboard:** "Practice pending" count shown in TodayFocus rules
- **Analytics:** Practice events feed back into roadmap progress

### Security
- Evidence upload reuses existing `upload.js` (images only) — extend to PDFs
- AI evaluation of evidence: no user data leaks beyond what existing AI calls send

### Analytics Events
- `practice_quiz_generated` — quiz created for a roadmap item
- `practice_quiz_submitted` — answers submitted
- `practice_quiz_passed` — score above threshold
- `practice_evidence_uploaded` — project evidence submitted
- `roadmap_item_practice_completed` — item advanced due to practice

### Estimated Complexity
**3 weeks** (new model + AI prompts + frontend practice UI)

### Dependencies
- Phase 2 must be complete (learning objectives needed for quiz generation context)
- Existing AI runner

### Risks
- Medium: Quiz quality depends on prompt quality. Mitigation: start with MCQs (easy to evaluate), add short-answer in v2.
- Low: Students may try to bypass quizzes. Acceptable — self-assessment with AI validation.

### Migration Strategy
Existing RoadmapItems without practice data render as today. Practice is an opt-in expansion.

### Backward Compatibility
- `PracticeSession` is a new model — no existing data affected
- RoadmapItem sub-document `practiceCompletions` is optional

---

## Phase 4: Job Intelligence

### Goal
Make the roadmap company-specific. A student targeting Google will see a different roadmap than one targeting a startup.

### User Journey
1. Student uploads a job description (JD) or selects a target company from the existing database
2. System parses the JD to extract required skills, qualifications, experience
3. System compares JD skills against the student's current roadmap
4. Roadmap adapts: existing items get `companyRelevance` scores, new items added for skills in the JD not on the roadmap, low-relevance items deprioritized
5. Company-specific resources (interview tips, prep cards) surface on roadmap items

### UX Flow
- On the roadmap hero, add "Target company" field (uses existing `targetCompanies`)
- When a company is selected and has a prep card, show a badge: "Google-specific prep"
- Roadmap items reorder: high-relevance items float to top
- JD upload: drag-and-drop on roadmap page → "Analyze for role requirements"

### Backend Architecture
- **Modified:** `server/services/roadmapService.js`
  - New function `adaptRoadmapForCompany(userId, companyData)`:
    1. Parse JD → skill list
    2. Compute intersection with current RoadmapItems
    3. Items in JD but not on roadmap → add as new RoadmapItems
    4. Items on roadmap but not in JD → deprioritize (lower `sortOrder`)
    5. Set `companyRelevance` on each item
- **Reused:** `Company.js` model already exists with prep card data
- **Modified:** `server/ai/prompts/index.js` — add `jdParse` prompt

### Database Models
- **Modified:** `PivotPlan.skillGaps` sub-document
  - Add: `companyRelevance: Number` (0-100)
  - Add: `companySpecificResources: [{ company, resourceType, url }]`

### APIs
```
POST /api/pivot/adapt-for-company   → adapt roadmap for a specific company
  Body: { companyId } or { jobDescription: "..." }
```

This is the only new endpoint. Everything else flows through existing roadmap CRUD.

### AI Pipeline
1. JD upload → text extraction (same pattern as resume parsing)
2. AI parses JD → `{ requiredSkills[], preferredSkills[], experience, qualifications }`
3. Business logic compares against current roadmap (no AI needed for comparison)
4. Roadmap reordered and extended
5. Company-specific resources attached from existing Company model data

### Integration Points
- **Existing Company model:** `Company.js` already stores prep cards, interview rounds, tips
- **Existing readiness controller:** `getReadiness` already scores company research
- **Roadmap:** Company adaptation directly modifies RoadmapItem sort order + relevance

### Security
- JD content sent to AI provider — same risk model as existing AI calls
- No new data sensitivity

### Analytics Events
- `company_selected` — student selected a target company
- `jd_uploaded` — job description uploaded
- `roadmap_adapted_for_company` — roadmap modified based on company data
- `company_items_added` — count of new items created from JD

### Estimated Complexity
**2 weeks** (AI parsing + reordering logic + frontend company selector)

### Dependencies
- Existing Company model + prep cards
- Phase 1 resume parsing pipeline (reused for JD parsing)
- Phase 2 learning resources (company-specific resources enrich items)

### Risks
- Low: Students may not have a target company. Existing roadmap works unchanged. Company adaptation is purely additive.
- Low: JD may be generic ("looking for software engineer"). AI still extracts useful signal.

### Migration Strategy
Existing roadmaps without company adaptation render as today. Company selection is optional.

### Backward Compatibility
- `companyRelevance` is optional — roadmap sort order defaults to existing behavior when not set
- No new models — all enrichment on existing schemas

---

## Phase 5: Interview Intelligence

### Goal
Simulate realistic interviews and use the results to dynamically update the roadmap.

### User Journey
1. Student starts an interview session from the career hub or roadmap
2. AI conducts a structured interview (technical, HR, or behavioural)
3. AI evaluates responses in real-time on: Knowledge, Communication, Confidence, Depth
4. After the session, weak areas are identified
5. Each weak area → new RoadmapItem or priority bump on existing item
6. Student can retry specific topics to improve scores

### UX Flow
- "Mock Interview" button on roadmap hero (when items are "done")
- Interview type selector: Technical / HR / Behavioural
- Voice or text input (start with text, voice optional)
- Each question: AI asks → student responds → AI scores → next question
- After 5-8 questions: results dashboard showing per-skill scores
- "Improve weak areas" button that creates new roadmap tasks
- Interview history shows score trends over time

### Backend Architecture
- **New:** `server/models/InterviewSession.js`
  ```
  { user, roadmapItemIds[], type, status, questions: [{
    question, studentAnswer, aiFeedback,
    scores: { knowledge, communication, confidence, depth }
  }], overallScore, createdAt, completedAt }
  ```
- **New:** `server/services/interviewService.js`
  - `startInterview(userId, type, roadmapItemIds)` — generates questions from RoadmapItems
  - `submitAnswer(sessionId, questionIndex, answer)` — scores + next question
  - `completeInterview(sessionId)` — final evaluation → generate RoadmapItems for weak areas
- **Modified:** `server/services/roadmapService.js`
  - `createItemsFromInterview(userId, weakAreas)` — creates new RoadmapItems for skills scored below threshold
  - `bumpPriority(userId, skill)` — increases sort order for weak skills

### Database Models
- **New:** `InterviewSession` (described above)
- **Modified:** `PivotPlan.skillGaps` sub-document
  - Add: `interviewScore: { latest: Number, history: [Number] }`

### APIs
```
POST /api/interview/start      → begin interview session
POST /api/interview/answer     → submit answer, get next question
POST /api/interview/complete   → finish evaluation, generate roadmap items
GET  /api/interview/history    → past session scores and trends
```

### AI Pipeline
1. `POST /api/interview/start`:
   - Select relevant RoadmapItems (skills marked "done" or "in-progress")
   - AI generates 5-8 questions targeting those skills
2. `POST /api/interview/answer` (per answer):
   - Send student's answer to AI with scoring prompt
   - AI returns: `{ score, feedback, nextQuestion }`
   - Scoring dimensions: Knowledge, Communication, Confidence, Depth (each 1-10)
3. `POST /api/interview/complete`:
   - Aggregate scores across all answers
   - Identify skills below threshold (e.g., <6/10)
   - Generate new RoadmapItems for weak areas or bump priority on existing

### Integration Points
- **Roadmap:** Interview results → create items for weak areas. Perfect feedback loop.
- **Career hub:** Interview history shown alongside readiness score
- **Dashboard:** "Weak areas identified in your last interview" shown in TodayFocus

### Security
- Interview answers sent to AI provider — student-written text, not sensitive beyond existing risk model
- No PII beyond what student voluntarily shares in answers

### Analytics Events
- `interview_started` — interview session created
- `interview_completed` — session finished
- `interview_weak_areas_identified` — skills with low scores
- `roadmap_items_created_from_interview` — new items generated from weak areas
- `interview_score_trend` — per-user score improvement over time

### Estimated Complexity
**3 weeks** (interview prompt engineering + session model + frontend chat-like UI)

### Dependencies
- Phase 3 practice engine (interview is an extension of the practice concept)
- Existing AI runner with streaming support (for real-time question display)

### Risks
- Medium: Streaming answers + AI evaluation adds latency. Mitigation: stream questions, batch-evaluate at the end.
- Low: Students may give lazy answers to skip quickly. Mitigation: minimum answer length requirement.
- Low: AI evaluation of "confidence" and "depth" is subjective. Acceptable for self-improvement tool.

### Migration Strategy
No migration. InterviewSession is a new model. RoadmapItem enrichment is optional.

### Backward Compatibility
- RoadmapItems without `interviewScore` render as today
- Existing roadmap CRUD endpoints unchanged

---

## Phase 6: Career Intelligence Graph

### Goal
Connect every node in the student's journey so the roadmap becomes a live map of their career readiness, not a static checklist.

### User Journey
1. Student sees a visual graph on their roadmap page
2. Nodes: Resume → Skills → Learning → Practice → Projects → Interview → Placement
3. Edges show progress flow (e.g., "Completed TensorFlow course → Practiced on Kaggle → Scored 8/10 in interview")
4. Clicking a node shows the items at that stage and their connections
5. The graph auto-updates as the student progresses through each phase

### UX Flow
- New "Graph" tab on the roadmap page (beside "Items" and "Weekly")
- Force-directed graph visualization (D3.js or vis-network)
- Nodes colored by completion status
- Hover: tooltip with summary stats
- Click: drill into the detail view for that phase
- "Recommended path" highlight: the shortest path from current state to target placement

### Backend Architecture
- **New:** `server/services/graphService.js`
  - `buildGraph(userId)` — traverses all connected models and builds a graph adjacency list
  - Nodes are: RoadmapItems, PracticeSessions, InterviewSessions, Resume sections, Company targets
  - Edges are: `prerequisite_of`, `practiced_by`, `assessed_by`, `required_for`
  - Returns a JSON graph structure consumable by any frontend visualization library
- **No new models.** All data already exists in connected models. Graph is a computed view.

### Graph Schema (computed, not stored)
```json
{
  "nodes": [
    { "id": "skill:python", "type": "roadmap_item", "label": "Python", "status": "done", "score": 85 },
    { "id": "practice:quiz:python-1", "type": "practice", "label": "Python Quiz", "status": "passed", "score": 90 },
    { "id": "interview:session-3", "type": "interview", "label": "Technical Interview", "status": "completed", "score": 7.5 }
  ],
  "edges": [
    { "source": "skill:python", "target": "practice:quiz:python-1", "relation": "practiced_by" },
    { "source": "skill:python", "target": "interview:session-3", "relation": "assessed_by" }
  ]
}
```

### APIs
```
GET /api/graph   → return the full graph for the current user
GET /api/graph/path?from=skill:python&to=placement:google  → shortest completion path
```

### Integration Points
- **All phases 1-5:** Graph reads from RoadmapItems, PracticeSessions, InterviewSessions, Resume, PlacementApplications
- **Dashboard:** Graph summary shown as a small widget ("6 skills practiced, 3 quizzed, 1 interviewed")

### Security
- Graph is per-user — no cross-user data exposure
- Existing `verifyToken` protects the endpoint

### Analytics Events
- `graph_viewed` — user opened the graph tab
- `graph_node_clicked` — user drilled into a node
- `graph_path_viewed` — user requested a recommended path

### Estimated Complexity
**2 weeks** (graph computation service + visualization library + frontend component)

### Dependencies
- All previous phases must have live data to make the graph meaningful
- D3.js or vis-network as a new frontend dependency

### Risks
- Low: Graph may be too complex for some students. Default view should be a simplified "progress ring" — detailed graph is an opt-in drill-down.
- Low: Performance for students with hundreds of nodes. Mitigation: limit to last 2 years of activity.

### Migration Strategy
First page load builds graph from existing data. No stored graph — always computed.

### Backward Compatibility
Graph tab is hidden when no connected data exists. Existing roadmap page unchanged.

---

## Implementation Sequence & Dependencies

```
Phase 1 ──────────────────────────────────┐
  Resume Intelligence (2 wks)              │
                                          ▼
Phase 2 ──────────────────────────┐   Phase 4 ─────────────────────┐
  Learning Engine (1.5 wks)       │     Job Intelligence (2 wks)    │
                                  │                                │
                                  ▼                                │
                           Phase 3 ─────────────────────┐          │
                             Practice Engine (3 wks)    │          │
                                                        │          │
                                                        ▼          ▼
                                                  Phase 5 ──────────────┐
                                                    Interview (3 wks)   │
                                                                        ▼
                                                                  Phase 6 ──────────┐
                                                                    Graph (2 wks)     │
                                                                                      │
                                                                           Career Intelligence Platform
```

**Total estimated timeline: ~14 weeks (3.5 months)**

Phases 1, 2, and 4 can run in parallel (no dependencies between JD parsing and learning resources). Phases 3 and 5 require Phases 2 and 4. Phase 6 requires all previous phases.

### What This Means for the Architecture

**After all 6 phases, every RoadmapItem looks like this:**

```
skill: "Machine Learning"
status: "in-progress"

// From resume (Phase 1)
resumeMatchPct: 60          // resume covers 60% of ML concepts
resumeGapFlag: true         // "Deep Learning" missing from resume

// From learning (Phase 2)
learningObjectives: ["Understand neural networks", "Train a CNN"]
estimatedHours: 20
difficulty: "advanced"
curatedResources: [{ title: "Fast.ai Course", url: "...", platform: "Fast.ai", isFree: true }]

// From practice (Phase 3)
practiceCompletions: [{ sessionId, type: "quiz", passed: true, completedAt }]

// From job intelligence (Phase 4)
companyRelevance: 85        // highly relevant for Google ML Engineer
companySpecificResources: [{ company: "Google", type: "interview_tip", url: "..." }]

// From interview (Phase 5)
interviewScore: { latest: 7.5, history: [6.0, 7.0, 7.5] }

// From graph (Phase 6)
prerequisites: ["Linear Algebra", "Python", "Statistics"]
```

**Nothing is new — everything is a progressive enrichment of the existing RoadmapItem.**

The PivotPlan model schema evolves from 5 fields to ~20, but every field is optional. A student who only uses the Skill Roadmap (Phase 0) sees a simple checklist. A student through all 6 phases sees a rich, connected career intelligence system — **and they're looking at the same `PivotPlan` document.**

This is how DATAD becomes a Career Intelligence Platform without ever rewriting the core architecture.
