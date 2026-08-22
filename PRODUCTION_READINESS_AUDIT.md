# DATAD — Production Readiness Audit

**Date:** 2026-08-21
**Branch:** `feat/resume-pdf-export-and-email`
**Scope:** Full-stack audit — architecture, security, AI runtime, notifications, database, reliability, observability, testing, deployment.

---

## Executive Summary

DATAD is a substantially more mature codebase than a typical pre-launch audit encounters. The high-risk areas an auditor expects to find broken — authentication, authorization, payments, file uploads, AI provider failover — are not just present but deliberately engineered, with the reasoning recorded in comments at each decision point. Several of the defensive measures (device-bound sessions, server-side price resolution, magic-byte upload validation, a fail-open circuit breaker) are better than what most production systems ship with.

The real problems were not in the application logic. They were in the **credential storage for the public API**, and in a cluster of **operational and tooling defects** that made the project's own quality signals unreadable: a test suite that reported 42 failures for an environmental reason, a lint command that never terminated, and a crash path that produced no structured log line.

| | Initial | Final |
|---|---|---|
| **Production-readiness grade** | **C+** | **B+** |
| Critical issues | 0 | 0 |
| High issues | 3 | 0 |
| Medium issues | 8 | 1 |
| Low issues | 5 | 4 |
| `npm audit` (prod deps) | 1 high | **0** |
| Server tests | 540 passed / **42 failed** (37 suites) | **649 passed / 0 failed** (44 suites) |
| Client lint | never terminated | **19.5s, 0 errors** |

**Verdict: PRODUCTION READY WITH ACCEPTED RISKS** — see [Remaining Risks](#remaining-risks).

---

## 1. Architecture Map

**Stack:** React 19 + Vite 8 SPA · Express 4 + Mongoose 9 · MongoDB Atlas · single-service deploy (Express serves the built SPA).

| Layer | Implementation |
|---|---|
| **Routing** | react-router 7, route-level code splitting (~100 lazy chunks) |
| **State** | React context (`AuthContext`, `NotificationContext`) + local state |
| **API layer** | axios instance + per-domain modules under `client/src/api/` (39 modules) |
| **Auth** | JWT bearer, 7-day expiry, `localStorage`, `jwt-decode` for claims |
| **Server entry** | `server/index.js` — 300 routes across 44 routers |
| **Middleware** | helmet → CORS → JSON(1mb) → mongo-sanitize → hpp → compression → rate limit |
| **Models** | 81 Mongoose models |
| **AI** | `aiGateway` → `runner` → provider chain (NVIDIA/Groq/Anthropic/OpenRouter/Gemini) |
| **Notifications** | `NotificationService` (dedup + persist) → `NotificationStream` (SSE) |
| **Jobs** | node-cron schedulers under `server/automation/` |
| **Payments** | Razorpay, server-side price table, HMAC-verified webhook |

### Authentication — genuinely strong

`middleware/verifyToken.js` does three things beyond signature verification, and each closes a real hole:

- **Session versioning** — a `tv` claim checked against the account's current `tokenVersion`, bumped on password change/reset and role change. A stolen 7-day token dies at the next password change rather than at expiry.
- **Database-authoritative role** — the comment *"Claims win for identity, database wins for authority"* is exactly right. A demoted admin loses admin routes on their next request, not whenever their token happens to expire. This is the single most commonly-missed control in JWT systems.
- **Device binding** — a `did` claim checked against active device sessions, LRU-evicted at 3 devices.

Passwords are bcrypt (cost 10) with `select: false` on the field, so a forgotten `-password` cannot serve hashes.

### AI — one canonical path, no competing implementations

The prompt anticipated multiple competing AI runtimes. That consolidation **already happened** (Sprint 2, July 2026) and is documented in `ai/aiGateway.js`:

> The V2/hybrid/shadow mode switch was removed… It was never reachable in production: the env var default was `v1_only`, and the V2 exec path called an export that did not exist.

Current state: `/api/dax` is canonical. `/api/chat` and `/api/ai` are unmounted with their files deleted. `runtime-v2/` survives as **infrastructure** (circuit breaker, model registry, provider health, telemetry) consumed by the V1 path — not as a competing execution path. `GET /api/automation/gateway-mode` returns a fixed `v1_only` and the `PUT` returns 400. There is no bypass.

**Failure engineering is real, not aspirational:**

| Failure | Handling |
|---|---|
| Provider timeout | 20s request timeout (`AI_REQUEST_TIMEOUT_MS`), SDK retries disabled |
| Stream stalls | 20s idle timeout (`streamIdleTimeout.js`) |
| Rate limit / outage | Error classified → circuit breaker benches provider → next in chain |
| Malformed request (400/404/422) | Classified `bad_request`, deliberately **does not** trip the breaker |
| All providers benched | Breaker **fails open** — tries anyway rather than manufacturing an outage |

The `bad_request` carve-out is a subtle and correct decision: without it, one bad model slug would walk the entire chain open and take the AI hub down globally.

---

## 2. Production Readiness Scorecard

| Category | Initial | Final | Notes |
|---|---:|---:|---|
| Architecture | 8 | 8 | Clean layering; AI consolidation already done |
| Security | 6 | 9 | Plaintext API keys were the one real hole |
| Authentication | 9 | 9 | Session versioning + device binding + DB-authoritative role |
| Authorization | 9 | 9 | Ownership checks consistent; dedicated authz test suites |
| Database | 7 | 7 | Indexes present; one read-modify-write race remains |
| API | 7 | 9 | External rate limit declared but never wired; CORS parsing inconsistent |
| AI Runtime | 9 | 9 | Circuit breaker, failover, timeouts, fail-open |
| Notifications | 8 | 8 | Dedup + SSE; dedup not concurrency-safe |
| File Uploads | 9 | 9 | Magic bytes, active-content rejection, size caps |
| Frontend | 7 | 7 | Code-split; 705KB vendor chunk |
| UX | 8 | 8 | Loading/empty/error states consistently present |
| Performance | 7 | 7 | No N+1s found in hot paths |
| Reliability | 6 | 8 | Crash logging added; graceful shutdown present |
| Observability | 4 | 8 | Correlation IDs + log levels + crash capture added |
| Testing | 5 | 9 | Suite went 540/42-red → 649/0; +22 new auth and CORS tests |
| Deployment | 8 | 8 | Fail-fast env validation, DB-gated health check |
| Accessibility | 7 | 7 | `jsx-a11y` enforced in lint, 0 errors |
| Documentation | 8 | 8 | Unusually thorough; env vars documented |

---

## 3. Findings and Status

### HIGH

**H1 — API keys stored in plaintext · FIXED**
`models/ApiKey.js` stored the issued key verbatim; `apiKeyAuth` matched on it directly. Any read of that collection — a backup, an analytics replica, a support tool — yielded credentials immediately usable against `/api/v1`, with no trace. The UI already told users *"copy it now, you won't see it again"*, a promise the backend was not keeping.

*Fix:* keys are now stored as SHA-256 (appropriate for a 32-byte random value — there is nothing to brute-force, and this runs on every public-API request). The raw key is returned exactly once at creation. Keys issued before the change are still accepted and **upgraded in place on first use**, so no existing integration breaks. A `keyPrefix` was added so the UI can still tell keys apart when deciding which to revoke.
The hash reuses the existing `key` column deliberately: that column already carries a unique index in the deployed database, and moving to a new field would leave every new row with `key: null` — a non-sparse unique index permits exactly one null, so the *second* key created after deploy would fail with a duplicate-key error.

**H2 — Unhandled promise rejection in `apiKeyAuth` · FIXED**
The middleware was `async` with no `try/catch`. Express 4 does not catch rejected promises from middleware, so a transient database error meant **no response was ever sent** — the request hung until the client gave up, and the failure surfaced only as an unhandled rejection that killed the process. Now routed to `next(err)`.

**H3 — High-severity vulnerability in an unused dependency · FIXED**
`xlsx@0.18.5` — prototype pollution + ReDoS, **no fix available**. Verified entirely unused (referenced only in a code comment and in client-side file-extension lists). Removed, along with two other unused dependencies, `adm-zip` and `mammoth`. `npm audit --omit=dev` now reports **0 vulnerabilities**.

### MEDIUM

**M1 — Test suite reported 42 failures, none of them real · FIXED**
All 42 failures across 6 suites traced to a single cause: Jest's default 5s timeout against MongoDB Atlas, whose cold SRV-resolve-plus-TLS handshake takes ~20s. A second cause surfaced underneath: `tests/helpers/testDb.js` did not honour `DNS_SERVERS`, the workaround `index.js` documents for networks that cannot resolve Atlas SRV records — so on exactly those networks the tests failed with an opaque `querySrv ESERVFAIL` and the documented fix appeared to do nothing.
*Fix:* `testTimeout: 30000` in Jest config; `DNS_SERVERS` honoured in the test helper.
This mattered more than the number suggests: a suite that is 42-red for a reason unrelated to the code is a suite whose signal the team learns to ignore.

**M2 — `npm run lint` never terminated · FIXED**
`eslint .` with no ignore file walked `dist/` — hundreds of generated chunks including a 705KB single-line bundle. ESLint 8 ignores `node_modules` by default but **not** build output. Killed after 20+ minutes with no output.
*Fix:* added `.eslintignore`. The run now completes in **19.5s with 0 errors, 4 warnings**.

**M3 — Process crashes produced no structured log · FIXED**
No `uncaughtException` or `unhandledRejection` handler existed anywhere. Every other event logged structured JSON; a crash — the event most worth reading at 3am — vanished into an unparseable stderr stack and a non-zero exit code. Both handlers now log structured JSON, then exit so the platform restarts. *(Verified in practice: a port conflict during testing was captured as a clean JSON line.)*

**M4 — No request correlation IDs · FIXED**
The logger stamped each *line* with a fresh UUID, which is not a correlation id — two lines from the same request got different values, so a failing request could not be reconstructed. Now a per-request id via `AsyncLocalStorage`, echoed as `X-Request-Id` and returned in 500 bodies so a user can quote the exact identifier that appears in the logs. Inbound ids are format-validated before being echoed (they reach both a response header and every log line, so an unbounded client-controlled string would be a header- and log-injection vector).

**M5 — `logger.debug` fired in production · FIXED**
No level gating; the noisiest callers are the AI and notification paths. Added `LOG_LEVEL` (default `info` in production, `debug` elsewhere). Also routed `warn`/`error` to **stderr** — platforms split the streams, and writing failures to stdout made "show me only the errors" impossible.

**M6 — `stockFetcher` suite was flaky and silently corrupted its own next test · FIXED**
Once the timeout fix let this suite actually run, it failed at a *different* assertion on each run — counts of `0`, a stale price of `100` where `110` was expected. The service was not at fault: driven directly it returns `194/194 quotes live` with zero fetch failures.

The suite is genuinely slow — ~194 Mongo upserts per `refreshStocks()` against remote Atlas (~4-5s warm), and several tests call it twice. The damaging part is what happens at the boundary: when a test exceeds its budget Jest fails it and moves on, **but the in-flight refresh keeps writing** — into the next test, which has already run its `deleteMany` and is now counting documents arriving from a test that supposedly ended. Hence the wandering failure line, and hence it reading like a bug in `refreshStocks`.

*Fix:* `jest.setTimeout(180000)` scoped to this suite, with the reasoning recorded. Deliberately not raised globally — elsewhere, a test that takes 30s really is hung, and blunting that signal everywhere to accommodate one slow suite is the wrong trade.

**M7 — A trailing slash in `CLIENT_URL` broke CORS in production only · FIXED**
`primaryClientUrl()` stripped trailing slashes; `isAllowedCorsOrigin()` did not — in the one file whose stated purpose is that the emailed-link host and the CORS allow-list "cannot drift apart".

A browser's `Origin` header is always exactly `scheme://host[:port]`, never with a trailing slash. So `CLIENT_URL=https://datad.app/` produced correct password-reset emails and rejected every browser call with *"Not allowed by CORS"*. Production-only, one character, and the working emails actively point away from the cause.

Worse, the symptom is partial. `Origin` is sent on every request whose method is not GET/HEAD — **including same-origin ones**. Since production is a single service serving the SPA from the same Express process, a misconfigured `CLIENT_URL` means the app loads and all reads work while **every write fails 403**.

*Fix:* both rules now share one `clientOrigins()` parser that trims whitespace and trailing slashes. Covered by `tests/corsOrigin.test.js` (10 tests), including an invariant test asserting that `primaryClientUrl()` always passes `isAllowedCorsOrigin()` for the same configuration.

**M8 — Notification dedup is not concurrency-safe · NOT FIXED (accepted)**
`NotificationService.send()` does `findOne` then `create` — a read-modify-write with no unique constraint. Two concurrent triggers can both find nothing and both insert. Impact is a duplicate bell entry, not data loss. A correct fix needs a unique index plus upsert, which is a schema-and-migration change; deliberately not done unilaterally. See Remaining Risks.

### LOW

| # | Finding | Status |
|---|---|---|
| L1 | External API rate limit (`60/min`) declared as an unused object — public API ran on `generalLimiter` alone (1000/15min shared with the whole app) | **FIXED** — wired, keyed on API key rather than IP |
| L2 | `DELETE /api/keys/:id` returned `{ok:true}` even when nothing was deleted — a failed revoke read as success | **FIXED** — 404 + client no longer reports false success |
| L3 | `tests/resumeDelivery.test.js` could not recover from an interrupted run (fixed `_id`/email fixture → permanent duplicate-key failure) | **FIXED** — idempotent setup |
| L4 | `SkillListing.user` lacks an index | Not fixed — small collection |
| L5 | "MongoDB connected" logged twice at boot | Not fixed — cosmetic |
| L6 | `/api/meta` comment says "Public read"; route requires auth | Not fixed — comment drift |
| L7 | CSP disabled (`contentSecurityPolicy: false`) + JWT in `localStorage` | Not fixed — see Remaining Risks |

---

## 4. Security Findings — verified sound

These were audited and found correct; no change was needed.

- **Authorization / IDOR** — ownership checks are consistently applied and explicit (`if (!note.author.equals(req.user.userId)) return 403`). Admin mutations are gated with `checkRole('admin')` at the router. All 300 routes were enumerated and cross-referenced: the only unauthenticated ones are the auth endpoints, the analytics ingest, and the Razorpay webhook — all correct by design. Dedicated suites (`noteAuthz`, `projectTaskAuthz`, `talent.hardening`, `sensitiveFields`) cover this.
- **Payments** — server-side price table (the client "never gets a say"), HMAC signature verification with `crypto.timingSafeEqual`, raw-body capture for the webhook, and payment verification scoped to the caller (*"a valid signature proves the payment is real, not that it belongs to whoever is presenting it"*). Textbook-correct.
- **File uploads** — magic-byte validation against the declared MIME type, active-content rejection, `Content-Length` pre-rejection before buffering, env-tunable per-instance limits. Hardened further during this audit (by concurrent work) against comment-padded SVG bypass.
- **Injection** — `express-mongo-sanitize` (operator injection), `hpp` (parameter pollution), regex escaping in search with a dedicated test (`searchRegexInjection.test.js`).
- **Secrets** — no secrets in tracked files. `.gitignore` covers every `.env` variant, and the credential bundle is explicitly excluded with the reasoning recorded.
- **Brute force** — login limited per-account (10/15min) rather than per-IP, with the campus-NAT reasoning documented; recovery endpoints deliberately excluded so an attacker cannot lock a victim out of their own password reset.

---

## 5. Remaining Risks

| Issue | Severity | Impact | Recommended action |
|---|---|---|---|
| CSP disabled + JWT in `localStorage` | **Medium** | Any XSS yields a 7-day token. Device binding and session versioning limit the blast radius, but do not eliminate it. | Introduce a CSP in report-only mode first, tighten from real violation data, then consider httpOnly refresh cookies. Both are architectural — not safe to change unilaterally mid-branch. |
| Notification dedup race (M6) | **Low** | Duplicate bell entries under concurrent triggers. No data loss. | Add a unique partial index on `(user, type, titleKey)` + upsert. Needs a migration. |
| Circuit-breaker state is in-process | **Low** | Multi-instance deploys each learn provider health independently; state dies on restart. Already documented as a known limitation. | Move to Redis if horizontal scaling begins. Fine for single-instance. |
| 705KB vendor chunk (220KB gzip) | **Low** | Slower first paint on poor connections. Route splitting already in place. | Split vendor chunk if first-paint metrics justify it. Measure before acting. |
| `xlsx` removal | **Low** | Verified unused, but removal is only as safe as that search. | Confirm no runtime path builds spreadsheets before the next release. |
| Integration tests need live Atlas | **Low** | CI needs a reachable test cluster and possibly `DNS_SERVERS`. | Document the CI requirement; the `-test` database guard already prevents pointing them at production. |

---

## 6. Verification

Every claim above was executed, not inferred.

| Check | Result |
|---|---|
| `npm test` (server) | **649 passed, 0 failed — 44/44 suites** (was 540 passed / 42 failed, 37 suites) |
| `npm audit --omit=dev` | **0 vulnerabilities** (was 1 high) |
| `npm run build` (client) | **✓ built in 2.94s** |
| `npx eslint . --ext .js,.jsx` | **0 errors, 4 warnings, 19.5s** (was: never terminated) |
| `npx jest tests/apiKeyAuth.test.js` | **12/12 passed** (new) |
| Server module load + DB connect | **✓** — and the new crash handler captured a port conflict as structured JSON |

The full suite requires a reachable Atlas cluster; on networks that cannot resolve Atlas SRV records it also needs `DNS_SERVERS` set. The `-test` database guard in `tests/helpers/testDb.js` refuses to run against any database whose name does not mark it disposable, so this cannot touch production data.

**New test coverage:** `tests/apiKeyAuth.test.js` — 12 tests asserting that the plaintext key is never used as a query value, that legacy keys are upgraded in place, that expired and inactive keys are rejected, and that a database error reaches `next(err)` rather than hanging the request.

### What was not verified

- **No browser-driven UX testing** was performed. The UX-failure matrix in the brief (every flow × success/loading/empty/error/timeout/offline/duplicate-submit) was assessed by reading components, not by driving the app. Loading, empty, and error states are consistently present in the code, but "consistently present" is a weaker claim than "verified working".
- **No load or latency measurement.** The performance section reports structural observations (bundle sizes, absence of N+1 patterns in hot paths), not measurements. The brief asked for measurement rather than guessing; that requires a load-testing environment this audit did not have.
- **No production deployment verification** — Render configuration was read, not exercised.

---

## 7. Final Verdict

### PRODUCTION READY WITH ACCEPTED RISKS

No critical issues remain. The one genuine security hole — plaintext API keys — is fixed with a backward-compatible upgrade path. The application's core defences are sound and, in several places, better than industry norm.

The accepted risks are the CSP/`localStorage` pairing and the notification dedup race. Neither blocks launch: the first is mitigated by session versioning and device binding, and the second costs a duplicate notification. Both need deliberate, separately-reviewed changes rather than an audit-time edit.

The most valuable outcome here is not the security fix — it is that the project's quality signals now work. A test suite that was 42-red for an environmental reason, a lint command that never finished, and a crash path that logged nothing are, collectively, how a healthy codebase stops being one. All three now produce trustworthy output.
