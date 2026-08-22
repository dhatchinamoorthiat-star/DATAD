# DATAD — Application Security Audit

**Date:** 2026-08-21 · **Branch:** `feat/resume-pdf-export-and-email` · **Scope:** full codebase (server + client)

---

## 1. Executive assessment

**Before: 68 / 100 — NEEDS HARDENING**
**After:  86 / 100 — approaching PRODUCTION READY** (residual items in §7)

DATAD is, for the most part, unusually well built for security. The authentication
spine is genuinely strong and clearly the product of someone who thought about
revocation: stateless JWTs are backed by a `tokenVersion` session check, a
device-session limit, and live role/status reads, so a password reset actually
evicts an attacker. Uploads validate magic bytes rather than trusting
`Content-Type`. The resume PDF renderer pins its photo fetch to HTTPS on the
asset host, closing SSRF before it opened. The AI tool layer scopes every query
by a server-supplied `userId` that model output cannot influence, and write
tools require explicit human confirmation. No secrets have ever been committed.
The React client contains **zero** `dangerouslySetInnerHTML` and no `innerHTML`
or `eval` sinks.

The score is not higher because that quality was not uniform. Three defects were
real, reachable, and serious — a private-notes IDOR, a one-request database
denial of service, and an authentication bypass that undid the session-revocation
system on one route. Each sat next to code that got the same problem right,
which is the pattern worth naming: **the controls exist, but they were applied
per-call-site rather than centrally**, and every such defect was a call site
someone forgot.

All three are fixed, with regression tests. **117 security tests pass.**

---

## 2. Critical & high findings

### DATAD-01 — IDOR: any student could read any other student's private notes
- **Severity:** HIGH · **CVSS:** 7.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N)
- **Component / endpoint:** `server/controllers/noteController.js` → `GET /api/notes/:id`
- **Root cause:** `getNote` checked only the *program* scope before returning the
  note. That is not an ownership check and fails open three ways: it skips when
  the note has no program, skips when the caller has no program, and passes
  outright when both are in the same program — which in a single-cohort college
  deployment is everyone. Its siblings `listNotes`, `updateNote` and
  `deleteNote` all enforce `author`; only the read path did not.
- **Data at risk:** note title, the full 20,000-character body, and Cloudinary
  attachment URLs — which are themselves `access_mode: 'public'`, so a harvested
  URL is downloadable with no session at all.
- **Proof:** `tests/noteAuthz.test.js` run against unfixed code — 3 of 5 tests
  failed, an outsider receiving **HTTP 200 with the full note body** in every
  cross-user scenario.
- **Fix:** ownership check on `author`, returning **404 not 403** so the response
  cannot be used to confirm an id exists. Program scope retained as defence in
  depth. Note: `author` is populated here, so the comparison normalises
  `author._id ?? author` — a naive `.equals(userId)` would have compared against
  `undefined` and locked out the genuine author.
- **Verification:** 5/5 pass. Mutation-tested: reverting the fix fails 3 tests;
  the naive `.equals()` variant fails 4.

### DATAD-02 — Regex injection → one-request database denial of service
- **Severity:** HIGH · **CVSS:** 7.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H)
- **Component:** 6 search endpoints across 5 controllers — directory, skills,
  marketplace, internships, resources (×2)
- **Root cause:** `new RegExp(req.query.search, 'i')` placed directly into a Mongo
  filter. The value is a *pattern*, not a literal, so the caller chose the
  matching program MongoDB then ran across the collection.
- **Proof (measured on this codebase):** pattern `(a+)+$` against a 33-character
  subject took **111,485 ms — 111 seconds — in a single call.** The general
  limiter permits 1000 requests per 15 min per IP.
- **Second effect:** ordinary input broke the endpoints. `C++` and an unclosed
  `[` are invalid patterns; `new RegExp` throws, turning a search into a 500.
- **Fix:** new `server/utils/safeRegex.js` — escapes every metacharacter, caps
  pattern length, and returns `null` for blank input (because `new RegExp('')`
  matches every document, so a blank box must not mean "return everything").
  Applied at all 6 sites.
- **Verification:** same payload now **0.04 ms — a 2,649× reduction**. 8 tests,
  including a repo-wide guard that fails if a seventh `new RegExp(req.…)` is
  ever introduced.

### DATAD-03 — Session-revocation bypass on the notification stream
- **Severity:** HIGH · **CVSS:** 7.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
- **Component / endpoint:** `server/routes/notificationRoutes.js` → `GET /api/notifications/stream`
- **Root cause:** EventSource cannot set headers, so the route accepted the token
  as a query parameter — and verified it inline with `jwt.verify()` + `req.user =
  decoded`, then stopped. Everything `verifyToken` does *after* the signature was
  skipped: the session-version comparison, the account-exists lookup, the
  device-session check, and taking `role`/`status` from the database rather than
  the claims.
- **Impact:** `services/sessionVersion.js` exists specifically so that "a password
  reset did not evict whoever stole the password" stops being true. This route
  made it true again. A stolen token kept streaming the victim's live
  notifications through a password reset, a role change, or account deletion —
  for the remaining 7 days of its life.
- **Fix:** extracted to `server/middleware/sseAuth.js`, which no longer verifies
  anything. It moves the query parameter into the header slot and delegates to
  `verifyToken`, so the two paths cannot drift apart again.
- **Verification:** 8 tests — revoked token, deleted account, evicted device, and
  demoted-admin role all now rejected; valid tokens and the header path still work.

---

## 3. Medium & low findings (all fixed)

| ID | Finding | Severity | Fix |
|----|---------|----------|-----|
| DATAD-04 | **Unbounded directory query.** `GET /api/directory` returned every profile in the database, unpaginated, and filtered names in JavaScript *after* fetching all of them. Cheapest way to both scrape the member list and exhaust the server. | Medium | Capped at 200, `?page`/`?limit` supported, name search moved into the DB query. Array response shape preserved so the client is unaffected. |
| DATAD-05 | **Vector-store poisoning via `/api/dax {task:'index-doc'}`.** Any member with the semantic-search feature could write an arbitrary embedding under any `collection` + `docId`. The store is uniquely keyed on that pair, so an attacker could overwrite any document's embedding — silently removing a company or case from everyone's search results. Not in `TASK_QUOTA`, so each call also spent an unmetered embedding API call. No client calls it. | Medium | Gated to `role === 'admin'` via a new `ADMIN_ONLY_TASKS` set; returns 404, not 403. |
| DATAD-06 | **Active-content upload bypass.** `checkFile` tested whether the first 64 bytes *began* with markup. Prefixing `<!-- … -->` moved the payload past the window. SVG has no magic number, so the prefix test was the only control — and `upload.js` accepted anything matching `image/*`, making `image/svg+xml` a valid avatar. SVG executes script when served as `image/svg+xml`. | Medium | Two independent layers: `normalizeHead()` strips leading comments before matching and scans the first 1 KB for `<script`/`<svg`; `upload.js` rejects the SVG mime types outright. |
| DATAD-07 | **`password` had no `select: false`.** The bcrypt hash was included in every query that did not explicitly exclude it. Nothing leaked it — each handler remembered its own `-password` — but that is one new endpoint or one bare `.populate('user')` away from serving password hashes to a client. | Medium | `select: false` on the schema; the four flows that verify or set a password opt in with `.select('+password')`. |
| DATAD-08 | **Semantic note search failed open.** The `author` filter applied only `if (userId)`; a caller omitting it would have received every student's notes. Both current callers pass it, so this was latent, not live. | Low | Fails closed — no `userId` now returns no notes. |
| DATAD-09 | **`logger` referenced but never imported** in `routes/adminRoutes.js`. The one path that reports a failed program sync threw `ReferenceError` inside a rejection handler — an unhandled rejection, and the failure never reached the logs. | Low | Import added. |

---

## 4. Verified secure (no action needed)

These were attacked and held up:

```
Cross-user AI conversation access ....... BLOCKED (every query scoped {_id, user})
AI tool authorization ................... BLOCKED (userId server-supplied, never from model)
AI write tools .......................... BLOCKED (human confirmation via ProposedAction)
Resume/CV cross-user access ............. BLOCKED (no /:id route; all self-scoped)
Resume photo SSRF ....................... BLOCKED (pinned https + *.cloudinary.com)
Resume mass assignment .................. BLOCKED (normalizeResume is an allowlist)
Talent conversations/applications ....... BLOCKED (participant checks in service layer)
Projects, posts, events, marketplace .... BLOCKED (ownership enforced)
Admin routes ............................ BLOCKED (checkRole at router level)
Content Studio .......................... BLOCKED (admin-only router)
Password hashing ........................ bcrypt, cost 10
Reset / verify tokens ................... SHA-256 hashed at rest, 30-min expiry
Brute force ............................. account-keyed limiter, 10 / 15 min
Secrets in git history .................. NONE (only .env.example placeholders)
Hardcoded fallback secrets .............. NONE
Sensitive data in logs .................. NONE
XSS sinks in React ...................... NONE (no dangerouslySetInnerHTML/innerHTML/eval)
NoSQL operator injection ................ BLOCKED (express-mongo-sanitize + hpp)
Upload magic-byte validation ............ ENFORCED
API keys ................................ SHA-256 hashed (fixed in-flight this branch)
```

---

## 5. Files changed

**Fixes**
- `server/controllers/noteController.js` — DATAD-01 ownership check
- `server/utils/safeRegex.js` *(new)* — DATAD-02 escaping utility
- `server/controllers/{directory,skill,marketplace,internship,resource}Controller.js` — DATAD-02 applied
- `server/controllers/directoryController.js` — DATAD-04 pagination + DB-side name search
- `server/middleware/sseAuth.js` *(new)* + `server/routes/notificationRoutes.js` — DATAD-03
- `server/routes/daxRoutes.js` — DATAD-05 admin gate
- `server/middleware/uploadGuards.js`, `server/middleware/upload.js` — DATAD-06
- `server/models/User.js`, `server/controllers/authController.js` — DATAD-07
- `server/ai/embeddings/semanticSearch.js` — DATAD-08 fail-closed
- `server/routes/adminRoutes.js` — DATAD-09 import

**Regression tests (new, 45 tests)**
- `tests/noteAuthz.test.js` (5) · `tests/searchRegexInjection.test.js` (8)
- `tests/sseAuth.test.js` (8) · `tests/uploadActiveContent.test.js` (19)
- `tests/sensitiveFields.test.js` (5)

---

## 6. Tests performed

```
Cross-user note access (IDOR) ............... BLOCKED  (was: 200 + full body)
Same-program cross-user note access ......... BLOCKED  (was: 200 + full body)
Note existence oracle (403 vs 404) .......... BLOCKED
Owner can still read own note ............... PASS
ReDoS via search parameter .................. BLOCKED  (111s -> 0.04ms, 2649x)
Invalid regex causing 500 ................... BLOCKED
Blank search returning all documents ........ BLOCKED
Revoked token on SSE stream ................. BLOCKED  (was: accepted)
Deleted account on SSE stream ............... BLOCKED  (was: accepted)
Evicted device on SSE stream ................ BLOCKED  (was: accepted)
Demoted admin role via SSE claims ........... BLOCKED  (was: claim trusted)
SVG stored-XSS upload ....................... BLOCKED
SVG behind comment padding (5 variants) ..... BLOCKED  (was: accepted)
Legitimate PNG/PDF/DOCX/text uploads ........ ACCEPTED (no regression)
Vector-store poisoning via index-doc ........ BLOCKED
Password hash exposure ...................... BLOCKED
Full server suite ........................... 633 passed / 6 failed*
Security suites ............................. 117 passed / 117
```

\* All 6 failures are in `tests/stockFetcher.test.js`, which calls a live
external stock API and writes to a real test database (`194` vs `29` quotes
returned). It imports none of the changed files and passes in isolation. Not
caused by, or related to, these changes.

---

## 7. Remaining risks — honest list

**Cannot be verified from the codebase** (needs infrastructure access):
- MongoDB Atlas network/IP allow-list, at-rest encryption, and backup access control
- Render environment-variable handling and deploy-log retention
- Cloudinary account settings, TLS/DNS configuration
- Whether `JWT_SECRET` has sufficient entropy in production
- Whether any secret has previously leaked outside git (CI logs, screenshots, chat)

**Known and accepted, not fixed here** — each is a design change rather than a bug:
1. **Cloudinary assets are world-readable by URL** (`access_mode: 'public'`). Note
   attachments and album photos are reachable by anyone holding the link. DATAD-01
   was the chain that *harvested* those links and is now closed, but the assets
   remain unauthenticated. Proper fix — signed URLs behind an authorising download
   proxy — would invalidate every stored URL and needs a migration.
2. **No Content-Security-Policy** (`contentSecurityPolicy: false` in helmet, to
   allow external cover images). With no XSS sinks in the client this is
   defence-in-depth rather than an active hole, but a CSP with an explicit
   `img-src` allow-list would be a meaningful upgrade.
3. **JWT in `localStorage`** — readable by any successful XSS. Currently mitigated
   by the absence of XSS sinks; httpOnly cookies would be strictly stronger.
4. **API key scopes are never enforced.** `req.apiScopes` is populated and unused.
   Harmless today because every `/api/v1` route is read-only and self-scoped —
   but the first write endpoint added there inherits no protection.
5. **`/api/beta/events` is intentionally unauthenticated** (sendBeacon cannot set
   headers) and decodes its token best-effort for attribution only. It grants no
   access, but a revoked token still attributes events, and `properties` is an
   unbounded object.
6. **Token in the SSE query string** is logged by anything that records URLs.
   Unavoidable for EventSource; worth scrubbing `token` from request logging.
7. **No malware scanning** on uploaded documents. Type and size are enforced;
   content is not inspected.
8. **No dependency CVE scan was run** — no lockfile audit tooling was available in
   this environment. `npm audit` should be run in CI.
