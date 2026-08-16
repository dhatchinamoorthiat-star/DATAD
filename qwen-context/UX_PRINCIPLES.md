# DATAD UX Principles

## Interaction Patterns, User Journeys & AI Experience Design

---

## 1. The Core Loop

Every session in DATAD follows the same rhythm. This is the product's fundamental interaction pattern.

```
ARRIVE → ORIENT → ACT → REFLECT → LEAVE
```

| Phase | Duration | User Question | Page | AI Role |
|---|---|---|---|---|
| **ARRIVE** | 2 seconds | "What matters today?" | Dashboard (Home) | Surfaces the daily mission and one insight |
| **ORIENT** | 5–15 seconds | "What should I do now?" | Dashboard / any workspace | Recommends next action |
| **ACT** | 2–30 minutes | "Let me do this thing." | Any workspace | Assists silently, offers help when stuck |
| **REFLECT** | 15–30 seconds | "How did that go?" | Any page + AI Coach | Summarizes, encourages, logs progress |
| **LEAVE** | 1 second | "I'll come back tomorrow." | Any page | Gentle farewell (optional, non-intrusive) |

**Design implication:** Every page must support the phase it belongs to. A page that doesn't fit this loop needs redesign.

---

## 2. State Machine for Every Data View

Every data display in DATAD exists in exactly one of five states. No exceptions.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ LOADING  │───→│  EMPTY   │───→│ HAS DATA │───→│  ERROR   │───→│  RETRY   │
│          │    │          │    │          │    │          │    │          │
│ Skeleton │    │ Emotion  │    │ Content  │    │ Friendly │    │ Button   │
│ only     │    │ + CTA    │    │          │    │ message  │    │ to retry │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### State Specifications

| State | What to show | What NOT to show | Example |
|---|---|---|---|
| **LOADING** | Skeletons matching the real layout | Spinner, blank page, "Loading..." text | `CardGridSkeleton` for notes |
| **EMPTY** | Illustration + message + clear CTA | "No data found," blank page | "No notes yet — write your first one" |
| **HAS DATA** | The content | Anything else | The note grid |
| **ERROR** | Friendly message + contextual action | Raw error text, console messages | "Couldn't load notes. Check your connection." |
| **RETRY** | Retry button, same as ERROR | Auto-retry loop | "Tap to retry" |

### The Null State Problem

**Current behavior:** Most pages use `if (!data) return null;` which shows a blank flash. This is unacceptable.

**Correct behavior:** Every page initializes in the LOADING state with a skeleton.

---

## 3. Empty States Are Not "Empty"

An empty state is the user's first conversation with a feature. It must:

1. **Explain what this feature does** in one sentence.
2. **Show the benefit** — not the mechanism.
3. **Offer one clear action.**

| Page | Current Empty State | Correct Empty State |
|---|---|---|
| Notes | "No notes yet" + "Write your first note" | "Start your knowledge repository. Paraphrase today's class in your own words — it sticks longer." + [Write your first note] |
| Planner | "No tasks yet" + "Add your first task" | "Plan your week. Add deadlines, case studies, and exam prep so nothing slips through." + [Add your first task] |
| Journal | "No entries yet" (implied) | "Private space. One sentence today is better than a page someday." + [Write today's entry] |
| Community | No posts | "Your batch is here. Share something — a doubt, a win, a photo from yesterday." |

---

## 4. AI Interaction Patterns

### 4.1 Ambient AI (Default Mode)

The AI does not announce itself. It works in the background and surfaces output when relevant.

```
User opens dashboard
  → AI has already computed today's mission
  → AI has already ranked recommendations
  → AI has already chosen the encouragement quote
User sees: page content with AI augmentations
User never: "uses" the AI
```

**Implementation pattern:**
```tsx
// Ambient AI — data flows into the page, no user action needed
function LivingSurface() {
  const mission = useAIMission()    // Pre-fetched on route enter
  const recommendations = useAIRecs() // Pre-fetched on route enter
  return <DailyMissionCard mission={mission} />
}
```

### 4.2 Invoked AI (On-Demand Mode)

When the user explicitly asks for AI help, the pattern is:

```
User signals intent → AI processes → AI shows output → User acts or dismisses
```

**Signals:** Button click (`Get AI suggestions`), natural language input (chat), gesture (highlight + ask).

**Implementation pattern:**
```tsx
// Invoked AI — user action triggers AI
function PlannerPage() {
  const [suggestions, setSuggestions] = useState<'idle' | 'loading' | 'done'>('idle')
  // State machine: idle → loading → done | error → idle
}
```

### 4.3 AI Confidence Display

Every AI output must show a confidence indicator when relevance varies:

| Confidence | Visual | When |
|---|---|---|
| High (≥ 80%) | No badge — AI is invisible | Daily mission, readiness score |
| Medium (50–79%) | Sparkle icon (small, muted) | Recommendations, summaries |
| Low (< 50%) | "AI · Low confidence" badge | Semantic search results |
| Error / unavailable | "AI unavailable" inline message | Graceful degradation |

### 4.4 AI Attribution

All AI-generated content is attributed with the AIBadge component:

```
[Sparkles icon] AI · {provider} · {confidence}%
```

This is always present but visually recessive (small, low contrast). The user should see it when they look for it, ignore it otherwise.

---

## 5. Form Design Patterns

### 5.1 Form Length

| Number of Fields | Treatment |
|---|---|
| 1–3 fields | Inline, no modal, no page navigation |
| 4–8 fields | Modal dialog |
| 8–20 fields | Dedicated page with sections |
| 20+ fields | Multi-step wizard (discouraged — prefer progressive disclosure) |

**Rule:** The 8-step registration wizard must be reduced to a maximum of 3 steps. Most configuration should happen in-context after the user starts using the product.

### 5.2 Validation

1. **Validate on blur** — not on keystroke, not on submit only.
2. **Show errors below the field** — not in a toast, not at the top of the form.
3. **One error message per field** — clear, specific, actionable.
4. **Never disable the submit button for validation** — let the user submit, then show errors.

### 5.3 Input Styling

All inputs use the `.input` class from the design system:

```css
.input {
  @apply w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 
         text-sm text-gray-900 placeholder:text-gray-400 transition-colors 
         duration-150 focus:border-indigo-400 
         dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 
         dark:focus:border-indigo-500;
}
```

No inline `inputClass` strings anywhere. If a customization is needed, extend `.input` with Tailwind's `@apply` in a utility class.

---

## 6. Loading & Skeleton Patterns

### 6.1 Skeleton Types

| Skeleton | Matches | Usage |
|---|---|---|
| `Skeleton` | Generic rounded rect | Base primitive, sized via className |
| `CardSkeleton` | Card (note/company) | Grids of cards |
| `RowSkeleton` | List row item | Feed, task list |
| `TileSkeleton` | Stat tile | Dashboard tiles |
| `CardGridSkeleton` | Grid of CardSkeleton | Any card grid |
| `FeedSkeleton` | Stack of RowSkeleton | Any list page |

### 6.2 Skeleton Rules

1. Skeletons match the final layout exactly — same dimensions, same grid, same columns.
2. Skeletons use the `.skeleton` class from `index.css` (shimmer animation).
3. Never show a spinner as a page-level loading state. Use skeletons.
4. Never show a blank page while loading. Always show skeletons.
5. Transition from skeleton to content should be instant (no fade — the content replaces the skeleton on the same frame).

---

## 7. Error & Fallback Patterns

### 7.1 Error Hierarchy

| Error Type | Handling | User Sees |
|---|---|---|
| Render crash | `ErrorBoundary` (class component) | "This section hit an unexpected error" + Refresh button |
| API failure (non-critical) | Swallow with `catch(() => {})` | Nothing — feature not available |
| API failure (critical) | Show error in-place | "Couldn't load [feature]. [Retry]" |
| Network offline | `PWAContext.isOnline` | OfflineBanner (top of page) |
| Rate limited | Specific error message | "You've used all your AI actions for today. They reset at midnight." |

### 7.2 Error Message Guidelines

1. **Explain what happened** (not technical details).
2. **Explain the impact** (what the user can't do right now).
3. **Offer a next step** (retry, go back, contact support).

**Bad:** `Error: 503 Service Unavailable`
**Good:** `Couldn't reach the server — this often happens on college WiFi. Try again?`

### 7.3 The "Silent Catch" Problem

**Current behavior:** Most `catch(() => {})` blocks swallow errors, leaving users on infinite loading skeletons.

**Correct behavior:** Every API call must handle three outcomes: `fulfilled` (show data), `rejected` (show error state), `pending` (show skeleton). Use the state machine from Section 2.

```tsx
const [state, setState] = useState<'loading' | 'data' | 'error'>('loading')

if (state === 'loading') return <Skeleton />
if (state === 'error') return <ErrorState onRetry={refetch} />
return <Content data={data} />
```

---

## 8. Feedback Patterns

### 8.1 Toast Notifications

| Type | Purpose | Style | Dismiss |
|---|---|---|---|
| Success | Task completed, item saved | Green check icon | Auto (3.5s) |
| Error | Action failed | Red X icon | Manual or auto |
| Information | Non-urgent update | Neutral | Auto (3.5s) |
| Loading | In-progress action | Spinner | Replaced by success/error |

Toast configuration (from `App.jsx`):
```tsx
<Toaster
  position="top-center"
  toastOptions={{
    className: 'datad-toast',
    duration: 3500,
    success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
    error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
  }}
/>
```

### 8.2 Optimistic Updates

For actions that the user expects to succeed immediately (task status toggle, bookmark, journal save):

1. Update the UI immediately.
2. Send the API request.
3. If the API fails, revert the UI change and show an error toast.

```tsx
const toggleBookmark = async (id) => {
  // Optimistic: update UI
  setBookmarked(prev => prev.map(b => b._id === id ? {...b, bookmarked: !b.bookmarked} : b))
  try {
    await toggleBookmarkApi(id)
  } catch {
    // Revert
    setBookmarked(prev => prev.map(b => b._id === id ? {...b, bookmarked: b.bookmarked} : b))
    toast.error('Failed to update bookmark')
  }
}
```

---

## 9. Keyboard Navigation

| Shortcut | Action | Scope |
|---|---|---|
| `⌘K` / `Ctrl+K` | Open command palette | Global |
| `Escape` | Close modal/dropdown/palette | Global |
| `Enter` | Confirm / submit | Focused |
| `ArrowUp` / `ArrowDown` | Navigate list items | Dropdowns, palette |
| `Tab` | Move to next focusable | Forms |
| `⌘Enter` | Submit form with textarea | Chat, journal |

### Focus Management

1. When a modal opens, focus moves to the first interactive element (close button or confirm button).
2. When a modal closes, focus returns to the element that triggered it.
3. The command palette always focuses the search input on open.
4. Dropdown menus trap focus while open.

---

## 10. Mobile & Touch

### 10.1 Touch Targets

All interactive elements must have a minimum touch target of 44×44 points (Apple HIG / WCAG 2.5.5).

```css
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

This is already defined in `index.css` — use it.

### 10.2 Bottom Tab Bar

On mobile, the bottom tab bar provides primary navigation. It uses `safe-area-inset-bottom` to respect the home indicator.

- Maximum 5 tabs.
- Active tab shows indigo icon + indigo badge background.
- The "Upgrade plan" link is replaced by a profile/avatar in the center.
- Notification badge appears on the appropriate tab.

### 10.3 Gestures

| Gesture | Action |
|---|---|
| Swipe left on list item | Reveal delete/mark complete |
| Pull to refresh | Reload current data |
| Tap status bar | Scroll to top |

---

## 11. Accessibility Baseline

| Requirement | Standard | Implementation |
|---|---|---|
| Color contrast | WCAG AA (4.5:1 text, 3:1 large text) | Verified in design tokens |
| Focus indicators | Visible focus ring on keyboard nav | `focus-visible` with 2px indigo ring |
| Screen reader support | All interactive elements labeled | `aria-label`, `aria-labelledby`, `aria-describedby` |
| Motion sensitivity | Respect `prefers-reduced-motion` | CSS animations reduced, Framer Motion uses `useReducedMotion` |
| Touch targets | Minimum 44×44pt | `.touch-target` and `.tap-target` classes |
| Heading hierarchy | Single `h1` per page, semantic order | Verified in page audits |

---

## 12. User Journey Maps

### First Session

```
ARRIVE (login/register)
  → 2-step registration (email + password → onboarding preferences)
  → ARRIVE (dashboard)
  → See greeting + encouragement
  → See daily mission
  → See AI coach widget
  → Try one feature (write a note, check readiness)
  → Leave with one task completed
```

### Daily Session

```
ARRIVE (dashboard)
  → See personalized greeting
  → See daily mission (AI-chosen)
  → Check readiness score (if career track)
  → Complete mission
  → Act on one recommendation
  → Check notifications
  → Leave
```

### Weekly Session

```
ORIENT (dashboard)
  → Review weekly summary
  → Check career readiness trend
  → Review overdue tasks
  → Update journal
  → Check community events for the week
  → Plan upcoming deadlines
```
