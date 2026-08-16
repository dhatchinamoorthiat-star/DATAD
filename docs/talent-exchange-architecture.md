# Talent Exchange — Product Architecture

> A first-class DATAD pillar alongside **Career**, **Study**, **Finance**, and **Dax AI**.
> Student opportunity ecosystem: Learn · Earn · Collaborate · Build Reputation.
> Every completed opportunity feeds the Student Intelligence Graph.

This document is the design contract. No implementation code lands until this is approved.
It deliberately reuses existing DATAD conventions:

- **Models**: Mongoose schemas in `server/models/*` with `{ timestamps: true }`.
- **Routes**: `server/routes/*Routes.js`, `router.use(verifyToken)`, thin controllers `server/controllers/*`.
- **Mount**: `app.use('/api/talent', ...)` in `server/index.js`.
- **Dax tools**: read-only, `userId`-scoped executors in `server/ai/tools/*` (writes require a UI confirmation surface).
- **Intelligence**: `server/ai/runtime-v2/studentIntelligenceEngine.js`, `server/ai/recommendation-engine/`, `server/ai/intelligence-layer/`.
- **Tiers**: `client/src/utils/tiers.js` (`free/trial/pro/max`), `TierGate`.
- **Client**: pages `client/src/pages/talent/*`, components `client/src/components/talent/*`, api `client/src/api/talent.js`.

---

## 1. Product Architecture

### 1.1 System context

```
┌──────────────────────────────────────────────────────────────┐
│  DATAD Web (React)                                            │
│  AppShell nav pillar "Talent" → /talent/*                    │
│  DaxPanel(context='talent') available on every page          │
└───────────────┬──────────────────────────────────────────────┘
                │ REST (axios, JWT via verifyToken)
┌───────────────▼──────────────────────────────────────────────┐
│  Express API  /api/talent/*                                   │
│  controllers → services → models (Mongoose/MongoDB)          │
│                                                               │
│  Talent Services            Cross-pillar services            │
│  ├─ opportunityService      ├─ studentIntelligenceEngine     │
│  ├─ applicationService      ├─ recommendation-engine         │
│  ├─ engagementService       ├─ notificationController.notify │
│  ├─ reputationService       ├─ creditLedgerService (new)     │
│  ├─ matchingEngine          └─ Dax tools (read) + writes     │
│  └─ moderationService                                         │
└───────────────┬───────────────────────────────┬──────────────┘
                │                                │
        MongoDB (primary)              Async workers (node-cron
        + text/compound indexes         schedulers/): matching
                                        refresh, reputation
                                        recompute, escrow sweeps
```

### 1.2 Domain model (the four nouns)

1. **Opportunity** — a posted need/collab/gig (the "listing"). Supersedes the thin legacy `SkillListing`/`MarketListing`.
2. **Application** — a helper expressing interest in an Opportunity.
3. **Engagement** — an accepted match; the unit of work with a lifecycle, escrow hold, and deliverables. This is where reputation and credits actually move.
4. **Review** — bidirectional rating attached to a completed Engagement (not to a listing — reviews must be earned by real work).

Plus supporting: **TalentProfile** (seller profile projection), **CreditLedger** (append-only), **MatchScore** (cached Dax compatibility), **ModerationCase**.

### 1.3 Why not reuse `SkillListing`/`MarketListing`

The legacy models are contact-swap classifieds (`contact` string, `markSold`) with no lifecycle, no escrow, no reputation. Talent Exchange needs a stateful engagement + ledger. **Plan**: keep legacy routes running, add `Opportunity` as the new core, and provide a one-time backfill script mapping `SkillListing → Opportunity(type:'offer')`. Deprecate `marketplaceRoutes` after migration.

---

## 2. User Journeys

**J1 — Discover & apply (helper)**
Land on `/talent` → Dax-ranked feed → open Opportunity Detail → read Dax "why you match" → Apply (Dax drafts a scoped pitch) → requester accepts → Engagement created, credits held in escrow → deliver work → both review → reputation + credits settle → profile + intelligence graph updated.

**J2 — Post a need (requester)**
`/talent/create` → choose **Need Help / Collaborator / Paid Gig** → Dax co-writes (improves wording, detects skills, estimates effort, suggests price, tags category) → publish → Dax surfaces "Recommended Helpers" → invite → accept → same Engagement lifecycle.

**J3 — Passive matching (both)**
Student never searches. Dax pushes "3 students need Excel help — you're an excellent match (Finance profile + 4 completed data gigs)" via notification + Talent home rail. One tap to apply.

**J4 — Reputation growth**
Completed Engagements accrue rating, on-time %, completion %, verified-skill confirmations → TalentProfile trust score rises → better feed ranking + unlocks higher-value opportunities.

**J5 — Dispute / no-show**
Deliverable overdue or disputed → moderationService opens a case → escrow held → admin resolves (release/refund/split) → reputation adjusted with reason.

---

## 3. Database Schema (Mongoose)

All `ObjectId` refs, `{ timestamps: true }`, snake-free camelCase to match existing models.

### 3.1 `Opportunity`
```
user            ObjectId ref User (requester)        required, indexed
kind            enum ['need_help','collaborator','paid_gig']   required
category        enum [tutoring, resume_review, mock_interview,
                      assignment_help, coding_help, design,
                      presentation, club_work, research,
                      team_formation]                required, indexed
title           String  required (≤120)
description     String  required (≤4000)
skills          [String] indexed                     (detected + confirmed)
estDurationMin  Number                               (Dax estimate)
priceCredits    Number   default 0                   (0 for pure collab)
priceSuggested  Number                               (Dax suggestion, immutable audit)
urgency         enum ['low','normal','high','urgent'] default 'normal'
status          enum ['draft','open','matched','in_progress',
                      'completed','cancelled','expired']  default 'draft', indexed
visibility      enum ['public','program','private']  default 'program'
programId       ObjectId ref ProgramRegistry         indexed (visibility scoping)
slotsTotal      Number default 1                     (team_formation > 1)
slotsFilled     Number default 0
daxMeta         { effortScore, riskScore, skillsDetected[], modelVersion }
searchText      String  (denormalized for text index)
expiresAt       Date    indexed (TTL-ish, swept by cron)
```
Indexes: `{status:1, category:1, createdAt:-1}`, `{skills:1}`, `{programId:1, visibility:1, status:1}`, text index on `title,description,skills`.

### 3.2 `Application`
```
opportunity   ObjectId ref Opportunity   required, indexed
applicant     ObjectId ref User          required, indexed
pitch         String (≤2000)             (Dax-assisted)
proposedCredits Number
status        enum ['pending','shortlisted','accepted','declined','withdrawn'] default 'pending'
matchScore    Number  (0..100 snapshot at apply time)
```
Unique index `{opportunity:1, applicant:1}` (one application per person, mirrors `SkillRating` pattern).

### 3.3 `Engagement`  *(the core stateful entity)*
```
opportunity   ObjectId ref Opportunity   required, indexed
requester     ObjectId ref User          required, indexed
helper        ObjectId ref User          required, indexed
category      String (denormalized)
priceCredits  Number  required
escrowLedgerId ObjectId ref CreditLedger  (the hold entry)
status        enum ['accepted','in_progress','delivered',
                    'completed','disputed','cancelled','refunded']  indexed
milestones    [{ title, done, doneAt }]
deliverables  [{ label, url/fileRef, at }]
dueAt         Date  indexed
completedAt   Date
completionRisk Number  (Dax prediction, refreshed by worker)
```
Indexes: `{helper:1, status:1}`, `{requester:1, status:1}`, `{status:1, dueAt:1}`.

### 3.4 `TalentReview`
```
engagement   ObjectId ref Engagement  required, indexed
rater        ObjectId ref User        required
ratee        ObjectId ref User        required, indexed
role         enum ['as_requester','as_helper']
rating       Number 1..5 required
onTime       Boolean
comment      String (≤1000)
skillsConfirmed [String]
```
Unique `{engagement:1, rater:1}`.

### 3.5 `TalentProfile`  *(materialized projection, recomputed by worker + on events)*
```
user            ObjectId ref User  unique, indexed
skills          [{ name, confirmedCount, verified:Boolean }]
completedCount  Number
responseRatePct Number
completionRatePct Number
onTimePct       Number
avgRating       Number
trustScore      Number  0..100  indexed   (reputation algorithm §12)
badges          [String]                   (derived, not awarded manually)
portfolioRefs   [{ engagementId, title, url }]
linkedProjects  [ObjectId ref Project]
lastActiveAt    Date
```

### 3.6 `CreditLedger`  *(append-only — never update/delete a row)*
```
user        ObjectId ref User  required, indexed
type        enum ['grant','earn','spend','hold','release','refund','expire']
amount      Number  required   (signed by convention: +credit, -debit)
balanceAfter Number required   (running balance snapshot for O(1) reads)
refType     enum ['engagement','subscription','ai_usage','admin','promo']
refId       ObjectId
idempotencyKey String unique    (prevents double-posting)
memo        String
```
Balance = last row's `balanceAfter` for user (compound index `{user:1, createdAt:-1}`).

### 3.7 `MatchScore` (cache) and `ModerationCase`
- `MatchScore`: `{ user, opportunity, score, reasons[], modelVersion, expiresAt }` — Dax compatibility cache, TTL-refreshed.
- `ModerationCase`: `{ subjectType, subjectId, reporter, reason, state, resolution, handledBy }`.

---

## 4. API Endpoints  (`/api/talent`, all behind `verifyToken`)

```
# Discover
GET    /opportunities                 list/feed (filters: category, skills, urgency, q; Dax-ranked when ?rank=dax)
GET    /opportunities/:id             detail (+ my matchScore, suggested questions)
GET    /feed                          personalized Dax feed (recommended opps + helpers + collaborators + mentors)

# Create / manage opportunities
POST   /opportunities                 create (draft or open)
PATCH  /opportunities/:id             update (owner only; whitelist fields)
POST   /opportunities/:id/publish     draft → open
POST   /opportunities/:id/close       open → cancelled/expired
POST   /opportunities/:id/assist      Dax co-write (improve, price, effort, skills, tags) — returns suggestions, no write

# Applications
POST   /opportunities/:id/apply       create Application (Dax-drafted pitch optional)
GET    /opportunities/:id/applications owner: list applicants (+ matchScore)
POST   /applications/:id/accept       owner → creates Engagement + escrow hold
POST   /applications/:id/decline
POST   /applications/:id/withdraw     applicant

# Engagements
GET    /engagements                   mine (as helper/requester), filter by status
GET    /engagements/:id
POST   /engagements/:id/start         accepted → in_progress
POST   /engagements/:id/deliver       attach deliverables → delivered
POST   /engagements/:id/complete      requester confirms → completed → escrow release + reputation
POST   /engagements/:id/cancel        → refund path
POST   /engagements/:id/dispute       → opens ModerationCase, freezes escrow
POST   /engagements/:id/review        create TalentReview (role-scoped)

# Profiles & reputation
GET    /profiles/:userId              public TalentProfile
GET    /me/profile                    my profile + private metrics

# Credits
GET    /credits/balance
GET    /credits/ledger                paginated
# (spend/earn are side effects of engagements & AI usage, not direct endpoints)

# Dax matching (server-computed)
GET    /match/opportunities           recommended opportunities for me + reasons
GET    /opportunities/:id/candidates  owner: recommended helpers + reasons

# Moderation (admin scope)
GET    /admin/moderation
POST   /admin/moderation/:id/resolve
```

Response envelope, error shape, and pagination follow existing controllers (e.g. `marketplaceController`, `notificationController`).

---

## 5. React Page Hierarchy (`client/src/pages/talent/`)

```
/talent                     TalentHubPage        (Discover feed + Dax rails)
/talent/create              CreateOpportunityPage (3 kinds, Dax co-writer)
/talent/o/:id               OpportunityDetailPage
/talent/engagements         EngagementsPage       (workspace: mine as helper/requester)
/talent/engagements/:id     EngagementDetailPage  (milestones, deliverables, chat, review)
/talent/profile/:userId     TalentProfilePage     (seller profile)
/talent/me                  MyTalentPage          (my profile, credits, stats)
/talent/credits             CreditsPage           (balance + ledger)
```
Nav: add a `Talent` item to the `AppShell` pillar list (`w` items with `icon/label/to`), and extend `routeContext()` so `pathname.startsWith('/talent') → 'talent'` drives `DaxPanel`.

---

## 6. Component Hierarchy (`client/src/components/talent/`)

```
discover/
  OpportunityFeed         (virtualized list)
  OpportunityCard         (category chip, urgency, priceCredits, DaxMatchBadge)
  DaxMatchBadge           (compatibility score + tooltip "why")
  FeedFilters             (category, skills, urgency)
  DaxRail                 (Recommended Opportunities/Helpers/Collaborators/Mentors)
create/
  OpportunityComposer     (form)
  KindSelector            (Need Help / Collaborator / Paid Gig)
  DaxCoWriter             (inline suggestions: wording, price, effort, skills, tags)
detail/
  OpportunityHeader, SkillMatchPanel, TimelinePanel,
  ReviewsList, ReputationSummary, SuggestedQuestions,
  ApplyDrawer (Dax-drafted pitch), MessageButton
engagement/
  EngagementBoard (status stepper), MilestoneList, DeliverableUploader,
  CompletionRiskBadge (Dax), ReviewForm, EscrowStatus
profile/
  TalentProfileHeader, TrustScoreDial, VerifiedSkills, BadgeShelf,
  PortfolioGrid, LinkedProjects, StatsStrip
credits/
  CreditBalanceCard, LedgerTable
shared/
  CategoryIcon, UrgencyTag, CreditPill, DaxWhyPopover
```
Reuse existing primitives: `Button`, `Skeleton`, `EmptyState`, `motion/Page`, `TierGate`, `DaxPanel`. Premium dashboard layout — no ecommerce grid, no bright CTAs. Use existing tier color tokens; keep the calm DATAD surface treatment (`LivingSurface`, `PremiumPanel`).

---

## 7. Backend Services (`server/services/talent/`)

- **opportunityService** — CRUD, publish/close lifecycle, denormalize `searchText`, emit analytics + notifications.
- **applicationService** — apply/accept/decline; on accept → creates Engagement + calls creditLedgerService.hold.
- **engagementService** — state machine (accepted→in_progress→delivered→completed / disputed / cancelled); orchestrates escrow release/refund, review windows, reputation trigger.
- **matchingEngine** — §8. Wraps `studentIntelligenceEngine` + `recommendation-engine`.
- **reputationService** — §12. Recompute TalentProfile on engagement completion + nightly.
- **creditLedgerService** — §13. Append-only, idempotent postings (`hold/release/refund/earn/spend`).
- **moderationService** — reports, dispute cases, admin resolution, reputation penalties.
- **talentProfileService** — materialize/serve TalentProfile projection.

Cross-cutting: `notificationController.notify()` for every state change; schedulers in `server/schedulers/` for match refresh, reputation recompute, escrow/expiry sweeps.

---

## 8. Matching Engine Design

**Goal**: students rarely search; Dax pushes ranked matches with human-readable reasons.

**Signals** (from Student Intelligence Graph via `studentIntelligenceEngine`):
- Skill vector overlap (opportunity.skills ∩ helper verified/confirmed skills).
- Pillar affinity (e.g. Finance profile → Excel/finance categories).
- Track record: completedCount, avgRating, onTimePct, trustScore.
- Availability & load (open engagements), urgency fit.
- Semantic similarity: embed `title+description` (existing `ai/embeddings/semanticSearch`) vs helper profile embedding.
- Program/visibility eligibility, exclusion of self.

**Pipeline** (two-stage, cheap→expensive):
1. **Candidate retrieval** — Mongo filter by category/skills/visibility/status + vector prefilter → top ~50.
2. **Scoring** — weighted linear blend → 0..100 `matchScore`; store top-K in `MatchScore` cache with `reasons[]`.
3. **Reason generation** — templated, deterministic (not free-form hallucination): `"Finance profile + 4 completed data gigs + 4.8★ on Excel help"`. Dax only phrases; the facts come from data.

**Refresh**: on new opportunity (fan-out to eligible helpers), on profile change, and nightly batch. Cache TTL keeps feeds fast without recomputing per request.

**Determinism & safety**: scoring is code, not the LLM. The LLM never invents match facts — it formats reasons and drafts text. This mirrors the existing read-only, userId-scoped tool philosophy in `server/ai/tools`.

---

## 9. Dax Integration Points

Add **Talent tools** to `server/ai/tools/` (read slice, userId-scoped, bounded results) + a **writes slice** gated by UI confirmation (following the existing `tools/writes.js` pattern):

Read tools:
- `talent_recommended_opportunities` → top matches + reasons
- `talent_find_candidates(opportunityId)` → recommended helpers
- `talent_my_engagements(status?)`
- `talent_profile_summary(userId?)`

Assist/generate (stateless, no writes — returns suggestions to the composer):
- `talent_improve_request`, `talent_suggest_price`, `talent_estimate_workload`,
  `talent_detect_skills`, `talent_draft_scope`, `talent_generate_interview_questions`,
  `talent_predict_completion_risk`, `talent_summarize_request`, `talent_draft_pitch`

Write tools (confirmation surface required): `talent_create_draft_opportunity`, `talent_apply` — never auto-executed; they stage an action the UI confirms.

`DaxPanel(context='talent')` renders the right quick actions per page (feed → "Recommend opportunities"; detail → "Summarize / Suggest better price"; create → co-writer; engagement → "Predict completion risk / Generate interview questions").

---

## 10. Analytics Events

Emit via existing bus (`BusEvent`/telemetry). Namespaced `talent.*`:

```
talent.opportunity.created {kind,category,priceCredits,daxAssisted}
talent.opportunity.published
talent.feed.viewed {rankMode, count}
talent.match.surfaced {opportunityId, score}
talent.opportunity.applied {matchScore, daxDraftedPitch}
talent.application.accepted
talent.engagement.started
talent.engagement.delivered {onTimeSoFar}
talent.engagement.completed {durationMin, priceCredits, rating}
talent.engagement.disputed {reason}
talent.review.submitted {rating, onTime, role}
talent.credits.held / .released / .refunded / .earned / .spent {amount}
talent.dax.assist.used {tool}
talent.reputation.recomputed {userId, trustScoreDelta}
```
Funnels: view→apply→accept→complete; Dax-assist lift on completion rate; credit velocity.

---

## 11. Security Model

- **AuthZ**: `verifyToken` everywhere; ownership checks (only requester edits their opportunity, only participants view an engagement). Field whitelists on PATCH (mirror `LISTING_UPDATABLE_FIELDS`).
- **Tenant isolation**: every query scoped by `userId`/participants — same rule the Dax tools enforce ("a tool call cannot reach another student's data").
- **Visibility scoping**: `public/program/private` enforced server-side, not client-filtered.
- **Input hardening**: reuse `express-mongo-sanitize`, `hpp`, `helmet`, validation layer (`server/validations`); length caps per schema; file uploads via existing `multer` + Cloudinary, type/size limits, no executables.
- **Rate limits**: `express-rate-limit` on create/apply/message to stop spam and scraping of profiles.
- **Ledger integrity**: append-only, idempotency keys, server-authoritative balance; no client-supplied credit amounts trusted.
- **PII**: no contact info in listings (kill the legacy `contact` field); messaging stays in-app. No personal data in URLs.
- **LLM safety**: Dax formats/drafts only; never authoritative for money, reputation, or match facts. Writes require explicit UI confirmation.
- **Abuse**: honeypot + email-verification gate (already in the codebase) required before posting/applying.

## 11b. Roles & Permissions

Per-engagement roles (`requester`, `helper`) + platform roles (`student`, `moderator`, `admin`). Tier gates via `tiers.js`:
- **free**: browse feed, see matches, apply limited/week, earn credits.
- **trial/pro**: unlimited applications, Dax co-writer, priority feed placement, more concurrent engagements.
- **max**: mentor tools, verified-skill fast-track, advanced Dax (risk prediction, candidate ranking).
Credits are the in-product currency; tier is the capability gate — orthogonal, so free earners aren't blocked from earning.

---

## 12. Reputation Algorithm

Deterministic, anti-gaming, no manual points. `trustScore ∈ [0,100]`, recomputed on completion + nightly.

Inputs (per user, decayed by recency, half-life ~120 days):
```
quality        = bayesian_avg(rating, priorMean=3.6, priorWeight=5)     # dampens 1-review 5★
reliability    = onTimePct * completionRatePct
responsiveness = responseRatePct
verification   = verifiedSkillCount / claimedSkillCount
consistency    = f(active weeks with ≥1 completed engagement)           # long-term signal
volumeConf     = min(1, completedCount / 10)                            # confidence, not reward
```
```
raw = 100 * ( 0.35*quality/5
            + 0.25*reliability
            + 0.10*responsiveness
            + 0.15*verification
            + 0.15*consistency )
trustScore = raw * (0.5 + 0.5*volumeConf)     # new users capped until proven
```
Anti-gaming:
- Reviews only from **completed, escrow-settled** engagements (can't review without real work).
- Reciprocal/self-dealing detection: repeated pairs, same-cluster ratings → discounted weight (flagged to moderation).
- Bayesian prior kills the "one 5★ = perfect" exploit.
- Disputes lost → reliability penalty with recorded reason; no silent score drops.
- Badges are **derived** from thresholds (e.g. `verified_tutor`, `on_time_25`), never awarded manually — no gamification spam.

---

## 13. Credit System (MVP — no real money)

- **DATAD Credits** = single append-only `CreditLedger`. Balance = latest `balanceAfter`.
- **Sources**: signup grant, subscription monthly allotment, promos, **earned** from completed engagements.
- **Sinks**: unlock AI usage, premium features, resume reviews, templates, paying for help.
- **Escrow (simulated)**: on accept → `hold` (debit requester into a system-held pool). On complete → `release` (credit helper). On cancel/dispute-refund → `refund` (credit requester). All postings **idempotent** via `idempotencyKey`, server-authoritative.
- **Invariant**: sum of a user's ledger amounts == balance; hold pool nets to zero across participants. A nightly reconciliation job asserts this and alerts on drift.

The ledger + hold/release/refund verbs are intentionally **payment-provider shaped** so the same state machine backs real money later.

---

## 14. Future Payment Migration Plan

The Engagement lifecycle and ledger verbs are the abstraction seam.

1. **Adapter interface**: `PaymentProvider { hold(), capture(), refund(), payout() }`. MVP implementation = `CreditsProvider` (writes CreditLedger). No engagement code references credits directly — only the interface.
2. **Add real provider**: `RazorpayProvider` / `StripeConnectProvider` implementing the same interface; escrow via provider hold + delayed capture / Connect transfers.
3. **KYC & payouts**: helpers onboard for payouts (provider-hosted KYC — DATAD never touches card/bank data; **entering financial credentials is out of scope for the app and stays with the provider's UI**).
4. **Dual-rail transition**: run credits + money side-by-side; per-opportunity `currency: 'credits'|'inr'`. Same Engagement, same reviews, same reputation.
5. **Compliance**: platform escrow terms, dispute SLAs, tax/invoice records — layered on the existing `ModerationCase` + ledger, no schema rewrite.

Because reputation, matching, and lifecycle never depend on *how* value moves, swapping the provider is additive, not a rebuild.

---

## 15. Implementation Roadmap

**Phase 0 — Foundations (design → skeleton)**
Approve this doc. Scaffold models (`Opportunity`, `Application`, `Engagement`, `TalentReview`, `TalentProfile`, `CreditLedger`), `talentRoutes` mounted at `/api/talent`, empty services, `client/src/pages/talent` + nav pillar + `routeContext`. Backfill script `SkillListing → Opportunity`.

**Phase 1 — Discover + Create (read + post)**
Opportunity CRUD + publish, feed (non-Dax ranking first), Detail page, Create with plain form. Analytics events. Ship behind a `talent` feature flag.

**Phase 2 — Engagements + Credits**
Apply → accept → Engagement state machine, CreditLedger + simulated escrow (hold/release/refund), reviews, TalentProfile v1, notifications. This is the "earn" loop MVP.

**Phase 3 — Dax integration**
Matching engine (two-stage) + `MatchScore` cache, Dax rails (recommended opps/helpers/collaborators/mentors) with reasons, Dax co-writer + assist tools, completion-risk prediction.

**Phase 4 — Reputation + Moderation hardening**
Full reputation algorithm + nightly recompute, badges, moderation/dispute flow, anti-gaming detection, rate limits, reconciliation job.

**Phase 5 — Premium + scale**
Tier gates (`free/trial/pro/max`) on applications/Dax depth/mentor tools, feed virtualization + caching, index tuning, load tests. Sets up the payment-provider seam for a later real-money release.

---

### Open decisions to confirm before Phase 0
1. **Visibility default** — `program` (same-cohort) vs `public` across all programs? (Recommend `program` for trust + density.)
2. **Legacy** — deprecate `marketplaceRoutes`/`SkillListing` now, or run in parallel one release?
3. **Credit grant sizing** — signup grant + monthly allotment per tier (drives the economy; needs a number).
4. **Messaging** — reuse existing `Conversation`/`ChatMessage` models for engagement chat, or a talent-scoped thread?
