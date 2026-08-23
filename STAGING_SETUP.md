# DATAD — Staging Release Candidate Setup

**Date:** 2026-08-23
**Status:** configuration prepared; **not deployed**. Standing up the environment
needs your Vercel, Render and Atlas accounts, and deploying is an outward-facing
action, so it waits for you.

This document is the part that could be done without those accounts: the exact
topology, every environment variable, and the smoke test to run once it is up.

---

## 1. Topology

| Layer | Service | Requirement |
|---|---|---|
| Frontend | Vercel — separate `staging` project | Its own project, not a preview branch of production |
| Backend | Render — separate `datad-api-staging` service | **Paid instance.** See §5 |
| Database | Atlas — **separate cluster or database** | Never production data |
| Mail | Brevo — sandbox/dedicated staging sender | Separate API key from production |
| AI | Own provider keys with spend caps | Separate from production keys |
| Errors | Sentry project `datad-staging` | `environment: staging` |

**Non-negotiable:** staging must not share a database, a mail credential, or an
AI key with production. The 2026-08-22 audit sent real email to real people
because a test process held a working production credential. The test suite is
now contained (`server/tests/setup/`), but that containment protects the test
runner, not a staging deployment pointed at the wrong `.env`.

---

## 2. Backend environment variables (Render)

### Required — the service will not start without these

| Variable | Value for staging | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables `upgradeInsecureRequests` in the CSP and production error formatting. "Staging" is the deployment, not the Node mode. |
| `MONGODB_URI` | staging Atlas URI | **Must not be the production cluster.** |
| `JWT_SECRET` | fresh 32+ byte random | Different from production, or a production token authenticates against staging. |
| `CLIENT_URL` | `https://datad-staging.vercel.app` | **No trailing slash.** The single worst bug in this project's history was a `CLIENT_URL` trailing slash, and it was production-only. |

### Mail — sandboxed

| Variable | Value | Notes |
|---|---|---|
| `BREVO_API_KEY` | staging-only key | Separate key so it can be revoked without touching production. |
| `BREVO_FROM_EMAIL` | verified staging sender | Brevo rejects an unverified sender; `mailTransport` refuses to start without it. |
| `BREVO_FROM_NAME` | `DATAD Staging` | So a leaked mail is identifiable at a glance. |
| `BREVO_VERIFY_SENDS` | `true` | Keep the delivery verification on in staging — it is what catches a silently rejected send. |

### AI — capped

Set only the providers you want staging to use. Each provider absent from the
environment is dropped from the chain, which is also the fix for L13 (an
unkeyed `anthropic` in the chain burning a failover attempt on a guaranteed 401).

`GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`,
`NVIDIA_API_KEY`, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

Set a spend cap on each key in the provider console. Staging is where a runaway
loop happens.

### Error tracking — new in this sprint

| Variable | Required? | Notes |
|---|---|---|
| `SENTRY_DSN` | optional | Server-side Sentry. **If set, `@sentry/node` must be installed** (`npm i @sentry/node` in `server/`). If the package is missing the service still starts and logs a warning — verified in `tests/errorTracking.test.js`. |
| `ERROR_WEBHOOK_URL` | optional | Any JSON endpoint (Slack, Discord). A zero-dependency alternative to Sentry. |
| `RENDER_GIT_COMMIT` | auto | Render sets it; used as the release tag so a regression can be tied to a deploy. |

With neither set, errors go to the structured log only — which is the state the
Phase 2 report called blindness. **Set at least one for staging.**

### Security headers — new in this sprint

| Variable | Recommended | Notes |
|---|---|---|
| `CSP_REPORT_ONLY` | `true` for the first 48h, then unset | Emits `Content-Security-Policy-Report-Only`, so violations are reported and nothing is blocked. Verified working in a browser against the real build; roll out in report-only anyway, because staging is where an unexpected third-party script surfaces. |
| `CSP_REPORT_URI` | optional | Where violation reports are POSTed. |
| `NEWSLETTER_ALLOWED_LINK_HOSTS` | your domain(s), comma-separated | The newsletter guard allows links only to `CLIENT_URL`'s host plus these. |

### Payments

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — **test-mode
keys only.** Payments remain end-to-end untested (see the release gate report).

---

## 3. Frontend environment variables (Vercel)

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://datad-api-staging.onrender.com` | No trailing slash. |
| `VITE_SENTRY_DSN` | staging Sentry DSN | Optional. Session replay is now text-masked and media-blocked; `beforeSend` strips query strings so a verification token cannot ride along. |
| `VITE_SHOW_PLANNED_ACCOUNT_TYPES` | **leave unset** | Setting it to `true` shows Faculty and Institution as disabled "Soon" cards. Unset hides them entirely, which is the honest default while neither has a backend. |

---

## 4. A CSP caveat that depends on your topology

The CSP is set by the **API server**, via helmet. It therefore protects the HTML
document only in the single-service deploy, where `server/index.js` serves
`client/dist`.

**If Vercel serves the frontend, the Vercel-served HTML carries no CSP**, and
the header on API responses does almost nothing for XSS. In that topology you
must also add the header in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://datad-api-staging.onrender.com https://*.ingest.sentry.io; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:" }
      ]
    }
  ]
}
```

This is the single most likely way the CSP work silently fails to protect
anything, so confirm which topology you are deploying before treating CSP as
done.

---

## 5. Render plan — a decision, not a setting

`render.yaml` currently specifies:

```yaml
plan: free
numInstances: 1
```

On the free plan the instance sleeps after ~15 minutes idle. **All 14 cron jobs
run in-process**, so a sleeping instance runs none of them — including
`trialExpiryReminder`, the only thing that downgrades lapsed paid tiers, and the
weekly newsletter generation.

For a staging environment that is exercised in bursts, sleeping also makes every
smoke test start with a 30-second cold boot, which will read as "the app is
broken".

**Use a paid instance for staging.** It is also the only way to learn anything
real about capacity (§7).

---

## 6. Smoke test

Run against staging, with a **completely fresh** student account. Capture for
each step: HTTP status, UI result, database result, notification result, error
state.

1. Register → confirm the verification email arrives at the **staging** sender
2. Verify email → confirm login is blocked before this and allowed after
3. Login → confirm `/auth/me` returns 200 and the dashboard loads
4. Onboarding → confirm answers persist
5. Profile → confirm the directory shows **only** public fields (M2 fix)
6. Resume → build, save, export PDF, email a copy
7. Dashboard → **confirm no 403s in the network tab** (P9 fix)
8. Readiness → 403 with a clear upgrade prompt on free; a score on placement
9. Opportunities → list, filter, open
10. Application → apply, confirm it persists
11. Notifications → confirm the bell updates and SSE survives Render's proxy
12. AI (Dax) → a normal question, then the H4 injection payload
13. Recommendations → `POST /generate` then `GET /`
14. Talent exchange → list and detail
15. Logout → confirm the token is cleared and protected routes redirect
16. Login again → confirm the session resumes

### Additionally, and specific to this sprint

17. **Newsletter:** run the generator. Confirm the draft is created with
    `status: 'draft'`, that **no email is sent**, and that admins get a review
    notification. Then approve it and confirm delivery.
18. **Newsletter injection:** create a post whose title carries the H4 payload,
    regenerate, and confirm the draft is `blocked` and cannot be sent.
19. **Rate limiting:** exhaust `/auth/check-email` from one IP, then confirm an
    authenticated `/auth/me` from the same IP still returns 200.
20. **Error tracking:** force a 500 and confirm it appears in Sentry (or the
    webhook) with the correlation id, environment and route — and that no
    secret, token or student record appears in the event.
21. **CSP:** load every major page with the browser console open and confirm no
    violations. Then unset `CSP_REPORT_ONLY` and repeat.

---

## 7. Load testing — only after the smoke test is green

Progressive, on the **staging topology**, not localhost. Local numbers do not
transfer: Render is a shared CPU with 512 MB, and Atlas adds per-query network
latency and a connection ceiling.

10 → 50 → 100 → 250 → 500 users. **Only proceed to the next level if the
previous one stayed healthy.** Do not attempt 1000 before 500 is clean.

Measure at each level: p50, p95, p99, error rate, 429 rate, CPU, RAM, Atlas
connection count, Atlas latency, throughput.

The first bottleneck is most likely **memory** (uploads are buffered in memory
at 512 MB) or the **Atlas connection limit**. Neither has been measured.

Note that rate-limit buckets and circuit-breaker state are **in-process**. At
`numInstances: 1` that is correct. Above 1, the effective limit becomes
N×the-configured-limit and each instance learns provider health independently —
so a multi-instance load test measures a different system than a single-instance
one.
