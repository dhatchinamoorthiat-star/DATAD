# Play Store listing — DATAD

Draft copy and the Data safety answers, for pasting into the Play Console.

**Everything here is a draft you must review before submitting.** The Data
safety section in particular is a declaration you are legally making about your
own app: it was written by reading the schemas in `server/models/` and the AI
call paths in `server/ai/`, which is the right starting point but is not the
same as you confirming it. Under-declaring is a takedown risk.

Graphics are generated — regenerate with:

```bash
cd client && node scripts/generate-store-assets.js
```

- Store icon 512×512 → `client/assets/store/play-icon-512.png`
- Feature graphic 1024×500 → `client/assets/store/play-feature-graphic-1024x500.png`

The feature graphic's wordmark renders in the system sans, not Inter — Inter is
loaded from Google Fonts at runtime and is not installed locally. Fine at
banner size; install Inter and re-run if you want it exact.

---

## Listing text

**App name** (30 char limit)

```
DATAD: Your Student OS
```

**Short description** (80 char limit — this is what shows in search results)

```
Your entire student life — notes, planner, career, money — in one calm place.
```

**Full description** (4000 char limit)

```
DATAD is one calm place for everything a student juggles.

Notes, planning, placement prep, money and wellbeing usually live in five
different apps that don't talk to each other. DATAD keeps them together, so
the work you did on Tuesday still counts on Friday.

WHAT'S INSIDE

Notes and study
Write in your own words, organise by subject, and find anything instantly.
Resources, assignments and projects stay attached to the subject they belong
to instead of scattered across your downloads folder.

Planner
Tasks, deadlines and a calendar that knows what's actually due. Daily
reflections and habit tracking, if you want them — quietly skippable if you
don't.

Career and placement
A résumé builder that exports a clean PDF, company research and prep cards,
interview question banks, and a placement tracker that follows an application
from applied to offer.

Money
A finance tracker built for a student's actual budget: income, expenses,
categories, and a picture of where the month went.

Wellbeing
A private journal with mood tracking. Yours alone — see the privacy note
below.

Community
Your batch, not the internet. Discussions, events, a marketplace and a shared
gallery, scoped to your campus.

Dax, the assistant
Ask questions about your own notes and résumé and get answers grounded in what
you actually wrote. Summaries, résumé feedback, and prep help.

PRIVACY, PLAINLY

Your journal entries and your finance records are never sent to any AI
provider. Notes and résumé content are, when you ask Dax to work on them —
that's how it answers about your own material.

No ads. No selling your data. Delete your account from Settings and it goes.

Built by students, for students.
```

**Category:** Education
**Tags:** Education, Productivity, Notes, Career
**Contact email:** support@datad.app
**Website:** https://datad.online
**Privacy policy:** https://datad.online/privacy

---

## Data safety

Derived from `server/models/`. Verify each row before submitting.

Answers that apply throughout:

- **Encrypted in transit?** Yes (HTTPS everywhere).
- **Can users request deletion?** Yes — Settings → Delete account.
- **Is any data sold?** No.

| Data type | Collected | Shared w/ third party | Required | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Required | Account management |
| Email address | Yes | Brevo (delivery only) | Required | Account management, sign-in, notifications |
| User IDs (roll number) | Yes | No | Required | Account management |
| Phone number | Yes (résumé only) | No | Optional | App functionality |
| Address (city/location text) | Yes (résumé only) | No | Optional | App functionality |
| Photos | Yes | Cloudinary (storage) | Optional | App functionality (avatar, gallery) |
| Financial info — other | Yes | **No** | Optional | App functionality (self-entered budgeting) |
| Health & fitness | Yes (journal mood) | **No** | Optional | App functionality |
| Messages — other in-app | Yes | AI providers* | Optional | App functionality |
| Files & docs | Yes | Cloudinary; AI providers* | Optional | App functionality (résumé, notes, resources) |
| App interactions | Yes | No | Required | Analytics, app functionality |
| Crash logs | Yes | Sentry | Required | Diagnostics |
| Device or other IDs | Yes | No | Required | Security (device-session cap, `User.sessions`) |

\* Groq, Cloudflare and NVIDIA — the failover chain in `server/ai/providers/`.

### Four rows worth reading twice

**Financial info.** DATAD stores self-entered expense and budget records
(`models/Expense.js`, `models/Budget.js`), not payment instruments. Card and
UPI details go straight to Razorpay and never reach our server, so
*User payment info* is **not** collected. Declare *Other financial info*.

**Health and fitness.** `models/JournalEntry.js` has a `mood` field. Mood
tracking is health data as far as Play is concerned, even though the app isn't
a health app. Declare it. The alternative — arguing it's just a journal — is
the kind of judgment call that gets an app pulled.

**Files, docs and messages → AI providers.** This is the one people get wrong.
Note and résumé content is sent to third-party AI providers when a student uses
Dax (`ai/retriever.js`, `ai/daxService.js`, `ai/embeddings/semanticSearch.js`).
That is *sharing with a third party* and must be declared as such.

Journal entries and finance records do **not** appear anywhere under
`server/ai/`, which is why the listing copy above says so out loud. If that
ever changes, this row and that sentence both have to change with it.

**Device IDs.** `User.sessions` stores `deviceId`, `ip` and `userAgent` to
enforce the device cap. Purpose is *Security*, not analytics or advertising.

---

## Content rating questionnaire

Category: **Reference, News, or Educational**. Expected outcome: Everyone / PEGI 3.

Answer **yes** to user-generated content and user-to-user communication — the
app has discussions, replies, a marketplace and talent conversations. Play then
requires you to confirm you have moderation and a reporting mechanism.
`models/ModerationCase.js` exists; check it's actually reachable from the UI
before claiming it, because this is a follow-up question reviewers do check.

There is no gambling, no violence, and no user-visible advertising.

---

## Screenshots

Minimum 2, but 2 looks abandoned — ship 6. Phone: 16:9 or 9:16, min 320px on
the short edge. Take them from a seeded demo account, never a real student's.

Suggested order — first two are what most people see before scrolling:

1. Dashboard / daily home
2. Notes, with a subject open
3. Planner with real deadlines
4. Résumé builder
5. Finance tracker
6. Dax answering a question about the student's own notes

Use fake but plausible names and numbers throughout. Real batch data in a
public store listing is its own privacy incident.
