# DATAD Design Principles

## An AI Operating System for Students

DATAD is not a dashboard. It is not a productivity tool. It is an **AI Operating System** — the layer between a student and the chaos of MBA life. These principles guide every pixel, interaction, and decision.

---

## Principle 1: Calm is the Interface

**Stress is the default state of a B-school student. DATAD is the antidote.**

A student opens DATAD between classes, after a rejection email, at 11 PM before a deadline. The product must never add to their cognitive load.

- Every page should answer one question: *"What should I do right now?"*
- Empty states are not "nothing here" — they are "here's your next step."
- Clutter is violence. If an element does not serve the student's growth, remove it.
- White space is a feature. Information density is a bug.
- The tone is calm, direct, never urgent. No red badges for attention. No "streaks" that punish absence.

**Applied:** The dashboard's greeting + encouragement + single mission. The readiness score that says "You've handled every hard day so far." The breathing exercise that doesn't gamify calm.

---

## Principle 2: AI is Ambient, Not an App

**The AI is the operating system. Features run inside it.**

The AI Coach is not a chat widget. The AI is the layer beneath every interaction:
- It chooses the daily mission.
- It prioritizes the task list.
- It suggests which notes to review.
- It curates the briefing.
- It writes the journal prompt.

The user should never "open the AI." They should simply notice that the product seems to understand them.

- AI is invisible when things work, visible when questioned.
- Every AI output shows source confidence (AIBadge pattern).
- The AI never interrupts. It suggests. The user decides.
- No chatbot-first design. Ambient AI is faster than conversational AI.

**Applied:** The readiness score already does this — it computes in the background and surfaces the next action. The planner AI panel does NOT do this — it requires a button click to "Get AI suggestions."

---

## Principle 3: One Page, One Purpose

**Every route in DATAD answers exactly one student question.**

| Page | Question it answers |
|---|---|
| Dashboard | *What matters today?* |
| Study Hub | *Where do I start studying?* |
| Notes | *What did I learn?* |
| Planner | *What's due and what's next?* |
| Career / Readiness | *How ready am I, and what's the next fix?* |
| Community | *What's happening with my batch?* |
| Finance | *Where is my money going?* |
| Wellbeing | *How do I reset?* |
| Briefing | *What do I need to know today?* |

- If a page tries to answer multiple questions, it needs sub-pages or tabs.
- If a page's answer is "a list of things," it is not doing its job.
- The primary action on every page must be the answer to its question.

---

## Principle 4: Trust is the Only Moat

**A student's notes, finances, journal, and career data are the raw material of their life. DATAD holds all of it.**

Trust is earned through:
- **Transparency:** Every AI output shows its reasoning. Every feature has a clear privacy boundary.
- **Reliability:** The product works offline. Nothing is lost. Loading is fast enough to feel instant.
- **Control:** The student owns their data. Export is one click. Delete is immediate.
- **Honesty:** No dark patterns. No fake urgency. The "Upgrade" prompt is contextual, not nagging.

The Support page's principles ("No advertising, no data selling, no engagement traps") are not marketing copy. They are product constraints. Every feature must pass this test: *Does this serve the student or the product's metrics?*

---

## Principle 5: The Canvas, Not the Template

**Every student's MBA is different. DATAD should feel different for each of them.**

- The dashboard adapts based on readiness score, deadlines, and goals.
- The study hub shows more subjects the student actually studies.
- The career page adjusts for freshers vs. experienced hires.
- The finance page changes based on income source (allowance vs. stipend vs. salary).

Sameness is the enemy of an OS. A fresher should never see "work experience years." An experienced hire should never see "what is a SIP?"

- Adaptive layout is not a feature. It is the default.
- If 80% of users see the same page, the OS is not adapting.

---

## Principle 6: Fast Feels Respectful

**A student's time between classes is measured in minutes. DATAD must respect that.**

- Every page loads in under 1.5 seconds on a 3G connection.
- Skeleton loading is not a placeholder. It is a promise that something is coming.
- Optimistic updates: the UI changes before the API responds.
- Offline is not an error state. It is a mode. Queue mutations, sync when connected.
- The Command Palette (⌘K) is faster than navigation. It must always work.

Speed is not a technical metric. It is a respect metric. Every millisecond of waiting says "your time is not valuable."

---

## Principle 7: Consistency is Compassion

**A student using DATAD for the first time should feel like they've used it before.**

- Every list looks like every other list.
- Every form follows the same pattern.
- Every card has the same padding.
- Every button has the same corner radius.
- Every page has the same content width.

When a student learns one part of DATAD, they have learned all of it. Inconsistency is not a design debt — it is a cognitive tax on an already overtaxed mind.

The `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input` classes in the current codebase are good. But they are not enforced. Many pages bypass them with inline styles. This stops today.

---

## Principle 8: Premium is Not Decoration

**A premium product does not look expensive. It feels valuable.**

Premium is:
- The weight of a button press (50ms micro-interaction).
- The right margin on a heading.
- The absence of a border where one was expected.
- The greeting that uses your name.
- The quote that changes daily.
- The sound of a successful action (optional, iOS-style haptic).

Premium is never:
- A gradient.
- A shadow.
- An animation without purpose.
- An emoji in a UI element.

The current `.gradient-text` is misnamed and should be `.accent-text`. Gradients signal "marketing" — DATAD is past marketing. It is a product.

---

## Principle 9: Every Interaction is a Relationship

**The AI Coach should feel like a mentor, not a search engine.**

- The greeting changes by time of day. Good. It should also change by context (after a completed task, after a logged journal entry).
- Encouragement quotes should reference actual user progress ("Your 5-day streak is real").
- The AI should remember past conversations and reference them.
- Empty states should not say "No tasks yet." They should say "Ready to plan your week?"

The product must feel like it knows you. Not through surveillance — through attention to what you've chosen to share.

---

## Principle 10: Ship the Feeling, Then the Feature

**Before building a feature, design the emotion it should create.**

The breathing exercise is not a timer with animations. It is a feeling of exhaling after a long day. The readiness score is not a number. It is the feeling of knowing you're on track.

This principle means:
- Design the emotional arc first. *What does the student feel before, during, and after?*
- Design the interaction second. *What does the student do?*
- Design the visual third. *What does it look like?*
- Code last. *How does it work?*

The current product got this right on the dashboard and the readiness score. It got it wrong on the finance page, the community page, and the notes list. Those pages were built as features first.

---

## Applying These Principles

Every design decision, every new feature, every refactor must be checked against these principles. If a decision violates a principle, it must be explicitly justified — not silently ignored.

The principles are ordered by priority. **Calm is the Interface** wins over **Premium is Not Decoration**. **Trust is the Only Moat** wins over **Fast Feels Respectful**. When in conflict, the higher principle governs.
