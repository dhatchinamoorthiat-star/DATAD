# Student Intelligence Graph (SIG)

## Product Design Specification — DATAD Pro Premium Experience

> *"Who am I becoming?"*
>
> This is the question every student asks in the middle of placement season, at 2 AM, after the third rejection, or before a big interview.
>
> The roadmap answers *"What should I do next?"*
> The Student Intelligence Graph answers **"Who am I becoming?"**

---

**Designer:** Principal AI Product Designer, Staff UX Architect, Cognitive Scientist
**Version:** 1.0 — July 23, 2026
**Status:** Complete Product Design Specification

---

# Table of Contents

1. [Product Vision](#1-product-vision)
2. [Why Students Would Pay](#2-why-students-would-pay)
3. [Information Architecture](#3-information-architecture)
4. [Screen-by-Screen User Journey](#4-screen-by-screen-user-journey)
5. [Complete UI Layout for Every Screen](#5-complete-ui-layout-for-every-screen)
6. [Component Hierarchy](#6-component-hierarchy)
7. [Intelligence Graph Architecture](#7-intelligence-graph-architecture)
8. [Career DNA Framework](#8-career-dna-framework)
9. [Weekly Intelligence Report Design](#9-weekly-intelligence-report-design)
10. [Future Simulation Experience](#10-future-simulation-experience)
11. [Opportunity Matching Experience](#11-opportunity-matching-experience)
12. [AI Insight Generation System](#12-ai-insight-generation-system)
13. [Empty States](#13-empty-states)
14. [Loading States](#14-loading-states)
15. [Motion Design](#15-motion-design)
16. [Micro Interactions](#16-micro-interactions)
17. [Animation Philosophy](#17-animation-philosophy)
18. [Notification System](#18-notification-system)
19. [Mobile-First Experience](#19-mobile-first-experience)
20. [Desktop Experience](#20-desktop-experience)
21. [Premium-Only Features](#21-premium-only-features)
22. [Data Model](#22-data-model)
23. [Intelligence Scoring Methodology](#23-intelligence-scoring-methodology)
24. [Privacy Considerations](#24-privacy-considerations)
25. [Future Expansion Roadmap](#25-future-expansion-roadmap)
26. [Daily Habit Formation](#26-features-that-create-daily-habit-formation)
27. [Emotional Attachment](#27-features-that-create-emotional-attachment)
28. [Switching Cost / Cancellation Resistance](#28-features-that-make-cancellation-psychologically-difficult)
29. [Inimitability](#29-what-makes-this-impossible-for-generic-ai-chatbots-to-replicate)
30. [Self-Critique & Redesign](#30-self-critique--redesign)

---

# 1. Product Vision

## 1.1 The Core Insight

Every interaction a student has with DATAD leaves a trace.

- A roadmap task completed
- A mock interview session
- A resume revision
- A practice question answered
- A reflection journal entry
- A Dax conversation about career choices
- A study streak continued
- A finance budget balanced
- A community discussion posted
- An internship application submitted

Each of these is *evidence*.

Not a score. Not a badge. **Evidence.**

The Student Intelligence Graph is the first system to collect all of this evidence, infer the student's evolving capabilities from it, and show them who they are becoming — not just what they've done.

## 1.2 The Tagline

**"Watch yourself grow."**

Three words. Not about productivity. About *becoming*.

## 1.3 What SIG Is

- A **living intelligence model** of the student's evolving capabilities
- A **personality system** (Career DNA) that adapts in real time
- A **prediction engine** that estimates multiple possible futures
- An **opportunity matching system** that scores every opportunity against the student's intelligence graph
- A **weekly AI-generated report** that reads like a mentor's letter

## 1.4 What SIG Is NOT

- ❌ A dashboard with KPIs
- ❌ A gamification layer (no XP, badges, levels, streaks as numbers)
- ❌ A resume score
- ❌ A LinkedIn-style profile completeness meter
- ❌ A chatbot conversation
- ❌ A static analytics page

## 1.5 The Apple Health Moment

Apple Health succeeded not because it tracked steps, but because it made health *visible, temporal, and personal* for the first time on a phone.

SIG must be the Apple Health moment for student careers.

Before SIG, students guess how they're doing by:
- How many rejections they've received
- Comparing themselves to friends
- Intuition and anxiety

After SIG, students *know*:
- Their learning velocity trajectory
- Which capabilities are accelerating
- Where their blind spots are
- What their Career DNA says about them
- How their future looks across different scenarios
- Which opportunities genuinely fit them

## 1.6 2028 Vision

Three years from now:

- SIG has 18+ months of behavioral data per student
- SIG can predict placement timing within 2 weeks
- SIG's Career DNA becomes the student's professional identity — more real than their LinkedIn profile
- Companies use SIG compatibility matching (with student consent) during campus recruitment
- SIG detects burnout 3 weeks before the student consciously feels it
- The Weekly Intelligence Report is something students look forward to reading, not ignore
- Students say "my SIG grew this week" the way athletes say "I got stronger"

---

# 2. Why Students Would Pay

## 2.1 The Emotional Argument

Every student experiences moments of profound uncertainty:

- *"Am I on the right track?"*
- *"Why did I get rejected when my friend didn't?"*
- *"What am I actually good at?"*
- *"Will I get placed before graduation?"*
- *"Should I switch from finance to consulting?"*

These questions cause real anxiety. Students lose sleep over them. They make bad decisions because they lack data about themselves.

SIG answers these questions with evidence, not intuition.

**A student who has SIG has a superpower: self-knowledge.**

## 2.2 The Practical Argument

**1. Better opportunity selection.** Instead of applying to 100 jobs blindly, SIG shows which opportunities match the student's actual capability profile (not just keywords). Higher hit rate. Less rejection fatigue.

**2. Targeted growth.** Instead of improving everything vaguely, SIG shows the 1-2 dimensions that would unlock the next stage. Maximum ROI per unit effort.

**3. Future visibility.** Instead of wondering "will I make it?", students can simulate different paths and see the estimated outcomes. This turns anxiety into a plan.

**4. The Weekly Report.** A personalized analysis of their growth that reads like a mentor wrote it. Most students have never received anything like this.

**5. Career DNA.** A professional identity that evolves with them. No other tool offers this.

## 2.3 The Switching Cost

Once a student has 3+ months of SIG data:
- The trajectory predictions become accurate
- The Career DNA reflects genuine behavioral patterns
- The Weekly Reports build a narrative of growth
- The opportunity matches learn the student's profile

Starting over with a different tool means losing 3+ months of this intelligence.

This is why cancellation feels like burning a journal, not canceling a subscription.

## 2.4 Pricing Positioning

SIG is **the** reason to subscribe to Pro.

| Tier | SIG Access |
|------|------------|
| Free | Basic graph view — see your dimensions (read-only, no predictions, no reports) |
| Pro (₹299/mo) | Full graph + Weekly Intelligence Report + Career DNA + Opportunity Matching + 2 future simulations/mo |
| Max (₹499/mo) | Everything Pro + Unlimited simulations + Priority AI insights + Career DNA coaching + Advanced predictions |

The Free tier shows just enough to create *desire*. The student sees the shape of their intelligence but cannot interact with it deeply — creating an intrinsic motivation to upgrade.

---

# 3. Information Architecture

## 3.1 Entry Point

SIG is accessed from the **Living Surface** (DATAD's ambient home interface). A subtle, organic node cluster sits in the top-right quadrant — always there, always alive. Tapping it opens the full graph.

There is no SIG link in a sidebar. No tab. No menu item.

The graph is an ambient presence, discovered through exploration.

## 3.2 Information Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    SIG — Primary Screen                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LAYER 0: The Living Graph (always present)              │ │
│  │  - Force-directed node cluster                           │ │
│  │  - Each node = one intelligence dimension                │ │
│  │  - Edges pulse with strength of correlation              │ │
│  │  - Nodes breathe with activity level                     │ │
│  │  - Interactive: drag, tap, pinch                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: Dimension Detail (tap a node)                  │ │
│  │  - Dimension name + current estimate                     │ │
│  │  - Trajectory: trend line over time                      │ │
│  │  - Evidence sources that contributed                     │ │
│  │  - AI insight about this dimension                       │ │
│  │  - Related dimensions (edges light up)                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: Career DNA (swipe up from bottom)              │ │
│  │  - Current DNA archetype(s)                              │ │
│  │  - Sub-dimensions that define each                        │ │
│  │  - Evolution over time (which archetypes emerged when)   │ │
│  │  - AI interpretation                                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: Weekly Intelligence Report (swipe left)        │ │
│  │  - Full-screen immersive report                          │ │
│  │  - Narrated by AI                                        │ │
│  │  - Animated data stories                                 │ │
│  │  - Timeline of evidence                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LAYER 4: Future Simulations (deep link or button)       │ │
│  │  - Simulate My Future experience                         │ │
│  │  - Parallel timeline visualizations                      │ │
│  │  - "What if" scenario builder                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LAYER 5: Opportunity Matching (contextual)              │ │
│  │  - Appears on internships, jobs, hackathons pages        │ │
│  │  - Compatibility score                                   │ │
│  │  - "Why this match" explanation                          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 3.3 Navigation Model

The SIG uses **spatial navigation**, not tabs.

- **Center:** The living graph (always the anchor)
- **Swipe up:** Career DNA panel
- **Swipe left:** Weekly Intelligence Report
- **Swipe right back:** Return to graph
- **Tap node:** Dimension drill-down
- **Tap & hold any insight:** Save/share
- **Two-finger gesture:** Open future simulation

This is a *gesture vocabulary*, not a tab bar. It feels like exploring a living thing, not navigating an app.

---

# 4. Screen-by-Screen User Journey

## 4.1 Journey: First Launch (New User, No Data)

### Step 1: Entering SIG
User taps the ambient graph cluster on the Living Surface.

**What they see:** A dark, empty space with one faint light at the center. Surrounding it, a constellation of 20+ dim nodes, barely visible — like stars before dawn. A soft pulse emanates from the center.

**What they feel:** Curiosity. Mystery. "What is this?"

**AI text (subtle, fades in):**
> *"Your graph is empty. Every interaction with DATAD will light a node. Start exploring, and watch yourself grow."*

### Step 2: First Interaction
User completes a roadmap task.

**What they see:** The "Execution Ability" node flickers, then holds a soft glow. A thin thread of light connects it to the center.

**AI notification (push, not banner):**
> *"We noticed you completed your first task. Execution Ability is your first active dimension."*

### Step 3: The Graph Awakens (Day 3-5)
User has done several things: completed tasks, chatted with Dax, written a journal entry, updated resume.

**What they see:** Multiple nodes now glowing at different intensities. A web of light connecting them. The graph is visibly alive.

**AI insight (appears as floating text near the brightest node):**
> *"Your strongest signal so far is Career Clarity. You've been exploring career paths more than any other dimension."*

### Step 4: First Career DNA Emergence (Day 7-10)
**What they see:** The graph shimmers. A new overlay appears — the Career DNA panel (swipe up). The AI has detected a pattern.

**AI insight:**
> *"Based on your activities this week, you're expressing an Explorer archetype. You're gathering information, trying different paths. This is normal. The archetype will sharpen as you go deeper."*

## 4.2 Journey: Active User (2-4 Weeks)

### Step 1: Daily Check-In
User opens DATAD. The Living Surface shows the graph in its ambient state.

**What they see:** Nodes pulsing at different rhythms. The ones they interacted with most recently glow brighter. A subtle connecting line between "Consistency" and "Learning Velocity" is thicker than yesterday.

**AI insight (ambient, no notification):**
> *"Your consistency is starting to accelerate your learning velocity. This connection is strengthening."*

### Step 2: Weekly Intelligence Report Arrives
Push notification: *"Your Week 3 Intelligence Report is ready."*

**What they see:** A full-screen report that scrolls like a beautiful long-form article, not a dashboard. Animated data visualizations. Narrative text. Sections flow like chapters.

**Headline:**
> *"You're building momentum. Your learning velocity increased 23% this week — your fastest growth yet."*

**Sections:**
- *"The Story of Your Week"* — narrative summary
- *"What Accelerated"* — dimensions with positive trajectory
- *"What Needs Attention"* — gentle noticing, not criticism
- *"Your Career DNA Update"* — how the archetype evolved
- *"Evidence Collected"* — timeline of important interactions
- *"One Recommendation"* — single highest-impact action
- *"Looking Ahead"* — prediction for next week

### Step 3: Exploring a Dimension
User taps "Learning Velocity" node.

**What they see:**
- A beautiful curve showing the trajectory over time
- Evidence sources listed with dates: study streaks, completed courses, practice sessions
- An AI insight specific to this dimension
- Related dimensions pulsing: "Consistency" (highest correlation), "Curiosity" (second)
- A subtle indicator: "This dimension is 34% correlated with Career Readiness"

**AI insight:**
> *"Your Learning Velocity spikes every time you complete a study streak of 5+ days. Short bursts don't move it — sustained effort does."*

### Step 4: First Future Simulation (Pro Feature)
User navigates to Simulate My Future.

**What they see:** A branching visualization. Two parallel timelines.

**Scenario A: "Continue Current Pace"**
- Estimated interview readiness: 8 weeks
- Estimated placement range: Top 40% of batch
- Confidence evolution: gradual increase
- Salary trajectory: estimated range

**Scenario B: "Accelerate (Add 2 projects + mock interviews)"**
- Estimated interview readiness: 5 weeks
- Estimated placement range: Top 20% of batch
- Confidence evolution: faster increase
- Salary trajectory: higher estimated range

**AI insight:**
> *"Adding mock interviews compounds faster than adding projects — because confidence is your limiting factor right now, not technical depth."*

## 4.3 Journey: Established User (3+ Months)

### Step 1: The Graph is Rich
**What they see:** A dense, beautiful constellation of 20+ nodes, all glowing, with a complex web of connections. The graph has personality — some nodes dominate, others are smaller, connections vary in thickness.

**AI insight (ambient, on open):**
> *"Your graph looks different from 3 months ago. Leadership Potential has grown faster than all other dimensions. Your Career DNA shifted from Explorer → Builder → Leader."*

### Step 2: Career DNA is Confident
**What they see:** The DNA panel now shows a primary archetype (Leader) with secondary signals (Analyst, Communicator). Sub-dimensions are clearly defined.

**AI insight:**
> *"You're a Leader-Analyst. You naturally organize people AND data. Students with this combination typically excel in consulting and product management. Your interview prep should emphasize case studies and strategic thinking."*

### Step 3: Opportunity Matching
User browses internships. Each listing now shows a compatibility score.

**What they see:**
- *"Strategy Intern at McKinsey"* — **92% match**
  - *Why: Your Leader-Analyst DNA matches consulting; your Career Clarity score is high; your preparation trajectory aligns with interview timelines*
- *"Data Analyst at Swiggy"* — **78% match**
  - *Why: Your Analytical Thinking is strong; but your Leadership score is underutilized in this role*
- *"Software Engineer at Google"* — **45% match**
  - *Why: Your Technical Depth dimension is below the threshold for competitive SDE roles; consider building projects first*

**What they feel:** This is not a search. This is a mirror.

### Step 4: Predicting Placement
**AI insight (in Weekly Report):**
> *"At your current trajectory, you're projected to reach interview readiness in 3-4 weeks. Students with similar Career DNA and trajectory received offers from consulting firms within 5-7 weeks of reaching readiness. Your estimated placement window: Mid-September to Mid-October."*

This is the moment the student realizes the system sees something they can't.

---

# 5. Complete UI Layout for Every Screen

## 5.1 The Living Graph (Primary Screen)

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│   ┌──────────────────────────────────────────────────┐ │
│   │                                                  │ │
│   │        ● ●        ●                             │ │
│   │     ●       ●  ●       ●                        │ │
│   │   ●    ●         ●    ●                         │ │
│   │       ◇─────────────◇                            │ │
│   │   ●  │   CENTER     │  ●    ●                    │ │
│   │   ●  │  (Self)      │●      ●                    │ │
│   │       ◇─────────────◇      ●                     │ │
│   │     ●  ●    ●   ●  ●      ●                      │ │
│   │   ●        ●        ●     ●                      │ │
│   │        ●     ●         ●                         │ │
│   │                                                  │ │
│   └──────────────────────────────────────────────────┘ │
│                                                        │
│   ┌─Floating Elements───────────────────────────────┐  │
│   │ [Evolving...]  [Career DNA: Explorer]  [≡]      │  │
│   └────────────────────────────────────────────────┘  │
│                                                        │
│   ┌─Bottom Sheet Handle───────────────────────────┐   │
│   │ ────  (swipe up for Career DNA)               │   │
│   └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Layout notes:**
- Full-screen, no traditional toolbar
- Graph uses the entire canvas
- Central "Self" node is slightly larger, always centered
- Dimension nodes orbit at varying distances based on relevance
- Edge thickness = correlation strength
- Node brightness = recent activity level
- Node size = overall signal strength
- Ambient particles float between connected nodes
- Floating elements are translucent glass panels at top
- Bottom sheet handle is the only persistent UI element

## 5.2 Dimension Detail (Tap Node)

```
┌──────────────────────────────────────────────────────┐
│                                                  ←    │
│                                                        │
│  Learning Velocity                                     │
│  ────────────────────────────────────────              │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Trajectory (last 30 days)                       │  │
│  │  ╱╲   ╱╲  ╱╲                                      │  │
│  │ ╱  ╲ ╱  ╲╱  ╲╱╲  ╱╲  ╱╲                          │  │
│  │╱    ╲          ╲╱  ╲╱  ╲╱╲                        │  │
│  │     Trend: +18% this week                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Evidence (last 7 days)                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📚 Study streak (5 days)             3d ago      │  │
│  │ 📝 Practice session (aptitude)       2d ago     │  │
│  │ 📖 Completed SQL module               1d ago      │  │
│  │ 💬 Dax discussion: DCF modeling      today       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Insight                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ "Your velocity accelerates when you combine      │  │
│  │  practice sessions with study streaks. Solo      │  │
│  │  study has a weaker effect."                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Related Dimensions (tap to navigate)                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│  │ Consistency │ │ Curiosity  │ │ Execution  │        │
│  │ (92% corr)  │ │ (76% corr) │ │ (54% corr) │        │
│  └────────────┘ └────────────┘ └────────────┘        │
└──────────────────────────────────────────────────────┘
```

**Layout notes:**
- Slides in from the right, overlaying the graph (90% width)
- Graph remains faintly visible behind (depth effect)
- Trajectory chart uses organic curves, not rigid lines
- Evidence listed chronologically with icons
- Insight card has a subtle glow animation
- Related dimensions are tappable pills
- Dismiss by tapping ← or swiping right

## 5.3 Career DNA Panel (Swipe Up)

```
┌──────────────────────────────────────────────────────┐
│ ────  Drag handle                                    │
│                                                        │
│  Your Career DNA                                       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Primary: BUILDER                               │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │  Building things that work.                  │ │  │
│  │  │  You focus on execution, iteration, results.  │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  │                                                    │  │
│  │  Secondary: ANALYST                               │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │  You naturally seek patterns before acting.   │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Archetype Evolution                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Explorer ──→ Builder ──→ Builder-Analyst         │  │
│  │ (wk 1-2)     (wk 3-4)    (wk 5-6)               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Sub-Dimensions                                        │
│  ┌────────────────────┬────────────────────┐          │
│  │ Execution Ability  │ Analytical Thinking │          │
│  │ ████████░░ 82      │ ██████░░░░ 64      │          │
│  │ (+12% this month)  │ (+5% this month)   │          │
│  ├────────────────────┼────────────────────┤          │
│  │ Problem Solving    │ Business Thinking  │          │
│  │ ███████░░░ 70      │ █████░░░░░ 55      │          │
│  │ (+8% this month)   │ (+15% this month)  │          │
│  └────────────────────┴────────────────────┘          │
│                                                        │
│  Insight                                                │
│  "Your Builder archetype emerged when you started     │
│   completing roadmap tasks consistently. The Analyst   │
│   signal is newer — it appeared after you began        │
│   journaling about case studies."                       │
│                                                        │
│  [Explore Career DNA ⟶]                                │
└──────────────────────────────────────────────────────┘
```

**Layout notes:**
- Slides up from bottom, covering 70% of screen
- Glassmorphism background — graph visible through it
- Primary archetype is large, with a subtle badge/animation
- Sub-dimensions as horizontal bars with percentage and delta
- Evolution timeline as horizontal scrollable path
- Deep link at bottom for full DNA exploration page

## 5.4 Weekly Intelligence Report (Full Screen)

The WIR is designed as an **immersive reading experience**, not a report page.

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Your Intelligence Report                              │
│  Week 3 · Jul 17–23                                   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  "You're building momentum."                     │  │
│  │  Your learning velocity increased 23% this week  │  │
│  │  — your fastest growth yet.                      │  │
│  │                                                  │  │
│  │  ──  Continue reading                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─Section Divider──────────────────────────────────┐  │
│  │ The Story of Your Week                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  This week, you focused on skill-building. Three       │
│  study sessions, one mock interview, and a resume      │
│  revision. Your consistency streak grew to 14 days.    │
│                                                        │
│  The most interesting signal: your analytical thinking │
│  score increased after the mock interview — not during │
│  study. This suggests you learn faster under pressure. │
│                                                        │
│  ┌─Visual: Weekly Activity Timeline─────────────────┐  │
│  │  Mon ██░░  Tue ███░  Wed ██░░  Thu ████  Fri ██  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─Section Divider──────────────────────────────────┐  │
│  │ What Accelerated                                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  • Learning Velocity ↑ 23%  (fastest gain)            │
│  • Career Clarity ↑ 15%  (continued exploration)      │
│  • Consistency ↑ 12%  (14-day streak)                 │
│                                                        │
│  ┌─Visual: Dimension Radar Chart────────────────────┐  │
│  │  (radar chart showing all dimensions, with       │  │
│  │   this week's overlay vs last week's)             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─Section Divider──────────────────────────────────┐  │
│  │ One Thing to Do This Week                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Your Confidence dimension is lagging behind your      │
│  actual capability. One mock interview will likely     │
│  close this gap more than anything else.                 │
│                                                        │
│  [Schedule a Mock Interview ⟶]                         │
│                                                        │
│  ┌─Section Divider──────────────────────────────────┐  │
│  │ Looking Ahead                                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  At current trajectory:                                │
│  Interview readiness in ~5 weeks                       │
│  Projected placement: Top 30% of batch                 │
│                                                        │
│  [Explore Future Simulations ⟶]                        │
│                                                        │
└──────────────────────────────────────────────────────┘
```

**Layout notes:**
- Full screen, scrollable
- Beautiful typography-first design
- No charts that look like dashboards — data is woven into narrative
- Each section has a subtle visual divider
- Action buttons are minimal, contextual
- The opening headline is large and emotionally freighted
- Can be shared as an image (PNG export with SIG branding)

## 5.5 Future Simulation (Full Screen)

```
┌──────────────────────────────────────────────────────┐
│  Simulate My Future                               ←    │
│                                                        │
│  ┌─Current Path─────────────────────────────────────┐  │
│  │  Your baseline: continuing your current habits    │  │
│  │                                                    │  │
│  │  Interview Readiness: ████████████░░░░░░  5 weeks  │  │
│  │  Confidence:          ██████████░░░░░░░░  68/100   │  │
│  │  Placement Range:     Top 30-40% of batch          │  │
│  │  Salary Estimate:     ₹12-16 LPA                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─Scenario Builder─────────────────────────────────┐  │
│  │  Add changes to your plan:                        │  │
│  │                                                    │  │
│  │  [+ Finish SQL module]     ── +3wks ──           │  │
│  │  [+ 2 mock interviews/week] ── +2wks ──          │  │
│  │  [+ Complete 1 project]    ── +2wks ──           │  │
│  │                                                    │  │
│  │  [Simulate This Path ⟶]                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─Comparison View (after simulation)──────────────┐  │
│  │  Baseline         │  Simulated Path              │  │
│  │  ─────────────────┼─────────────────────         │  │
│  │  5 weeks to ready │  3 weeks to ready            │  │
│  │  Top 30-40%       │  Top 15-25%                  │  │
│  │  ₹12-16 LPA       │  ₹16-22 LPA                  │  │
│  │                    │                               │  │
│  │  "Adding mock interviews has an outsized effect  │  │
│  │   because it improves both skill AND confidence   │  │
│  │   simultaneously."                                 │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Layout notes:**
- Full screen with dark background
- Parallel timeline visualization (two paths side by side)
- Scenario builder uses pill components for levers
- Results animate into view after simulation runs
- The AI insight is the most prominent text after results
- Each simulated parameter is a beautiful glass card

## 5.6 Opportunity Matching (Embedded)

Appears on existing opportunity pages (Internships, Jobs, Hackathons, Scholarships):

```
┌──────────────────────────────────────────────────────┐
│  Strategy Intern @ McKinsey                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ◇ 92% Match                                      │  │
│  │                                                   │  │
│  │ Why this fits you:                                │  │
│  │ • Your Career DNA (Leader-Analyst) matches        │  │
│  │   consulting archetype (91% historical accuracy)  │  │
│  │ • Career Clarity is in your top 3 dimensions      │  │
│  │ • Your preparation trajectory aligns with         │  │
│  │   interview timelines (4-6 weeks)                 │  │
│  │                                                   │  │
│  │ Gaps to address:                                  │  │
│  │ • Case interview practice (low: 32/100) —         │  │
│  │   this is the single biggest impact action        │  │
│  │                                                   │  │
│  │ [View Matching Details ⟶]  [Apply Now]           │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

# 6. Component Hierarchy

```
SIGContainer
├── SIGAmbientEntry (on Living Surface)
│   ├── NodeCluster (ambient mini-graph)
│   ├── PulsingIndicator (subtle activity notification)
│   └── GestureDetector (tap to open full graph)
│
├── SIGGraphScreen (primary full-screen view)
│   ├── GraphCanvas
│   │   ├── ForceSimulation (physics engine)
│   │   ├── CentralNode ("Self")
│   │   ├── DimensionNodes (20+ nodes, one per dimension)
│   │   │   ├── NodeGlow (intensity = activity)
│   │   │   ├── NodePulse (rhythm = recency)
│   │   │   └── NodeLabel (dimension name, appears on hover/tap)
│   │   ├── EdgeLines (connections between nodes)
│   │   │   ├── EdgeThickness (correlation strength)
│   │   │   ├── EdgeAnimation (pulse flow along line)
│   │   │   └── EdgeLabel (correlation %, on hover)
│   │   └── AmbientParticles (floating between connected nodes)
│   ├── TopFloatingPanel
│   │   ├── StatusIndicator ("Evolving...")
│   │   ├── CareerDNABadge (current primary archetype)
│   │   └── MenuButton (settings, share, help)
│   └── BottomSheetHandle
│       └── SwipeUpIndicator ("Career DNA")
│
├── DimensionDetailSheet (overlay, 90% width, right slide-in)
│   ├── Header
│   │   ├── BackButton
│   │   ├── DimensionName
│   │   └── TrendIndicator (direction + magnitude)
│   ├── TrajectoryChart
│   │   ├── OrganicCurve (30-day sliding window)
│   │   ├── TrendLine (7-day moving average)
│   │   └── Annotations (events that caused spikes)
│   ├── EvidenceFeed
│   │   └── EvidenceCards (scrollable)
│   │       ├── EvidenceIcon
│   │       ├── EvidenceDescription
│   │       └── EvidenceTimestamp
│   ├── InsightCard
│   │   ├── InsightText (AI-generated)
│   │   └── InsightSource (which model/data)
│   └── RelatedDimensions
│       └── DimensionPills (tappable, navigate to that dimension)
│
├── CareerDNAPanel (bottom sheet, 70% height)
│   ├── ArchetypeCard (primary)
│   │   ├── ArchetypeName (large typography)
│   │   ├── ArchetypeDescription
│   │   └── ArchetypeBadge (subtle animation)
│   ├── SecondaryArchetypeCard
│   ├── ArchetypeEvolutionTimeline
│   │   └── EvolutionStages (horizontal scrollable path)
│   ├── SubDimensionGrid
│   │   └── SubDimensionCards (2×2 or 3×2 grid)
│   │       ├── DimensionName
│   │       ├── ProgressBar (soft gradient)
│   │       └── DeltaIndicator (change since last week)
│   └── DNAInsight
│
├── WeeklyIntelligenceReport (full-screen immersive)
│   ├── ReportHeader
│   │   ├── WeekLabel
│   │   ├── DateRange
│   │   └── ShareButton
│   ├── HeroSection
│   │   ├── Headline (large emotional typography)
│   │   ├── Subheadline
│   │   └── ScrollDownIndicator
│   ├── NarrativeSections (scrollable, sectioned)
│   │   ├── StoryOfYourWeek
│   │   ├── WhatAccelerated
│   │   │   └── AccelerationCards
│   │   ├── WhatNeedsAttention
│   │   │   └── AttentionCards
│   │   ├── EvidenceTimeline
│   │   ├── OneRecommendation
│   │   └── LookingAhead
│   └── ActionFooter
│       ├── ScheduleMockInterview
│       ├── OpenSimulations
│       └── ShareReport
│
├── FutureSimulationScreen
│   ├── CurrentPathCard
│   ├── ScenarioBuilder
│   │   ├── ScenarioActions (addable/removable pills)
│   │   └── SimulateButton
│   ├── ComparisonView
│   │   ├── BaselineColumn
│   │   └── SimulatedColumn
│   └── SimInsight
│
├── OpportunityMatchCard (reusable, embeddable)
│   ├── MatchScore (prominent percentage)
│   ├── MatchBreakdown
│   │   ├── PositiveFactors (green)
│   │   └── GapFactors (amber)
│   └── ActionButtons
│
├── SIGEmptyState
│   ├── ConstellationIllustration (animated, dim nodes)
│   ├── OnboardingMessage
│   └── FirstStepsHint
│
├── SIGLoadingState
│   ├── NodePlaceholders (pulsing skeletons)
│   ├── ParticleAnimation (ambient while loading)
│   └── LoadingMessage (rotating insights)
│
└── SIGNotifications
    ├── InsightBanner (ambient, non-intrusive)
    ├── DimensionAlert (significant change detected)
    ├── ReportReady (push notification)
    └── MilestoneCelebration (achievement, not gamification)
```

---

# 7. Intelligence Graph Architecture

## 7.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STUDENT INTELLIGENCE GRAPH                        │
│                                                                       │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐    │
│  │  Event Bus    │───▶│  Evidence Store  │───▶│  Inference       │    │
│  │  (collectors) │    │  (weighted logs) │    │  Engine (Bayes)  │    │
│  └──────────────┘    └─────────────────┘    └────────┬─────────┘    │
│                                                       │               │
│                        ┌──────────────────────────────┼──────────┐   │
│                        │           LAYER 1            │          │   │
│                        │  ┌───────────────────────────▼────────┐ │   │
│                        │  │  Dimension Estimates                │ │   │
│                        │  │  (25+ continuous scores 0-100)     │ │   │
│                        │  │  Each with: value, confidence,     │ │   │
│                        │  │  trend, velocity, acceleration     │ │   │
│                        │  └───────────────────┬────────────────┘ │   │
│                        └──────────────────────┼──────────────────┘   │
│                                                │                     │
│                        ┌───────────────────────┼──────────────┐      │
│                        │       LAYER 2         │              │      │
│                        │  ┌────────────────────▼─────────────┐│      │
│                        │  │  Career DNA Engine                ││      │
│                        │  │  (Adaptive archetype classifier)  ││      │
│                        │  │  Input: dimension vector →        ││      │
│                        │  │  Output: primary/secondary        ││      │
│                        │  │  archetypes with confidence       ││      │
│                        │  └────────────────┬──────────────────┘│      │
│                        └───────────────────┼───────────────────┘      │
│                                            │                         │
│                        ┌───────────────────┼──────────────┐          │
│                        │      LAYER 3      │              │          │
│                        │  ┌────────────────▼─────────────┐│          │
│                        │  │  Prediction Engine             ││          │
│                        │  │  (Time-series forecasting)    ││          │
│                        │  │  Outputs: readiness, timeline, ││          │
│                        │  │  salary, placement probability ││          │
│                        │  └────────────────┬──────────────┘│          │
│                        └───────────────────┼───────────────┘          │
│                                            │                          │
│                        ┌───────────────────┼──────────────┐           │
│                        │      LAYER 4      │              │           │
│                        │  ┌────────────────▼─────────────┐│           │
│                        │  │  Report Generator             ││           │
│                        │  │  (LLM + template + scores)   ││           │
│                        │  │  Weekly Intelligence Report  ││           │
│                        │  └──────────────────────────────┘│           │
│                        └──────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## 7.2 Data Sources (Collectors)

The existing Student Intelligence Layer collectors are the foundation. SIG extends them:

| Existing Collector | Extension for SIG |
|---|---|
| identityCollector | + Learning style, goal clarity, confidence meta-data |
| memoryCollector | + Behavioral patterns, preference stability, topic depth |
| taskCollector | + Task completion rate, time-to-complete, consistency scoring |
| noteCollector | + Note depth analysis, topic breadth, concept mastery |
| plannerCollector | + Plan accuracy, completion ratio, gap closure rate |
| careerCollector | + Skill depth scoring, application effectiveness ratio |
| learningCollector | + Learning velocity, retention inference, peak performance times |
| activityCollector | + Query novelty, exploration breadth, learning mode detection |
| stressCollector | + Trend analysis, recovery patterns, resilience score |

**New SIG-specific collectors:**

| SIG Collector | Purpose |
|---|---|
| `communicationCollector` | Analyzes Dax conversation quality, peer discussion depth, presentation prep |
| `leadershipCollector` | Detects mentoring activity, project leadership, community contributions |
| `curiosityCollector` | Measures topic exploration breadth, novel query frequency, learning beyond curriculum |
| `confidenceCollector` | Infers from interview performance, decision speed, application volume vs quality |
| `focusCollector` | Detects session depth, context-switching patterns, sustained attention duration |
| `adaptabilityCollector` | Measures response to schedule changes, topic switching, rejection recovery |
| `feedbackCycler` | Closes the loop: user reactions to insights improve future estimates |

## 7.3 The Event Bus

Every collector pushes typed events:

```typescript
interface SIGEvent {
  eventType: string;       // "task.completed" | "interview.done" | "note.created" ...
  userId: string;
  timestamp: Date;
  payload: Record<string, any>;
  weight: number;          // 0.0 - 1.0 (evidence strength)
  source: string;          // "system" | "ai-inferred" | "user-confirmed"
}
```

Events flow through:
1. **Validation** — schema check, dedup
2. **Weighting** — event weight × recency multiplier (temporal decay)
3. **Storage** — written to `SIGEvent` collection (append-only)
4. **Inference trigger** — if significant weight accumulated, trigger inference engine

## 7.4 The Inference Engine

The core of SIG. Uses a Bayesian approach to estimate latent dimensions from observed evidence.

**Math (simplified):**

Each dimension `D` has:
- Prior: `P(D)` — initialized from population baseline
- Likelihood: `P(E|D)` — how likely this evidence is given the dimension level
- Posterior: `P(D|E) ∝ P(E|D) × P(D)` — updated after each evidence event

**Implementation:**

```typescript
interface DimensionEstimate {
  dimensionId: string;
  currentValue: number;          // 0-100
  confidence: number;            // 0-100 (how much evidence supports this)
  trend: 'accelerating' | 'stable' | 'decelerating';
  velocity: number;              // rate of change (points/week)
  acceleration: number;          // change in velocity
  lastUpdated: Date;
  evidenceCount: number;
  topContributors: SIGEvent[];   // top 5 most impactful events
}
```

**Key property:** Confidence is as important as the value. A dimension at 68 with 90% confidence is more useful than one at 72 with 30% confidence.

## 7.5 Edge Inference

Edges between dimensions are computed from correlations in the evidence stream:

```
edge_correlation(D1, D2) = Pearson's r over last 30 days of evidence
edge_strength = |r| × recency_factor × mutual_evidence_count
```

Edges are not static. They evolve as the student grows.

An edge may show:
- **Strong positive correlation** (0.7): "Your consistency directly drives learning velocity"
- **Weak or negative** (-0.2): "Your career exploration does not correlate with execution right now"
- **Emerging** (recently crossed threshold): "We're seeing a new connection between communication and confidence"

## 7.6 Temporal Decay

Evidence loses weight over time. The decay function:

```
weight(t) = base_weight × e^(-λ × days_since_event)
```

Where λ (lambda) controls decay rate:
- λ = 0.05: significant evidence for ~60 days
- λ = 0.02: moderate evidence for ~150 days
- λ = 0.01: background signal for ~300 days

Different evidence types have different λ:
- Task completion: λ = 0.03 (moderate decay)
- Mock interview: λ = 0.02 (slower decay — more significant)
- Daily reflection: λ = 0.05 (faster decay — state-specific)
- Resume update: λ = 0.01 (very slow decay — structural)

---

# 8. Career DNA Framework

## 8.1 Design Principles

1. **Not MBTI. Not Big Five.** DATAD's Career DNA is original, grounded in student behavior, not psychology pop-science.
2. **Evolving, not fixed.** DNA changes as the student gathers new experiences.
3. **Emergent from evidence.** The system does not ask the student to classify themselves. It observes and infers.
4. **Predictive, not descriptive.** The purpose of DNA is not to label but to recommend.

## 8.2 The Archetypes

SIG defines 8 archetypes, mapped across two axes:

**Axis 1: Action Style** — Builder ↔ Explorer
- Builders execute, iterate, produce
- Explorers investigate, learn, discover

**Axis 2: Thinking Mode** — Analyst ↔ Strategist
- Analysts decompose, optimize, verify
- Strategists synthesize, envision, connect

The four quadrants produce 4 primary archetypes. Each has a social counterpart:

```
               ANALYST
                  │
                  │
    CREATOR       │       RESEARCHER
    (Build+       │       (Explore+
     Analyze)     │       Analyze)
                  │
━━━━━━━━━━━━━━━━━┼━━━━━━━━━━━━━━━━━ BUILDER
                  │
    COMMUNICATOR  │       EXPLORER
    (Build+       │       (Explore+
     Strategize)  │       Strategize)
                  │
             STRATEGIST
```

| Archetype | Core | Strengths | Blind Spots |
|-----------|------|-----------|-------------|
| **Builder** | Execution, iteration, results | Reliable output, project completion, hands-on problem solving | May neglect exploration, can optimize too early |
| **Explorer** | Discovery, breadth, possibility | Wide knowledge, adaptability, pattern recognition | May struggle with deep focus, commitment to one path |
| **Analyst** | Logic, data, precision | Rigorous thinking, evidence-based decisions, error detection | May over-analyze, miss the human element |
| **Strategist** | Vision, systems, connections | Long-term thinking, resource allocation, seeing the whole | May get lost in abstraction, under-execute |
| **Creator** | Builder + Analyst | Builds things that are rigorous and well-crafted | May over-engineer, slow to ship |
| **Researcher** | Explorer + Analyst | Deep investigation, rigorous discovery, knowledge building | May hesitate to act without complete information |
| **Communicator** | Builder + Strategist | Builds narratives, aligns people, drives action through clarity | May prioritize harmony over truth |
| **Leader** | High across all action dimensions | Naturally organizes people, ideas, and execution | Risk of spreading too thin |

## 8.3 How DNA is Computed

1. **Evidence vector:** The 25+ dimension estimates form a feature vector
2. **Archetype classifier:** A soft clustering over archetype centroids
3. **Primary:** The archetype with highest cosine similarity to the student's vector
4. **Secondary:** The next closest archetype (if above threshold)
5. **Confidence score:** How decisively the student fits the primary vs. distributed across several

```typescript
interface CareerDNA {
  primary: {
    archetype: ArchetypeType;
    score: number;        // 0-100, similarity to centroid
    confidence: number;   // 0-100, how decisive the classification is
  };
  secondary: {
    archetype: ArchetypeType;
    score: number;
    confidence: number;
  } | null;
  history: {
    archetype: ArchetypeType;
    weekStart: Date;
    score: number;
  }[];
  subDimensions: {
    [key: string]: number;  // the dimensions that define this archetype
  };
}
```

## 8.4 DNA Evolution Rules

- **Minimum data threshold:** DNA is not assigned until at least 7 days of significant interaction
- **Cooldown:** Archetype reassessment happens at most once per day
- **Transition detection:** A significant shift requires 3+ consecutive days of new archetype scoring highest
- **Regression resistance:** Once an archetype emerges, it leaves a residual signal. Students don't "lose" an archetype — they layer new ones on top.

## 8.5 DNA in Action

The Career DNA directly influences:
- **Recommendations:** A Builder gets project recommendations; an Explorer gets reading/exploration recommendations
- **Opportunity matching:** Strategy roles matched to Strategists; analytical roles to Analysts
- **AI tone:** Communicators get narrative explanations; Analysts get data-rich ones
- **Report framing:** Each week's report is framed around the student's dominant archetype

---

# 9. Weekly Intelligence Report Design

## 9.1 Delivery Mechanism

- **Pushed** every Monday at 8:00 AM local time
- **Notification**: "Your Week X Intelligence Report — see how you evolved"
- **Accessible** anytime from SIG (swipe left on graph)
- **Archived** forever — students can look back at any week

## 9.2 Report Structure

### Opening Section: The Headline

One line that captures the week's dominant theme. Generated from the dimension with the most significant change.

Examples:
- *"You're accelerating."* (when velocity > 15%)
- *"A week of depth over breadth."* (when one dimension grew significantly)
- *"Your consistency is compounding."* (when streak-based growth)
- *"A recalibration week."* (when dimensions are flat but confidence increased)
- *"Your Career DNA shifted."* (when archetype changed)

### Section 1: The Story of Your Week

A narrative paragraph summarizing the week's activities and what they mean.

**Template:**
> "This week, you focused on [focus area]. You completed [X] tasks, had [Y] Dax conversations about [topics], and [notable activity]. The most interesting signal: [insight]. This suggests [interpretation]."

### Section 2: What Accelerated

Top 3-5 dimensions with positive trajectory. Each has:
- Dimension name
- Percentage change
- A one-sentence AI insight
- A tiny sparkline (organic curve)

### Section 3: What Needs Attention

Gentle noticing of flat or decreasing dimensions. Max 3 items. Always framed positively.

**Format:**
> *"Presentation Skills has been steady for 2 weeks. Your graph suggests strengthening this would unlock the next stage of growth."*

Never: *"You are weak in presentations."*

### Section 4: Evidence Timeline

Chronological list of significant evidence events from the week, with their impact on dimensions. Visually presented as a horizontal timeline.

### Section 5: One Thing

A single, specific, actionable recommendation with the highest leverage.

**Format:**
> *"Your Confidence dimension is lagging behind your actual capability by 14 points. One mock interview would likely close this gap more than anything else. [Schedule] →"*

### Section 6: Looking Ahead

Projections based on current trajectory.

- Estimated interview readiness date
- Projected placement range
- Confidence evolution forecast
- One note of caution (if applicable)

**Example:**
> *"At your current pace, you'll reach interview readiness in approximately 4 weeks. Students with similar growth patterns typically place within 2-3 weeks of reaching readiness. Your trajectory looks strong — maintain consistency and the results will follow."*

### Section 7: DNA Pulse

If the Career DNA shifted this week, a special card explains the change. Otherwise, a check-in on the current archetype's expression.

### Closing: A Question

The report ends with a question, not a call to action. This creates reflection, not pressure.

Examples:
- *"What would happen if you practiced interviews every day this week?"*
- *"What topic have you been avoiding that would change your trajectory?"*
- *"What did this week teach you about yourself?"*

## 9.3 Visual Design

- **Format:** Long-form article/magazine, not dashboard
- **Typography:** Serif headlines for emotional weight, sans-serif body for readability
- **Color palette:** Soft gradients (indigo → purple for acceleration, amber → gold for attention, green → teal for growth)
- **Charts:** Custom organic shapes, not standard bar/line charts. Data visualized as flowing curves, soft radar shapes, animated node constellations
- **Whitespace:** Generous. Nothing crowded.
- **Export:** PNG share image with SIG branding, suitable for Instagram/LinkedIn stories

---

# 10. Future Simulation Experience

## 10.1 Concept

Students make hundreds of decisions during their career preparation. Most of them are blind — they don't know how one choice compounds over another.

Future Simulation makes the invisible visible.

## 10.2 Inputs

The simulation models:
- **Current state:** All dimension estimates, Career DNA, trajectory velocities
- **Actions the student can take:**
  - Complete courses / modules
  - Practice mock interviews (frequency)
  - Build projects
  - Network / informational interviews
  - Study consistency (streak targets)
  - Resume revisions
  - Apply to internships
- **External factors (estimated):**
  - Placement season timing
  - Batch competition
  - Industry demand cycles

## 10.3 Simulation Model

For each scenario, SIG projects dimension trajectories forward using:
1. **Historical velocity** — how fast dimensions typically grow given different activity patterns
2. **Compound effects** — how dimensions influence each other (from the graph edges)
3. **Plateau detection** — diminishing returns on continued same-type activity
4. **DNA-specific projections** — different archetypes have different growth patterns

Outputs:
- **Interview readiness** (date when confidence + skill + career readiness cross threshold)
- **Placement probability** (estimated range within batch)
- **Salary trajectory** (estimated range based on readiness level and role type)
- **Dimension evolution** (projected values at key milestones)

## 10.4 UX

- **Current path** is always shown as a baseline
- User adds "scenario actions" from a list of known interventions
- Simulation runs on server (compute — Max tier gets deeper simulations)
- Results animate: two parallel timelines diverging
- AI insight explains WHY the result differs
- User can save scenarios, compare side by side, share

## 10.5 Limitations (Honest)

- Simulations cannot account for luck, personal connections, or market shifts
- All projections carry a confidence interval that widens with time
- The system explicitly states: *"This is an estimate based on your data and historical patterns. Your actual outcomes may differ significantly."*
- Simulations are motivational and directional, not deterministic

---

# 11. Opportunity Matching Experience

## 11.1 How It Works

Every opportunity (internship, job, hackathon, scholarship, certification, course) gets a SIG compatibility score.

The score is computed from:

```
compatibility = Σ(weight_i × similarity_i) / Σ(weight_i)
```

Where:
- `similarity_i` = cosine similarity between the student's dimension vector and the opportunity's requirement vector
- `weight_i` = the opportunity's importance weight for that dimension (e.g., consulting roles weight "Communication" highly)

## 11.2 What the Student Sees

Each opportunity on the internships/jobs page shows:
- **Match %** — prominent, with a color (green > 80%, amber 60-80%, gray < 60%)
- **Why this match** — 2-4 bullet points linking SIG dimensions to opportunity requirements
- **Gaps to address** — 1-2 areas where the student falls short, with recommended actions
- **View details** — expandable breakdown showing each dimension match

## 11.3 The Match Breakdown

```
┌──────────────────────────────────────────────────────┐
│  Match Breakdown                                     │
│  ────────────────────────────────                     │
│                                                       │
│  Role Requirements:                                   │
│  ┌─────────────┬──────────┬──────────┬───────────┐  │
│  │ Dimension   │ Required │ Your     │ Match     │  │
│  ├─────────────┼──────────┼──────────┼───────────┤  │
│  │ Analytical  │ 75       │ 82       │ ✓  Excellent │
│  │ Communic.   │ 80       │ 65       │ △  Needs ↑  │
│  │ Leadership  │ 70       │ 73       │ ✓  Good     │
│  │ Consistency │ 60       │ 88       │ ✓  Strong   │
│  │ Technical   │ 50       │ 45       │ △  Near gap │
│  └─────────────┴──────────┴──────────┴───────────┘  │
│                                                       │
│  "Your analytical thinking exceeds what this role     │
│   requires. Strengthening communication by 15 points  │
│   would make you a near-perfect match."               │
└──────────────────────────────────────────────────────┘
```

## 11.4 Importance of NOT Being Keyword-Based

Traditional matching is a bag-of-words disaster:
- Resume has "Python" → matches Python jobs
- Student wrote "SQL project" → matches SQL roles

SIG matching is deeper:
- "This student's Execution dimension suggests they complete projects, not just start them"
- "Their Learning Velocity indicates they can pick up new tools quickly"
- "Their Career DNA (Explorer) suggests they'd thrive in roles with variety"

This is the moat. A resume doesn't capture who you are. The graph does.

---

# 12. AI Insight Generation System

## 12.1 Guiding Principles

1. **Never state a number without context.** Not "82/100" but "Your analytical thinking is in your top 3 dimensions."
2. **Always compare to the student's own history, not others.** Not "above average" but "higher than last week."
3. **Frame gaps as opportunities, not deficiencies.** Not "You're weak in" but "Strengthening this would unlock."
4. **Mix observation with implication.** Not "your consistency is 14 days" but "your 14-day streak is driving learning velocity."
5. **One insight per interaction.** The AI does not dump everything it knows.

## 12.2 Insight Types

| Type | Trigger | Example |
|------|---------|---------|
| **Acceleration** | Dimension velocity > 15% | "Your learning velocity is accelerating faster than any other dimension." |
| **Correlation** | Edge strength crosses threshold | "Your consistency is now strongly correlated with interview confidence." |
| **Deceleration** | Dimension velocity < -5% | "Your focus has been decreasing slightly. This often happens before a breakthrough — rest may help." |
| **Emergence** | New dimension active | "Career Clarity just became measurable. You've been exploring career paths actively." |
| **Milestone** | Dimension value crosses threshold | "Your Confidence crossed 70. At this level, students typically apply to 3x more opportunities." |
| **Contrast** | Two dimensions diverge | "Communication is growing faster than Technical Depth. This is uncommon — your strength is becoming narrative." |
| **Prediction** | Forward-looking | "At current trajectory, you'll reach interview readiness in approximately 4 weeks." |
| **Recommendation** | Highest leverage action | "One mock interview would move your Confidence more than 10 study sessions would." |
| **DNA Insight** | Archetype-related | "Your Builder archetype is strongest when you have concrete deadlines. Create some." |
| **Pattern** | Behavioral recurrence | "You consistently learn fastest between 8-11 PM. Your evening sessions are 2x as effective." |
| **Risk** | Potential negative trajectory | "Your Consistency streak is at risk. You haven't studied in 3 days after a 12-day streak." |
| **Social (anonymous)** | Peer-relative (anonymized) | "Students with similar growth patterns typically interview 2 weeks after reaching your level." |

## 12.3 Generation Pipeline

```
1. Trigger Event
   │
2. Candidate Generation
   ├── Rule-based triggers (velocity thresholds, milestones)
   ├── Anomaly detection (unusual patterns)
   └── Scheduled cadence (daily digest, weekly report)
   │
3. Rank & Filter
   ├── Relevance score (to student's current focus)
   ├── Novelty (avoid repeating similar insights)
   └── Actionability (how useful is this?)
   │
4. Natural Language Generation
   ├── Template selection (based on insight type)
   ├── Variable injection (dimension names, values, trends)
   └── Tone adaptation (based on DNA + confidence)
   │
5. Delivery
   ├── Ambient (shown on graph with low priority)
   ├── Notify (push notification for significant insights)
   └── Report (included in Weekly Report)
```

## 12.4 Tone Calibration

The AI's tone is calibrated per student based on:
- **Career DNA:** Analyst students get more data-driven insights; Communicator students get more narrative ones
- **Confidence level:** Low-confidence students get more supportive framing; high-confidence gets direct framing
- **Recent trajectory:** If multiple dimensions are decelerating, tone becomes gentler
- **Time of day:** Evening insights are more reflective; morning ones more actionable

## 12.5 The "Not Robotic" Rule

Every insight passes through a naturalness check:
1. Would a human mentor say this?
2. Does it contain jargon the student doesn't know?
3. Is it the same insight they got yesterday?
4. Could it be misinterpreted as judgment?

If any check fails, the insight is either rewritten or suppressed.

---

# 13. Empty States

## 13.1 No Data Yet (Fresh User)

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│                    ✦  ✦  ✦                            │
│                 ✦         ✦                            │
│               ✦     ◇     ✦                            │
│                 ✦         ✦                            │
│                    ✦  ✦  ✦                            │
│                                                        │
│  Your intelligence graph is waiting for you.           │
│                                                        │
│  Every interaction lights a node:                      │
│    ✓ Complete a task                                   │
│    ✓ Talk to Dax                                       │
│    ✓ Practice an interview                             │
│    ✓ Write a journal entry                             │
│    ✓ Update your resume                                │
│                                                        │
│  The more you use DATAD, the more your graph grows.    │
│                                                        │
│  [Start Exploring →]                                   │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 13.2 One Dimension Active

When a single dimension has data but others are empty:

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Execution Ability is your first active dimension.     │
│  Other dimensions will light up as you explore.       │
│                                                        │
│  Try something new this week:                          │
│  • Practice a mock interview                           │
│  • Write a journal reflection                           │
│  • Discuss your career goals with Dax                   │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 13.3 No Weekly Report Yet

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Your first Weekly Report will arrive after 7 days     │
│  of activity. It needs enough data to find patterns.  │
│                                                        │
│  Days of data collected: [████░░░░░░] 3 / 7           │
│                                                        │
│  Keep going — the first report will surprise you.     │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 13.4 Career DNA Not Yet Available

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Your Career DNA is forming.                           │
│  It needs about 7 days of activity to detect your     │
│  natural patterns.                                     │
│                                                        │
│  In the meantime, keep exploring. Every interaction    │
│  helps the graph understand you better.                │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 13.5 No Insight Available

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  No new insights right now.                            │
│  Check back after your next activity — the graph      │
│  generates insights when it detects new patterns.     │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 13.6 Opportunity Matching Without Enough Data

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Matching is unavailable until your graph has more     │
│  data. Currently: 40% of dimensions active.            │
│                                                        │
│  Complete a few more activities and check back.        │
│  Resume updates and career chats with Dax help most.  │
│                                                        │
└──────────────────────────────────────────────────────┘
```

---

# 14. Loading States

## 14.1 Graph Loading

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│              ◌     ◌     ◌                            │
│          ◌                    ◌                        │
│      ◌         ◇   ·   ◇         ◌                    │
│          ◌                    ◌                        │
│              ◌     ◌     ◌                            │
│                                                        │
│  Your graph is forming...                              │
│  (rotating insight messages)                            │
│                                                        │
└──────────────────────────────────────────────────────┘
```

Loading insights rotate every 2 seconds:
- *"Building your dimension estimates..."*
- *"Connecting your activity patterns..."*
- *"Analyzing your recent interactions..."*
- *"Your graph gets smarter with every action."*

## 14.2 Dimension Detail Loading

```
┌──────────────────────────────────────────────────────┐
│  Learning Velocity                                    │
│  ────────────────────────                              │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ░░░░░░░░░░░░░░  Loading trajectory...            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ░░░░░░░░░░░░░░  Collecting evidence...           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Insight forming...                                     │
└──────────────────────────────────────────────────────┘
```

Subtle skeleton placeholders with a gentle pulse animation. Not jarring.

## 14.3 Future Simulation Loading

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Simulating your future...                              │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Current path:    ████████░░░░░░░░░░░░  complete  │  │
│  │  Scenario A:      ██████████░░░░░░░░░░  projecting │  │
│  │  Scenario B:      ████░░░░░░░░░░░░░░░░  queued   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  "Based on 14 weeks of behavioral data..."             │
│                                                        │
└──────────────────────────────────────────────────────┘
```

Animated progress bars showing simulation stages. A contextual fact about the student's data.

## 14.4 Weekly Report Loading

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Composing your Week 4 Intelligence Report...           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Gathering evidence...  ✓ 37 events collected    │  │
│  │  Computing trajectories... ✓ 25 dimensions       │  │
│  │  Generating insights...   ╲  (8 found)           │  │
│  │  Writing your story...    ╱                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  "This usually takes a few seconds..."                  │
│                                                        │
└──────────────────────────────────────────────────────┘
```

Transparent, honest progress. The student sees what's happening and why it takes time.

---

# 15. Motion Design

## 15.1 Motion Philosophy

**"The graph is alive. Motion is its breath."**

Every animation in SIG serves one purpose: to communicate that the system is alive, responsive, and intelligent. Motion is not decoration — it is information.

## 15.2 Core Motions

### Node Pulse
Each dimension node pulses at a rhythm determined by its recent activity:
- **Active today:** Pulse every 2 seconds, amplitude 15%
- **Active this week:** Pulse every 4 seconds, amplitude 8%
- **Active this month:** Pulse every 8 seconds, amplitude 4%
- **No recent activity:** No pulse, steady glow at 10% brightness

The pulse is a smooth sine wave, not a sharp blink. The overall effect is like a breathing constellation.

### Edge Flow
Edges between nodes show a particle flow along the connection:
- **Direction:** Flows from the more active node to the less active one
- **Speed:** Proportional to correlation strength (faster = stronger)
- **Color:** Matches the source node's glow color
- **Intensity:** Brighter when the edge recently strengthened

### Transition Animations
- **Open graph from ambient:** Fade in + scale up (0.3s, ease-out)
- **Tap node → dimension detail:** Slide from right (0.35s, ease-out)
- **Swipe up → Career DNA:** Slide up with spring (0.4s, spring)
- **Swipe left → Weekly Report:** Page curl or slide (0.35s, ease-out)
- **Dimension detail → back to graph:** Slide right + fade (0.25s)
- **Insight appearance:** Fade in with slight upward drift (0.5s, delay 0.2s)

### Graph Layout Animation
When the graph loads or a dimension changes significantly:
- Nodes gently rearrange using force simulation (continuous, 60fps)
- New nodes fade in from center (0.5s, ease-out)
- Edges draw themselves (0.3s per edge, staggered)
- The graph never "snaps" — positions are always interpolated

### Ambient Particle System
Tiny floating particles drift between connected nodes:
- **Number:** 20-50 particles, depending on graph density
- **Motion:** Brownian motion with slight attraction to edge paths
- **Opacity:** 0.1-0.3, creates a subtle star-field effect
- **Color:** Warm white with slight hue shift toward active node colors

---

# 16. Micro Interactions

## 16.1 Graph Tap
- Node expands slightly on touch (1.1x scale, 0.15s)
- Ripple effect emanates from touch point (0.3s, fading)
- Haptic feedback (light tap)

## 16.2 Drag Node
- Node follows finger with slight lag (0.1s spring)
- Connected edges stretch like rubber bands
- Other nodes subtly shift to accommodate (0.2s delay)
- On release, node springs back to physics position

## 16.3 Edge Hover (Desktop)
- Edge highlights on hover (glow increases 50%)
- Correlation percentage appears as floating label
- Brief haptic on supported devices

## 16.4 Insight Appearance
- Text fades in character by character (typewriter effect, 0.02s per char)
- Soft glow pulse when insight completes
- Option to re-read (tap to pause/restart animation)

## 16.5 Swipe Gestures
- **Swipe up:** Career DNA sheet follows finger position with rubber-banding
- **Swipe left:** Weekly Report page curl follows finger angle
- **Swipe down (on sheet):** Sheet follows finger, dismisses below 40% threshold

## 16.6 Pull to Refresh (Graph)
- Drag down on empty space: nodes gently stretch downward
- Release: graph recomputes, nodes reorganize with new data
- Loading: "Gathering new evidence..." text at top

## 16.7 Value Change Animation
When a dimension value updates:
- Number counts up/down to new value (0.3s, ease-out)
- Bar smoothly interpolates (0.3s)
- If significant change (>5 pts): brief glow pulse on the dimension node

## 16.8 Share Report
- Tapping share: report compresses into a card (0.2s)
- Share sheet opens from card position
- Export: subtle shimmer as image renders (0.5s)

---

# 17. Animation Philosophy

## 17.1 Principles

1. **Motion communicates meaning.** Every animation tells the user something about the system state. If it doesn't communicate, remove it.

2. **Speed signals importance.** Fast animations (0.2s) for routine feedback. Slower animations (0.5s+) for significant events.

3. **Never block.** Animations should never prevent interaction. If the user taps during an animation, the next screen opens immediately.

4. **Consistent easing.** Use the same easing curves throughout:
   - Enter: `cubic-bezier(0.16, 1, 0.3, 1)` — snappy, natural
   - Exit: `cubic-bezier(0.4, 0, 1, 1)` — faster exit
   - Spring: custom spring with tension 180, friction 20

5. **Reduce motion respected.** If the OS has "Reduce Motion" enabled, switch to fade transitions only (no scale, no spring).

## 17.2 Easing Reference

| Use | Easing | Duration |
|-----|--------|----------|
| Graph open | ease-out | 0.3s |
| Sheet slide | spring (180, 20) | 0.4s |
| Value change | ease-out | 0.3s |
| Pulse | sine wave | 2-8s periodic |
| Fade in | ease | 0.5s |
| Fade out | ease-in | 0.2s |
| Typewriter | steps | 0.02s/char |
| Force layout | continuous | 60fps |

---

# 18. Notification System

## 18.1 Notification Types

| Type | Frequency | Delivery | Example |
|------|-----------|----------|---------|
| **Daily Digest** | Once/day (evening) | Push + in-app | "You completed 3 tasks today. Your graph is evolving." |
| **Dimension Alert** | As triggered | Push | "Your Consistency streak reached 14 days. This is your longest ever." |
| **Milestone** | One-time | Push + in-app celebration | "Your Learning Velocity crossed 80. You're in the top growth tier." |
| **Weekly Report** | Once/week (Monday) | Push | "Your Week 5 Intelligence Report is ready. See how you evolved." |
| **Risk Alert** | As triggered | Push | "Your Consistency streak is at risk — 3 days since last activity." |
| **Career DNA Shift** | As triggered | Push | "Your Career DNA shifted. The Explorer signal strengthened." |
| **Opportunity Match** | Weekly batch | In-app | "3 new opportunities match your current graph." |
| **Insight of the Day** | Once/day | Ambient (in-app) | Shows on graph open — one insight, subtle, no notification |

## 18.2 Notification Content Guidelines

- **No numbers without context.** Not "Confidence: 72" but "Your Confidence is at a 3-week high."
- **No commands.** Not "Study now" but "Your consistency streak is the strongest it's been."
- **Personalize the sender.** Not "SIG" but "Your Intelligence Graph" — as if the graph itself is speaking.
- **One message per notification.** Never list multiple insights.
- **Actionable when possible.** "Your Weekly Report is ready" → tap opens the report.
- **Respect quiet hours.** No push notifications between 10 PM and 8 AM. Queue for morning delivery.

## 18.3 Notification Examples (Approved)

> *"Your Consistency streak reached 14 days — your longest this semester. Learning Velocity is accelerating as a result."*

> *"Career Clarity just became measurable. You've explored 5 career paths this week through Dax conversations."*

> *"Your Week 8 Intelligence Report is ready. This week's theme: 'Your execution ability caught up to your analytical thinking.'"*

> *"We noticed your Communication dimension has been steady for 2 weeks. Your graph suggests one mock interview would shift it."*

> *"Your Career DNA is evolving. The Analyst archetype is strengthening alongside your existing Builder pattern."*

---

# 19. Mobile-First Experience

## 19.1 Mobile as Primary

SIG is designed mobile-first because:
- Students open DATAD primarily on phone
- The graph's organic feel translates naturally to touch
- Gesture-based navigation feels native on mobile
- Notifications reach students on their phone

## 19.2 Mobile Layout

- **Graph screen:** Full viewport, no chrome
- **Graph interactions:** Tap to select, drag to explore, pinch to zoom
- **Dimension detail:** Slides in from right, 90% width, translucent background
- **Career DNA:** Bottom sheet, 70% height, swipe to dismiss
- **Weekly Report:** Full screen, scrollable, immersive reading experience
- **Future Simulation:** Full screen, scrollable
- **Opportunity Matching:** Embedded card within existing pages

## 19.3 Mobile Gestures

| Gesture | Action |
|---------|--------|
| Tap node | Open dimension detail |
| Drag node | Explore connections (temporary) |
| Swipe up | Open Career DNA |
| Swipe left | Open Weekly Report |
| Swipe right | Back/return to graph |
| Pinch | Zoom in/out of graph |
| Pull down | Refresh graph |
| Long press insight | Save or share |
| Two-finger swipe | Open Future Simulation |

## 19.4 Mobile Constraints Addressed

- **Temperature:** Graph goes to ambient state after 30s of inactivity (saves battery, prevents burn-in on OLED)
- **Data:** Graph updates are batched; dimensions recompute on server, client receives diff
- **Performance:** 20-30 nodes max for mobile (above that, cluster into meta-nodes)
- **Haptics:** Light tap on node select, medium on milestone, heavy on Career DNA shift
- **Accessibility:** VoiceOver labels on all nodes and edges; reduce motion respected

---

# 20. Desktop Experience

## 20.1 Desktop as Deep Work

Desktop SIG is for:
- Reading the Weekly Report (more comfortable for long-form reading)
- Exploring Future Simulations (more screen real estate for side-by-side comparison)
- Reviewing Career DNA in depth (larger sub-dimension grid)
- Opportunity matching with research (open multiple tabs)

## 20.2 Desktop Layout

```
┌──────────────────────────────────────────────────────────┐
│                    SIG — Desktop View                      │
│                                                           │
│  ┌──────────────┬────────────────────────┬──────────────┐ │
│  │              │                        │              │ │
│  │  Dimension   │    Graph Canvas        │  Insight     │ │
│  │  Sidebar     │    (full interactive)  │  Panel       │ │
│  │              │                        │              │ │
│  │  • Learning  │    ● ●        ●        │  Today's     │ │
│  │    Velocity  │  ●      ● ●     ●     │  Insight     │ │
│  │  • Confidence│   ●  ●   ●  ●         │  ─────────  │ │
│  │  • Career    │      ◇──◇              │  "Your       │ │
│  │    Readiness │     │  │              │  Learning    │ │
│  │  • Execution │   ● │  │●      ●      │  Velocity    │ │
│  │  • ...       │     ◇──◇              │  accelerated │ │
│  │              │  ●     ●   ●  ●      │  23% this    │ │
│  │  Selected:   │       ●       ●       │  week..."    │ │
│  │  Learning V. │                        │              │ │
│  │  ██ 82/100   │                        │              │ │
│  │  ↑ 18%/week  │                        │              │ │
│  │              │                        │              │ │
│  └──────────────┴────────────────────────┴──────────────┘ │
│                                                           │
│  ┌─Bottom Bar──────────────────────────────────────────┐  │
│  │ Career DNA  │  Weekly Report  │  Simulations  │ ...  │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## 20.3 Desktop-Specific Features

| Feature | Why Desktop |
|---------|-------------|
| Three-column layout | Graph + sidebar + insight panel visible simultaneously |
| Hover previews | Hover a node to see dimension summary without tapping |
| Edge detail on hover | Hover an edge to see exact correlation and evidence |
| Sim comparison | Side-by-side future simulation view |
| Report magazine view | Widescreen reading layout with floating table of contents |
| Export to PDF | Full report as printable PDF |
| Multi-window | Drag a dimension detail into its own window |
| Keyboard shortcuts | Full keyboard navigation (see below) |

## 20.4 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-9` | Quick select top 9 dimensions (by strength order) |
| `g` | Focus graph (center + zoom to fit) |
| `d` | Open Career DNA |
| `r` | Open Weekly Report |
| `s` | Open Future Simulation |
| `o` | Open opportunity matching |
| `i` | Show daily insight |
| `←/→` | Navigate between views |
| `↑/↓` | Navigate dimension list |
| `Esc` | Back / close panel |
| `Space` | Pause/resume graph animation |

---

# 21. Premium-Only Features

## 21.1 Free Tier

- **Graph view:** Read-only. See the nodes and connections, but cannot tap into dimension details.
- **Daily insight:** One insight per day (rotating, not student-specific by default — becomes personalized after 3 days of activity).
- **Career DNA:** See the archetype name only (no sub-dimensions, no evolution history).

The free tier is a *taste*. Enough to create curiosity. Not enough to satisfy it.

## 21.2 Pro Tier (₹299/mo) — SIG-Enabled

| Feature | Free | Pro |
|---------|------|-----|
| Graph visualization | View only | Full interactive |
| Dimension details | — | Full detail + trajectory + evidence |
| Career DNA | Archetype name | Full archetype + sub-dimensions + evolution |
| Weekly Intelligence Report | — | Full report every Monday |
| Future Simulation | — | 2 simulations per month |
| Opportunity Matching | — | Full compatibility scores + breakdown |
| AI Insights | 1/day generic | Unlimited personalized |
| Evidence Feed | — | See what contributes to each dimension |
| Historical Data | — | Full history (all-time) |
| Report Export | — | PDF, PNG share image |

## 21.3 Max Tier (₹499/mo) — SIG Max

Everything in Pro, plus:

- **Unlimited future simulations**
- **Career DNA coaching:** Dax conversations guided by the student's Career DNA
- **Advanced predictions:** Placement window estimates with confidence intervals
- **Predictive alerts:** "Based on your trajectory, you may hit interview readiness next Wednesday"
- **Batch comparison (anonymous):** Compare your graph structure to batch averages (anonymized)
- **Priority insights:** More nuance, more depth, multiple insights per day
- **Deeper history:** 2+ year evidence retention (Pro retains 1 year)
- **Custom dimensions:** Suggest new dimensions for the graph to track

---

# 22. Data Model

## 22.1 Collections

### `sig_events` (append-only log)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // ref: User
  eventType: String,          // "task.completed" | "interview.done" | ...
  timestamp: Date,
  payload: Mixed,             // event-specific data
  weight: Number,             // 0.0 - 1.0
  source: String,             // "system" | "ai-inferred" | "user-confirmed"
  metadata: {
    clientVersion: String,
    sessionId: String,
    processingLatencyMs: Number
  },
  createdAt: Date,
  // TTL index on timestamp (auto-delete after retention period)
}
// Indexes: { userId: 1, timestamp: -1 }
//           { userId: 1, eventType: 1, timestamp: -1 }
```

### `sig_dimension_estimates` (current state + trajectory)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  dimensionId: String,        // "learningVelocity" | "confidence" | ...
  currentValue: Number,       // 0-100
  confidence: Number,         // 0-100
  trend: String,              // "accelerating" | "stable" | "decelerating"
  velocity: Number,           // points/week
  acceleration: Number,
  lastUpdated: Date,
  evidenceCount: Number,
  history: [{                  // sliding window, max 90 points (daily snapshots)
    date: Date,
    value: Number,
    confidence: Number,
    topEventTypes: [String]
  }],
  parameters: {
    decayLambda: Number,       // temporal decay rate
    weight: Number,            // overall importance in composite scores
    priorMean: Number,
    priorConfidence: Number
  }
}
// Indexes: { userId: 1, dimensionId: 1 } (unique compound)
```

### `sig_edges` (dimension correlations)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  sourceId: String,            // dimensionId
  targetId: String,            // dimensionId
  correlation: Number,         // -1.0 to 1.0
  strength: Number,            // 0.0 - 1.0 (|correlation| × evidence quality)
  direction: String,           // "bidirectional" | "source_to_target"
  lastUpdated: Date,
  history: [{
    date: Date,
    correlation: Number,
    strength: Number
  }]
}
// Indexes: { userId: 1, sourceId: 1, targetId: 1 } (unique compound)
```

### `sig_career_dna` (live archetype state)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  primaryArchetype: {
    archetype: String,          // "builder" | "explorer" | "analyst" | ...
    score: Number,              // 0-100
    confidence: Number          // 0-100
  },
  secondaryArchetype: {
    archetype: String,
    score: Number,
    confidence: Number
  } | null,
  history: [{
    date: Date,
    primaryArchetype: String,
    secondaryArchetype: String | null,
    confidence: Number
  }],
  lastUpdated: Date,
  version: Number              // model version for reproducibility
}
// Indexes: { userId: 1 } (unique)
```

### `sig_weekly_reports` (archived reports)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  weekNumber: Number,
  weekStart: Date,
  weekEnd: Date,
  headline: String,
  sections: {
    storyOfWeek: { headline: String, body: String, topDimension: String },
    whatAccelerated: [{ dimensionId: String, delta: Number, insight: String }],
    whatNeedsAttention: [{ dimensionId: String, delta: Number, insight: String }],
    evidenceTimeline: [{ date: Date, eventType: String, impact: String }],
    oneRecommendation: { action: String, rationale: String, link: String | null },
    lookingAhead: { readinessEstimate: String, placementRange: String, caution: String | null },
    dnaPulse: { changed: Boolean, previousArchetype: String | null, currentArchetype: String | null, insight: String }
  },
  generatedAt: Date,
  status: String               // "draft" | "published" | "archived"
}
// Indexes: { userId: 1, weekNumber: -1 }
```

### `sig_insights` (generated AI insights)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  insightType: String,         // "acceleration" | "correlation" | "milestone" | ...
  body: String,                // the natural language insight
  dimensions: [String],        // related dimension IDs
  relevanceScore: Number,      // 0-100
  noveltyScore: Number,        // 0-100 (how different from recent insights)
  actionabilityScore: Number,  // 0-100
  isDelivered: Boolean,
  deliveredAt: Date | null,
  wasDismissed: Boolean,
  feedback: String | null      // "helpful" | "not_relevant" | "confusing"
}
// Indexes: { userId: 1, createdAt: -1 }
//          { userId: 1, isDelivered: 1, relevanceScore: -1 }
```

### `sig_opportunity_matches` (cached match results)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  opportunityId: ObjectId,     // polymorphic ref
  opportunityType: String,     // "internship" | "job" | "hackathon" | ...
  matchScore: Number,          // 0-100
  breakdown: {
    dimensionMatches: [{
      dimensionId: String,
      studentValue: Number,
      requiredValue: Number,
      weight: Number
    }],
    positiveFactors: [String],
    gapFactors: [String]
  },
  aiRationale: String,         // natural language explanation
  lastUpdated: Date,
  expiresAt: Date              // TTL (matches become stale)
}
// Indexes: { userId: 1, opportunityId: 1, opportunityType: 1 } (unique)
```

### `sig_simulations` (saved future simulations)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  name: String,                 // user-given name (e.g., "Conservative path")
  actions: [{
    actionType: String,         // "finish_module" | "add_interviews" | ...
    params: Mixed,
    estimatedTimeWeeks: Number
  }],
  results: {
    readinessWeeks: Number,
    placementRange: String,
    confidenceEstimate: Number,
    salaryEstimate: String,
    dimensionProjections: [{
      dimensionId: String,
      values: [{ week: Number, value: Number }]
    }]
  },
  createdAt: Date,
  isArchived: Boolean
}
// Indexes: { userId: 1, createdAt: -1 }
```

---

# 23. Intelligence Scoring Methodology

## 23.1 Philosophy

The scoring system is designed to be:
- **Evidence-based:** Every score is grounded in observed events, not guesswork
- **Transparent:** The system can explain why a dimension is at any value
- **Evolving:** Scores improve in accuracy as more data accumulates
- **Honest:** Confidence is tracked separately from value — a score without confidence is incomplete

## 23.2 The 25+ Dimensions

### Learning & Growth
| Dimension | Description | Primary Signals |
|-----------|-------------|-----------------|
| Learning Velocity (LV) | Rate of acquiring new knowledge/skills | Streak length × task completion rate × study diversity |
| Knowledge Retention (KR) | How well information is retained | Quiz performance × concept reuse in conversations × spaced repetition adherence |
| Consistency (CN) | Regularity of engagement | Streak length × daily active probability × session regularity |
| Curiosity (CU) | Breadth of exploration | Unique topics explored × novel queries × cross-domain activity |
| Focus (FC) | Depth of concentration | Session length × context-switch frequency × completion rate per session |

### Career & Professional
| Dimension | Description | Primary Signals |
|-----------|-------------|-----------------|
| Career Readiness (CR) | Preparedness for placement | Resume score × mock interview performance × skill coverage |
| Career Clarity (CC) | How clear career direction is | Goal stability × exploration-to-commitment ratio × Dax conversation topics |
| Interview Confidence (IC) | Readiness for interviews | Mock interview scores × Dax coaching engagement × practice consistency |
| Execution Ability (EA) | Ability to complete and deliver | Task completion rate × project completion × commitments met |
| Industry Readiness (IR) | Knowledge of target industry | Industry research breadth × application quality × market awareness |

### Communication & Leadership
| Dimension | Description | Primary Signals |
|-----------|-------------|-----------------|
| Communication (CM) | Clarity and effectiveness of expression | Dax conversation quality × peer discussion depth × writing analysis |
| Presentation Skills (PS) | Ability to present ideas | Mock presentation performance × STAR story quality × structured thinking |
| Leadership Potential (LP) | Capacity to guide and organize | Project leadership × mentoring activity × community contribution |
| Collaboration (CL) | Effectiveness in teams | Peer feedback × discussion participation × group task outcomes |
| Networking Strength (NS) | Building professional relationships | Connection activity × follow-up ratio × informational interview engagement |

### Analytical & Problem Solving
| Dimension | Description | Primary Signals |
|-----------|-------------|-----------------|
| Analytical Thinking (AT) | Decomposition and logical reasoning | Case solving × quantitative task performance × structured journaling |
| Problem Solving (PS) | Creative solution generation | Task difficulty completed × novel approach frequency × Dax problem-solving sessions |
| Decision Quality (DQ) | Quality of choices made | Application outcome ratio × goal-action alignment × decision satisfaction follow-up |
| Business Thinking (BT) | Understanding of business context | Case study engagement × financial analysis × industry discussion depth |

### Growth & Wellbeing
| Dimension | Description | Primary Signals |
|-----------|-------------|-----------------|
| Growth Momentum (GM) | Overall trajectory | Composite of all velocities × week-over-week improvement × trend strength |
| Adaptability (AD) | Response to change | Schedule adjustment speed × topic-switching ease × rejection recovery |
| Stress Trends (ST) | Wellbeing indicator | Sleep/journal patterns × task pressure ratio × application anxiety signals |
| Discipline (DI) | Structured approach | Plan adherence × routine consistency × goal progress regularity |
| Confidence (CF) | Self-belief | Decision speed × application volume × risk-taking behavior × improvement acknowledgment |

### Composite
| Dimension | Description | Formula |
|-----------|-------------|---------|
| Intelligence Score (IS) | Overall composite | Weighted average of all dimensions, reweighted by confidence |
| Interview Readiness (IRdy) | When ready for interviews | CF × 0.25 + CM × 0.25 + EA × 0.2 + AT × 0.15 + CR × 0.15 |

## 23.3 Initialization

When a new student first activates SIG:

1. All dimensions start at **null** — no data, no estimate
2. After first event → the dimension it maps to gets a **prior estimate** (population mean for that event type)
3. After 3+ events in one dimension → estimate becomes **personalized**
4. After 10+ events → estimate becomes **confident**
5. After 50+ events across all dimensions → the full graph becomes **stable**

## 23.4 Confidence Calibration

| Evidence Count | Confidence Range | Interpretation |
|---------------|-----------------|----------------|
| 0 | null | No data |
| 1-2 | 5-15 | Speculative |
| 3-5 | 15-35 | Emerging |
| 6-15 | 35-60 | Developing |
| 16-50 | 60-85 | Established |
| 50+ | 85-100 | Reliable |

## 23.5 Composite Score Computation

The Intelligence Score is not a simple average. It is a **weighted composite with confidence penalties**:

```
IS = Σ(w_i × v_i × c_i) / Σ(w_i × c_i)

Where:
  w_i = base weight of dimension i
  v_i = current value of dimension i (0-100)
  c_i = confidence of dimension i (0-1)
```

This means:
- Low-confidence dimensions contribute less to the composite
- As confidence grows, dimensions contribute their full weight
- The composite naturally becomes more reliable over time

---

# 24. Privacy Considerations

## 24.1 Design Philosophy

SIG is built on trust. A student's intelligence graph is deeply personal — it reveals patterns the student themselves may not see. This requires extraordinary privacy safeguards.

## 24.2 Data Principles

1. **The student owns their graph.** Not DATAD. Not any institution. The student.
2. **No institutional access.** Even with institutional partnerships, colleges cannot see individual student graphs. Only anonymized aggregate data.
3. **Transparent inference.** If asked "why is my confidence at 72?", the system shows exactly which events contributed and how.
4. **Data portability.** Students can export their complete graph at any time (JSON, CSV, visual PDF).
5. **Right to deletion.** Students can delete their SIG data independently of their DATAD account. All or selective (e.g., "remove evidence from last week").
6. **No third-party sharing.** SIG data never leaves DATAD infrastructure. No training of external models.

## 24.3 Data Retention

| Data Type | Free Tier | Pro | Max |
|-----------|-----------|-----|-----|
| Raw events | 30 days | 1 year | 2+ years |
| Dimension estimates | 30 days | 1 year | Full history |
| Career DNA history | Current only | 6 months | Full history |
| Weekly Reports | — | 1 year | Full history |
| Simulations | — | 1 month | 1 year |

## 24.4 Anonymized Batch Comparisons

When showing "Students similar to you" insights:
1. Data is aggregated at the cohort level (minimum 20 students)
2. Individual graphs are never compared directly
3. Similarity is computed on dimension vectors, not raw data
4. The student must opt in to batch comparison (they get richer insights in exchange)
5. Opt-out available at any time with no feature degradation

## 24.5 The "Explain Yourself" Feature

Any insight or score comes with an explanation:

> *"Your Confidence is 72 because over the last 14 days:*
> *- You completed 3 mock interviews (largest contributor: +8 points)*
> *- You updated your resume (+3 points)*
> *- You had 2 Dax conversations about career goals (+2 points)*
> *- Your confidence was stable when no interviews were happening (base: 59)*
>
> *This is 82% confident based on 23 evidence events."*

This transparency is not optional. It is the foundation of trust.

---

# 25. Future Expansion Roadmap

## 25.1 Phase 1 (Current — July 2026)

**Foundation — The graph exists and learns.**

- [ ] 25 dimension estimates from existing data sources
- [ ] Basic graph visualization (living nodes, edges)
- [ ] Career DNA v1 (simple archetype classification)
- [ ] Weekly Intelligence Report v1 (template-based generation)
- [ ] Free tier: read-only graph view
- [ ] Pro tier: full interactivity + reports + simulations

## 25.2 Phase 2 (Q3-Q4 2026)

**Personalization — The graph adapts to the individual.**

- [ ] Temporal decay tuned per student (not one-size-fits-all)
- [ ] Career DNA v2 (sub-dimension grid, evolution tracking)
- [ ] Future Simulation v1 (2-action scenarios)
- [ ] Opportunity Matching v1 (internships, jobs)
- [ ] AI Insight Engine — personalized daily insights
- [ ] Notification system — dimension alerts, risk detection
- [ ] Mobile-first graph interactions

## 25.3 Phase 3 (Q1-Q2 2027)

**Prediction — The graph sees forward.**

- [ ] Future Simulation v2 (multi-action, compound effects)
- [ ] Placement prediction (timeline, probability, salary)
- [ ] Career DNA v3 (archetype transition predictions)
- [ ] Opportunity Matching v2 (hackathons, scholarships, courses)
- [ ] Batch comparison (opt-in, anonymized)
- [ ] "Explain Yourself" feature for every score
- [ ] Data export and portability

## 25.4 Phase 4 (Q3-Q4 2027)

**Network — The graph connects cohorts.**

- [ ] SIG-powered study groups (match students with complementary dimensions)
- [ ] Mentor matching (connect students with alumni whose Career DNA fits)
- [ ] Institutional dashboards (anonymized cohort-level intelligence)
- [ ] Company compatibility (companies can define requirement vectors)
- [ ] API for partner integrations (with student consent)
- [ ] Custom dimension suggestions (students propose new dimensions)

## 25.5 Phase 5 (2028)

**Autonomy — The graph operates independently.**

- [ ] Self-improving inference engine (models retrained on outcomes)
- [ ] Predictive intervention: "You're 3 days from a focus dip — here's what helps"
- [ ] Career DNA becomes the student's professional identity
- [ ] Company recruitment via SIG compatibility (consent-based)
- [ ] Life-long graph (transitions beyond college into career)
- [ ] Open standard for student intelligence graphs (interoperability)

---

# 26. Features That Create Daily Habit Formation

## 26.1 The Ambient Graph

The Living Surface on the home screen shows a mini version of the graph at all times. It subtly changes — a node brightens, a connection thickens. This creates **ambient curiosity**: "What changed? What did I do today that affected the graph?"

This is the hook. The student doesn't need to "go to" SIG. SIG is always there, subtly inviting.

## 26.2 Daily Insight Pacing

The system generates exactly **one significant insight per day**. Not more. The insight is delivered when the student opens DATAD (not as a push, which feels intrusive). This creates:

- **Anticipation:** "What will the graph notice today?"
- **Scarcity:** If insights came every time, they'd lose meaning
- **Reflection:** One insight per day is digestible

## 26.3 The Streak Connection

The dimension "Consistency" is prominently visible. Every day the student engages, it visibly strengthens. Missing a day causes a visible (but gentle) slowing of the node's pulse. This is more powerful than a streak counter because it's *visual and emotional* — the student feels the graph respond to their presence.

## 26.4 The Notification That Isn't a Notification

Instead of a generic push notification, SIG sends a **graph-shaped notification** — a small visual representation of the graph with one node highlighted. The student sees the shape of their graph in the notification and instinctively wonders: "Why is that node brighter today?"

This turns notification-checking from a dopamine habit into a curiosity habit.

## 26.5 Evening Reflection Prompt

At the end of each day, if the student has had significant activity, the system offers a single question:

> *"Your graph noticed something today. Want to see it?"*

This replaces the generic "Good evening" with something that feels responsive and intelligent.

---

# 27. Features That Create Emotional Attachment

## 27.1 The Graph as a Living Thing

The graph is never static. Even when the student isn't active, old evidence decays, connections weaken, nodes dim. The graph has a **life cycle** — it grows with engagement and contracts without it.

Students develop an emotional relationship with something that responds to their presence.

## 27.2 The "Looking Back" Feature

Students can scroll back through old Weekly Reports. This creates a **growth narrative** — a story of who they were at each stage.

The AI highlights contrast: *"This week, your Confidence was 58. Four weeks ago, it was 42. You've grown 38% in a month."*

Seeing this creates genuine emotional response — pride, relief, motivation.

## 27.3 Career DNA as Identity

When a student sees their Career DNA for the first time, something shifts. "I'm a Builder." "I'm an Explorer." These archetypes give students a language to understand themselves.

The attachment is to the *identity the system revealed*, not the system itself.

## 27.4 The Mentor Relationship

The AI's tone is designed to feel like a **mentor who genuinely cares**, not a tool generating text. This is achieved through:

- Remembering past conversations: "Last week you were worried about your Confidence. Here's what changed."
- Using the student's name naturally: "Aarav, your Learning Velocity is accelerating in a way we haven't seen before."
- Expressing anticipation: "I'm curious to see how your next interview changes your graph."

## 27.5 The Milestone That Isn't Gamified

When a dimension crosses a meaningful threshold (not a round number), the system acknowledges it:

> *"Your Confidence crossed 70 today. At this level, students typically start applying to opportunities they would have avoided before."*

The emotional hook is **self-awareness**, not achievement. The student feels seen, not rewarded.

---

# 28. Features That Make Cancellation Psychologically Difficult

## 28.1 The Data Gravity

After 3+ months, the student has:
- A detailed Career DNA history showing their evolution
- 15+ Weekly Reports telling the story of their growth
- Hundreds of evidence events linking their actions to outcomes
- A functioning prediction model calibrated to their behavior

**Losing this is like burning a journal you've kept for years.** The student doesn't just lose a service — they lose a record of who they were becoming.

## 28.2 The Prediction Dependency

Students who use Future Simulation and see accurate predictions become dependent on it for planning. Not having it feels like navigating without a map.

The switching cost is not financial — it's **cognitive**. The student has built a mental model of their career trajectory around SIG's predictions.

## 28.3 The Career DNA Identity Shift

When a student has internalized their Career DNA ("I'm a Builder-Analyst"), losing access to SIG means losing a part of their professional identity. They've started using the DNA to make decisions:
- "This doesn't fit my Builder pattern"
- "I need to strengthen my Analyst side"

This identity attachment is the strongest lock-in.

## 28.4 The Weekly Report Archive

Students who have 6+ months of Weekly Reports have a **growth journal** — a narrative of their transformation. Cancelling means losing access to this record.

Even if they export it, the new reports stop. The narrative ends mid-story.

## 28.5 The Social Connection (Phase 4)

Once SIG connects to cohort comparisons and mentor matching, cancellation means losing:
- Knowledge of where you stand relative to peers
- Mentor relationships powered by DNA matching
- Cohort intelligence about placements and opportunities

**The student doesn't want to be the one person without a graph.**

---

# 29. What Makes This Impossible for Generic AI Chatbots to Replicate

## 29.1 The Data Moat

A generic chatbot (ChatGPT, Claude, Gemini) sees isolated conversations. It has no persistent, unified view of the student's:

- Task completion patterns over months
- Resume iterations and their timing
- Mock interview performance trajectories
- Study consistency and its relationship to confidence
- Career exploration breadth and depth
- Financial discipline as a personality signal
- Journal entries as a measure of self-awareness
- Community engagement as a leadership signal

SIG sees **all of these together** because it's part of DATAD, not a website the student visits.

## 29.2 The Behavioral Moat

SIG doesn't just collect data — it infers *latent dimensions* that no chatbot can see:

- Creativity: Hard to measure from chat. Easy from the variety of projects, notes, and approaches.
- Stress trends: Inferred from task deadlines, application frequency, journal sentiment — not self-reported.
- Adaptability: Measured from real schedule changes and topic switches, not claimed in an interview.

A chatbot can ask "How adaptable are you?" A student will say what they believe. SIG measures what they *do*.

## 29.3 The Temporal Moat

Generic AI has no memory of you 3 months ago unless you tell it. SIG tracks:

- Week-over-week trajectory for 25+ dimensions
- Career DNA evolution across archetypes
- Prediction accuracy over time (did it say you'd be ready in 5 weeks? Were you?)

This longitudinal data is impossible for a chatbot to replicate without a persistent graph like SIG.

## 29.4 The Integration Moat

SIG doesn't live in one place. It draws from:

| Source | What It Reveals |
|--------|----------------|
| Roadmap tasks | Execution, consistency, focus |
| Mock interviews | Confidence, communication, readiness |
| Dax conversations | Curiosity, career clarity, analytical thinking |
| Resume builder | Skill depth, career narrative |
| Journal entries | Stress trends, self-awareness |
| Finance tracking | Discipline, planning |
| Community discussions | Leadership, networking |
| Study sessions | Learning velocity, retention |

A chatbot would need to be integrated into **all of these** to replicate SIG. That's not a product feature — that's a platform architecture.

## 29.5 The Prediction Moat

To predict when a student will be interview-ready, you need to know:
- Their current skill levels
- Their learning velocity
- Their consistency
- Their career clarity
- Their confidence trajectory
- Historical patterns of similar students
- How these dimensions interact

A chatbot cannot do this because it doesn't have the dimensional model, the historical data, the cohort comparisons, or the predictive framework.

## 29.6 The Feedback Loop Moat

SIG improves with every prediction:
- Predicted readiness in 5 weeks? When the student reaches readiness, the system records accuracy
- Recommended a mock interview? It tracks whether confidence improved
- Said a dimension would accelerate? It checks 7 days later

This creates a **self-improving cycle** that a static chatbot cannot replicate.

## 29.7 The Trust Moat

Most importantly:

**Students trust SIG because it earns trust daily.**

A chatbot claims to know you. SIG *proves* it knows you by noticing things you didn't realize about yourself. Every insight that surprises the student with its accuracy deepens trust.

That trust is the ultimate moat. It takes weeks to build and seconds to lose. No generic AI can buy it.

---

# 30. Self-Critique & Redesign

## 30.1 Critique Methodology

I have designed the Student Intelligence Graph with the same rigor I would apply to a product I was shipping. But every design has weaknesses. Below, I identify the most significant risks and redesign the weakest parts.

## 30.2 Critique 1: The Scoring Problem

**Weakness:** 25 dimensions scored 0-100 with confidence levels looks suspiciously like a dashboard. Despite my insistence that SIG is "not a dashboard," users may interpret the numbers as a scoreboard and optimize for the wrong things.

**Evidence:** When Apple introduced the Health app, many users became obsessed with closing rings rather than being healthy. The same risk exists here — a student might fixate on raising "Confidence" to 80 rather than doing the work that builds genuine confidence.

**Severity:** HIGH. This could undermine the entire premise of SIG.

**Redesign:**

Replace absolute scores (0-100) with **relative self-comparison only**. Never show "Confidence: 72." Always show "Your Confidence grew 12% this week." The student only sees *deltas*, never absolutes.

The Intelligence Score composite is removed entirely. It invites comparison across students and creates a hierarchy. Instead, the graph shows:
- **Velocity indicators:** Arrows showing direction and magnitude of change
- **Acceleration indicators:** Curvature showing whether growth is speeding up or slowing down
- **Balance indicators:** A visualization of which dimensions are leading vs. lagging

**New visual language:**

| Before | After |
|--------|-------|
| "Learning Velocity: 82/100" | "Learning Velocity ↑ 18% this week" |
| "Confidence: 58" | "Confidence grew +5 points this week" |
| "Intelligence Score: 71" | (removed) |
| Radial chart with numbers | Organic shape showing balance/drift |

The only number the student ever sees is the **rate of change**, and only relative to their own history. This turns the system from a scoreboard into a *growth mirror*.

## 30.3 Critique 2: The Complexity Wall

**Weakness:** SIG is incredibly complex. 25 dimensions, 8 archetypes, predictions, simulations, weekly reports, opportunity matching. A new student landing on the graph may feel overwhelmed rather than curious.

**Severity:** HIGH. Complexity kills adoption.

**Redesign:**

**Progressive disclosure becomes the primary design pattern, not a secondary concern.**

### Day 1-3: The Seed State
The graph shows exactly **1 node** — the one that has the strongest initial signal. Everything else is faint, barely visible. The student can't even see the other dimensions until they've activated them.

The message: *"Your graph has one active dimension. The rest are waiting for you to discover them."*

### Day 4-7: The Neighborhood
When a second dimension activates, only those two + their connection are visible. A ring of faint, unnamed nodes surrounds them — suggesting there's more to discover without showing the full complexity.

### Week 2-3: The Constellation
As 4+ dimensions activate, the full graph skeleton becomes visible. But dimensions without evidence are at 5% opacity — technically there but barely noticeable.

### Month 1+: The Complete Graph
Only after 30+ days does the full graph appear at readable opacity. By this time, the student understands the mechanics because they've watched it build piece by piece.

**Second simplification:** The 25 dimensions are grouped into 5 "families" (Learning, Career, Communication, Thinking, Growth). On the graph, families are color-coded. The student can collapse a family to see only the family-level aggregate. This reduces complexity by 5x.

## 30.4 Critique 3: The Career DNA Labelling Risk

**Weakness:** Career DNA archetypes (Builder, Explorer, Analyst, etc.) create **identity labels** that students may:
- Over-identify with ("I'm a Builder, so I shouldn't do Analyst work")
- Feel boxed in by ("The graph says I'm an Explorer, but I want to be a Leader")
- Use to limit themselves ("I'm not a Communicator, so I should avoid presentations")

This is the MBTI problem — people use personality labels as cages rather than starting points.

**Severity:** CRITICAL. This could genuinely harm students' growth if they use archetypes to narrow their aspirations.

**Redesign:**

### 1. Rename "Career DNA" to "Current Energies"
The word "DNA" implies permanence. The word "Archetype" implies a fixed type. Replace both.

**New name:** *Your Patterns This Month*

### 2. Reframe the archetype as a weather report, not an identity
Instead of "You are a Builder," say:
> *"Lately, your energy has been in building mode. You've been completing projects, executing plans, and making progress on concrete goals. Over time, this energy may shift."*

The archetype becomes **temporal and situational**, not permanent and identity-defining.

### 3. Add "Shadow Patterns" alongside strengths
For each archetype, show not just what's active but what's dormant:
> *"Your Explorer energy is quieter this month. Consider exploring something outside your usual domain to keep your perspective broad."*

### 4. Remove the archetype name from the primary graph UI
The archetype label only appears in the dedicated panel, not as a badge on the main graph. This reduces identity-fixation.

### 5. Add archetype fluidity visualization
Show a timeline of how the student's pattern has shifted over months, emphasizing change:
> *"October: Building → November: Exploring → December: Building + Analyzing"*

The message is always: **you change. Your pattern changes with you.**

## 30.5 Critique 4: The Weekly Report Could Become Noise

**Weakness:** A weekly report that says the same things every week will be ignored after week 3. If the insights are shallow, the report becomes notification noise.

**Severity:** MODERATE. Reduces long-term engagement.

**Redesign:**

### Rule: Every report must have at least one "surprise"
Before generating, the system asks: "What did we learn this week that we couldn't have predicted last week?" If there's no surprise, the report finds an unexpected connection, a subtle shift, or a counterintuitive insight.

Examples of surprises:
- "Your fastest Learning Velocity came on a day you took a break. Rest appears to compound growth."
- "Your Career Clarity increased most on days when you did NOT think about career."
- "The dimension most correlated with your Confidence this week was... Finance. Tracking your budget improved your professional confidence."

If no genuine surprise exists, the report is shorter. It acknowledges: *"This week was about consolidation, not transformation. Both are necessary."*

### Cadence reduction to bi-weekly after 3 months
After 12 weekly reports, the novelty naturally declines. Switch to bi-weekly, with the off-week being a simple check-in:
> *"Your graph is stable. Two dimensions decelerating slightly. One insight worth noting: [insight]. Full report next week."*

### Report length caps at 3-minute read
No scrolling past 3 minute's worth of content. If the insights are substantial, they go in the daily insight system instead. The report is for *signal, not noise*.

## 30.6 Critique 5: Simulations Could Create False Confidence

**Weakness:** Future Simulation shows estimated outcomes. A student might:
- Take a simulation as a guarantee ("The graph says I'll be placed by October — I can relax")
- Get demoralized by a bad simulation
- Make life decisions based on imperfect predictions

**Severity:** HIGH. Could cause real harm.

**Redesign:**

### Every simulation gets a "confidence ribbon"
A visual indicator that shrinks as the projection extends further into the future:

```
Week 2:  ████████████████░░  90% confident
Week 4:  ██████████░░░░░░░░  70% confident
Week 8:  ████░░░░░░░░░░░░░░  40% confident
Week 12: ██░░░░░░░░░░░░░░░░  20% confident
```

The student can always see how much to trust each projection.

### Required disclaimer, not fine print
Every simulation result includes, in readable body text:
> *"This is an estimate based on your data. Outcomes depend on factors this model cannot see: luck, network, market conditions, and your own choices. Use this as a guide, not a guarantee."*

### No "guaranteed" language anywhere
The system never says "You will be placed by X date." It says "At current trajectory, students with similar patterns typically reach readiness by..." The phrase "typically" appears in every prediction.

### Add "What Could Go Wrong" to every simulation
Each simulation automatically generates a counter-scenario:
> *"If your consistency drops by 30% next month (placement season distractions, burnout), this timeline extends by approximately 2-3 weeks."*

### Simulation as motivation, not prediction
Reframe the output: instead of "You'll be ready in 5 weeks," say:
> *"If you maintain your current pace, your readiness trajectory suggests 5 weeks. This is a goal you can reach, not a prediction of what will happen."*

## 30.7 Critique 6: The Moat Narrative Is Overconfident

**Weakness:** The claim that SIG is impossible to replicate is true for *now*, but AI moves fast. In 2027, a sufficiently advanced model with long-term memory and integration capabilities could approximate SIG's core value. The moat sections above may age poorly.

**Severity:** MEDIUM. Strategic risk, not product risk.

**Response:**

The true moat is not just the data or integration — it's the **trust relationship** with the student. A competitor can replicate the graph. They cannot replicate the 6-month history of:
- Predictions that proved accurate
- Insights that surprised the student in useful ways
- A Career DNA identity the student has internalized
- A weekly report archive the student emotionally values

**This trust takes months to build and can't be downloaded.**

But to protect against architectural replication, SIG should:
1. **Invest heavily in prediction accuracy** — the most accurate predictor wins, and accuracy improves with data volume
2. **Build the network effects early** — cohort comparisons, mentor matching, institutional integration
3. **Open the API on our terms** — make SIG the canonical student intelligence layer that other tools read from (with consent)

The offense is better than the defense.

## 30.8 Summary of Redesign Outcomes

| Weakness | Redesign | Outcome |
|----------|----------|---------|
| Scored dashboard problem | Remove absolute scores → show only deltas | Feels like a growth mirror, not a scoreboard |
| Complexity wall | Progressive disclosure over 30 days | Students grow into the graph |
| Career DNA labeling risk | Temporal "patterns" not permanent identities | Fluid, aspirational, not limiting |
| Weekly report noise | Mandatory surprise per report, cadence reduction | Always worth reading |
| Simulation false confidence | Confidence ribbons, disclaimers, counter-scenarios | Motivational, not deterministic |
| Moat overconfidence | Invest in accuracy, network effects, API | Defense through offense |

---

# Final Word

The Student Intelligence Graph is not a feature.

It is a **new category of product** — the first system designed to show students who they are becoming, not just what they've done.

It succeeds when a student, months into using it, has a moment of genuine self-discovery:

*"I didn't know I was capable of that."*

*"I didn't realize I'd changed that much."*

*"I can see my future now."*

That moment is worth more than any retention metric, any conversion rate, any revenue target.

Build for that moment.

Everything else is infrastructure.

---

**End of Product Design Specification**

*Designed July 2026 · DATAD Pro — Student Intelligence Graph*
