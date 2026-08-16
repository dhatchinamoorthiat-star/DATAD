# DATAD Closed Beta Readiness — Audit & Plan

**Audience:** 20–30 final-year students
**Duration:** 4 weeks
**Scope:** Skill Roadmap (beachhead) + core platform (notes, tasks, career hub, dashboard)
**Version:** Branch `feat/cloudflare-workers-ai-fallback`

---

## 1. Beta Checklist

### Authentication

| Check | Status | Evidence |
|-------|--------|----------|
| Registration flow works end-to-end | ✅ | 34 Jest tests pass. Honeypot, email verification, referral codes verified in audit. |
| Email verification link works | ✅ | `verifyEmail` in `authController.js` validates SHA-256 hash, sets `emailVerifiedAt`. |
| Password reset flow works | ✅ | 30-min token, SHA-256 hashed, generic error on email probe. |
| JWT token expiry (7 days) | ✅ | `expiresIn: '7d'` in `signToken`. |
| Login after roadmap generation persists data | ✅ | 50 e2e tests validate full CRUD persistence. |
| Logout clears all state | ✅ | `AuthContext.logout()` clears localStorage `token`, `activeProgram`, all `dax:*` keys. |
| Admin email matches correctly | ✅ | `isAdminEmail()` in `authController.js` handles case-insensitive comparison. |
| Rate limiting on auth endpoints | ✅ | `authLimiter`: 20 req / 15 min. |

### Performance

| Check | Metric | Current State |
|-------|--------|---------------|
| Dashboard page load time | <2s | Multiple `useEffect` calls (8 parallel API calls). No waterfall — they fire simultaneously. Each call adds ~200-800ms. Risk: slow network could push total to 3-5s. |
| Roadmap page load time | <1.5s | 3 API calls (getPivot, getTodayLog, getRoadmapProgress). Fire in parallel. Acceptable. |
| AI roadmap generation time | <30s | Timeout set to 20s per provider call. With key failover, could reach 60s. **SEE NOTE BELOW** |
| MongoDB query performance | — | All roadmap queries use `{ user: userId }` with unique index on `user` field. O(1) lookups. |
| API response compression | — | Not configured. Express has no compression middleware. For JSON responses under 10KB, minimal impact. |

> **Note on AI generation time:** The 20s request timeout + up to 8 provider chain attempts could mean a user sees "Generating…" for >60s. For beta, explicitly tell users "This may take 30-60 seconds" above the generate button. A future optimization would be a WebSocket-based progress stream.

### Mobile Responsiveness

| Check | Status | Notes |
|-------|--------|-------|
| Dashboard (`/`) | ✅ | `max-w-4xl`, `grid-cols-2 sm:grid-cols-4`, responsive padding. |
| Roadmap (`/career/roadmap`) | ✅ | `max-w-2xl`, `flex-wrap`, `grid grid-cols-2 gap-3` on edit form. Daily check-in input is full-width on mobile. |
| Career hub (`/career`) | ✅ | Uses `grid gap-6 lg:grid-cols-2` pattern. |
| Navigation sidebar | ✅ | Desktop sidebar `lg:flex`, mobile bottom tab bar visible on small screens. |
| Weekly summary card | ⚠️ | 3-column grid (`grid-cols-3`) on roadmap page. On <360px width, columns may compress. Acceptable for beta. |

### Error Handling

| Check | Status | Evidence |
|-------|--------|----------|
| Global error boundary | ✅ | `ErrorBoundary` wraps `<Routes>` in `App.jsx`. Catches unhandled React errors. |
| API error interceptor | ✅ | Axios interceptor on 401 auto-redirects to `/login`. `/auth/` paths excluded from redirect. |
| ValidationError returns 400 | ✅ | `errorHandler.js` converts Mongoose validation errors to 400 with message. |
| CastError returns 400 | ✅ | Malformed ObjectId returns 400. |
| Duplicate key returns 409 | ✅ | MongoDB E11000 → 409. |
| Generic errors return 500 | ✅ | All other errors → 500 with "Something went wrong". |
| AI provider failures bubble correctly | ✅ | `roadmapService.generateRoadmap` throws clear error "A target role is required". Runner catches provider failures and tries next. |
| Empty data states (roadmap) | ✅ | `getProgress` returns `{ hasRoadmap: false, progress: 0, items: [] }` for new users. |
| Empty data states (daily check-in) | ✅ | `getTodayLog` auto-creates a default HabitLog with 5 starter habits. |
| Empty data states (dashboard) | ✅ | "No notes yet." and "Nothing due." render for empty task/note lists. |
| 404 catch-all | ✅ | `app.use('/api', (req, res) => ...)` for API; SPA `*` fallback for client. |

### Loading States

| Check | Status | Evidence |
|-------|--------|----------|
| Dashboard skeleton | ✅ | `Skeleton` components for Arrival, TodaysFocus, StudentSnapshot (all 4 tile positions). |
| Roadmap page skeleton | ✅ | 3-block skeleton for initial data fetch (added in polish sprint). |
| TodayFocus skeleton | ✅ | Component skips rendering when `data` is null. Rules engine is lazy. |
| Generate roadmap loading | ✅ | Button shows "Generating…" with disabled state. |
| Edit form loading | ✅ | Save button shows "Saving…" with disabled state. |
| Daily check-in saving | ✅ | Button shows "Saving…" with disabled state. |

### Accessibility

| Check | Status | Notes |
|-------|--------|-------|
| Keyboard navigation (sidebar) | ✅ | Native `<NavLink>` elements, all focusable. `⌘K` opens command palette. |
| Keyboard navigation (roadmap) | ⚠️ | Gap items toggle on click but not on Enter/Space. `GapItem` button is a `<button>` element so it's natively keyboard-accessible. ✅ |
| ARIA labels | ⚠️ | `AvatarMenu` button has `aria-label="Account menu"`. Settings nav button has `aria-label`. Daily check-in input has no explicit label. |
| Focus indicators | ⚠️ | Tailwind `focus:border-indigo-500` on inputs. No custom `focus-visible` ring styles — relies on browser defaults. |
| Color contrast | ⚠️ | All `text-gray-400` on `bg-white` passes WCAG AA for body text. `text-gray-300` on `bg-gray-800` (dark mode) is 4.0:1 — barely AA. |
| Screen reader support | ⚠️ | `useDocumentTitle` updates page `<title>`. Roadmap hero has no `aria-live` region for progress updates. |

### Security

| Check | Status | Notes |
|-------|--------|-------|
| Rate limiting: API | ✅ | 1000 req / 15 min (generous but present). |
| Rate limiting: Auth | ✅ | 20 req / 15 min. |
| Rate limiting: Uploads | ✅ | 40 req / 15 min. |
| CORS allow-list | ✅ | `CLIENT_URL` comma-separated + ngrok regex. |
| Helmet headers | ✅ | HSTS (1yr), Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control, others configured. |
| NoSQL injection protection | ✅ | `express-mongo-sanitize` strips `$`/`.`. |
| Password hashing | ✅ | bcrypt, 10 rounds. |
| JWT in localStorage | ⚠️ | Standard SPA pattern. Mitigated by 7-day expiry + HTTPS. |
| XSS protection | ✅ | Helmet's CSP is currently disabled (external images). No other XSS vectors in the codebase. |

### Analytics

| Check | Status | Notes |
|-------|--------|-------|
| Client-side event tracking | ❌ | **No analytics exist on the client.** No PostHog, Mixpanel, GA4, or custom event pipeline. |
| Server-side usage tracking | ⚠️ | `AiUsageEvent` model tracks AI requests. `logActivity.js` tracks admin actions and key events (register, login, password reset, account delete). Search analytics exist. |
| Feature adoption tracking | ❌ | No way to measure which features users engage with. |
| Error tracking | ❌ | No Sentry, Datadog, or similar. Errors are logged server-side via `logger.js` but not aggregated. |

### Data Integrity

| Check | Status | Notes |
|-------|--------|-------|
| Mongoose schema validation | ✅ | `maxlength`, `enum`, `min`, `max`, `required`, `trim` on all fields. |
| Referential integrity | ✅ | User IDs are referenced but not enforced via MongoDB foreign keys — standard Mongoose pattern. |
| Unique indexes | ✅ | `HabitLog: { user, date }`, `User: { email }`, `PivotPlan: { user }`, `StudentIdentity: { user }`. |
| Cascade deletes | ✅ | Account deletion cascades to Notes, Tasks, Albums, Expenses, Budget, Resume, Journal, Announcements. |
| Migration idempotency | ✅ | `backfillPivotPlanType.js` uses `$or` with `$exists: false`, `null`, `''`. Safe to re-run. |

---

## 2. Analytics Plan

All events should fire from a single lightweight utility. For a 20-user beta, a simple server-side POST to a `BetaEvent` MongoDB collection is sufficient — no third-party analytics tool needed.

### Event Definitions

| Event Name | When It Fires | Why It Matters | KPI |
|-----------|---------------|----------------|-----|
| `user_signed_up` | Registration form submitted | Funnel top | Activation rate |
| `email_verified` | Verification link clicked | Funnel step 2 | Activation rate |
| `roadmap_viewed` | User lands on `/career/roadmap` | Feature awareness | Feature adoption |
| `roadmap_generated` | AI roadmap generation completes | Core value delivered | Time to first value, activation |
| `roadmap_regenerated` | User clicks "Regenerate" | Iterative use, potential dissatisfaction | Retention |
| `roadmap_item_toggled` | User changes gap status (not-started→in-progress→done) | Progress signal | Roadmap completion rate |
| `roadmap_item_done` | Gap reaches "done" status (fires on every toggle, only counts done) | Milestone | Roadmap completion rate |
| `daily_checkin_added` | User saves a daily note in the check-in input | Habit formation | Daily check-in rate |
| `daily_checkin_streak_milestone` | Check-in streak hits 7, 14, 30 days | Habit strength | 7-day retention |
| `target_role_set` | User sets a target role (in edit form or via generation) | Commitment signal | Activation, roadmap completion |
| `roadmap_progress_viewed` | User visits `/career/roadmap` when a roadmap exists | Returning engagement | 7-day retention |
| `dashboard_viewed` | User lands on `/dashboard` or `/` | Overall engagement | DAU, MAU |
| `dashboard_onboarding_clicked` | User clicks the "Build your skill roadmap" onboarding card | Funnel conversion | Activation rate |
| `career_pivot_viewed` | User visits `/career/pivot` | Feature awareness | Feature adoption |
| `error_frontend` | Unhandled React error caught by ErrorBoundary | Stability | Error rate |
| `error_api` | API returns 4xx/5xx (sampled, not every error) | Stability | Error rate |
| `session_started` | User logs in or refreshes authenticated page | Engagement baseline | Sessions/user |
| `search_queried` | User submits a query in command palette | Feature awareness | Feature adoption |

### Implementation (Minimum Viable)

For beta, implement a single `POST /api/beta/events` endpoint that upserts into a lightweight `BetaEvent` collection:

```javascript
const BetaEvent = mongoose.model('BetaEvent', {
  user: { type: ObjectId, ref: 'User' },
  event: String,
  properties: Object,
  timestamp: { type: Date, default: Date.now },
  sessionId: String,
});
```

On the client, a single `track(event, properties)` function:

```javascript
export function track(event, properties = {}) {
  try {
    const stored = navigator.sendBeacon('/api/beta/events', JSON.stringify({
      event, properties, sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    }));
  } catch {}
}
```

### Analysis Queries

After beta, these three queries are sufficient to understand engagement:

```javascript
// Activation: users who generated a roadmap within 7 days of signup
BetaEvent.aggregate([
  { $match: { event: 'roadmap_generated' } },
  { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
  { $match: { 'user.createdAt': { $gte: new Date(Date.now() - 7*86400000) } } },
  { $count: 'activated' },
]);

// 7-day retention: users who generated a roadmap AND came back 7+ days later
BetaEvent.aggregate([
  { $match: { event: 'roadmap_generated' } },
  { $lookup: {
      from: 'betaevents',
      let: { uid: '$user' },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ['$user', '$$uid'] },
          { $eq: ['$event', 'dashboard_viewed'] },
          { $gte: ['$timestamp', { $subtract: [new Date(), 7*86400000] }] },
        ]}}},
      ],
      as: 'returned',
  }},
  { $project: { returned: { $gt: [{ $size: '$returned' }, 0] } } },
]);

// Average daily check-ins per user per week
BetaEvent.aggregate([
  { $match: { event: 'daily_checkin_added' } },
  { $group: { _id: { user: '$user', week: { $week: '$timestamp' } }, count: { $sum: 1 } } },
  { $group: { _id: null, avg: { $avg: '$count' } } },
]);
```

---

## 3. Beta Success Metrics

### Activation Rate

| | Value |
|---|-------|
| **Formula** | `# users who generated a roadmap ÷ # users who signed up` × 100 |
| **Window** | Within 7 days of signup |
| **Good** | ≥60% |
| **Acceptable** | 40–59% |
| **Poor** | <40% |
| **Why** | Roadmap generation is the first value moment ("Time to First Value"). If <40% generate a roadmap, the onboarding funnel is broken. |

### Roadmap Completion Rate

| | Value |
|---|-------|
| **Formula** | `# roadmap items marked "done" ÷ # total roadmap items` × 100 |
| **Window** | Over 4-week beta |
| **Good** | ≥40% |
| **Acceptable** | 20–39% |
| **Poor** | <20% |
| **Why** | If users generate a roadmap but never complete items, the roadmap is a passive dashboard widget, not an active planning tool. |

### Daily Check-in Rate

| | Value |
|---|-------|
| **Formula** | `# users who check in on a given day ÷ # active users that day` × 100 |
| **Window** | Daily, averaged over 4 weeks |
| **Good** | ≥40% |
| **Acceptable** | 20–39% |
| **Poor** | <20% |
| **Why** | The daily check-in is the habit loop. If <20% of users check in, the beachhead isn't forming a habit. |

### 7-Day Retention

| | Value |
|---|-------|
| **Formula** | `# users who returned to the roadmap page at least once in days 7-14 ÷ # users who generated a roadmap in days 0-7` × 100 |
| **Window** | Day 7-14 after roadmap generation |
| **Good** | ≥50% |
| **Acceptable** | 30–49% |
| **Poor** | <30% |
| **Why** | 7-day retention is the standard SaaS metric for product-market fit. If <30%, the roadmap doesn't provide enough recurring value. |

### Average Sessions / User / Week

| | Value |
|---|-------|
| **Formula** | `# sessions (any pageview) ÷ # unique users` per week |
| **Window** | Weekly |
| **Good** | ≥5 sessions |
| **Acceptable** | 3–4 sessions |
| **Poor** | <3 sessions |
| **Why** | Measures overall engagement with the platform, not just the roadmap. |

### Time to First Value

| | Value |
|---|-------|
| **Formula** | Median minutes between `user_signed_up` and first `roadmap_generated` |
| **Window** | Onboarding session |
| **Good** | <10 minutes |
| **Acceptable** | 10–20 minutes |
| **Poor** | >20 minutes |
| **Why** | If it takes >20 minutes to generate a roadmap, the onboarding friction is too high. |

### NPS (Net Promoter Score)

| | Value |
|---|-------|
| **Formula** | Single survey question at day 14: "How likely are you to recommend DATAD to a friend?" (0-10). Promoters (9-10) - Detractors (0-6). |
| **Good** | ≥30 |
| **Acceptable** | 10–29 |
| **Poor** | <10 |
| **Why** | For a 20-person beta, NPS is the most direct signal of product-market fit. One detractor reporting dissatisfaction is 5% of the sample. |

---

## 4. Beta Feedback Plan

### Collection Process

**Two sources of feedback:**

1. **In-app survey** at 14-day mark — one question
2. **Weekly 15-min calls** with 3-5 students (rotating cohort)

### Survey Questions

Asked at day 14 via a simple modal (one question per session, 3 checkpoints across 4 weeks):

**Checkpoint 1 (Day 14):**
> _On a scale of 0–10, how likely are you to recommend DATAD's Skill Roadmap to a friend?_
> (_NPS question_)
> Follow-up: "What is the ONE thing that would make this more useful?"

**Checkpoint 2 (Day 21):**
> _In the past week, what did you use DATAD for?_
> - [ ] Checking my roadmap progress
> - [ ] Writing a daily check-in
> - [ ] Looking at career hub or opportunities
> - [ ] Studying (notes, tasks)
> - [ ] Other
> (_Multi-select_)

**Checkpoint 3 (Day 28):**
> _If we removed the Skill Roadmap tomorrow, what would you lose?_
> (_Free text, 1-2 sentences_)

### Weekly Call Protocol

```
⏱ 15 min | 🎧 3–5 students | 📝 Observer takes notes

1. (2 min) What did you use DATAD for this week?
2. (3 min) Show me your latest roadmap — walk me through it
3. (3 min) What frustrated you this week?
4. (3 min) What delighted you this week?
5. (4 min) Open discussion — anything else?
```

### Issue Prioritization Method

For every piece of feedback, classify by:

| Dimension | Rating | Guidance |
|-----------|--------|----------|
| **Frequency** | 1–3 | How many students reported it? 1 = single user, 3 = ≥5 users |
| **Impact** | 1–3 | How much does this block their success? 1 = minor annoyance, 3 = blocks roadmap use |
| **Effort** | 1–3 | How hard to fix? 1 = <1 day, 2 = <1 week, 3 = >1 week |

**Priority score = (Frequency × Impact) − Effort**

| Score | Action |
|-------|--------|
| ≥5 | P0 — Fix before beta ends |
| 3–4 | P1 — Fix after beta, before public launch |
| 1–2 | P2 — Backlog |
| ≤0 | P3 — Future |

### Feedback Artifacts

At the end of each week, produce:
- Raw feedback log (5-10 bullet points)
- Priority-scored issue list (ordered by score)
- One critical insight (the most surprising thing learned)

---

## 5. Prioritized Backlog

### P0 — Must Fix Before Public Launch (4 items)

| # | Item | Why P0 | Effort |
|---|------|--------|--------|
| 1 | **Add client-side analytics** (`track()` utility + `POST /api/beta/events` endpoint) | Without this, we cannot measure any of the success metrics above. Beta is blind. | 2 days |
| 2 | **Add "Browse popular roles" to empty roadmap state** | First-year persona has no role discovery. Without this, students without a target role bounce. | 0.5 day |
| 3 | **Show generation time estimate on roadmap generate button** | "Generating…" for 60s with no feedback is confusing. Add text: "This may take 30-60 seconds." | 0.25 day |
| 4 | **Client error tracking** | Without Sentry or similar, we can't fix bugs users encounter but don't report. | 1 day |

### P1 — High Value After Beta (5 items)

| # | Item | Why P1 | Effort |
|---|------|--------|--------|
| 5 | **Wire daily check-in notes back into roadmap gap status** | Rohan persona: if user writes "Worked on TensorFlow distributed training", auto-advance "MLOps" to in-progress. Closes the feedback loop between checking in and making progress. | 3 days |
| 6 | **ROLE_SKILL_MAP expansion** | 15 roles is not enough. Use beta signup data (actual target roles chosen) to prioritize top-10 additional roles. | 0.5 day |
| 7 | **Weekly trend view** | "This week: 4h study → last week: 2.5h. +60%." Rohan needs to see growth trajectory. | 2 days |
| 8 | **Plausible analytics or PostHog** | Replace custom BetaEvent collection with a proper analytics tool. Required before scaling past 100 users. | 1 day |
| 9 | **Roadmap auto-re-evaluation** | After N days or N check-ins, suggest regenerating the roadmap based on new data. Prevents stale roadmaps. | 3 days |

### P2 — Nice to Have (4 items)

| # | Item | Why P2 |
|---|------|--------|
| 10 | **Mobile-responsive weekly summary** | 3-column grid compresses on <360px. Edge case for beta. |
| 11 | **Keyboard shortcut for `/roadmap`** | Convenience. Users can already search via ⌘K. |
| 12 | **Daily check-in streak milestones** | 7/14/30 day milestone notifications. Drives habit formation but not critical for validity testing. |
| 13 | **Roadmap ready percentage vs task completion percentage** | Rohan confused progress with readiness. Split into separate metrics. |

### P3 — Future Ideas (5 items)

| # | Item | Why P3 |
|---|------|--------|
| 14 | **Placement-officer view** | Requires 3+ months of beta data to be meaningful. |
| 15 | **Course/platform integrations** (Coursera, Kaggle, LeetCode) | External data sync is infrastructure-heavy. Validate need first. |
| 16 | **Cohort skill analytics** | Aggregate views across students. Requires scale. |
| 17 | **AR/VR skill practice** | Distant future. Not relevant to beachhead. |
| 18 | **Social roadmap sharing** | May create viral loop but adds complexity. Test organic sharing first. |

---

## Summary: Beta V1.0 Ship Checklist

```
[ ] Client-side analytics (`track()` + `POST /api/beta/events`)
[ ] "Browse popular roles" on empty roadmap state
[ ] Generation time estimate on roadmap button
[ ] Client error tracking (Sentry or custom ErrorBoundary logging)

Technical checks (all passing):
[✅] 84 automated tests (34 Jest + 50 e2e)
[✅] All schemas validated with Mongoose constraints
[✅] Migration scripts (backfillPivotPlanType) ready
[✅] Rate limiting active on auth, API, uploads
[✅] CORS, Helmet, HSTS configured
[✅] SPA fallback + API 404 handler

Operational:
[ ] Beta invite link prepared
[ ] 20-30 final-year students recruited
[ ] Weekly feedback call schedule set
[ ] Analytics dashboard (MongoDB aggregation queries) ready
[ ] #1 P0 feedback triage process defined
```

**Total estimated effort for P0 items: ~4 days**
**Beta is ready to launch within 1 week of completing P0.**
