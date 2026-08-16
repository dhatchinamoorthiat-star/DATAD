# DATAD — Product Roadmap

Goal: evolve from a batch utility app into a **Student Operating System** — the platform
MBA students open every day. Modules ship incrementally; nothing existing breaks.

## ✅ Phase 0 — Foundation (done)

- JWT auth (open signup), dark mode, responsive navbar
- Notes (shared, by subject/semester) · Photos (albums, Cloudinary) · Planner (shared tasks)
- Finance (private): expenses, budget, category chart, EMI/SIP/savings calculators
- Resume Builder (private): guided sections → ATS print-to-PDF
- Photos: Google Photos shared-album links (no upload/storage cost)
- Roles: admin superuser (by email) + members · admin Journal, Console, announcements (Resend email)
- **Intelligence Center** (News): **live** business news auto-pulled from Economic Times RSS
  feeds (10 category feeds, refreshed every 30 min, cached in Mongo), 10 categories, bookmarks,
  topic personalization ("For you"), Top Story highlight, admin-updated market snapshot,
  dashboard integration
- Support page: UPI QR presets + roadmap · Footer with feedback links · Privacy/Terms · Settings

## Intelligence Center — Phase 2 (needs API keys + budget)

- ✅ Live news aggregation — DONE via RSS (free, no key). More sources can be added in
  `server/config/newsFeeds.js`.
- ✅ Live market snapshot — DONE via Yahoo Finance's keyless endpoint (Nifty, Sensex, USD/INR,
  Gold, Crude), refreshed every 15 min. Symbols are in `server/services/marketFetcher.js`.
- AI auto-enhancement per live article (why-it-matters, MBA concepts, interview questions) via an
  LLM API key — the `NewsItem` model already reserves these fields; a worker would fill them.

**Deployment note:** the news fetcher makes outbound HTTPS requests to the RSS feeds. It sends a
browser User-Agent; if a host blocks datacenter egress or the publisher rate-limits, add feeds or
a small proxy. Works on localhost and standard PaaS.

## 🔜 Phase 1 — Go live

- Deploy server (Render/Railway) + client (Vercel), custom domain
- Change-password + profile page (avatar, bio, LinkedIn/GitHub links)
- Global toast/skeleton polish, code-split routes

## Phase 2 — Placements & careers

- **Placement Hub**: companies, role, package, eligibility, deadline, rounds;
  per-student status tracker (Applied → Shortlisted → Interview → Offer/Rejected)
- **Internship Board**: company, location, remote/hybrid, apply link, deadline
- Resume: multiple stored resumes, more templates
- Admin role for creating placements & announcements

## Phase 3 — Community

- **Community Feed**: posts, images, questions, polls, likes, comments, bookmarks,
  hashtags, mentions, infinite scroll
- **Student Directory**: searchable profiles — skills, interests, clubs, links
- **Announcements** (pinned, priority) + **Notification Center** (Socket.IO)
- Bookmarks across posts/notes/resources/placements

## Phase 4 — Resources & events

- Notes → **Resource Library**: PDF/Word/Excel/PPT/ZIP/video/links, categorized by
  subject/semester/professor/tags, global search
- **Event Management**: RSVP, attendance, gallery, certificates
- **Group Projects**: kanban tasks, deadlines, files, comments

## Phase 5 — Growth & intelligence

- **AI section**: document summarization, resume review, interview Q&A, flashcards,
  prompt library (needs API budget)
- **Study Tools**: pomodoro, habit tracker, goals, streaks
- **Gamification**: contribution score, badges, leaderboard
- **Marketplace** & **Skill Exchange** (needs critical mass of users)
- **Portfolio Generator**: public shareable profile pages
- **Admin panel** with analytics dashboards

## Principles

- Never break existing functionality; refactor only when a module demands it
- Private-by-default for personal data (finance, resume); shared-by-default for batch content
- Ship small, verify in the browser, commit per feature
