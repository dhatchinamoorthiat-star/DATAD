# DATAD — Security

A summary of the security posture and the pre-launch audit. Scope: a small,
open-signup platform for one MBA batch.

## Measures in place

**Authentication & passwords**
- JWT (7-day) with server-verified signature; `verifyToken` on every protected route.
- bcrypt password hashing (10 rounds). Minimum 8 chars, letter + number required.
- Passwords never returned by the API (`.select('-password')`).
- Change-password requires the current password; account deletion requires the password.

**Authorisation**
- `checkRole('admin')` gates all `/api/admin` routes (journal, students, stats, announcements).
- Every mutation on shared content verifies ownership (`.equals(req.user.userId)`).
- Every private-data query (finance, resume, journal) is scoped to the caller's `userId`.

**Input handling**
- `express.json` capped at 1 MB.
- Schema-level `maxlength` on every text field; array-size caps on resume sections; numeric caps on amounts.
- `express-mongo-sanitize` strips `$`/`.` operators → blocks NoSQL injection.
- `hpp` guards against HTTP parameter pollution.
- `errorHandler` returns generic messages to clients; full errors logged server-side only.

**Rate limiting** (per IP, `trust proxy` set for hosted deployment)
- All `/api`: 300 requests / 15 min.
- `/api/auth`: 20 / 15 min (brute-force protection).
- Photo upload & announcement email: 40 / 15 min (abuse/cost protection).

**Uploads**
- `multer` memory storage; image mimetypes only; 10 MB per file.
- Stored on Cloudinary; only URL + publicId persisted. Deletions remove the Cloudinary asset.

**Transport & headers**
- `helmet` sets secure headers. CORS restricted to the `CLIENT_URL` allow-list.
- Secrets live only in `server/.env` (gitignored). `.env.example` documents required keys.

## Data protection

- **Deletion / right to erasure**: users can delete their account from Settings; this cascades to all their notes, photos (incl. Cloudinary assets), tasks, expenses, budget, resume, journal, and announcements.
- **Minimisation**: JWT carries only `{ userId, name, email, role }`. Email is shared with Brevo solely to send account and announcement mail. No analytics, tracking, or ad identifiers.
- **Transparency**: `/privacy` and `/terms` pages state what's stored, where (Atlas/Cloudinary/Brevo), and who sees what.

## Audit findings (pre-launch)

| # | Finding | Status |
|---|---|---|
| 1 | Private modules (finance/resume/journal) scoped to userId | ✅ Verified — no cross-user leak |
| 2 | Shared modules enforce owner-only mutation | ✅ Verified |
| 3 | No input length limits (storage/DoS vector) | ✅ Fixed — schema maxlength + array caps |
| 4 | Rate limiting only on auth | ✅ Fixed — general + heavy limiters added |
| 5 | Weak password policy (6 chars) | ✅ Fixed — 8 chars, letter+number |
| 6 | No change-password / account deletion | ✅ Fixed |
| 7 | Validation errors returned 500 | ✅ Fixed — now 400 with message |
| 8 | CORS single-origin, no proxy trust | ✅ Fixed — allow-list + trust proxy |

## Known limitations / accepted risks

- **Open signup**: anyone with the link can register (by design for a batch). Not suitable for sensitive data.
- **Admin-by-email**: the account matching `ADMIN_EMAIL` becomes admin. On a fresh production database, **the real admin must register first** (see DEPLOYMENT.md). The admin email is public, so if the DB is ever wiped, re-register the admin immediately.
- **No token revocation**: a stolen JWT is valid until it expires (7 days). Mitigation: HTTPS-only in production, short-ish expiry. A refresh/blocklist scheme is a future enhancement.
- **No email verification**: registration doesn't confirm the email address.

## Pre-launch checklist

- [ ] Separate **production** MongoDB Atlas project (not shared with any other app).
- [ ] Separate **production** Cloudinary account/folder.
- [ ] Fresh, strong `JWT_SECRET` for production (never reuse the dev one).
- [ ] Verify the sending domain in Brevo; set `BREVO_FROM_EMAIL` to an address on it.
- [ ] Admin registers first, before sharing the link.
- [ ] `CLIENT_URL` set to the real domain(s); confirm CORS blocks others.
- [ ] HTTPS enforced (handled by Render/Vercel).
