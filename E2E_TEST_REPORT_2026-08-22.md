# DATAD — End-to-End Test Report

**Date:** 2026-08-22
**Branch:** `feat/resume-pdf-export-and-email`
**Method:** Live black-box testing against a running stack — Express API + Vite client + local MongoDB — driven over HTTP and through a real browser. Every finding below was reproduced against a running system, not inferred from reading code.

**Relationship to `PRODUCTION_READINESS_AUDIT.md` (2026-08-21):** that audit was a static review and explicitly recorded three gaps — *"no browser-driven UX testing"*, *"no load or latency measurement"*, *"no production deployment verification"*. This report targets the first two. It does not re-audit what that document already covered; where I re-tested its claims, they held.

---

## Test Environment

| | |
|---|---|
| API | `server/index.js` on :5001, isolated local MongoDB (`mongodb://127.0.0.1:27018/datad-test`) |
| Client | Vite dev server on :5175, proxying `/api` |
| Mail | Transport credentials blanked after the first test **(see note)** |
| Accounts | 14 accounts created across student / admin / attacker / victim roles |
| Repo | Unmodified during testing. Remediation commits followed afterwards — see [Remediation](#remediation) |

> **Note on outbound mail.** My first registration was sent through the live Brevo credentials in `server/.env` and **actually delivered an email** (`messageId: <202608220943.65300183787@smtp-relay.mailin.fr>`) to `asha@test.edu`. I blanked the transport credentials immediately and every subsequent test ran with mail disabled. Worth knowing that running the server locally with the committed `.env` sends real mail from the production sender.

---

## Executive Summary

**Readiness score: 78/100 → 90/100 after remediation — CONDITIONAL GO**

> **Update, 2026-08-22 (later the same day).** All three HIGH findings, plus M1, have been fixed and each fix re-verified by re-running the exploit that found it. The suite is now **693 passing across 47 suites** (was 676/45; `tests/rateLimiters.test.js` and `tests/registrationApproval.test.js` added). Details in [Remediation](#remediation) at the end. The remaining Medium and Low findings are unchanged and still open.

The security core is genuinely strong, and I say that having tried to break it rather than having read about it. 91 of 92 GET routes reject anonymous callers; all 22 admin routes reject a student token; there is no mass assignment on either privileged write path; cross-user IDOR fails on every owned resource I could reach; the upload guard defeated six of seven crafted attack files including the comment-padded SVG bypass; and the client contains **zero** uses of `dangerouslySetInnerHTML`. The test suite passes clean.

The problems I found are not in the authorization model. They clustered in three places — all three are the HIGH findings, and all three are now fixed:

1. **A capacity control that will misfire at launch scale** — the global rate limiter is IP-keyed at 1000/15min, and the careful campus-NAT reasoning applied to the login limiter was never applied to it.
2. **A security control that is opt-in for the attacker** — device binding is skipped entirely when the client omits a header it controls.
3. **Silent breakage in things nobody watches** — product analytics records nothing at all, avatars never load on eight endpoints, and the referral system's central promise is false for most students.

None of these is a data breach. All three are the kind of defect that surfaces on launch day in front of 10,000 users.

| Severity | Found | Open |
|---|---|---|
| Critical | 0 | 0 |
| High | 3 | **0 — all fixed** |
| Medium | 5 | 4 |
| Low | 10 | 10 |

---

## Critical Blockers

None. Nothing found puts existing data at risk of unauthorised access or loss.

---

## HIGH

### H1 — Global rate limit will brown out a campus, and the fix is already documented one file over

> **STATUS: FIXED** — `generalLimiter` is now keyed on the authenticated account. See [R1](#r1--h1-global-rate-limit).

**Location:** `server/index.js:161` · `server/middleware/rateLimiters.js:9`

**Issue.** `app.use('/api', generalLimiter)` applies a 1000-request / 15-minute ceiling across all 300 API routes, keyed on IP (express-rate-limit's default).

`rateLimiters.js` contains an extended comment explaining why *this exact reasoning* was wrong for login:

> *"a college campus reaches the internet through a handful of NAT addresses, so the whole cohort shared 20 attempts… the 21st student to try logging in would be told 'Too many attempts' — indistinguishable from an outage"*

That insight produced `loginAccountLimiter`, keyed on the account. It was never carried across to `generalLimiter`, which still has the property the comment describes as broken.

**Evidence.** One dashboard load fires ~15 distinct API requests (measured from the browser network log, excluding React StrictMode's dev-only doubling): `notifications`, `search/pinned`, `search/analytics/recents`, `search/analytics/frequent`, `dax/usage`, `readiness`, `tasks`, `notes`, `reflection/today`, `daily-case/today`, `resume`, `internships`, `dax`, `pivot/progress`, `subscription/me`.

1000 ÷ 15 ≈ **66 dashboard loads per 15 minutes for an entire shared egress IP.**

My load test hit this directly — I could not measure application throughput because the limiter took over first:

```
/auth/me   conc=1   n=400   {"200":300,"429":100}
/auth/me   conc=25  n=400   {"429":400}
```

**Impact.** On campus wifi behind NAT, a few dozen students browsing normally exhaust the budget for everyone on that network. The failure presents as a site-wide outage. Students on mobile data are unaffected, which makes it maddening to diagnose — it will look intermittent and user-specific.

**Severity:** High — conditional on deployment topology. If most students arrive on individual mobile IPs this is a non-event; if orientation day is 500 students on one campus SSID, it is an outage.

**Fix.** Key the general limiter on the authenticated user (`req.user.userId`) with an IP fallback for unauthenticated routes, exactly as `loginAccountKey` already does. Raise the ceiling, and treat the number as "requests per student", not "requests per network".

---

### H2 — Device binding is bypassed by omitting one request header

> **STATUS: FIXED** — every token now names a device, and `verifyToken` requires one. See [R2](#r2--h2-device-binding).

**Location:** `server/middleware/verifyToken.js:49-58` · `server/controllers/authController.js:33-37`

**Issue.** The device check is guarded by `payload.did &&`. `did` is populated from `deviceFromRequest()`, which reads the **client-supplied** `x-device-id` header. Omit the header and `signToken` mints a token with `did: undefined` — which the middleware then never checks.

The comment justifies the guard as backwards compatibility for tokens issued before device sessions existed. That is a legitimate concern, but the same branch is reachable *today* by any caller that simply doesn't send the header.

**Reproduction.**
```bash
# 1. Log in with no x-device-id header    -> token has no `did` claim
# 2. Log in on 5 further distinct devices -> cap is 3, so the first two evict
# 3. Check every token
```
Result:
```
dev1 /auth/me -> 401     (evicted, correct)
dev2 /auth/me -> 401     (evicted, correct)
dev3 /auth/me -> 200
dev4 /auth/me -> 200
dev5 /auth/me -> 200
no-did /auth/me -> 200   <-- never registered, never evicted
```

The header-less session is also **invisible and unrevocable**. `GET /auth/devices` returns only `dev-visible`, `dev5`, `dev4` — the no-`did` session is not listed, so the student's "Your devices" screen cannot see or revoke it. Only a password change (which bumps `tokenVersion`) kills it.

**Impact.** Two things. The subscription-sharing cap — a revenue control — is defeated by deleting a header. And a stolen token that was minted without a device id cannot be revoked through the UI built for exactly that purpose.

`client/src/utils/deviceId.js` is candid that this control is soft: *"Making account sharing inconvenient and visible is the goal; making it impossible is not achievable in a browser."* That is fair, but copying a device id still consumes a slot and still appears in the devices list. Omitting the header produces a session that is neither capped nor visible — a strictly weaker outcome than the design intends.

**Fix.** Mint a server-side device id when the header is absent, rather than issuing an unbound token. Keep the `!payload.did` allowance only for tokens issued before the cutover, and drop it once 7 days (the token TTL) have elapsed post-deploy — at which point no legacy token can still exist.

---

### H3 — Product analytics records nothing; every event is rejected

> **STATUS: FIXED** — the beacon now sends a JSON-typed `Blob`. See [R3](#r3--h3-product-analytics).

**Location:** `client/src/utils/analytics.js:48` · `server/routes/betaRoutes.js:38`

**Issue.** `navigator.sendBeacon(url, body)` with a **string** payload sets `Content-Type: text/plain;charset=UTF-8`. Express's `express.json()` only parses `application/json`, so `req.body` is empty, `event` is `undefined`, and the handler returns 400 *"Event name is required"*.

`sendBeacon` is the primary path and is available in every browser the app supports, so the `fetch` fallback beneath it never runs.

**Reproduction.**
```bash
curl -X POST /api/beta/events -H 'Content-Type: text/plain;charset=UTF-8' \
     -d '{"event":"test_event"}'      # -> 400 {"message":"Event name is required"}
curl -X POST /api/beta/events -H 'Content-Type: application/json' \
     -d '{"event":"test_event"}'      # -> 201 {"ok":true}
```

Confirmed end-to-end: after a full browser session including login and dashboard use, `db.betaevents.countDocuments()` returns **0**. The browser network log shows `POST /api/beta/events → 400` on every page load.

**Impact.** Zero product telemetry. There is no activation funnel, no feature-usage data, and no way to answer "what did students actually do on launch day". The irony is that this is the one system whose whole job is to tell you when something is wrong.

**Fix.** One line:
```js
navigator.sendBeacon('/api/beta/events', new Blob([body], { type: 'application/json' }));
```
Consider also accepting `text/plain` on the ingest route as a belt-and-braces measure, since beacons are awkward by nature.

---

## MEDIUM

### M1 — "Instant access" is false for most students, and the referral code is burned anyway

> **STATUS: FIXED** — a valid referral now admits the student regardless of program type. See [R4](#r4--m1-referral-admission).
>
> **Correction to this section:** it originally read "17 of 40 selectable combinations". The denominator was wrong — the signup form offers **45** combinations, 17 preset and **28** custom. The 17 was right; the remainder was not. Corrected below.

**Location:** `server/utils/programResolver.js:12-23` · `server/controllers/authController.js:199-221`

Auto-approval requires `Boolean(referrer) && isPresetProgram`. `CURATED_COMBOS` maps only 10 course/specialisation patterns. Cross-referencing against the options the registration UI actually offers (`client/src/components/register/AcademicStep.jsx`), **17 of 45 selectable combinations are preset; the other 28 resolve to `custom`** and land in the approval queue regardless of referral code.

Two entries in the map are unreachable from the UI at all: `b.sc|psychology` (the UI's B.Sc list has no Psychology) and `m.sc|computer science` (the UI sends `CS`).

Verified live:

| Course | Specialisation | Result |
|---|---|---|
| B.Tech | CSE | `approved` / preset |
| B.Tech | ECE | **`pending`** / custom |
| B.Com | Accounting | **`pending`** / custom |
| Medical | MBBS | **`pending`** / custom |
| B.Sc | Computer Science | **`pending`** / custom |

**The sharper half:** the code is claimed *before* the preset check, so it is consumed even when it grants nothing — and it is one-time.

```
Student A: code ADMI-J0G + Medical/MBBS  -> 201, status=pending   (code burned)
Student B: code ADMI-J0G + B.Tech/CSE    -> 400 "This referral code has already been used"
```

Student A waits in the queue. Student B, who would have qualified, is locked out. And `client/src/components/common/InviteCard.jsx:9` generates a WhatsApp message promising exactly what did not happen:

> *"Register with my one-time referral code ADMI-J0G for instant access (it only works once, so it's yours!)"*

**Fix.** Only claim the code on a path that grants approval — move the `findOneAndUpdate` after the `isPresetProgram` determination, or release it when `autoApproved` is false. Separately, decide whether a referral should grant access irrespective of program type; a friend vouching for you is orthogonal to whether your degree has a curated content feed.

---

### M2 — Student directory republishes onboarding data the student never chose to share

**Location:** `server/controllers/directoryController.js:47-53`

`getDirectory` returns whole `UserProfile` documents with no field projection, to any authenticated member, 200 per page, paginated across the database.

Verified response contains **30 fields**, including:

`difficultSubjects` · `favouriteSubjects` · `dreamRole` · `goals` (12 career-intent booleans) · `learningStyle` · `college` · `semester` · `graduationYear` · `experience`

The tell is that the **write** path immediately below it (`upsertMyProfile:70`) has an explicit 13-field allowlist. The extra 17 fields cannot be set through the directory UI — they arrive from registration, where they were collected for personalisation. The read path publishes them anyway.

`difficultSubjects` is, literally, a list of the subjects a student finds hard. Nothing in the signup flow suggests it becomes visible to their entire cohort.

**Fix.** Mirror the write allowlist as a `.select()` projection on the read. The directory's purpose (skills, interests, clubs, languages, links, `lookingFor`, bio) is well served by the 13 fields students can actually edit.

---

### M3 — Faculty and Institution sign-ups silently become student accounts

**Location:** `client/src/pages/RegisterPage.jsx:154-159` · `server/controllers/authController.js:130`

The registration UI offers three account types — Student, Faculty, Institution — and branches its onboarding on the choice (faculty skip course and semester). It sends `accountType`. The register controller never destructures or reads that field. `User.role` is `enum: ['admin','member']` and is set solely from the `ADMIN_EMAIL` check.

The code is honest about it:

> *"This field is accepted and ignored by the current endpoint… Faculty/Institution is a routing hint in the client today and needs a matching User field before it persists."*

So a faculty member completes a tailored signup and receives an ordinary student account, with no faculty capability anywhere.

**Impact on the brief specifically:** the requested Phase 3 faculty testing (student management, job posting, review workflows, faculty analytics) **could not be performed because the role does not exist.** There are two roles in this product, not three. Any launch messaging aimed at faculty is currently unsupported.

**Fix.** Either persist `accountType` and gate faculty features on it, or remove the selector until the backend supports it. Presenting a choice that is discarded is worse than not offering it.

---

### M4 — Account enumeration is a supported feature of the API

**Location:** `server/controllers/authController.js:109-118` (`checkEmail`), `:563-570` (`login`)

`GET /api/auth/check-email?email=` returns `{"exists":true|false}` with no authentication. The endpoint is deliberate and its docstring justifies the UX. But combined with `authLimiter` at 300/15min per IP, that is ~28,800 probes per day from a single address.

Login compounds it by distinguishing states:

| Case | Response |
|---|---|
| Unknown account | 401 `Invalid email or password` |
| Real account, unverified | **403 `needsEmailVerification`** |
| Real account, pending approval | **403 `pending`** |

So an attacker learns not just that an address is registered, but its lifecycle state.

**Impact.** For a platform whose user base is a known, enumerable population (`firstname.lastname@college.edu`), this allows reconstructing the student roster and identifying who has not yet completed signup — a good targeting list for phishing that impersonates the verification email.

**Fix.** Tighten `check-email` to a much lower per-IP budget than the shared `authLimiter` — it is a typeahead check, not a login. The 403 states are harder to remove without hurting real users; the enumeration cost is mostly carried by `check-email`.

---

### M5 — Avatars never render anywhere, on eight endpoints

**Location:** `server/models/User.js:29` vs. 8 call sites

The schema field is **`avatarUrl`**. Eight controllers populate **`'name avatar'`**:

`feedController.js:21,60` · `projectController.js:14,37` · `marketplaceController.js:21` · `skillController.js:15` · `eventController.js:113` · `directoryController.js:48`

Mongoose silently selects nothing for a path that doesn't exist. Verified:

```json
directory user subdoc : {"_id":"6a89711f...","name":"attacker2"}
feed author subdoc    : {"_id":"6a896fb0...","name":"Admin User"}
```

No avatar field is returned at all. Every list view in the app — feed, directory, projects, marketplace, skills, events — renders fallback initials for every user, including users who uploaded a photo.

**Fix.** `populate('user', 'name avatarUrl')` at all eight sites. Low effort, immediately visible improvement.

---

## LOW

| # | Finding | Location |
|---|---|---|
| L1 | **`text/*` bypasses every active-content check.** `checkFile` skips the markup checks entirely when the declared type starts with `text/`, and `studioUpload` accepts `text/plain`, `text/csv`, `text/markdown`. An SVG with `onload=` named `x.svg` and declared `text/plain` is **accepted**. Reachable only through Content Studio, which is `checkRole('admin')` — so this needs a malicious or compromised admin. | `middleware/uploadGuards.js:173` |
| L2 | **Email templates predating `esc()` interpolate raw.** `esc` is defined at `mailer.js:161`; the five templates above it (welcome, approval, verification, program-ready, password reset) interpolate `user.name` unescaped. Verified: a name of `Bala<img src=x onerror=…><a href="https://phish.example/login">Verify now</a>` renders as live HTML in the body. All five are self-directed, which caps severity. `sendAnnouncementEmail:277` also interpolates the admin-authored body raw. **Credit where due:** `sendResumeCopyEmail` — the only template that reaches a third party — *does* escape correctly. | `config/mailer.js` |
| L3 | **Non-string `email` returns 500, not 400.** `{"email":{"$ne":null}}` → `TypeError: email.toLowerCase is not a function`. Not an auth bypass (mongo-sanitize strips the operator), but unhandled input should be a 400. | `authController.js:559` |
| L4 | **Two malformed `.env` lines contain live key material.** L25 and L28 are leftovers from a bad edit where a secret value ran into the next key name (`nvapi-…_BREVO_FROM_NAME=`). Harmless to parsing — the real keys are defined separately — but these are credentials sitting in a file, alongside 5 `.env.bak.*` files with more. | `server/.env` |
| L5 | **`/api/feed` exposes internal moderation scores.** Every post ships `aiModerationScores: {spam, hate, advertising, lowQuality}` to the client. Internal scoring, no UI consumer. | `models/Post.js:32` |
| L6 | **Guaranteed console errors on every dashboard load for free-tier users.** The dashboard requests `GET /api/readiness` (403 — Placement Pass required) and `POST /api/dax` (403) unconditionally. Two failed requests per load for the majority of users; real errors get lost in the noise. | browser network log |
| L7 | **Duplicate dashboard card.** "Build your skill roadmap" renders twice — once as TODAY'S FOCUS, again immediately below with near-identical copy. Very visible on mobile. | Dashboard |
| L8 | **`VITE_PITCH_MODE=true` is set but referenced nowhere** in `client/src`. Dead config. | `client/.env` |
| L9 | **`npm run build` fails locally** — a root-owned `client/dist/.DS_Store` can't be removed by `emptyOutDir`. Local-only; a clean CI checkout is unaffected. Build itself is healthy (1.47s to a clean dir). | — |
| L10 | **"MongoDB connected" still logged twice** at boot (carried over from the previous audit's L5). | — |

---

## What Held Up Under Attack

These were tested adversarially and did not break. Listing them because a report of only defects misrepresents the codebase.

| Area | Result |
|---|---|
| **Anonymous access** | 92 GET routes probed without a token → **91 correctly 401**. The one exception, `check-email`, is public by design. |
| **Privilege escalation** | 22 admin routes probed with a student token → **all 22 rejected**. |
| **Mass assignment** | `role`, `status`, `tier`, `tokenVersion`, `emailVerifiedAt` injected into both `POST /register` and `PUT /profile` → **all ignored**; account stayed `member`/`free`/`pending`. Both paths use explicit allowlists. |
| **Cross-user IDOR** | Attacker vs. victim on notes/tasks/expenses/albums → read 404, update 403, delete 403 across the board. List endpoints correctly scoped to the caller. |
| **Upload guards** | 6 of 7 attack files rejected: HTML-as-PNG, SVG-as-PNG, SVG-as-SVG, **comment-padded SVG** (the documented bypass — now closed), HTML-as-PDF, PNG+`<script>`, empty file. The only acceptance was a valid PNG with script appended past byte 1024, which is inert when served as `image/png`. |
| **XSS** | **Zero** occurrences of `dangerouslySetInnerHTML` in the entire client. |
| **Auth lifecycle** | Verification tokens are single-use (replay → 400). Case-differing duplicate emails correctly 409 (schema `lowercase: true`). Password policy enforced. Honeypot present. Device cap evicts correctly *when the header is sent*. |
| **Graceful degradation** | With the mail transport down, registration still returns 201 and tells the truth: *"Account created, but we couldn't send the confirmation email just now."* Structured error logged. This is the right behaviour and it is rare. |
| **Readiness score** | Genuinely computed from resume completeness, company reads, bookmarks, interests and task history. **No hardcoded values.** Component maxima (35+25+20+20) sum to exactly 100 and each is actually reachable. |
| **Test suite** | **676 passed / 0 failed, 45 suites, 23.5s** against local MongoDB. |

---

## Performance

| Measurement | Result |
|---|---|
| Client production build | **1.47s** |
| Largest chunk | `index-*.js` **705.68 kB / 220.85 kB gzip** |
| Route splitting | Working well — page chunks are 5-20 kB gzip |
| API latency (local, warm) | `/auth/me` p50 1ms · `/directory` p50 3ms · `/feed` p50 2ms |
| Under 100 concurrent | p50 6-9ms, p95 10-20ms — before the rate limiter took over |

The 705 kB vendor chunk remains the one structural front-end cost, consistent with the previous audit. No N+1 patterns surfaced in the endpoints I exercised.

**A useful operational finding:** the test suite runs in **23 seconds against a local MongoDB**, versus the slow, timeout-prone Atlas runs that the previous audit spent considerable effort stabilising (`testTimeout: 30000`, the `DNS_SERVERS` workaround, the 180s carve-out for `stockFetcher`). Running CI against an ephemeral local MongoDB would remove that entire class of flakiness rather than accommodating it.

---

## What I Did Not Test

Stating these plainly, because a readiness score that quietly omits them is misleading.

- **AI runtime, recommendations, and prompt injection.** The AI endpoints returned 403 for the free-tier test account, and exercising them properly means spending real credits against live providers on the user's account. **Feature 5 (AI Intelligence Center) and Feature 6 (Recommendation Engine) are untested here**, including the prompt-injection and data-leakage checks the brief asked for. This is the largest gap in this report.
- **Load at 500 and 1000 users.** Not meaningful from this setup: a single local instance with a 1000/15min limiter measures the limiter, not the app (as H1 shows). Real numbers need a staging deploy with limits raised and a distributed client.
- **Cross-browser and real devices.** Chromium only. I checked a 375×812 mobile viewport (layout adapts cleanly — bottom tab bar, no horizontal overflow, though with large vertical gaps and the Dax button overlapping a card). No Safari, no Firefox, no physical iOS or Android.
- **Production deployment.** Render, Vercel and Atlas configuration was not exercised. All testing was local.
- **Payments end-to-end.** Razorpay logic is covered by the passing test suite, but no live checkout was performed. Note there is uncommitted work in `server/payments/razorpay.js` plus a new `razorpay.chain.test.js`.
- **Psychological assessment (Feature 3).** No endpoint corresponding to it surfaced in the 40-prefix API map; the closest are `/api/reflection` and `/api/pivot`. It may not be built yet.

---

## Recommendation

### CONDITIONAL GO

Ship once H1, H2 and H3 are addressed. All three are small, well-understood changes:

**Before launch**
1. **H1** — re-key `generalLimiter` on user id with IP fallback. *(highest launch-day risk)*
2. **H3** — one-line `Blob` fix in `analytics.js`. *(you cannot diagnose launch day without it — fix it first, so it is collecting data by the time you need it)*
3. **H2** — mint a server-side device id when the header is absent.
4. **M1** — stop burning referral codes that grant nothing, and fix or retract the "instant access" invite copy.

**Shortly after**
5. **M5** — `avatarUrl` at eight call sites. Cheap, and the app looks broken without it.
6. **M2** — projection allowlist on the directory.
7. **M3** — decide whether faculty is a real role or remove the selector.
8. **L6, L7** — stop firing known-403 requests; de-duplicate the dashboard card.

**Carried forward, still open from the 2026-08-21 audit:** CSP disabled + JWT in `localStorage`, and the notification dedup race. My testing did not change the assessment of either. Note that H2 interacts with the first: an XSS-stolen token minted without a `did` is not revocable from the devices screen.

### Final Launch Checklist

| | |
|---|---|
| ✅ | Authentication stable — lifecycle tested end-to-end |
| ✅ | Authorization verified — 92 anonymous + 22 privilege-escalation probes |
| ✅ | IDOR and mass assignment — tested, clean |
| ✅ | File uploads — 7 attack files, 6 rejected |
| ✅ | Database safe — ownership scoping confirmed on every list endpoint |
| ✅ | Tests green — 693/693 |
| ✅ | Rate limits — H1 fixed, per-account keying verified |
| ✅ | Device binding — H2 fixed, bypass no longer reproducible |
| ✅ | Monitoring — H3 fixed, events now reach the database |
| ⚠️ | Notifications — bell and SSE present; email fan-out not load-tested |
| ❌ | AI stability — **not tested** |
| ❌ | Backup strategy — not reviewed |
| ❌ | Production deploy verification — not performed |

---

## Remediation

All three HIGH findings were fixed on 2026-08-22. Each fix was verified by re-running the
exact script that originally demonstrated the flaw, against a rebuilt server — not by
re-reading the code.

| | Finding | Fix | Verified by |
|---|---|---|---|
| R1 | H1 — IP-keyed global limit | `generalKey` in `middleware/rateLimiters.js` | two accounts, one IP |
| R2 | H2 — device binding opt-out | `deviceFromRequest` + `verifyToken` | original bypass script |
| R3 | H3 — analytics never recorded | JSON-typed `Blob` in `utils/analytics.js` | browser, A/B beacon |

**Suite:** 693 passing / 47 suites (was 676 / 45). **Client:** builds clean, `eslint` 0 errors.

---

### R1 — H1, global rate limit

`generalLimiter` now keys on the authenticated account, falling back to the address only
when a request carries no usable token.

The signature is **verified**, not merely decoded. Decoding alone would let anyone mint a
fresh bucket per request by claiming a new `userId` — strictly worse than keying on IP,
which is the trap this fix exists to avoid.

```
Student A: first 429 after 1001 requests   (their own 1000/15min budget)
Student B, same IP, different account: 200, 200, 200, 200, 200
```

Before the fix, B was 429ed by A's traffic. Pinned by `tests/rateLimiters.test.js`
(8 tests), including the forged-token and expired-token fallbacks.

> **Note — a second, tighter chokepoint remains.** Everything under `/api/auth` also
> passes through `authLimiter`, which is still IP-keyed at 300/15min. That includes
> `GET /api/auth/me`, which the client calls on load — an authenticated profile read
> sharing a bucket meant for credential guessing. On a shared campus egress this binds
> before the general limit does. Not fixed here because it needs a decision about which
> `/api/auth` routes are genuinely unauthenticated; filed as follow-up.

### R2 — H2, device binding

Two changes, because either alone is insufficient:

- `deviceFromRequest` (`controllers/authController.js`) generates a UUID when
  `x-device-id` is absent, so a token can no longer be minted without a device.
- `verifyToken` rejects any token with no `did`, returning `SESSION_UPGRADE_REQUIRED`.
  This replaces `if (payload.did && …)` — a guard an attacker could switch off.

`deviceSessions.isActive` also now fails closed on a missing device id rather than
returning `true`, so a future caller that forgets the check inherits the safe answer.

```
login with NO x-device-id -> did = "cd193db9-…"   (was: undefined)
no-did token /auth/me     -> 401                  (was: 200, for 7 days)
```

The previously-invisible session now appears in "Your devices" and is revocable.

**Behaviour change:** tokens issued before this deploy are rejected, so existing sessions
sign in once more. The test asserting the opposite — *"lets tokens issued before this
feature through, so a deploy signs nobody out"* — was replaced, because that allowance
**was** the vulnerability. Acceptable at closed-beta size; if a live cohort must not be
signed out, gate the rejection on a deploy-dated `iat` cutover instead.

### R3 — H3, product analytics

`navigator.sendBeacon` sends a bare string as `text/plain;charset=UTF-8`, which
`express.json()` will not parse — so the server received an empty body and answered
400 for every event ever sent. sendBeacon is the primary path in every supported
browser, so the `fetch` fallback never ran and the failure was total.

The payload is now a `Blob` typed `application/json`. Verified in a real browser by
firing both forms at one authenticated endpoint:

```js
navigator.sendBeacon(url, body);                                  // old
navigator.sendBeacon(url, new Blob([body], {type:'application/json'})); // new
```
```
db.betaevents → [ { event: 'new_blob_way' } ]     // old_string_way: dropped
```

Both were queued by the browser; only one was recorded. That is exactly the failure mode
that made this invisible — the client-side call reports success either way.

---

### R4 — M1, referral admission

The bug was two questions answered by one variable:

```js
// before
const autoApproved = isAdminEmail(email) || (Boolean(referrer) && isPresetProgram);
// after
const autoApproved = isAdminEmail(email) || Boolean(referrer);
```

*Is this person allowed in?* is now decided by the referral — a one-time code traceable to
an approved member, which is exactly the signal admission should turn on. *Is their program
curated?* stays on the `ProgramApproval` record, still pending for uncurated programs and
still reviewed by an admin. It just no longer decides whether a vouched-for student can log
in.

Gating admission on curation was never justified by cost: `programSyncService` tags existing
news, company, post and resource rows onto the new slug. There are no AI calls and no
external fetches, and `runProgramSync` does not check `approval.status` — so a referred
student's feed builds on verification exactly as a preset student's does.

**Verified live** — a referred student across the courses the signup form offers:

```
B.Tech / CSE              account=approved  program=preset  programApproval=approved
B.Tech / ECE              account=approved  program=custom  programApproval=pending
B.Com / Accounting        account=approved  program=custom  programApproval=pending
Medical / MBBS            account=approved  program=custom  programApproval=pending
B.Sc / Computer Science   account=approved  program=custom  programApproval=pending
BBA / Marketing           account=approved  program=custom  programApproval=pending

B.Tech / CSE, no code     account=pending          <- gate still closed
```

The second half of the finding — the code being spent for nothing — resolves as a
consequence: the code now always buys admission, so spending it is never wasted. One-time
semantics are unchanged.

```
burn-a  Medical/MBBS -> 201  account=approved
burn-b  B.Tech/CSE   -> 400  "This referral code has already been used"
```

**Coverage:** `tests/registrationApproval.test.js` (9 tests) — nothing previously tested the
rule deciding whether a student can log in. It also measures how much of the signup form the
curated map covers, so the gap stays visible: **17 of 45 combinations preset, 28 custom**.
Curating more programs is still worth doing for feed quality; it is no longer a locked door.

> **Note on test-suite mail.** This new suite is the only one that drives a real `register()`
> call, and on first run it delivered **four real emails** through the live Brevo credentials
> that `dotenv` loads from `.env`. The file now clears the mail environment before the mailer
> is required. Verified afterwards: a full `npm test` produces zero real sends — the 21
> "Mail delivered" lines all come from `mailTransport.test.js`, which mocks its transports.
> Worth remembering for the next suite that touches a send path.

### Two curated-map entries are still unreachable (unchanged)

`b.sc|psychology` and `m.sc|computer science` cannot be produced by the signup form, which
offers no Psychology under B.Sc and sends `CS` rather than `Computer Science`. Harmless dead
config, and much less consequential now that `custom` no longer blocks admission — left
alone rather than changing the form's course list as a side effect of a security fix.
