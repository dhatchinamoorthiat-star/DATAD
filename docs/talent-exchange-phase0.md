# Talent Exchange — Phase 0: Architecture Review & Dependency Map

Status: **design only, no code**. Produced after reading the real implementations
(not assumptions). Every "reuse" below cites the concrete file that already does the job.

UI name: **Talent Exchange** · Internal domain: **Opportunity → Application → Engagement → Review**

---

## 0. Executive findings (the decisions this review forces)

1. **`Opportunity` is a NEW bounded context, not an extension of `MarketListing`.**
   `MarketListing` (`server/models/MarketListing.js`) is second-hand *goods* resale (books, electronics, `price`, `condition`, `sold`) living under the **Community** pillar. It is a different domain and must be left untouched.
2. **`SkillListing` IS the seed of `Opportunity`.** `server/models/SkillListing.js` is a person offering a skill (`skill`, `mode`, `availability`, `contact`). It maps to `Opportunity{ kind: 'offer' }`. It will be **migrated, then deprecated** — not duplicated, not deleted in place.
3. **⚠️ Naming collision: "Credits" already exists.** `server/ai/usageMeter.js` `CREDIT_LIMITS` + `AiUsage.creditsUsed` are a *daily-reset AI quota*, not a transferable ledger. The Talent economy needs a **separate append-only wallet**. To avoid confusion I recommend the domain term **"Talent Credits"** (model `CreditLedger`, wallet scope `talent`), explicitly distinct from AI-usage credits. This is the single most important naming decision to lock before Phase 1.
4. **The Dax write-confirmation flow already exists and is excellent — reuse it verbatim.** `proposalService` + `ProposedAction` + `tools/writes.js` (validate → propose → confirm → execute → undo). Talent writes become new entries in the `VALIDATORS/EXECUTORS/UNDOERS` maps. Do **not** invent a second confirmation mechanism.
5. **Matching is deterministic and already has a home pattern.** `intelligence-layer/buildStudentProfile` produces scored profiles; `recommendation-engine` consumes them via a `GENERATORS` array. Talent matching = a deterministic `matchingEngine` reading the same profile scores, optionally surfaced through a new recommendation generator. The LLM never scores.
6. **`/career/opportunities` already exists** (placements/internships tab in `workspaces.js`). The internal *model* name `Opportunity` is fine, but the **UI pillar route must be `/talent`** to avoid collision.

---

## 1. Dependency Map — what to reuse vs. build

| Concern | Existing asset (reuse) | Talent Exchange action |
|---|---|---|
| **Auth** | `middleware/verifyToken.js` → sets `req.user = { userId, tier, program, role }` | Reuse as-is on every `/api/talent` route. |
| **Tier gating** | `subscription/permissionEngine.js` `requireFeature()`, `refreshTier`; `featureRegistry.js` `FEATURE`/`FEATURE_ACCESS` | **Add** new `FEATURE.TALENT_*` keys; gate premium actions with `requireFeature`. Apply `refreshTier` before gates (JWT tier is stale up to 7d). |
| **Program scoping** | `req.user.program.id`, pattern in `marketplaceController.list` | Reuse the same `program` filter for opportunity visibility. |
| **Domain events** | `events/index.js` `emit(type, userId, data)` + `BusEvent`; type regex `^[a-z]+\.[a-z]+(-[a-z]+)?$` | Emit `opportunity.created`, `engagement.completed`, etc. Register handlers by prefix (`engagement.`). |
| **SIG update** | `intelligence-layer/index.js` collectors + `computeScores` | **Add** a `talentCollector` (reads completed engagements) so future profiles reflect proven skills; trigger via `emit('profile.refresh-needed', ...)` on completion. |
| **Matching signals** | `intelligence-layer/buildStudentProfile(userId)` → `{ scores, enrichedContext }` | New `matchingEngine` consumes these scores deterministically → compatibility score + reasons. |
| **Recommendation surfacing** | `recommendation-engine/index.js` `GENERATORS[]` | Optionally add a `talentOpportunityGenerator` so matches appear in the existing rec feed. |
| **Dax read tools** | `ai/tools/index.js` `TOOL_DEFINITIONS` + executors (bounded, `userId`-scoped) | **Add** read tools: `talent_recommended_opportunities`, `talent_find_candidates`, `talent_profile_summary`, `talent_my_engagements`. |
| **Dax write confirmation** | `ai/proposalService.js` + `ai/tools/writes.js` + `models/ProposedAction.js` | **Add** `create_opportunity`, `apply_to_opportunity` to `VALIDATORS/EXECUTORS/UNDOERS`. No new flow. |
| **Notifications** | `controllers/notificationController.js` `notify()` / `notifyBulk()` | Reuse. **Extend** `Notification` type enum with `opportunity`, `application`, `engagement`, `review`. |
| **Messaging** | `models/Conversation.js` + `ChatMessage.js` are **Dax-only** (role `user`/`assistant`) | Do **not** overload for peer chat. Engagement discussion = a small new `EngagementMessage` model (decision D4). |
| **Analytics** | `events/index.js` `onAny()` catch-all; `search/searchAnalytics.js` precedent | Emit product-analytics through the same bus; add a catch-all analytics handler for `talent.*`. |
| **Navigation** | `client/src/utils/workspaces.js` `WORKSPACES` + `WORKSPACE_TABS`; `AppShell.jsx` maps them | **Add** a `talent` pillar entry + tabs. Extend `AppShell.routeContext()` → `/talent` ⇒ `'talent'` for `DaxPanel`. |
| **Client API** | `client/src/api/*.js` axios-instance modules | **Add** `client/src/api/talent.js`. |
| **UI primitives** | `Button`, `Skeleton`, `EmptyState`, `motion/Page`, `LivingSurface`, `PremiumPanel`, `TierGate` | Reuse for all Talent pages — no new design system. |
| **Route mount** | `server/index.js` `app.use('/api/...', ...)` | Add `app.use('/api/talent', require('./routes/talentRoutes'))`. |
| **Rate limiting** | `middleware/rateLimiters.js`, `generalLimiter` | Reuse; add tighter limiter on create/apply to stop spam. |

**Explicitly NOT reused (kept separate):** `MarketListing` (goods resale), Dax `Conversation`/`ChatMessage` (assistant chat), `AiUsage` credits (AI quota ≠ wallet).

---

## 2. Confirmed conventions to follow (from the real code)

- **Models**: `mongoose.Schema({...}, { timestamps: true })`, refs via `ObjectId ref 'User'`, indexes declared after schema (`schema.index(...)`), `module.exports = mongoose.model(...)`.
- **Controllers**: thin, `exports.fn = async (req, res, next) => { try {...} catch (err) { next(err); } }`, ownership via `item.field.equals(req.user.userId)`, whitelist `UPDATABLE_FIELDS`.
- **Routes**: `const router = require('express').Router(); router.use(verifyToken); ... module.exports = router;`
- **Services**: plain modules exporting functions (see `proposalService`, `subscriptionService`).
- **Dax tools**: OpenAI-compatible schema objects; executors bounded (`MAX_ITEMS=5`, `MAX_SNIPPET=600`) and `userId`-scoped at the query level.
- **Writes**: three-phase `VALIDATORS` (build summary from validated values, never model text) / `EXECUTORS` (re-scope by userId) / `UNDOERS`.
- **Tests**: Jest, `uuid` mocked (`server/tests/__mocks__/uuid.js` per `package.json` jest config).
- **No TypeScript** on server; ESLint on client.

---

## 3. Migration Strategy

### 3.1 `SkillListing` → `Opportunity`
- **Mapping**: `skill → title/skills[]`, `description → description`, `mode → deliveryMode`, `availability → availability`, `tags → skills[]`, `user → user`, `kind = 'offer'`, `status = 'open'`. Drop `contact` (peer contact moves in-app — PII hardening).
- **Method**: idempotent backfill script `server/scripts/migrateSkillListings.js` (follows the existing `scripts/migrateConversations.js` precedent), writing new `Opportunity` docs with a `legacySkillListingId` for re-run safety. Original collection retained read-only for one release.

### 3.2 `SkillRating` → reputation seed
- Reviews now require a completed `Engagement`, so historic `SkillRating` rows **cannot** become `TalentReview` (no engagement exists). Instead: aggregate them into the initial `TalentProfile.avgRating`/`ratingCount` as a **seed prior** (feeds the Bayesian mean), marked `source: 'legacy'`. No fabricated engagements.

### 3.3 `MarketListing`
- **No migration.** Different domain (goods). Stays under Community as-is.

### 3.4 Notification enum
- Additive migration: extend the `type` enum. Existing rows unaffected (enum is validated on write only).

### 3.5 Rollout safety
- Ship behind a `talent` feature flag / `FEATURE.TALENT` gate. Legacy `marketplaceRoutes` + `skillRoutes` keep running in parallel until Talent reaches parity, then deprecate `skillRoutes`.

---

## 4. Deterministic Matching Pipeline (design, no LLM scoring)

```
buildStudentProfile(userId)          # intelligence-layer (existing)
   → scores + enrichedContext
matchingEngine.score(opportunity, helperProfile)   # NEW, pure function
   → { compatibility: 0..100, reasons: [factual strings] }
      signals: skill overlap · pillar affinity · trackRecord(trustScore,
               onTime, completion) · availability · program eligibility
Dax  → only *phrases* reasons[]; never generates the number or the facts
```
Two-stage (Mongo candidate filter → weighted linear score), results cached in a `MatchScore` collection with TTL. Mirrors the read-only, deterministic philosophy already enforced in `ai/tools`.

---

## 5. Reputation (only changes after completed engagements)

Recomputed by a handler on `engagement.completed` + nightly job. Inputs: Bayesian-weighted rating (prior mean ~3.6), completion rate, response time, on-time %, review quality, skill-verification ratio, recency decay, fraud discount (reciprocal/self-dealing detection). Materialized into `TalentProfile.trustScore`. Reviews are gated to escrow-settled engagements — structurally prevents fake ratings and self-review.

---

## 6. Credits / Wallet (append-only, provider-swappable)

- New `CreditLedger` (append-only; balance = last `balanceAfter`, never stored mutably), verbs `grant · spend · hold · release · refund · reverse`, idempotency keys.
- **Abstraction seam**: `PaymentProvider { hold, capture, release, refund }` interface; MVP impl `CreditsProvider` writes the ledger. Later `StripeConnectProvider` / `RazorpayEscrowProvider` implement the same interface — engagement code never references credits directly.
- Kept explicitly distinct from `AiUsage`/`usageMeter` AI-quota credits (see finding #3).

---

## 7. New surface area (created in later phases — listed for scope)

**Models**: `Opportunity`, `Application`, `Engagement`, `TalentReview`, `TalentProfile`, `CreditLedger`, `MatchScore`, `EngagementMessage?`, `ModerationCase`.
**Server**: `routes/talentRoutes.js`, `controllers/talent*`, `services/talent/{opportunity,application,engagement,matching,reputation,credit,moderation}Service.js`, `ai/tools` additions, `intelligence-layer/collectors/talentCollector.js`, `events/handlers/talentHandlers.js`, `scripts/migrateSkillListings.js`, `validations/talent*`.
**Client**: `pages/talent/*` (Discover, Detail, Create, MyOpportunities, Applications, Engagement, SellerProfile, Reviews, Credits), `components/talent/*`, `api/talent.js`, `workspaces.js` pillar entry.

---

## 8. Decisions (LOCKED — 2026-07-24)

- **D1 — Wallet name**: ✅ **"Talent Credits" + append-only `CreditLedger`**, separate from AI-usage credits.
- **D2 — Visibility default**: ✅ **Public (all programs)**. Opportunities are visible cross-program by default; `program`/`private` remain available as opt-in scopes on the model.
- **D3 — Engagement chat**: ✅ **Reuse Dax `Conversation`/`ChatMessage`**, extended minimally: add `channel: 'dax' | 'talent'` (default `'dax'`) and `participants[]`. **Required wiring**: the AI-chat quota query in `subscription/subscriptionService.getRemainingChatQuota` and all Dax history reads MUST filter `channel: 'dax'` so peer chat never inflates AI quota or leaks into assistant context. `role` on a talent message denotes the sender's engagement side.
- **D4 — Legacy `skillRoutes`/`SkillListing`**: ✅ **Run parallel one release**, then deprecate after Talent reaches parity.
- **D5 — Credit economics**: MVP defaults (tunable): signup grant **100 TC**, monthly allotment free/trial/pro/max = **0 / 200 / 500 / 1500 TC**. Flagged for product sign-off; centralised in one config constant.

---

## 9. Phase gate

Phase 0 = **this document**. No code written. On approval of D1–D5, proceed to
**Phase 1 (models + indexes + migration script)**, then compile/lint/test before Phase 2.
