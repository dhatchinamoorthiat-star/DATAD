# DATAD

**Technology · Psychology · Impact**

A Student Operating System for MBA students — notes, memories, planning, personal finance,
resume building, and (soon) placements, community and AI study tools. Independently built
and maintained by Dhatchinamoorthi.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas (Mongoose)
- **Storage:** Cloudinary (photos)

## Features

| Module | What it does | Visibility |
|---|---|---|
| Notes | Study notes by subject & semester | Shared with batch |
| Photos | Album-based memories | Shared with batch |
| Planner | Case studies, deadlines, exam & interview prep | Shared with batch |
| Finance | Expense tracker, budget, EMI/SIP/savings calculators | Private per user |
| Resume | Guided ATS resume builder with print-to-PDF | Private per user |
| Support | UPI contributions toward hosting & development | — |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, data model, and the privacy/sharing model
- [SECURITY.md](SECURITY.md) — security measures, pre-launch audit, and go-live checklist
- [DEPLOYMENT.md](DEPLOYMENT.md) — step-by-step Render + Vercel runbook
- [ROADMAP.md](ROADMAP.md) — what's next (Placement Hub, Community Feed, AI tools…)

## Setup

1. **Server**
   ```bash
   cd server
   npm install
   cp .env.example .env   # fill in your MongoDB Atlas + Cloudinary credentials
   npm run dev            # runs on http://localhost:5001
   ```

2. **Client**
   ```bash
   cd client
   npm install
   cp .env.example .env
   npm run dev            # runs on http://localhost:5173
   ```

## Project structure

```
server/
  config/       # db + cloudinary setup
  middleware/   # JWT auth, multer upload, error handler
  models/       # User, Note, Album, Photo, Task, Expense, Budget, Resume
  controllers/  # one per domain
  routes/       # mounted under /api/*
client/src/
  api/          # axios instance + per-domain API modules
  context/      # Auth (JWT) + Theme (dark mode)
  components/   # layout, common UI, feature components
  pages/        # one per route
  utils/        # constants, date helpers
```

## Conventions

- Shared content is visible to every registered user; only the author/uploader/creator can
  edit or delete their own items. Finance and Resume data are private per user.
- Photo uploads are capped at 10MB, images only.
- Auth endpoints are rate-limited (20 requests / 15 min).
- JWT (7-day expiry) in `Authorization: Bearer` header; 401 triggers client-side logout.
