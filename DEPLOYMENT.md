# DATAD — Deployment Runbook

The app is two deployables: the **server** (Express API) and the **client** (static
Vite build). Recommended free-tier hosts: **Render** (server) + **Vercel** (client).
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
   both free) at `https://<api-host>/api/health` every 10 minutes. Without this
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
  idle. Every cron lives in-process (`server/schedulers/index.js`): daily
  briefing, daily case, reflections, resume tips, company enrichment, interview
  questions, moderation, the weekly newsletter, five reminder jobs — and
  `trialExpiryReminder`, which is the only code path that downgrades an expired
  paid tier. A sleeping instance runs none of them, so lapsed subscriptions
  keep their entitlements indefinitely.
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

## 1. Deploy the server (Render)

1. New → **Web Service** → connect the GitHub repo → root directory `server`.
2. Build command: `npm install` · Start command: `npm start`.
3. Environment variables:
   ```
   PORT=10000                 # Render sets this; the app reads process.env.PORT
   NODE_ENV=production        # makes a failed DB connection fatal at boot
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
   ```
   `CLIENT_URL` is the CORS allow-list, not just a link — an origin missing
   from it gets 403'd on every API call.

   Do **not** set `AI_FALLBACK_PROVIDER=ollama` here: Ollama is a localhost
   service and does not exist on Render.
4. Deploy. Confirm `GET https://<api-host>/api/health` returns
   `{"status":"ok","database":"connected"}`. A `503` with
   `"database":"disconnected"` means Atlas isn't reachable — check the
   `MONGODB_URI` and that Atlas network access allows Render.
5. Check the boot logs for `Mailer NOT configured`. If it's there, signup is
   broken (registration needs the verification email) — fix the Brevo vars
   before sharing the link. The log line on a successful send names the
   provider (`"provider":"brevo"`), so you can confirm which transport won.

## 2. Deploy the client (Vercel)

1. New Project → import the repo → root directory `client`.
2. Framework preset: **Vite**. Build: `npm run build` · Output: `dist`.
3. Environment variable:
   ```
   VITE_API_BASE_URL=https://<api-host>/api
   VITE_SENTRY_DSN=<sentry dsn>   # optional: client-side crash reporting
   ```
   (`VITE_*` vars are baked in at build time and belong to the client only —
   setting them on the server has no effect.)
4. Deploy. Vercel gives a URL now; attach the custom domain once chosen.

## 3. Wire the domain (when the client picks one)

1. Point the domain's DNS at Vercel (client) per Vercel's instructions.
2. Update Render's `CLIENT_URL` to the final domain(s) and redeploy the server
   (CORS reads this).
3. If using both apex and www, list both in `CLIENT_URL` comma-separated.

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
cd client && npm install && cp .env.example .env    # VITE_API_BASE_URL=http://localhost:5001/api
npm run dev            # http://localhost:5173
```

## Rollback

Both Render and Vercel keep previous deploys — use their dashboard "Rollback" to the
last good build. Data is unaffected (it lives in Atlas/Cloudinary).

## Post-deploy smoke test

- [ ] `/api/health` OK
- [ ] Register → welcome email arrives
- [ ] Login, create a note, upload a photo
- [ ] Finance income+expense, resume PDF export
- [ ] Admin announcement emails the batch
- [ ] Settings → change password, and (on a throwaway account) delete account
- [ ] `/privacy`, `/terms`, `/creator` load logged-out
- [ ] `POST /api/beta/events` returns 201 (analytics endpoint live)
- [ ] `GET /api/dax/memory` returns user profile (Dax Profile panel data)
- [ ] `GET /api/admin/outcomes` returns empty array (outcome vault ready)
- [ ] Sentry error appears in dashboard when testing (if VITE_SENTRY_DSN set)
