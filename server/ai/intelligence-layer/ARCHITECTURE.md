# Student Intelligence Layer

## Overview

The intelligence layer computes a per-student profile and hands it to the AI
gateway, which injects it into the prompt. Since the snapshot layer landed
(August 2026) it also *remembers* that profile: a daily snapshot, trends
computed over it, and a ledger of Dax's own forward-looking claims resolved
against it.

```
Request → buildStudentProfile() → AI Gateway → V1 runtime → Response
                │                     │
                │                     └─ injects profile.enrichedContext
                │
                ├─ 9 collectors (parallel) → scoringEngine → 12 scores
                └─ trends.summarizeTrends() ← StudentProfileSnapshot history

Nightly:  snapshotProfiles → StudentProfileSnapshot
          resolvePredictions → DaxPrediction outcomes
          computeCohortInsights → CohortInsight
          sendJudgmentNudges → notifications
```

> **What this document used to say, and why it was wrong.** Earlier versions
> described V1/V2 hybrid routing, an `_execV2()` integration point, and a table
> of profile-driven routing overrides ("urgency > 70 forces V1"). None of that
> exists. The V2/hybrid/shadow switch was removed in the Sprint 2 AI
> consolidation (July 2026) — it had never been reachable in production, because
> the env default was `v1_only` and the V2 path called an export that did not
> exist. See the header comment in `server/ai/aiGateway.js`. There is one
> runtime and the profile does not route anything; it personalises the prompt.

## Components

```
server/ai/intelligence-layer/
├── index.js                    # Entry point: buildStudentProfile(), getIntelligence()
├── profileFactory.js           # Profile structure + enriched context builder
├── scoringEngine.js            # Computes the 12 scores from collected data
├── trends.js                   # getTrend / getDelta / summarizeTrends over snapshots
├── ARCHITECTURE.md             # This document
└── collectors/
    ├── identityCollector.js    # User, UserProfile, StudentIdentity, SiteMeta
    ├── memoryCollector.js      # UserMemory (AI-accumulated student context)
    ├── taskCollector.js        # Task (pending, overdue, deadlines)
    ├── noteCollector.js        # Note (subjects, topics, count)
    ├── plannerCollector.js     # PivotPlan, Project (career plans, skill gaps)
    ├── careerCollector.js      # Resume, PlacementApplication, CompanyRead, StarStory
    ├── learningCollector.js    # HabitLog, DailyCaseSolve, streak, consistency
    ├── activityCollector.js    # ChatMessage, AiUsage (recent queries, engagement)
    └── stressCollector.js      # Task deadlines, application status (stress inference)
```

## Request flow

1. A route handler or automation job calls the gateway with a `userId`.
2. `aiGateway._buildProfile()` calls `intelligenceLayer.buildStudentProfile(userId)`.
3. The nine collectors run in parallel; each returns structured data or `null`.
4. `scoringEngine.computeScores()` derives the 12 scores.
5. `trends.summarizeTrends()` reads the snapshot history and returns a short
   line of notable movements — or `''` when the student has no history yet.
6. `profileFactory.buildProfile()` assembles the profile and builds
   `enrichedContext`, a pipe-separated string.
7. The gateway injects `enrichedContext` into the system prompt as a
   `[Student Context]` block, and attaches `profile.scores` and
   `profile.enrichedContext` to the response.

A profile is `null` when the request has no `userId`; the gateway then behaves
as it did before this layer existed.

## Collected data

| Field | Source | Contents |
|-------|--------|----------|
| `identity` | User, UserProfile, StudentIdentity, SiteMeta | Name, tier, batch, specialization, days to placement, learning style, goals, challenges, college |
| `memory` | UserMemory | Specialization, career interests, target companies, readiness score, recent topics, strengths, weaknesses, preferred explanation style |
| `tasks` | Task | Total/pending/overdue/completed counts, upcoming deadlines, task type distribution |
| `notes` | Note | Total count, recent subjects, recent titles |
| `planner` | PivotPlan, Project | Has pivot plan, career change direction, skill gaps, active projects |
| `career` | Resume, PlacementApplication, CompanyRead, StarStory | Resume completion %, skills, experience, applications by status, companies researched, STAR stories count |
| `learning` | HabitLog, DailyCaseSolve, UserMemory, Task | Streak, consistency %, study minutes, pomodoros, weak/strong topics |
| `activity` | ChatMessage, AiUsage | Chat messages today, AI calls today, recent query topics |
| `stress` | Task, PlacementApplication | Stress level (0-100), indicators, overdue/near-deadline counts, rejection count |

## Computed scores

| Score | Range | Description |
|-------|-------|-------------|
| `currentFocus` | string | `deadline-pressure`, `catch-up`, `placement-prep`, `interview-prep`, `task-management`, `skill-building`, `exploration`, `general` |
| `currentChallenges` | string[] | Top challenges detected |
| `recommendedTone` | string | `supportive`, `direct`, `encouraging`, `professional`, `curious`, `neutral`, `detailed` |
| `recommendedResponseLength` | string | `short`, `moderate`, `long` |
| `recommendedExamples` | string[] | Example topics drawn from skills, industries, recent topics |
| `urgencyLevel` | 0–100 | Overdue tasks, near deadlines, placement proximity |
| `motivationLevel` | 0–100 | Streak, consistency, interview activity, rejections |
| `confidence` | 0–100 | Skill depth, experience, readiness score, rejections |
| `learningVelocity` | 0–100 | Consistency, streak, task completion, study volume |
| `careerReadiness` | 0–100 | Resume, skills, research, stories, applications |
| `contextQualityScore` | 0–100 | How many data sources were available |
| `intelligenceScore` | 0–100 | Weighted composite of the above |

The three `recommended*` scores are emitted into `enrichedContext` as an
explicit "How to respond:" instruction clause, so personalisation changes *how*
Dax speaks and not only *what* it knows.

## The memory layer

Everything above is recomputed per request. These four pieces are what persist.

### 1. Daily snapshots — `models/StudentProfileSnapshot.js`

`automation/intelligence/snapshotProfiles.js`, 02:30 UTC / 08:00 IST
(`CRON_PROFILE_SNAPSHOT`). One row per active student per day: the 12 scores
plus eight raw `signals` counters. Unique on `{user, dateKey}`, so a re-run
overwrites rather than duplicates.

- **Active** means a device session seen in the last 14 days
  (`User.sessions[].lastSeenAt`, touched by `services/deviceSessions.js`).
- Students whose `contextQualityScore` is 0 are skipped — a snapshot of nothing
  would flatten every trend computed over it.
- Cursor-driven, five profiles in flight at a time.

**This data cannot be backfilled.** A day the job does not run is a day of that
student's history that no longer exists.

### 2. Trends — `trends.js`

`getTrend(userId, metric, {days})` returns the series, `getDelta` the movement
between its ends, `summarizeTrends` a terse line of only the notable movements,
capped at four clauses for the prompt's token budget. It returns `''` rather
than a label with nothing behind it, because an empty "Trends:" is an
invitation for the model to invent one. `ai/dax.js` correspondingly instructs
Dax to cite the numbers behind any trajectory claim and never to assert a trend
that is not in its context.

### 3. Prediction ledger — `models/DaxPrediction.js`

Recorded from the deterministic forward-looking paths only
(`recommendation-engine/goalProgress.js`, `weeklyReview.js`) via
`ai/predictions/ledger.js`. Free-form chat is deliberately **not** parsed for
predictions.

`automation/intelligence/resolvePredictions.js` (03:00 UTC / 08:30 IST,
`CRON_PREDICTION_RESOLVE`) settles each due claim against the snapshot nearest
its horizon, or marks it `unresolvable` when no snapshot is within ±3 days. It
never guesses and never re-resolves: every write is guarded on
`outcome: 'pending'`.

`getAccuracy(userId)` and `GET /api/recommendations/predictions` show hits and
misses in the same unfiltered list. Nothing softens a miss — an assistant that
says "I predicted 5 weeks, it took 8" is the point of the feature.

### 4. Cohort insights — `models/CohortInsight.js`

`automation/intelligence/computeCohortInsights.js` (03:30 UTC / 09:00 IST,
`CRON_COHORT_INSIGHTS`) precomputes aggregates per `batch × college × program`.
Privacy rules live in `models/profileVisibility.js` and are enforced at write
time: no cohort under five members, no converted/unconverted split unless both
sides clear five independently, aggregates only, and stored rows deleted when a
cohort shrinks below the minimum.

### Judgment nudges

`automation/intelligence/sendJudgmentNudges.js` (04:00 UTC / 09:30 IST,
`CRON_JUDGMENT_NUDGE`) is the one cron that pushes judgement rather than
content: near a drive, with overdue tasks, and a falling consistency trend. Hard
capped at one per student per day.

## Enriched context

Example, with the trend segment last:

```
Student: Aarav Sharma | Batch: 2025 | Specialization: Finance | Days to placement: 45 |
Plan: pro | Placement readiness: 72/100 | Target roles: Investment Banking, Consulting |
Pending tasks: 3 | Overdue: 1 | Streak: 12 days | Consistency: 80% |
Focus: placement-prep | Challenges: Imminent placement season |
How to respond: adopt a professional tone; keep it under ~250 words unless asked for more |
Trend over last 14d: consistency down 30% since 2026-08-09 (80→56)
```

## Backward compatibility

| Aspect | Status |
|--------|--------|
| Route handlers | Unchanged |
| Gateway API | `process(request)` signature unchanged; profile built internally |
| Response shape | `profile` field added; downstream code ignores unknown fields |
| Automation jobs | Profile built when `userId` is present on the request |
| No `userId` | Profile is `null`; gateway behaves as before |
| No snapshot history | `trendSummary` is `''`; the context segment is omitted |

## Not yet done

- Chat-sourced predictions. This needs the model to emit a structured claim;
  parsing free text for forecasts would fill the ledger with claims Dax never
  made and then score itself against them.
- Cohort insights are computed and privacy-gated but not yet injected into the
  chat context.
- Calendar/event and exam-schedule collectors.
- Temporal decay — weighting recent activity above stale data within a single
  profile build.
