# DATAD — E-Cell IIT Bombay Questionnaire Answers

All long answers are under the 150-word cap. Copy the block-quoted text only.

---

## 1. Venture Description
**What problem is your venture targeting to solve? How are the affected people (customers/consumers) coping with the problem at present?**

*(147 words)*

B-school students run their academic, career, financial and personal lives across a dozen disconnected tools that were never built for them. Notes sit in one app, deadlines in another, resumes in a Word file, expenses nowhere at all, and placement prep in WhatsApp groups. Nothing shares context, so no tool can actually advise the student — it can only store fragments.

Today students cope by improvising. They stitch together Notion, Google Drive, spreadsheets, senior-year PDFs circulated informally, and generic AI chatbots that know nothing about their resume, exam schedule or placement timeline, so the advice stays generic. Finance is tracked only after a crisis. The result is constant context-switching, missed opportunities and burnout during placement season — precisely when clarity matters most.

DATAD replaces that patchwork with one calm student operating system, where Dax, an AI advisor with real context, turns scattered data into actionable guidance.

---

## 2. Market Analysis
**What is the intended customer segment or target customers of your venture?**

*(130 words)*

Primary segment: MBA and B-school students in India, aged 21–27, currently in a two-year programme. Within that, the sharpest wedge is the placement-seeking cohort — first-year students entering summer placements and second-years in finals — who face the highest-stakes, most time-compressed version of the problem and have clear willingness to pay during that window.

Entry strategy is cohort-by-cohort rather than broad: win an entire batch at one campus, where shared notes, albums and discussions create network effects a competitor cannot buy, then replicate campus by campus.

Secondary segments as the product matures: undergraduate students at professional colleges facing similar placement cycles, and B-schools themselves as institutional buyers — licensing DATAD for a full batch with faculty-side career-tracking dashboards.

---

## 3. Competitor Analysis
**Who are your current competitors? (both direct and indirect)**

*(146 words)*

No one competes with DATAD's full scope, so competition is per-module rather than head-on.

Direct: Notion and Evernote for notes and planning, Zoho/Enhancv and Overleaf templates for resumes, Walnut and Money Manager for expenses, and campus-specific portals or LMS platforms schools already run. Each solves one slice with no shared context.

Indirect but strongest: ChatGPT, Gemini and Claude, which students already use for resume edits and concept help. They are more capable models than anything we run — but they start every session blind. They do not know your resume history, exam calendar, placement timeline or budget, so their advice stays generic and unremembered.

Also indirect: WhatsApp groups and inherited senior-year Drive folders, which handle notes and placement intel informally today.

Our defensibility is context and cohort network effects, not model quality — the thing a general chatbot structurally cannot copy.

---

## 4. Revenue Model
**How will your venture generate revenue? What are the factors affecting your costs and revenues? Also highlight any growth opportunities in future.**

*(147 words)*

Three revenue lines, deliberately not dependent on mass consumer conversion.

Primary: institutional licensing. B-schools pay annually per batch for faculty placement-readiness dashboards and cohort analytics — infrastructure already built. One 300-student college outweighs a hundred individual subscribers, and the revenue is contracted rather than seasonal. Placement cells hold budgets; students do not.

Second: a placement season pass — one-time, bought during summer and final placements, when a student weighs it against a job offer rather than against a monthly app bill. Willingness to pay peaks with the stakes.

Third: individual Pro subscriptions, as an entry point rather than the core.

Costs: hosting, database and storage are fixed and modest. AI inference is the only meaningful variable cost, contained by hard per-user quotas, low-cost models on the free tier, and caching queries repeated across a batch. Solo-built, so no salaries — break-even is roughly 25 paying students, or one institutional contract.

Growth: premium verticals (consulting case coaching, investment-banking prep), then international markets.

---

## 5. Unique Selling Proposition (USP)
**How does your idea and marketing strategy differentiate your startup from your competitors and help you create demand? Mention your IP advantage if any.**

*(148 words)*

USP: DATAD is the only student tool where the AI actually knows the student. Dax reads your real resume history, exam calendar, placement timeline and budget, and remembers across sessions — so advice is specific, not the generic output a blank-slate chatbot gives. One system replaces five disconnected apps.

Second differentiator is a deliberate anti-pattern: no ads, no infinite feed, no streaks, no data sale. Engineered for outcomes, not engagement — a positioning incumbents monetising attention cannot copy.

Marketing is cohort-led, not paid. We saturate one campus batch at a time, where shared notes, albums and discussions make the product more valuable as classmates join, then let placement-season word of mouth carry it to the next campus. Demand peaks naturally when stakes peak.

IP: no patents. The defensible assets are proprietary — the accumulated student context graph, cohort network effects, and our own AI orchestration and privacy layer.

---

## 6. Technology Readiness
**What is the current Technology Readiness Level (TRL) of your solution?** *(dropdown)*

**Select: TRL 8 — System complete and qualified.**

Rationale (not for submission): the full V1 platform is live in production on real infrastructure with real students, all modules shipped and tested, but not yet operating at commercial scale. Choose TRL 9 only if you can defend sustained paying-customer operations at scale under questioning.

---

## 7. Technical Innovation
**What is the key technological innovation or differentiator of your solution?**

*(150 words)*

The innovation is the context layer beneath the AI, not the model itself. Three parts:

Persistent, retrieval-grounded student context. A user-memory store plus an embedding-based vector index over the student's own notes, resume and planner data lets Dax retrieve genuinely relevant material rather than re-asking every session. Semantic, not keyword — it finds meaning, not string matches.

Privacy-preserving cohort intelligence. A nightly aggregation job computes batch-level insights behind a hard minimum-group-size threshold. The module is architected so no code path can return an individual student — privacy is the interface, not a convention. This lets Dax say how your batch is tracking without exposing anyone.

A hardened AI runtime. Tier-based model routing with a registry and circuit breakers, per-user usage metering, and an explicit instruction/data boundary that JSON-encodes all student-authored text before it enters a prompt — closing the prompt-injection hole most AI products still ship with.

---

## 8. Intellectual Property & Technical Assets
**Which of the following technical assets have you developed?** *(dropdown)*

Options are: Proprietary AI Model · Proprietary Dataset · Proprietary Hardware · Novel Algorithm · Research Publication · Patent Filed · Patent Granted · None

**Select: Proprietary Dataset.**

Rationale (not for submission): it is the only option that is true without stretching.

- *Proprietary AI Model* — false. DATAD routes to third-party models (DeepSeek, Llama); you have not trained or fine-tuned your own. Claiming this is the fastest way to lose credibility in a technical round.
- *Novel Algorithm* — a stretch. The cohort aggregation and tier routing are solid engineering, not a novel algorithm, and a judge will ask what is novel about it.
- *Proprietary Dataset* — defensible. The accumulated student context graph is genuinely yours: per-user memory, resume iteration history, notes and planner embeddings, and the precomputed cohort-insight collection. It compounds with every user and no competitor can buy it.
- *Patent Filed / Granted / Research Publication / Hardware* — none apply.

If asked to elaborate verbally, say the dataset is early-stage but structurally defensible, and that the codebase itself is proprietary and unpublished — just not one of the listed categories.

---

## 9. Prototype
**Do you currently have a functional prototype? If yes, provide a publicly accessible link.** *(dropdown + link)*

**Select: Yes.**

Link: **[ADD BEFORE SUBMITTING]**

The form explicitly rejects submissions with an inaccessible link, so verify it in a private/incognito window before submitting. Two things to watch:

- The only deployed URLs in the repo are staging (`datad-staging.vercel.app`, `datad-api-staging.onrender.com`). If staging sits behind auth or a login wall, do not submit it as-is.
- Safest option: record a 2–3 minute screen-capture walkthrough of the live app — dashboard, notes, resume builder, a Dax interaction — upload to YouTube as **Unlisted** (not Private) or Google Drive set to "Anyone with the link can view", then paste that link.

---

## 10. Achievements
**List your distinctive achievements.**

Everything unbracketed below is defensible from the codebase itself. The bracketed items
are personal credentials that exist nowhere in this repo — they need to come from you.

Draft:

As T. A. Dhatchina Moorthi (Founder & Systems Architect, D² Labs), built and shipped DATAD end-to-end as a solo founder — a production student operating system spanning notes, planner, finance, resume building, community and an integrated AI advisor, live on real infrastructure and used by students today.

Engineered an in-house AI runtime rather than wrapping a chatbot: tier-based model routing with circuit breakers and usage metering, an embedding-based semantic retrieval layer, and a privacy-preserving cohort aggregation engine architected so no code path can expose an individual student.

Shipped a hardened prompt-injection boundary that JSON-encodes all student-authored content before it reaches a model — a class of vulnerability most production AI products still carry.

Ran formal security and production-readiness audits against the platform pre-launch and closed the findings.

Selected to pitch DATAD at the Pitch Sell Win competition at PSG Institute of Management, presenting the venture to a live audience of faculty and peers. The pitch drew active engagement and encouragement from faculty across the institute — early external validation that the problem is real and the approach is credible (August 2026).

[Add: academic honours, scholarships, rank in entrance exams]
[Add: any other competitions or hackathons, with names and placements]
[Add: prior work, internships, leadership roles, publications]
[Add: any real, verifiable DATAD traction — users, retention, revenue]

Two notes before you submit. Keep the personal accolades — judges read this section as
*your* credibility, not the product's, and the product-side claims are already covered in
Q5 and Q7. And check whether this field enforces a word cap; if it does, cut the second and
third product paragraphs first, since they repeat Q7.

---

## 11. Pitch Deck (GoDaddy Airo AI Builder)
**Submit your GoDaddy Airo AI Builder pitch URL.**

Optional — the form offers "Skip for Now" and states it enhances your application rather
than determining your score. Do it if you have time; skip it rather than submit something
half-built.

You will need to create the Airo account and build the page yourself at
https://eurekapitch2026.c40.airoapp.ai/pitch — you have 50 AI credits, so paste the copy
below instead of prompting Airo to write sections from scratch. Spend credits on imagery
and layout, not text you already have.

URL to paste back into the form: **[ADD AFTER BUILDING]**

### Page copy

**Hero**

> DATAD — The Student Operating System
> Study. Career. Finance. Community. Reflection.
> One calm system for every dimension of student life, with an AI advisor that actually knows you.

**The problem**

> B-school students run their academic, career, financial and personal lives across a dozen disconnected tools. Notes in one app, deadlines in another, resume in a Word file, expenses nowhere at all, placement prep in WhatsApp groups.
>
> Nothing shares context — so no tool can advise you. It can only store fragments.

**The solution**

> DATAD replaces the patchwork with one system: notes, planner, finance, resume builder, albums and community, unified under Dax — an AI advisor that reads your actual resume history, exam calendar, placement timeline and budget.
>
> Not a chatbot bolted on. An advisor with context.

**Why it's different**

> **Dax knows you.** ChatGPT starts every session blind. Dax remembers your resume iterations, your deadlines, your goals.
> **Engineered for outcomes, not engagement.** No ads. No infinite feed. No streaks. No data sale.
> **Built by a student who lived the problem.** Not designed by a product team guessing at student life.

**Under the hood**

> Embedding-based semantic retrieval over your own notes and documents. Persistent user memory across sessions. Privacy-preserving cohort intelligence that reports how your batch is tracking without ever exposing a classmate. Tier-based AI model routing with usage metering and a hardened prompt-injection boundary.

**Business model**

> Free forever for every student, ad-free. Institutions license DATAD per batch for placement-readiness dashboards and cohort analytics. Students can buy a one-time placement season pass when the stakes are highest. Solo-built with no salaries, so the platform breaks even on a single college contract.

**Traction & validation**

> Live in production and in daily use. Pitched at the Pitch Sell Win competition, PSG Institute of Management, August 2026, where it drew active engagement from faculty across the institute.

**Founder**

> T. A. Dhatchina Moorthi — Founder & Systems Architect, D² Labs. Builds as Digital Don. Engineer from Tamil Nadu, India. Built DATAD solo, end to end.

**Call to action**

> Try DATAD → [your live or demo link]

### Build notes

- Keep it one scrolling page. Judges skim.
- Use the same live/demo link here as in Q9 so the two answers corroborate each other.
- Do not restate the 150-word questionnaire answers verbatim — this page should let judges *experience* the product, so lead with screenshots of the actual app over walls of text.
- Verify the published URL loads in an incognito window before pasting it into the form.

---

## Pre-submission check

The traction figures in `DATAD_Pitch_Deck.md` (100+ users, 85% weekly retention, 60% Pro conversion) read as projections rather than measured numbers. If a later question asks for traction, use only what you can defend from actual usage data — E-Cell judges tend to probe those.

**Fix the 60% conversion claim before anyone reads the deck.** Consumer freemium converts at 1–5%. A 60% claim tells an experienced judge you have not modelled your own economics, and it directly contradicts the Q4 answer, which is built on the assumption that consumer conversion stays low. Either cut it or replace it with real measured numbers.

---

## Anticipated judge questions

**"If only 1–2 students in 100 buy premium, how do you cover hosting and AI costs?"**

One or two in a hundred is the correct assumption for a consumer monthly subscription — which is why that is not my core model. Free users cost me close to nothing: hard token quotas, low-cost models on the free tier, and cached answers to the questions a whole batch asks identically. I am solo-built with no salaries, so break-even is roughly ₹8,000 a month — twenty-five paying students nationwide, or one college contract. My primary revenue is institutional: placement cells have budgets, and their rankings depend on the outcomes my cohort analytics measure. Customer acquisition cost is near zero because growth is word-of-mouth within a batch, not paid advertising.

**"If an investor puts in ₹2 lakh, how do they get it back?"**

At that cheque size I would use a convertible instrument — an iSAFE or convertible note — rather than a priced round. It avoids setting a valuation prematurely and keeps legal costs proportionate to the amount raised; it converts to equity at a discount at the next round. If the investor prefers cash back over equity, revenue share fits well: a fixed percentage of monthly revenue until they have received 1.5–2x, then it ends. That suits a business with recurring revenue and a near-zero cost base, and needs no exit event. At this stage, though, non-dilutive capital is the better fit — Startup India Seed Fund, StartupTN and NIDHI-PRAYAS all target exactly this amount.

*(Get a CA or company secretary involved before executing any of these; most require a registered Pvt Ltd.)*
