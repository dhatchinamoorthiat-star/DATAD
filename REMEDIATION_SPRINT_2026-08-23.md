# DATAD — Remediation Sprint & Release Gate

**Date:** 2026-08-23
**Input:** `E2E_TEST_REPORT_2026-08-22.md`, `E2E_PHASE2_REPORT_2026-08-22.md`,
`PRODUCTION_READINESS_AUDIT.md`, existing suite.
**Method:** fix → test → re-run the original exploit → confirm closed.
No new audit was performed; the reports were treated as the finding list.

**Test suite:** 57 suites / 840 tests → **67 suites / 1030 tests, all passing.**
Four consecutive clean full runs.

> **Scope honesty, first rather than last.** Everything below was verified on
> this machine. **Staging was not deployed and no production topology was
> exercised**, because that needs your Vercel/Render/Atlas accounts and is an
> outward-facing action. Nothing in this document describes production.

---

## FIXED

### P0 · H4 — newsletter poisoning → mass phishing · **CLOSED**

The original chain: student post title → prompt → AI output → auto-send to every
approved member → raw HTML → verified Brevo sender (SPF/DKIM pass).

Four independent layers, none of which depends on a model behaving:

1. **Instruction/data boundary** — `server/ai/untrusted.js`. Post titles are
   JSON-encoded, collapsed to one line, stripped of invisible characters,
   length-capped, and wrapped in sentinels the content cannot reproduce. The
   standing rule lives in the *system* message, above the data.
2. **Refusal is terminal** — `server/ai/refusal.js` + `ai/runner.js`. This was
   the report's sharpest finding: Groq refused, the runner read the refusal as a
   malformed response, and failed over to a provider that complied. The six
   states the brief asked for are now distinct — `transport_error`, `timeout`,
   `provider_unavailable`, `malformed_response`, `model_refusal`,
   `safety_refusal` — and the last two **stop the chain**. The first four still
   fail over, so resilience is intact.
3. **Output gate** — `automation/newsletter/newsletterGuard.js`. Assumes 1 and 2
   failed. Rejects off-domain links, any HTML/`javascript:`, and
   credential-harvesting language. A failing draft becomes `blocked`, which
   **no admin can override** — it must be regenerated.
4. **Approval boundary** — `controllers/newsletterController.js`. The generator
   no longer imports the mailer at all. Sending happens only via
   `POST /api/admin/newsletter/:id/send`, and the draft is **re-validated at
   send time**, not just at generation.

Also: `sendAnnouncementEmail` now escapes the HTML body (`esc()` already existed
in that file), and "top discussions" is ranked with `$addFields: { $size }` —
`sort({'likes.length': -1})` never ranked at all, which is why the attack needed
no engagement.

**Verified against the original exploit.** The verbatim `PWNED-NEWSLETTER-5150` /
`http://phish.example/reset` payload is driven through the real prompt and real
runner with providers mocked to always comply. 56 tests across
`newsletterSecurity`, `newsletterApproval`, `newsletterMailEscaping`.
The load-bearing assertion: the compliant provider is **never called** after a
refusal.

**A real defect found while fixing this.** The terminal-refusal guard used
`err instanceof RefusalError`, which compares constructor identity and therefore
**fails open** when two copies of the module exist — re-enabling the H4 chain
silently. Replaced with a structural `isRefusal()` check. The regression suite
caught it by resolving to the phishing payload.

### P1 · H5 — auth limiter locks out a campus · **CLOSED**

The per-endpoint limiters were already written; **`server/index.js` still mounted
one shared `authLimiter` on the whole `/api/auth` prefix**, which runs *before*
the router and charged the shared bucket regardless. That mount was the bug.
Removed; `/auth/me`, `/profile`, `/password`, `/devices` now fall through to the
per-account `generalLimiter`, exactly like `/tasks`.

**Verified against the original exploit** (`authRateLimitIsolation.test.js`, 14
tests, real HTTP through real middleware): exhaust `/check-email` from one IP →
authenticated `/auth/me` from that IP still returns **200**. Also covered: five
students behind one NAT each get their own budget; login brute force is bounded
per account across rotating IPs; one student's failed logins do not lock out
another; check-email is still capped (isolation ≠ unlimited).

### P2 · M6 — error handler crash · **CLOSED**

`Object.values(err.errors)` no longer throws, and the handler is wrapped so it
cannot throw at all. Every error returns `{ message, code, requestId }` as JSON,
with a stable machine-readable `code`. A `redact()` layer sweeps configured
secret values and secret-shaped patterns (Mongo URIs, `sk-`/`gsk_`/`xkeysib-`
keys, bearer tokens, JWTs, filesystem paths) out of anything client-bound.

One further fix: when headers are already sent it now **delegates to Express**
rather than returning, which was leaving SSE sockets open until timeout.

### P3 · M2 — directory privacy · **CLOSED**

`models/profileVisibility.js` defines PUBLIC / PRIVATE / ROLE_RESTRICTED /
INTERNAL as an **allowlist**, so an unclassified field is withheld rather than
published — the previous default was the reverse, which is how `dreamRole`
shipped to the directory the day it was added. `difficultSubjects`,
`favouriteSubjects`, `goals`, `dreamRole`, `learningStyle`, `experience`,
`semester`, `careerInterests`, `preferredIndustries` are all private.
Canary-verified in `directoryPrivacy.test.js`.

### P4 · Error tracking · **BUILT**

`server/observability/errorTracker.js` — one `capture()` seam behind three
transports: Sentry (lazy, optional dependency), webhook (`ERROR_WEBHOOK_URL`),
and the structured log. Wired to API 500s, both fatal crash handlers, and a new
`POST /api/telemetry/error` for frontend runtime errors.

Client side: the section-level `ErrorBoundary` sits *inside* Sentry's root
boundary and stopped propagation, so **every section crash a student actually
saw was invisible**. It now reports. Global `error`/`unhandledrejection`
handlers cover what React boundaries structurally cannot see.

Privacy fixes made in passing: Sentry session replay had `maskAllText: false`
while the app renders private notes, résumés and finance data — now masked and
media-blocked, with `beforeSend` stripping query strings so a verification token
cannot ride along.

**Verified:** an intentionally generated 500 travels handler → tracker →
transport carrying the correlation id, environment and route pattern, and
redaction is asserted against live credentials, Mongo URIs and student PII
(15 tests).

**Last mile (added after the above).** "Built but inert until a DSN is set" was
still a state nothing would have told you about, so three things close it:

- `@sentry/node` is now an installed dependency, not a documented intention.
  `SENTRY_DSN` alone activates the sink; the optional-dependency fallback is
  still pinned by a test that simulates the package being absent.
- `GET /api/health` reports an `errorTracking` field naming the live sinks
  (`sentry+log`, `webhook+log`, or bare `log`). A production health check
  reading bare `log` is the signal that a DSN never reached the deploy — which
  is the failure mode, and it was previously silent. The handler moved to
  `routes/healthRoutes.js` so it is testable, and reading the sink list is
  wrapped: a tracker that throws must not be able to pull an instance out of the
  load balancer (`healthErrorTracking.test.js`, 5 tests).
- `npm run verify:errors` sends one real event through the real `capture()` path
  and prints a nonce to look for. Exit 0 = every configured sink accepted it;
  exit 2 = only the log is active, which is a failed gate, not a pass. Webhook
  delivery was confirmed end to end against a local listener — the received
  payload had filesystem paths already redacted.

Deployment variables and the verification step are documented in
`DEPLOYMENT.md` § Error tracking and `server/.env.example`.

### P5 · CSP · **CLOSED** (see caveat)

`contentSecurityPolicy: false` → a real policy in `server/config/csp.js`.
`script-src 'self'`, no `unsafe-inline`, no `unsafe-eval`, `base-uri` locked,
`frame-ancestors 'none'`, `object-src 'none'`.

The original justification was correct but the conclusion did not follow: the
external cover images needed **one** directive (`img-src https:`), not the whole
header off. And CSP is the second layer that makes the JWT-in-localStorage risk
survivable — with it off, a single XSS anywhere takes the session.

Blocker found and fixed: `index.html` had an **inline theme script** that
`script-src 'self'` would block, causing a flash of the wrong theme. Extracted
to `client/public/theme-init.js`.

**Verified in a real browser** against the real production build: page renders,
theme script executes (`html.class === "dark"`), zero inline scripts, **no CSP
violations**. A/B'd with CSP disabled to confirm the one console error (service
worker) is pre-existing and unrelated.

### P6 · Product truth · **CLOSED**

`accountType` is posted by the client and the server has **zero references to
it** — the choice was silently discarded. Faculty and Institution are now
`available: false`: hidden by default, and `RegisterPage` coerces anything
unavailable to `student` before the request is built, so UI and created account
cannot disagree. **Verified in the browser:** the selector no longer renders.

### P9 · Avatar / dashboard cleanup · **CLOSED**

`avatar` vs `avatarUrl` was already fixed in `profileVisibility.js`. The
guaranteed 403s were not: `getReadiness()` (needs Placement) and
`dashboardInsights()` (needs Pro) fired on **every dashboard load for every
user**, swallowed by `.catch(() => {})`. Now gated on tier via
`client/src/utils/tier.js`. `tierParity.test.js` asserts the client's copy
matches the server registry and — the dangerous direction — that the client can
never suppress a call the server would have allowed.

### P10 · Test safety · **CLOSED**

Three layers, opt-in via `ALLOW_REAL_EXTERNAL_CALLS=1` / `npm run test:integration`:

1. `tests/setup/safeEnv.js` — deletes every outbound credential (mail, payments,
   AI, storage, observability) and **wraps `dotenv.config`**, because eleven test
   files re-load `.env` after setup runs and would put them all back.
2. `tests/setup/blockExternalCalls.js` — guards `fetch`.
3. `tests/socketGuard.js` — guards `http/https.request` and `net.connect`, which
   is where **nodemailer's SMTP actually goes**. The one transport with a
   confirmed incident was the one `fetch` guarding missed.

**Repo-wide sweep done.** `stockFetcher.test.js` was the only suite reaching a
live external API; it is now blocked and its own stub is used.

**A second, real reliability fix:** all DB suites shared one test database across
parallel jest workers, each opening with `deleteMany({})`. `testDb.js` now
derives a **per-test-file** database. This is what turned an intermittent
2-suite failure into four consecutive clean runs.

### P8 · AI security regression · **BUILT**

`aiSecurityRegression.test.js`, 48 tests, asserting **shape not behaviour** — the
brief asked for authorization at the tool/data layer, not prompt instructions.
Covers: no tool declares an identity parameter, no free-form filter object,
`executeTool(call, userId)` takes the id positionally, unauthorized/invented
tool names, secret extraction via error paths, stored prompt injection, and
every provider failure mode including refusal.

**A real vulnerability found here.** `EXECUTORS[call.name]` is a plain object
lookup, so `__proto__`, `constructor`, `toString` and `valueOf` resolved to
**inherited members** — walking past the "unknown tool" guard and being *invoked*
with the model's arguments, with the result returned as a tool result.
`call.name` is model-controlled. Nothing reachable that way leaks another
student's data, so it is not the breach it first looks like; it is a code path
chosen by model output that the guard existed to prevent. Fixed with
`hasOwnProperty` + `typeof === 'function'`.

---

## VERIFIED — re-tested against the original exploit

| Finding | Original exploit re-run | Result |
|---|---|---|
| H4 | verbatim `PWNED-NEWSLETTER-5150` payload through real prompt + runner | canary and `phish.example` absent from any sent mail; draft `blocked`; compliant provider never called |
| H4 (failover) | provider A refuses, provider B would comply | B **never invoked** |
| H5 | exhaust `/check-email` from one IP, then authenticated `/auth/me` | **200** (was 429) |
| M6 | custom `ValidationError` with no `.errors` | JSON + `requestId`, handler cannot throw |
| M2 | canary in another student's private bio via `/api/directory` | absent |
| CSP | real production build in a real browser | renders, no violations, no inline scripts |
| P6 | register page in a real browser | misleading selector gone |
| P4 | forced 500 | captured with correlation id, environment, route; secrets redacted |

---

## REMAINING — genuine open issues

| # | Issue | Severity | Note |
|---|---|---|---|
| — | **JWT in localStorage** | MEDIUM | Not migrated. CSP is now the mitigating layer. An httpOnly-cookie migration touches auth, SSE and CORS, and doing it in the same sprint as eight other fixes is how auth breaks. **Deliberately deferred**, with the compensating control shipped. |
| — | **Notification dedup race** | LOW | `findOne`-then-`create` is still not atomic. Duplicate bell entry under concurrent triggers; **no data loss**. Not tested this run. |
| L12 | Stored injection via `resume.summary` | LOW | Self-injection only — every chat tool is scoped to the caller. Unchanged. |
| L14 | Invalid `modelId` answers 200 | LOW | Unchanged. Product decision: reject or transparently default. |
| L15 | AI blends `dreamRole` with `careerInterests` | LOW | Unchanged. |
| — | **Recommendations are not domain-aware** | MEDIUM (product) | See below. |
| — | Render free plan | HIGH (ops) | Sleeping instance runs **none** of the 14 in-process crons. Decision, not a bug. |

### P7 · Recommendation quality — the honest answer

The Phase 2 caveat was correct, and it is now **measured** rather than suspected.
Alice (Finance) and Bob (Marketing) with *identical completeness*, differing only
in domain:

- **The recommendation set is identical.** Same titles, same types. Selection
  does not consider career domain at all; the engine is a state machine over
  what a student has done.
- **Exactly one generator** (`plannerGenerator`) varies its wording with the
  stated goal — one sentence in one of six recommendations.
- Changing Alice's goal Finance → Marketing changes **only that wording**. She
  is told to do exactly the same things, described with different nouns.
- The contrast that proves the harness is live: dropping `careerReadiness` to 20
  **does** change the set.

Measured by *differencing* Alice against Bob, not keyword search — which matters,
because `interviewGenerator` emits the fixed phrase *"strategy, marketing,
finance, and operations"* to every student and a keyword scan reported it as
both marketing-aware and finance-aware.

**This is a product gap, not a bug.** Pinned in
`recommendationDomainSensitivity.test.js` so making the engine domain-aware
becomes a deliberate decision rather than an unremarked change.

---

## NOT TESTED — no evidence, not a pass

- **Production/staging deployment on Vercel + Render + Atlas.** Nothing here
  describes production.
- Load at any level on production topology; **capacity for any user count**.
- Payments end-to-end (checkout, webhook replay, forged webhook, amount tampering).
- Atlas backup / PITR / **restore has still never been rehearsed**.
- Safari, Firefox, iOS, Android — tooling here is Chromium only.
- Notification concurrency and dedup under simultaneous triggers.
- Accessibility: keyboard-only, screen reader, focus trapping, contrast.
- Whether a Sentry event **arrives at sentry.io** — the pipeline is verified to
  the transport boundary; the vendor leg needs a real DSN.
- Whether the note-based injection path is exploitable once embeddings are indexed.

---

## PRODUCT DECISIONS — yours, not engineering's

1. **Faculty / Institution.** Currently hidden. Build the role lifecycle, or
   remove the catalogue entries permanently? (`VITE_SHOW_PLANNED_ACCOUNT_TYPES=true`
   shows them as disabled "Soon" cards if you want the roadmap signal.)
2. **Psychological assessment.** Still does not exist — no model, route, or
   scoring. It is in the brand line and Feature 3. Launch messaging problem
   before an engineering one.
3. **Recommendation engine.** Accept completeness-driven recommendations for v1,
   or invest in domain-aware generation?
4. **Render plan.** Free is incompatible with in-process crons. Upgrade, or move
   crons to an external scheduler?
5. **Newsletter cadence.** An admin must now approve every send. Is that
   sustainable weekly, or should low-risk drafts auto-send after a delay?
6. **AI credit accounting on failure.** Should a failed generation consume a
   student's daily credits?
7. **Directory field policy.** The allowlist is enforced; the *contents* are a
   product call. Should `college` and `graduationYear` be public?

---

## RELEASE BLOCKERS

**For staging:** none in the code. The blockers are access, not engineering —
Vercel/Render/Atlas accounts, a staging Brevo sender, and capped AI keys. All
documented in `STAGING_SETUP.md`.

**For public beta:**

1. Staging deployed and the smoke test green — **config drift is invisible
   locally, and this project's worst bug was exactly that** (`CLIENT_URL`
   trailing slash).
2. `SENTRY_DSN` or `ERROR_WEBHOOK_URL` actually set, and a test error confirmed
   to arrive. The pipeline is built; an unconfigured tracker tracks nothing.
3. A paid Render instance, or crons moved off-process.
4. One Atlas restore rehearsed. An unrehearsed backup is a hypothesis.
5. Payments exercised end-to-end in test mode.
6. If Vercel serves the frontend, the CSP added to `vercel.json` — otherwise the
   header protects API responses and not the document (§4 of `STAGING_SETUP.md`).

---

# 🟡 CONDITIONAL GO

**Conditional on staging being exercised — not on any code fix.**

Both HIGH findings are closed and re-verified against their original exploits.
H4 is closed at four independent layers, and deliberately none of them relies on
a model declining, because the report proved that defence gets walked past. H5
was one middleware argument, and the regression test drives real HTTP so the
mistake that made the per-route fix insufficient cannot recur silently.

Three real defects were found *by the new tests* rather than by the audit: a
fail-open `instanceof` guard that would have silently re-enabled the H4 chain, a
prototype-chain lookup letting model output invoke `Object.prototype` members,
and a shared test database that made the suite unreliable. That is the argument
for the tests being worth more than the fixes.

**What has not moved is the unmeasured half**, and it dominated the previous
58/100 score for good reason. Nothing here has run on Render, on Atlas, or under
load. Error tracking is built and now reports its own configuration, but it still
ships inert until a DSN or webhook URL is set on the deploy. Backups have
still never been restored. Payments remain untested.

### To reach GO

1. Deploy staging per `STAGING_SETUP.md`; complete the 21-step smoke test.
2. Set `SENTRY_DSN` or `ERROR_WEBHOOK_URL` on the deploy, then `npm run
   verify:errors` against that environment and find the nonce at the far end.
3. Progressive load 10 → 500 on staging; name the first bottleneck.
4. Rehearse one Atlas restore; record RTO and RPO.
5. Exercise payments in test mode.

Then: **controlled beta, 50–200 students, paid instance, one week**, before any
public launch.

---

## Changed in this sprint

**New:** `ai/refusal.js`, `ai/untrusted.js`, `automation/newsletter/newsletterGuard.js`,
`controllers/newsletterController.js`, `observability/errorTracker.js`,
`routes/telemetryRoutes.js`, `config/csp.js`, `models/profileVisibility.js`,
`tests/setup/`, `tests/socketGuard.js`, `tests/helpers/httpAgent.js`,
`client/src/utils/reportError.js`, `client/src/utils/tier.js`,
`client/public/theme-init.js`, `STAGING_SETUP.md`.

**New suites:** `newsletterSecurity` (36), `newsletterApproval` (12),
`newsletterMailEscaping` (8), `authRateLimitIsolation` (14), `errorTracking` (15),
`csp` (16), `aiSecurityRegression` (48), `tierParity` (5),
`recommendationDomainSensitivity` (9), plus `directoryPrivacy`, `errorHandler`,
`testSafety`, `newsletterNoAutoSend`, `newsletterRefusalChain`.

**Regressions introduced:** none. 1030/1030 passing across four consecutive runs.

> `graphify update .` refused to overwrite the graph (its own fail-closed guard
> reported fewer nodes than the existing `graph.json`). Not forced — run
> `graphify update . --force` or a full rebuild deliberately.
