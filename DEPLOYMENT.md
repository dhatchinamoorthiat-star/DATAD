# DATAD — Deployment Runbook

The app deploys as **one Render service**. The build compiles the client and installs
the server; `server/index.js` then serves `client/dist` itself, with an SPA fallback for
non-API GETs. Client and API share an origin, so there is no second host and no
cross-origin hop. `render.yaml` is the source of truth for this — it is a Blueprint, and
everything in it is applied on create.

A second service, the **event worker**, is defined in the same blueprint but is not free;
see § 2.

Everything below can be prepared now; the only blocker is choosing a domain.

## 0. One-time production setup (do before first deploy)

1. **MongoDB Atlas** — create a *new, separate* project + free M0 cluster for production.
   Get the connection string; create a DB user; allow network access from anywhere
   (0.0.0.0/0) or Render's IPs.
2. **Cloudinary** — create a *separate* account (or at least a dedicated folder) for prod.
   Note cloud name, API key, API secret.
3. **Mail** — registration gates on a verification email, so the server must
   have a working transport before anyone can sign up. `config/mailTransport.js`
   picks the first configured option:

   1. **Brevo (use this in production).** Create an account, verify the sending
      domain, then set `BREVO_API_KEY` (the `xkeysib-…` HTTP API key) and
      `BREVO_FROM_EMAIL` (an address on that verified domain). `BREVO_FROM_NAME`
      is optional and defaults to `DATAD`. To use Brevo's SMTP relay instead,
      set `BREVO_SMTP_API_KEY` (the `xsmtpsib-…` key) — the two credentials are
      different and not interchangeable.
   2. **Any other SMTP provider** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
      `SMTP_PASS`, optional `SMTP_SECURE`.
   3. **Gmail SMTP — development only.** Enable 2-Step Verification on the
      sending account, create an **App Password** (Google Account → Security →
      App passwords); that 16-character value is `GMAIL_APP_PASSWORD` and the
      address is `GMAIL_USER`. Gmail caps at ~500 recipients/day, and because
      verification mail shares that budget, hitting the cap stops new signups
      entirely — which is why it is not a launch configuration.
4. **Secrets** — generate a fresh JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Production resources (read before picking a plan)

`render.yaml` pins `plan: free` and `numInstances: 1` — a deliberate pre-revenue
choice, viable only with the two mitigations in the next section.

| | Current (`free`) | After revenue (`starter`) | At scale (`standard`) |
|---|---|---|---|
| Memory | 512 MB | 512 MB | 2 GB |
| CPU | shared | 0.5 | 1 |
| Always-on | **no — spins down** | yes | yes |
| Crons fire | only if kept warm | yes | yes |
| Upload limits | reduced via `UPLOAD_MAX_*` | defaults | may raise |

### Running on `free` safely

1. **Keep it warm.** Point an external scheduler (cron-job.org, UptimeRobot —
   both free) at `https://<host>/api/health` every 10 minutes. Without this
   the instance sleeps after ~15 min idle and **no cron runs at all**, which
   among other things means `trialExpiryReminder` never downgrades an expired
   paid tier — a Pro subscriber whose month ended keeps Pro indefinitely. Free
   includes 750 instance-hours/month, enough for one continuously-running
   service.
2. **Watch for OOM restarts** in the Render logs. The `UPLOAD_MAX_*` values in
   `render.yaml` are set well below the code defaults to make this unlikely,
   but 512 MB with in-heap uploads has no spare room.

Upgrade to `starter` as soon as there is revenue: it is always-on, which
removes mitigation 1 entirely.

**Why `free` is a real constraint, not just a slower tier:**

- **Spin-down breaks all scheduled work.** Free instances sleep after ~15 min
  idle. All 23 crons live in-process (`server/schedulers/index.js`): daily
  briefing, daily case, reflections, resume tips, company enrichment, interview
  questions, moderation, the weekly newsletter, five reminder jobs, the four
  intelligence jobs (profile snapshot, prediction resolution, cohort
  aggregates, judgement nudge) — and `trialExpiryReminder`, which is the only
  code path that downgrades an expired paid tier. A sleeping instance runs none
  of them, so lapsed subscriptions keep their entitlements indefinitely.
- **The snapshot job is the one that loses data permanently.** It runs at 02:30
  UTC — the deadest part of the traffic day, so an unpinged instance is
  reliably asleep for it. Every other cron catches up on its next run;
  `StudentProfileSnapshot` cannot be backfilled, so a missed night is a day of
  that student's trajectory gone for good, and every trend, prediction and
  cohort figure computed downstream is thinner for it.
- **Memory.** Uploads are buffered in memory by multer, and three call sites
  build a base64 data-URI from the buffer, so peak heap is roughly 2.4x the
  file size per concurrent upload. Baseline RSS for this process (Express,
  Mongoose with 78 models, the AI SDKs, `xlsx`/`pdf-parse`/`mammoth`) runs
  200–300 MB before any request arrives.

**Memory budget on `starter`.** ~300 MB baseline leaves ~200 MB of working
room. With the current caps (25 MB per document, 60 MB per Studio request) a
single large upload peaks near 60 MB, so roughly three concurrent large uploads
fit. That is the reasoning behind the numbers in
`server/middleware/uploadGuards.js`; they are env-overridable:

```
UPLOAD_MAX_IMAGE_MB=10           # avatars, album photos
UPLOAD_MAX_DOC_MB=25             # notes attachments, resources
UPLOAD_MAX_STUDIO_FILE_MB=25     # per file
UPLOAD_MAX_STUDIO_FILES=5        # per request
UPLOAD_MAX_STUDIO_REQUEST_MB=60  # whole request, rejected on Content-Length
```

Raise these only after moving to `standard`, and raise the request cap in step
with the per-file cap.

**Why a single instance.** The schedulers have no distributed lock or leader
election. A second instance re-runs every cron on its own timer: two daily
briefings, two newsletters, duplicate reminder emails. In-process cron is safe
at `numInstances: 1` and only there. If you ever need to scale out, the
schedulers must move to a dedicated worker or a Render Cron Job first — that
work is deliberately **not** part of this change.

## 1. Deploy (Render)

1. New → **Blueprint** → connect the GitHub repo. Render reads `render.yaml` and
   proposes the services in it. Root directory is the repo root (`.`), not
   `server` — the build has to reach both halves:
   ```
   build: cd client && npm install && npm run build && cd ../server && npm install
   start: cd server && npm start
   ```
   Creating the web service by hand works too, with those two commands and the
   env vars below; the blueprint exists so the sizing decisions and the long
   rationale behind them travel with the repo.
2. **Secrets.** Everything marked `sync: false` in `render.yaml` is prompted for
   on create and has no value in the file:
   ```
   CLIENT_URL=https://<your-domain>      # comma-separate if www + apex
   MONGODB_URI=<prod atlas uri>
   JWT_SECRET=<fresh 64-char hex>
   CLOUDINARY_CLOUD_NAME=<...>
   CLOUDINARY_API_KEY=<...>
   CLOUDINARY_API_SECRET=<...>
   BREVO_API_KEY=<brevo http api key>
   BREVO_FROM_EMAIL=<address on your Brevo-verified domain>
   BREVO_FROM_NAME=DATAD
   ADMIN_EMAIL=digitaldoncodes@gmail.com
   NVIDIA_API_KEY=<nvidia nim key>
   SENTRY_DSN=<server dsn>        # set at least one of these two — see § Error tracking
   ERROR_WEBHOOK_URL=<slack/discord webhook or any JSON POST endpoint>
   ```
   `CLIENT_URL` is the CORS allow-list, not just a link — an origin missing
   from it gets 403'd on every API call. On a single service that origin is the
   service's own URL, since the browser loads the app from there.

   Leave `AI_FALLBACK_PROVIDER` and the `GMAIL_*` keys **empty**. Ollama is a
   localhost service and does not exist on Render, so a fallback pointed at it
   is guaranteed to fail; Gmail is a development transport (see § 0).
3. **Set by the blueprint — do not re-enter.** `PORT`, `NODE_ENV`,
   `AI_PRIMARY_PROVIDER`, `VITE_UPI_NAME`, the five `UPLOAD_MAX_*` caps (sized for 512 MB — see
   § Production resources), and `BASE_URL`, which is resolved from the service's
   own host rather than typed in: a hand-entered value is one typo away from
   mailing the admin a dead approve-link, and nothing surfaces the mistake until
   someone clicks it. Set `BASE_URL` manually only if a custom domain fronts the
   API, in which case it must be that domain.
4. **Client build-time vars** — also prompted for, since Vite inlines `VITE_*`
   into the bundle during `npm run build`, which runs in this service's build
   step. Read at build time only: changing one needs a redeploy, not a restart.
   ```
   VITE_UPI_VPA=<your-upi-vpa>    # the checkout QR payee — see below
   VITE_SENTRY_DSN=<browser dsn>  # optional, and a different project from SENTRY_DSN
   ```
   `VITE_UPI_VPA` has no safe default. Unset, checkout falls back to `datad@upi`
   — a placeholder nobody here controls — and a student scanning that QR pays a
   stranger, with the payment looking successful from their side. Set it before
   taking money. (`VITE_UPI_NAME` defaults to `DATAD` in the blueprint.)

   Do **not** set `VITE_API_BASE_URL`. It defaults to the relative `/api`, which
   is what same-origin serving needs; a full URL would point the browser off its
   own origin and reintroduce the CORS problem this layout removes.
5. Deploy. Confirm `GET https://<host>/api/health` returns
   `{"status":"ok","database":"connected"}`. A `503` with
   `"database":"disconnected"` means Atlas isn't reachable — check the
   `MONGODB_URI` and that Atlas network access allows Render.
6. Open `https://<host>/` in a browser. It should serve the React app. JSON
   `{"message":"Route not found"}` instead means `client/dist` is absent — the
   client build did not run, so re-check the build command in step 1.
7. Check the boot logs for `Mailer NOT configured`. If it's there, signup is
   broken (registration needs the verification email) — fix the Brevo vars
   before sharing the link. The log line on a successful send names the
   provider (`"provider":"brevo"`), so you can confirm which transport won.

## 2. The event worker

Something has to drain the `BusEvent` collection — polling every 5s in batches of
20 and dispatching to the handlers in `server/events/handlers/index.js`. Without
a consumer the talent flows (application, engagement, review, opportunity), the
profile-refresh handler and the notification bridge still *write* rows; they just
accumulate as `pending` forever, and nothing reports it.

The loop itself lives in `server/events/pollLoop.js` and runs in one of two
places. **Run one, not both** — both is wasteful rather than incorrect, since
`pollBatch()` claims each row with an atomic `pending`→`processing` transition.

**In-process (the current default).** `RUN_WORKER_IN_PROCESS=true` on the web
service runs the loop inside the API process. **Render has no free plan for
background workers** — they start at `starter` — so on a free deploy this is not
a slower worker, it is the difference between the queue draining and not. The
costs are real and worth naming: it shares the API's event loop and its 512 MB,
and a spun-down free instance polls nothing, which is the same exposure the 23
crons already have and the same mitigation (keep it warm, § Running on `free`
safely).

**Dedicated service (`datad-worker`, preferred once there is revenue).** Its own
process, so async work cannot touch the request path and the two scale
separately. Creating the blueprint with this block starts a `starter` service —
that charge is the entire cost of the switch. Set `RUN_WORKER_IN_PROCESS=false`
on the web service the moment it is running, or comment the `- type: worker`
block out of `render.yaml` before creating the blueprint to defer it.

Unlike the web service the dedicated worker is safe to scale out: it runs no
cron, so there is nothing to duplicate. Verify the claim semantics in
`events.pollBatch()` before raising `numInstances` above 1.

## 3. Wire the domain (when the client picks one)

1. Add the domain to the Render service (Settings → Custom Domains) and point
   the DNS at Render per its instructions.
2. Update `CLIENT_URL` to the final domain(s) and redeploy — CORS reads this,
   and it is now also the origin the app is served from.
3. If using both apex and www, list both in `CLIENT_URL` comma-separated.
4. Set `BASE_URL` to the custom domain explicitly. It otherwise resolves to the
   `onrender.com` host, which still works but leaks the internal service name
   into the admin's inbox.

## 4. First-run

1. **The admin registers first**: go to `/register` and sign up with
   `digitaldoncodes@gmail.com` — this account is auto-promoted to admin. Do this
   *before* sharing the link, so no one else can claim the admin email.
2. Verify: admin sees the **Admin** and **Journal** nav links; `/admin` loads.
3. Post a test announcement with "Email everyone" to confirm Brevo works.
4. Share the link with the batch.

## Local development

```bash
# server
cd server && npm install && cp .env.example .env   # fill values
npm run dev            # http://localhost:5001

# client
cd client && npm install && cp .env.example .env    # keep VITE_API_BASE_URL=/api
npm run dev            # http://localhost:5173
```

The relative `/api` is correct in both environments: in dev Vite proxies it to
`localhost:5001` (`client/vite.config.js`), and in production the API is
same-origin. To exercise the production serving path locally, run
`npm run build` in `client/` and hit the server's port directly — `index.js`
picks up `client/dist` if it exists.

## Rollback

Render keeps previous deploys — use the dashboard's "Rollback" to the last good
build. Since one service carries both halves, a rollback reverts client and
server together, which is usually what you want. Data is unaffected (it lives in
Atlas/Cloudinary).

## Post-deploy smoke test

- [ ] `/api/health` OK **and `errorTracking` is not `"log"`** — see below
- [ ] Register → welcome email arrives
- [ ] Login, create a note, upload a photo
- [ ] Finance income+expense, resume PDF export
- [ ] Admin announcement emails the batch
- [ ] Settings → change password, and (on a throwaway account) delete account
- [ ] `/privacy`, `/terms`, `/creator` load logged-out
- [ ] `POST /api/beta/events` returns 201 (analytics endpoint live)
- [ ] `GET /api/dax/memory` returns user profile (Dax Profile panel data)
- [ ] `GET /api/admin/outcomes` returns empty array (outcome vault ready)
- [ ] `npm run verify:errors` (server) exits 0 and the event arrives — see below

## Error tracking

Errors from all three sources — 500s, process crashes, and frontend runtime
errors posted to `/api/telemetry/error` — funnel through one seam,
`server/observability/errorTracker.js`. It has three sinks and the default is
the honest one: with nothing configured the only sink is the structured log,
which means no alert fires and the first you hear of an outage is a student
telling you. **A production deploy must set at least one of the two below.**

Server — both are declared in `render.yaml`, so Render prompts for them when the
blueprint is created; leaving both blank is what produces the bare-`log` state:

```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>   # @sentry/node is installed
ERROR_WEBHOOK_URL=https://hooks.slack.com/services/...      # or a plain JSON POST
```

**Set the same two on `datad-worker`** — they are declared there too. Use the
*same* values, not a second project: `worker.js` tags its events with a `source`
(`crash` for boot failures and process-level crashes, `job` for failed poll
cycles) and a `process: worker` context, which separates the two services
without splitting one incident across two dashboards.

The worker is where an alert matters most, because a stalled worker has no
user-visible symptom — the queue stops draining, `BusEvent` rows accumulate as
`pending`, and every page still loads. Three consecutive failed poll cycles
(~15s) escalate from `error` to `fatal`, on the reasoning that one bad batch is
a blip and a run of them means the queue has stopped moving.

Client — a **separate DSN** from the server's, set on the same Render service
(it is a build-time var; see § 1 step 4):

```
VITE_SENTRY_DSN=<sentry dsn>
```

The client half is not required for coverage: `reportError` always POSTs to
`/api/telemetry/error` as well, so frontend crashes land in the server pipeline
— same redaction, same correlation id — with no vendor at all. The DSN buys
grouping, breadcrumbs and session replay on top.

### Verify it reaches a human

Reading config proves nothing: a DSN can be present and wrong, and a webhook URL
can 404. Both failures look exactly like a quiet week. So send a real one, with
the deployed environment's variables loaded:

```bash
cd server && npm run verify:errors
```

Exit 0 means every configured sink accepted it; exit 2 means only the log is
active, which is the state this section exists to prevent. The script prints a
nonce — find that string in Sentry or in the webhook's channel. If it is not
there, error tracking is not wired, whatever the script printed.

`GET /api/health` reports the same thing continuously, as an `errorTracking`
field naming the live sinks (`sentry+log`, `webhook+log`, or bare `log`). Bare
`log` in production means a DSN never made it into the deploy.

### What is deliberately not sent

An error tracker copies production failures to a third party, so it is the last
place to be relaxed. Secret values and secret-shaped strings are redacted, a
key deny-list (passwords, tokens, and student data such as résumés, notes and
goals) is dropped outright, and query strings are removed rather than redacted —
a password-reset link carries a single-use token there. Session replay is
recorded with `maskAllText`, because the screens include the résumé editor, the
finance tracker and the onboarding answers.
