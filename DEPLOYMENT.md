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
3. **Gmail** — the mailer sends over Gmail SMTP. On the Google account you'll
   send from, enable 2-Step Verification, then create an **App Password**
   (Google Account → Security → App passwords). That 16-character value is
   `GMAIL_APP_PASSWORD`; the account address is `GMAIL_USER`. Note Gmail's
   ~500 recipients/day cap — it limits how large an announcement blast can be.
4. **Secrets** — generate a fresh JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

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
   GMAIL_USER=<sending gmail address>
   GMAIL_APP_PASSWORD=<16-char google app password>
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
   broken (registration needs the verification email) — fix the Gmail vars
   before sharing the link.

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
3. Post a test announcement with "Email everyone" to confirm Resend works.
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
