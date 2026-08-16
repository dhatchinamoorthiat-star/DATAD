# DATAD Student Experience

**Role:** Chief Product Designer  
**Constraint:** Backend is frozen. No new models, no new APIs, no infrastructure changes.  
**Goal:** Design the journey from first visit to placement — every screen, every emotion, every interaction.

---

## Phase 1: Discovery

### Landing Page

**Before the student arrives, they've heard one sentence from a friend:**
> "DATAD tells you exactly what to learn next to land the job you want."

That's the only promise. Not "organize your life." Not "AI assistant." One clear value proposition.

**Screen structure (top to bottom):**
1. **Hero:** "Know exactly what to learn next." Subtitle: "Upload your resume. Pick a role. Get a 3-month plan."
2. **Proof:** Three student cards showing before/after — "Got my first internship in 8 weeks" with a real photo and a one-line quote.
3. **Simplicity:** A 3-step diagram — Upload resume → Pick target role → Daily plan. No feature list. No screenshots of dashboards.
4. **CTA:** "Start your roadmap" — one button. That's it.

**User emotion:** Curiosity → "This might actually work" → "Let me try"

**Trust signals:**
- No infinite scroll. No blog. No social proof counter.
- A single testimonial from someone who looks like the student (same college, same year)
- Privacy note: "Your data stays yours. Delete anytime."
- No email required to see the landing page (no gate)

**What makes the student sign up:**
- The 3-step diagram makes it feel achievable
- The testimonial makes it feel real
- The single CTA removes decision paralysis

---

## Phase 2: Onboarding

### Step 1: Quick Registration

**Goal:** Remove friction. Get the student in within 30 seconds.

**Screen:** A single form. Name, email, password, "I'm a" dropdown (fresher / experienced).

**User emotion:** "That was fast. Okay, what's next?"

**Design notes:**
- No email verification gate at this point (delayed to Step 4)
- Honeypot field hidden from real users (existing feature)
- Trust note: "We'll never share your data"

### Step 2: Profile Setup

**Goal:** Collect enough to generate a useful first roadmap. But only what's needed.

**Screen:** A multi-step form, one question per screen (Duolingo-style). Progress bar at top.

**Questions (in order):**
1. "What's your current course / specialization?" — text input with autocomplete
2. "Which semester / year are you in?" — dropdown
3. "What's your dream role?" — text input with suggested completions from ROLE_SKILL_MAP
4. "What skills do you already have?" — tag input with autocomplete from canonical skill list
5. "How much time can you commit daily?" — slider: "15 min / 30 min / 1 hour / 2+ hours"

**User emotion:** Guided, not interrogated. Each step feels short and meaningful.

**AI involvement:** None during form (speed). AI runs after submission to generate the initial roadmap.

**Empty state:** Not applicable — this is the setup flow.

**Error state:** Each field validates inline. If API fails during roadmap generation, show: "We hit a snag. Our AI is thinking — give us a moment." Never show a raw error.

### Step 3: Resume Upload (Optional but Encouraged)

**Goal:** Increase roadmap accuracy by matching existing skills.

**Screen:** A simple card after profile setup: "Make your roadmap smarter — upload your resume."

**States:**
- **Empty:** Upload area with dashed border. "Drop your resume here or click to browse. PDF or DOCX."
- **Uploading:** Progress bar with "Parsing your experience..." — spinning icon
- **Success:** "We found these skills in your resume:" — checklist of extracted skills with checkmarks. "Your roadmap will skip these and focus on what you actually need."
- **Error (bad file):** "We couldn't read that file. Try a different format (PDF works best)."
- **Skip:** Small "Skip this step" link below the upload area. No penalty for skipping.

**User emotion if they upload:** "Wow, it actually found my skills. This is smart."
**User emotion if they skip:** "No problem. I'll add them manually later."

**AI involvement:** Resume parsing runs via existing AI infrastructure. Student doesn't wait — they proceed to the next step while parsing happens in background. A toast appears: "Resume analyzed! We found 6 skills. Your roadmap is being tailored."

### Step 4: Email Verification

**Goal:** Confirm the student owns this email (anti-bot measure).

**Screen:** "Check your inbox. We sent a confirmation link."
**Below:** A field to re-enter email if they mistyped (inline, no page reload).

**User emotion:** Slight pause but trust-building.

**Design notes:**
- Resend button after 60 seconds
- "Already verified? Log in" link
- The roadmap is generated in the background during this wait. When they return after verifying, their roadmap is ready.

### Step 5: First Roadmap

**Goal:** Show immediate value. The "aha" moment.

**Screen:** `/career/roadmap` with the freshly generated roadmap.

**States:**
- **Loading (while generating):** The roadmap hero shows a skeleton with pulsing gradient. A single line: "Building your roadmap to [target role]..." No spinner — show a phantom outline of what's coming (pill-shaped placeholders for each item).
- **Success:** The full roadmap hero with target role, progress (0%), and the list of roadmap items. Each item shows: skill name, difficulty badge, estimated hours. The first item has a subtle glow/attention pulse.
- **Error (AI generation failed):** "We couldn't generate your roadmap right now. Here's a starter template — you can customize it." Show 3 default skill items (taken from ROLE_SKILL_MAP for the requested role). The student can edit, add, and regenerate later.

**User emotion:** "This is exactly what I needed. I can see the path."

**AI involvement:** The prompt has already run. The roadmap is displayed. No further AI until the student regenerates.

---

## Phase 3: Daily Usage

### Morning Dashboard

**Goal:** Establish a 5-minute daily habit.

**Screen (`/dashboard` or `/study`):**

```
┌─────────────────────────────────────────────┐
│  Good morning, Ananya.                       │
│  You have 4 items to work on today.          │
│                                             │
│  ┌─────────────────────────────────────────┐ │
│  │ Today's Focus                           │ │
│  │                                         │ │
│  │  [BookOpen]  Practice: SQL Joins        │ │
│  │             → Your roadmap says this    │ │
│  │               is the highest-impact     │ │
│  │               item you can do today.    │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  ┌─────────────────────────────────────────┐ │
│  │  What did you work on today?            │ │
│  │  [________________________________] [Log] │ │
│  │  Studied 30 min today · 4-day streak    │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  ┌─────────────────────────────────────────┐ │
│  │  Your Roadmap Progress                  │ │
│  │  [████░░░░░░░░░░░] 3/10 skills done    │ │
│  │  +2 this week                          │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  [Continue where you left off]              │
│  [Upcoming deadlines]                       │
└─────────────────────────────────────────────┘
```

**User emotion:** "I know what to do today. This takes 2 minutes."

**First action:** The "Today's Focus" card is the hero. It recommends ONE thing — the highest-impact roadmap item for that day. No multiple choices. No analysis paralysis.

**Design decisions:**
- The daily check-in is SECOND in visual hierarchy, after the focus suggestion
- The roadmap progress bar is always visible — a constant progress signal
- Streak display is subtle (gray text, not a badge) — motivation, not gamification
- "Continue where you left off" references their last note/task (existing feature)

**AI involvement:**
- Today's Focus is computed by a priority engine: roadmap items with closest deadline → highest confidence gap → smallest estimated time to complete
- No AI call needed — the engine uses existing RoadmapItem data

**Empty state (no roadmap yet):**
```
┌─────────────────────────────────────────────┐
│  Build your skill roadmap                   │
│                                             │
│  [Map icon]  Set a target role and get      │
│             a 3-month plan of courses,      │
│             projects, and resources.        │
│                                             │
│  [Build your roadmap]                       │
└─────────────────────────────────────────────┘
```

**Success state (all items done):**
```
┌─────────────────────────────────────────────┐
│  You're all caught up!                      │
│  All roadmap items complete.                │
│  Ready for the next challenge?              │
│                                             │
│  [Regenerate with higher target]            │
│  or [Explore career opportunities]          │
└─────────────────────────────────────────────┘
```

**Error state (API failure):**
- The dashboard degrades gracefully — the TodayFocus card simply doesn't appear
- "Continue where you left off" and deadlines still show (they're cached from the last successful fetch)

### Weekly Rhythm

**Monday morning:** A brief summary card appears: "Last week: 4 check-ins, 2 skills advanced. This week's focus: [recommended item]."

**Sunday evening:** "You completed 3 practice sessions this week. Consistency score: 80%. Keep it up."

No push notifications (mobile not yet supported). All rhythm is in-app.

---

## Phase 4: Learning

### Expanding a Roadmap Item

**Trigger:** Student clicks on a roadmap item in the list.

**States:**

**Collapsed (default):**
```
[▸] Python · Intermediate · ~12 hours · 60% confident
```

**Expanded:**
```
[▾] Python · Intermediate · ~12 hours · [60% ██████░░░░]

     Learning objectives:
     • Understand Python syntax and data structures
     • Write functions and classes
     • Work with files and libraries
     • Build a command-line application

     Resources:
     [📺] Python for Everybody (Coursera) · 8h · Free
     [📖] Automate the Boring Stuff (Book)  · 4h · Free
     [💻] Google's Python Class · 3h · Free

     Your progress:
     [████░░░░] 2 of 4 objectives completed

     [Practice this skill] [Mark as learned]
```

**User emotion:** "I can see what I need to learn, how long it takes, and where to start. No ambiguity."

**Information hierarchy:**
1. Skill name + difficulty + estimated time (top-level, always visible)
2. Confidence meter (at-a-glance progress)
3. Learning objectives (what "done" means)
4. Resources (how to get there)
5. Progress (how far along)
6. Actions (practice / mark done)

**AI involvement:**
- Learning objectives and curated resources come from the AI prompt at roadmap generation time
- No per-interaction AI calls — everything is pre-computed
- Only "Practice this skill" triggers a new AI call (generates quiz/project)

**Empty state (newly generated item, not started):**
```
[▸] Python · Intermediate · ~12 hours
      Ready to start. Open the first resource.
```

**Success state (item completed):**
```
[▸] Python · Intermediate · ~12 hours  ✓ Learned
     All objectives complete. Confidence: 80%
     [Practice this skill] → [Review material]
```

**Error state (resource link broken):**
If a student clicks a resource link that 404s, they can report it. A small flag icon next to the link. After 3 reports, that resource is deprioritized on future roadmap generations. (No model change — stored in existing PivotPlan notes field as `broken_link: true`.)

---

## Phase 5: Practice

### Practice Flow

**Trigger:** Student clicks "Practice this skill" on a roadmap item.

**Screen:** A modal/panel slides in from the right (40% width) showing:

**Tab 1: Knowledge Check (Quiz)**
```
┌─────────────────────────────────┐
│ Practice: Python                │
│                                 │
│ ┌── Knowledge Check ──────────┐│
│ │ Question 1 of 5             ││
│ │                             ││
│ │ What does the `map()`       ││
│ │ function do in Python?       ││
│ │                             ││
│ │ ○ Applies a function to     ││
│ │   every item in an iterable ││
│ │ ○ Creates a new dictionary  ││
│ │ ○ Maps values to keys       ││
│ │ ○ Returns memory address    ││
│ │                             ││
│ │ [Submit Answer]             ││
│ └─────────────────────────────┘│
│                                 │
│ ┌── Mini Project ─────────────┐│
│ │ Build a CLI weather app     ││
│ │ that takes a city name and  ││
│ │ returns the current         ││
│ │ temperature.                ││
│ │                             ││
│ │ [Upload evidence]           ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

**User emotion during quiz:** Focused. Low pressure (it's for me, not for a grade).

**AI involvement:** Quiz questions are generated by AI when the student clicks "Practice". Uses existing `quizGenerate` prompt. Quiz is 5 questions, always multiple choice (easy to evaluate).

**States:**

- **Quiz not started:** "Ready to test your [skill] knowledge? 5 questions, about 5 minutes."
- **Quiz in progress:** Current question with answer options. Progress indicator (2/5).
- **Quiz submitted:** "You scored 4/5. Great work!" Show correct/incorrect for each question.
- **Quiz failed (score < 60%):** "Keep practicing. You got 2/5. Here's a suggestion: review [specific objective] before retrying."
- **Project uploaded:** "Evidence submitted. Our AI will review it shortly." → After AI evaluation: "Project approved! [Skill] confidence increased to 70%."

**Success state:** Both quiz passed AND project submitted → RoadmapItem confidence increases. The item badge changes from "in-progress" to "practiced." The roadmap progress bar increments.

**Error state (AI evaluation fails):** "We couldn't evaluate your submission right now. Your project has been saved and will be reviewed." (Falls back to manual admin review, or retries on next visit.)

### Evidence Collection (Subtle)

Every practice action creates evidence in the background. The student doesn't see "Evidence created" — they see their confidence number go up and their roadmap progress bar advance.

**Design principle:** Evidence is invisible. Only the result (confidence, progress) is visible.

---

## Phase 6: Interview

### Readiness Signal

**Goal:** DATAD should proactively suggest interview practice when the student's confidence data indicates readiness.

**Trigger (automatic):** When >70% of the student's roadmap items have confidence >60, a new card appears on the dashboard:

```
┌─────────────────────────────────────────────┐
│  [Microphone icon]  Interview Ready         │
│                                             │
│  Your roadmap suggests you're ready to      │
│  start practicing interviews. 8 of 10       │
│  target skills are at 60%+ confidence.      │
│                                             │
│  [Start mock interview]  [Not yet]          │
└─────────────────────────────────────────────┘
```

**User emotion:** "Am I really ready? Let me try."

### Interview Practice

**Screen:** A full-page experience (not a modal — this deserves focus).

**Step 1: Interview Type**

```
What kind of interview?
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Technical      │  │   HR / Fit       │  │  Behavioural     │
│   Questions      │  │   Questions      │  │  (STAR)          │
│   8 questions    │  │   5 questions    │  │   5 questions    │
│   20 min         │  │   15 min         │  │   15 min         │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Step 2: The Interview**

```
┌─────────────────────────────────────────────────┐
│  Technical Interview · Question 3 of 8          │
│                                                 │
│  "Explain the difference between TCP and UDP.   │
│   When would you use each?"                     │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ [Type your answer here...]                   ││
│  │                                             ││
│  │ [Submit]                                    ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Hint: Think about reliability vs. speed.       │
│  [Request hint]                                 │
└─────────────────────────────────────────────────┘
```

**User emotion:** Like a real interview but safe. No judgment. No consequences. Pure practice.

**AI involvement:**
- Generates questions based on the student's roadmap items (focuses on skills with lower confidence)
- After each answer, AI provides a brief score and feedback (silently — score is shown later)
- After all questions, the full evaluation is shown

**Step 3: Feedback**

```
┌─────────────────────────────────────────────────┐
│  Interview Complete                             │
│                                                 │
│  Overall: 7.2/10                                │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ By skill:                                   ││
│  │ Python             8.5/10  ████████░        ││
│  │ System Design      6.2/10  ██████░░░        ││
│  │ Data Structures    7.0/10  ███████░░        ││
│  │ SQL                5.5/10  █████░░░░  ◄ Weak││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Skills scored below 6/10 have been added to    │
│  your roadmap as high-priority items.           │
│                                                 │
│  [Retry weak areas]  [Back to roadmap]          │
└─────────────────────────────────────────────────┘
```

**Emotional arc:** Nervous during interview → Curious during feedback → Empowered knowing exactly where to improve.

**Empty state (no interview yet):** "When you're ready, start a mock interview. It's private — only you see the results."

**Success state (interview completed):** The dashboard TodayFocus card shows: "Your last interview identified 2 weak areas. They've been added to your roadmap."

**Error state (AI timeout during interview):** "We lost connection mid-interview. Your answers up to question [N] have been saved. You can resume." (Progress is saved per-question).

---

## Phase 7: Placement

### What Happens When the Student Gets Placed

**Trigger:** Student marks themselves as placed (toggle on their profile or roadmap).

**Celebration Screen:**

```
┌─────────────────────────────────────────────┐
│                                             │
│         🎉 Congratulations!                 │
│                                             │
│         You got placed at Google!           │
│                                             │
│         From first roadmap to offer         │
│         in 5 months. 42 skills learned.     │
│         18 practice sessions. 3 interviews. │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │  Your journey                           ││
│  │                                         ││
│  │  ██████████████████░░  Roadmap: 90%     ││
│  │  ██████████████░░░░░░  Practice: 72%    ││
│  │  ████████████████████  Interviews: 100% ││
│  │  ████████░░░░░░░░░░░░  Learning: 40%    ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [Share your journey]  [Not now]            │
└─────────────────────────────────────────────┘
```

**User emotion:** Pride. Accomplishment. "I did this. DATAD helped, but I did this."

**Design principles:**
- The celebration is genuine, not gaudy. One confetti burst, then a clean summary.
- The numbers are specific and personal (not generic "You crushed it!")
- "Share your journey" generates a clean timeline card the student can post on LinkedIn or WhatsApp

### Roadmap Archive

**What happens to the roadmap:**
1. The current roadmap is frozen — no further generation
2. A "Completed" badge appears on the roadmap hero
3. The student can still view their roadmap history (all versions)
4. The roadmap becomes read-only

**Alumni Mode:**

After placement, the student enters "Alumni" mode:

```
┌─────────────────────────────────────────────┐
│  You're now in alumni mode.                 │
│                                             │
│  You can still access your data and         │
│  connect with current students.             │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │  Mentor incoming students               ││
│  │  Your placement journey can guide       ││
│  │  someone else's. Enable mentoring?      ││
│  │  [Yes, help others]  [Maybe later]      ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Your profile now shows:                    │
│  "Placed at Google · Batch 2026"            │
└─────────────────────────────────────────────┘
```

**Profile Evolution:**
- Profile gains a "Placement" section: company, role, offer date
- Student can share their learning timeline (public, opt-in)
- "Top skills" from their roadmap become a shareable badge/embed

**State if student leaves without marking placed:**
The roadmap remains active. If they come back 6 months later, they see: "It's been a while. Your roadmap might be stale. Want to regenerate based on where you are now?"

---

## Complete UX Map

```
                             ┌──────────┐
                             │  Student │
                             │  arrives │
                             └────┬─────┘
                                  │
                                  ▼
                          ┌─────────────────┐
                          │  Landing Page    │
                          │  "Know exactly   │
                          │  what to learn   │
                          │  next."          │
                          └────────┬─────────┘
                                   │ Clicks "Start"
                                   ▼
                          ┌─────────────────┐
                          │  Registration    │
                          │  (30 seconds)    │
                          └────────┬─────────┘
                                   │
                                   ▼
                     ┌─────────────────────────┐
                     │  Onboarding Flow         │
                     │  (5 steps, one per page) │
                     │                          │
                     │  1. Course/specialization │
                     │  2. Semester/year         │
                     │  3. Dream role            │
                     │  4. Current skills        │
                     │  5. Time commitment       │
                     └────────┬─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Resume Upload      │
                    │  (optional)          │
                    │                     │
                    │  Skills extracted → │
                    │  roadmap tailored   │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  Email Verification  │
                    │  (background wait)   │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  ✨ FIRST ROADMAP    │
                    │                     │
                    │  Target: [role]      │
                    │  10 skills to learn  │
                    │  ~80 hours total     │
                    │  3-month plan        │
                    │                     │
                    │  [Start learning]    │
                    └────────┬────────────┘
                             │
                             ▼
             ┌───────────────────────────────────┐
             │  DAILY LOOP (repeats)              │
             │                                    │
             │   ┌─────────────────────────┐       │
             │   │ Morning Dashboard       │       │
             │   │ (2 minutes)             │       │
             │   │                         │       │
             │   │ • Today's Focus         │       │
             │   │ • Daily check-in        │       │
             │   │ • Roadmap progress      │       │
             │   └──────────┬──────────────┘       │
             │              │                       │
             │              ▼                       │
             │   ┌─────────────────────────┐       │
             │   │ Expand roadmap item     │       │
             │   │ (anytime)               │       │
             │   │                         │       │
             │   │ • Learning objectives   │       │
             │   │ • Resources             │       │
             │   │ • Progress              │       │
             │   └──────────┬──────────────┘       │
             │              │                       │
             │              ▼                       │
             │   ┌─────────────────────────┐       │
             │   │ Practice (quiz/project) │       │
             │   │ (5-15 minutes)          │       │
             │   │                         │       │
             │   │ • Knowledge check       │       │
             │   │ • Mini project          │       │
             │   │ • Confidence updates    │       │
             │   └──────────┬──────────────┘       │
             │              │                       │
             └──────────────┼───────────────────────┘
                            │
                            │ Progress triggers:
                            │ 70%+ confidence →
                            ▼
                    ┌─────────────────────┐
                    │  Interview Ready     │
                    │  (suggested)         │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  Mock Interview      │
                    │  (20 minutes)        │
                    │                     │
                    │  • Technical / HR   │
                    │  • Scored feedback  │
                    │  • Weak areas →     │
                    │    new roadmap items│
                    └────────┬────────────┘
                             │
                             │ May loop back to
                             │ daily loop for
                             │ weak areas
                             ▼
                    ┌─────────────────────┐
                    │  REPEAT DAILY LOOP  │
                    │  + INTERVIEWS       │
                    │  until placed       │
                    └────────┬────────────┘
                             │
                             │ "I got placed!"
                             ▼
                    ┌─────────────────────┐
                    │  🎉 PLACEMENT       │
                    │                     │
                    │  Celebration screen │
                    │  Roadmap archived   │
                    │  Data preserved     │
                    │  Alumni mode        │
                    │  Mentoring option   │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  ALUMNI MODE        │
                    │                     │
                    │  Read-only timeline │
                    │  Mentor toggle      │
                    │  Share journey      │
                    │  Stay connected     │
                    └─────────────────────┘
```

---

## Design Principles (Summary)

1. **One action per screen.** Never give the student more than one thing to decide.

2. **Progress is visible everywhere.** The roadmap progress bar, confidence meters, and streak counter are always on screen.

3. **AI is invisible.** The student never "talks to AI." They see results — roadmap generated, quiz scored, interview feedback. The AI is the engine, not the interface.

4. **Empty states are invitations, not apologies.** "No practice sessions yet" → "Ready to test your skills?" with a button. Never just "Nothing here."

5. **Success states always include a number.** "Roadmap generated!" is weak. "10 skills identified · 80 hours planned · 3 months to completion" is strong.

6. **Error states never show raw errors.** "Something went wrong" is the worst error message. "We couldn't load your roadmap right now. Your data is safe — try refreshing." is better.

7. **The daily habit takes less than 5 minutes.** If the student has to think about what to do, the design failed. Today's Focus removes the thinking.

8. **Celebration is earned, not automatic.** Getting placed is a big deal. The celebration screen should feel like an achievement, not a notification.

9. **Every screen serves the roadmap.** If a screen doesn't help the student complete a roadmap item, it doesn't belong in the product.

10. **The student is the hero.** DATAD is the guide. The roadmap is the map. The placement is the destination. DATAD never claims credit — it gives the student the tools and gets out of the way.
