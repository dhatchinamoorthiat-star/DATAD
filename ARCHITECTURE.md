# DATAD — Architecture

## System overview

```
                    ┌─────────────────────────┐
                    │   Browser (React SPA)    │
                    │  Vite build · Tailwind   │
                    │  JWT in localStorage     │
                    └───────────┬─────────────┘
                                │ HTTPS, Authorization: Bearer <jwt>
                                ▼
                    ┌─────────────────────────┐
                    │   Express API server     │
                    │  helmet · cors · hpp     │
                    │  mongo-sanitize          │
                    │  rate limiters           │
                    │  verifyToken / checkRole │
                    └──┬──────────┬────────┬───┘
                       │          │        │
              ┌────────▼──┐  ┌────▼────┐  ┌▼──────────┐
              │ MongoDB    │  │Cloudinary│  │  Resend    │
              │ Atlas      │  │ (photos) │  │ (email)   │
              └────────────┘  └──────────┘  └───────────┘
```

- **Client** (`client/`): React 19 + Vite + Tailwind. One axios instance injects the JWT and redirects to `/login` on 401. Routing in `App.jsx`; auth state in `context/AuthContext` (decodes the JWT), theme in `context/ThemeContext`.
- **Server** (`server/`): Express 4. Layered `routes → controllers → models`. Cross-cutting concerns in `middleware/` and `config/`.
- **Data**: MongoDB Atlas via Mongoose. Photos on Cloudinary (only URL + publicId stored in Mongo). Email via Resend HTTP API.

## Request lifecycle

1. `helmet`, `cors` (allow-list from `CLIENT_URL`), `express.json` (1 MB cap), `express-mongo-sanitize`, `hpp`, then `generalLimiter` on all `/api`.
2. Route-level: `authLimiter` on `/api/auth`; `heavyLimiter` on photo upload and announcements.
3. `verifyToken` reads the Bearer JWT → `req.user = { userId, name, email, role }`.
4. `checkRole('admin')` guards `/api/admin`.
5. Controller runs; Mongoose schema validation enforces field limits.
6. `errorHandler` maps ValidationError/CastError → 400, duplicate key → 409, else 500 (generic message; details logged server-side only).

## Data model

| Model | Owner field | Sharing |
|---|---|---|
| User | — | name/email visible to admin only |
| Note | `author` | **Shared**; author-only edit/delete |
| Album / Photo | `createdBy` / `uploadedBy` | **Shared**; owner-only delete |
| Task | `createdBy` (+ `assignee`) | **Shared**; creator/assignee edit |
| Expense / Budget | `user` | **Private** to the user |
| Resume | `user` (unique) | **Private** to the user |
| JournalEntry | `user` | **Private**; personal reflection journal, never exposed to admin or other users |
| Announcement | `createdBy` | Created by admin; readable by all |

## Privacy model (the core invariant)

- **Private data** (Finance, Resume, Journal): every query is scoped to `req.user.userId`. There is no endpoint that returns another user's private data.
- **Shared data** (Notes, Photos, Tasks): readable by any authenticated user; mutations require the caller to be the owner (checked via `.equals(req.user.userId)`).
- **Admin** sees the student register (names/emails/join dates) and platform counts, and posts announcements. Admin has **no** access to any member's private finances, resume, or journal — the admin journal is scoped to the admin's own `userId` like any other private data.
- **Roles**: `member` (default) and `admin`. The account whose email matches `ADMIN_EMAIL` is promoted to admin on register/login.

## Auth

- JWT signed with `JWT_SECRET`, 7-day expiry, payload `{ userId, name, email, role }`.
- Passwords hashed with bcrypt (10 rounds). Minimum 8 chars, must include a letter and a number.
- No server-side session store; the token is the source of truth. Logout is client-side (drops the token).

## Folder map

```
server/
  config/      db.js · cloudinary.js · mailer.js (Resend)
  middleware/  verifyToken · checkRole · upload (multer) · rateLimiters · errorHandler
  models/      User · Note · Album · Photo · Task · Expense · Budget · Resume · JournalEntry · Announcement
  controllers/ one per domain
  routes/      mounted under /api/*
client/src/
  api/         axios instance + per-domain modules
  context/     AuthContext · ThemeContext
  components/  layout/ · common/ · finance/ · feature dirs
  pages/       one per route
  utils/       constants · dateUtils · upcomingFeatures
```
