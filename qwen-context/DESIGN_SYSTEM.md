# DATAD Design System

## Visual Language & Token Reference

> **Version 1.0** — Single source of truth for all visual decisions.
> Every pixel in DATAD is governed by the tokens below.

---

## 1. Architecture Philosophy

DATAD uses a **dark-first, flat, neutral surface** approach inspired by modern OS design (Arc Browser, Linear, Notion's dark mode). Color is reserved exclusively for meaning — never for decoration.

```
Neutral surfaces   →  The stage. Quiet, dimensional, never distracting.
Indigo             →  Action. The user's next step.
Emerald            →  Success. Completion, growth, readiness.
Amber              →  Warning. Attention needed, approaching limits.
Rose               →  Danger. Destructive actions, critical errors.
Purple             →  Premium. AI features, Max tier capabilities.
Sky/Blue           →  Information. External data, learning, wellbeing.
```

---

## 2. Color Tokens

### Neutral Scale (Gray)

The entire product uses a single neutral scale with a cool cast. Dark and light modes are luminance mirrors of each other.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `gray-50` | `#F7F8FA` | — | Light: page background |
| `gray-100` | `#F4F6F9` | — | Light: card/button hover bg |
| `gray-200` | `#E4E7EC` | — | Light: borders, hairline dividers |
| `gray-300` | `#C4CBD4` | — | Light: disabled text, placeholder |
| `gray-400` | `#9AA4B2` | Light: secondary text | Dark: secondary text |
| `gray-500` | `#67717F` | Light: tertiary text | Dark: tertiary text |
| `gray-600` | `#4E5866` | — | Dark: hover surfaces |
| `gray-700` | `#39404B` | — | Dark: borders, hairline dividers |
| `gray-800` | `#242830` | — | Dark: card/raised surface |
| `gray-900` | `#181C22` | — | Dark: card surface |
| `gray-950` | `#0B0D10` | — | Dark: page background |

**Surface token:**
```css
--surface: #13161B;  /* Dark: elevated surface (between 900 and 950) */
```

### Semantic Colors

| Token | Color | Hex | Usage |
|---|---|---|---|
| `indigo-500` | Indigo | `#6366F1` | Primary action, interactive states |
| `indigo-600` | Indigo deep | `#4F46E5` | Button bg, active links |
| `emerald-500` | Emerald | `#10B981` | Success, completion, readiness ≥75 |
| `amber-500` | Amber | `#F59E0B` | Warning, readiness 40–74, Pro tier |
| `rose-500` | Rose | `#F43F5E` | Danger, destructive actions |
| `purple-500` | Purple | `#A855F7` | Max tier, premium AI features |
| `sky-500` | Sky | `#0EA5E9` | Information, external links, wellbeing |

### Token Usage Rules

1. **Never use a semantic color for a neutral purpose.** Indigo is for action, not for a random icon.
2. **Never use a neutral color where a semantic one belongs.** A "Save" button must be indigo, never gray.
3. **Colors must carry meaning consistently across the product.** Indigo on the readiness page means the same thing as indigo in the planner.
4. **Dark mode is not an afterthought.** Every color must have a `dark:` counterpart that maintains the same perceived contrast.

---

## 3. Typography

### Font Stack

```css
font-family: 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### Font Features

```css
font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
/* cv02 = Open digits     */
/* cv03 = Proportional figures */
/* cv04 = Tabular figures */
/* cv11 = Stylistic alternates (Inter-specific) */
```

### Type Scale

| Token | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| `display` | 36px / `text-4xl` | 800 (extrabold) | 1.1 | `-0.025em` | Landing hero, feature titles |
| `heading-1` | 24px / `text-2xl` | 600 (semibold) | 1.25 | `-0.02em` | Page titles, section headers |
| `heading-2` | 20px / `text-xl` | 600 (semibold) | 1.3 | `-0.015em` | Section headers, modal titles |
| `heading-3` | 16px / `text-base` | 600 (semibold) | 1.4 | `-0.01em` | Card titles, sidebar items |
| `body` | 14px / `text-sm` | 400 (normal) | 1.5 | normal | Body text, descriptions |
| `body-bold` | 14px / `text-sm` | 500 (medium) | 1.5 | normal | Emphasized body text |
| `caption` | 12px / `text-xs` | 500 (medium) | 1.4 | `+0.02em` | Labels, metadata, timestamps |
| `label` | 11px / `text-[11px]` | 600 (semibold) | 1.3 | `+0.08em` | Form labels, section labels |
| `micro` | 10px / `text-[10px]` | 500 (medium) | 1.2 | `+0.05em` | Badges, keyboard shortcuts, small stats |

### Typography Rules

1. **h1, h2, h3 always get `tracking-tight`.** This is already in the base styles — preserve it.
2. **Never use font weights below 400.** Light (300) reduces readability on screens.
3. **Body text is always `text-sm` (14px).** Never `text-base` (16px) except on the landing page.
4. **Line height for body text is always 1.5.** Tighter lines reduce readability for long content.
5. **Labels are uppercase only when specified.** Section labels (`text-xs font-semibold uppercase tracking-wide`) are uppercase. Action labels are sentence case.
6. **Numbers use tabular figures (`tabular-nums`)** in data displays (scores, amounts, dates) to prevent layout shift.

---

## 4. Spacing Scale

DATAD uses a **4px grid system**. All spacing values are multiples of 4.

| Token | Pixels | Tailwind | Usage |
|---|---|---|---|
| `space-1` | 4px | `p-1`, `gap-1` | Tight icon–text gaps |
| `space-2` | 8px | `p-2`, `gap-2` | Dense element spacing |
| `space-3` | 12px | `p-3`, `gap-3` | Grid gap, card internal |
| `space-4` | 16px | `p-4`, `gap-4` | Card padding, section spacing |
| `space-5` | 20px | `p-5`, `gap-5` | Card padding (standard `.card`) |
| `space-6` | 24px | `p-6`, `gap-6` | Section spacing, modal padding |
| `space-8` | 32px | `p-8` | Page padding (mobile) |
| `space-10` | 40px | `p-10` | Generous empty states |
| `space-12` | 48px | `p-12` | Page section separators |

### Spacing Conventions

| Context | Token | Rationale |
|---|---|---|
| `.card` padding | `p-5` (20px) | Standard — matches existing |
| Page content padding | `px-4 py-6` (16px / 24px) | Matches max-w-5xl content |
| Grid gaps (dense) | `gap-3` (12px) | Notes grid, company grid |
| Grid gaps (spacious) | `gap-4` (16px) | Section grids, dashboard |
| Form field spacing | `space-y-4` (16px) | Between form fields |
| Card internal sections | `space-y-3` (12px) | Inside a card |
| List items | `space-y-2` (8px) | Between list rows |
| Button icon gap | `gap-1.5` (6px) | Between icon and text in buttons |

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 6px / `rounded` | Checkboxes, small badges |
| `radius-md` | 8px / `rounded-lg` | Inputs, selects, small cards |
| `radius-lg` | 12px / `rounded-xl` | Buttons, cards, modals, dropdowns |
| `radius-xl` | 16px / `rounded-2xl` | Cards (standard), dialogs, panels |
| `radius-full` | 9999px / `rounded-full` | Badges, pills, avatars, tier dots |

**Rule:** All interactive elements use `rounded-xl` (12px) consistently. No exceptions. Cards use `rounded-2xl` (16px). This is already the standard — enforce it.

---

## 6. Shadows & Elevation

DATAD uses minimal shadows. The default state of a surface is flat with a hairline border. Shadows appear only on interactive or overlay elements.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | `0 0 0 1px rgba(255,255,255,0.07)` | `.card-hover:hover` |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 12px rgba(0,0,0,0.4)` | Dropdown menus |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.1)` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, command palette |
| `shadow-xl` | `0 12px 40px rgba(0,0,0,0.12)` | `0 12px 40px rgba(0,0,0,0.6)` | Full-screen modals |

**Rule:** Never add shadows to cards at rest. A card's surface is conveyed by its background color and border, not by dropshadow.

---

## 7. Border Width

| Token | Value | Usage |
|---|---|---|
| `border` | 1px | Standard hairline borders |
| `border-2` | 2px | Tier gates (dashed), focus rings |
| `border-0` | 0px | Cards without borders (future) |

---

## 8. Layout Grid

### Page Content Width

All page content is constrained to `max-w-5xl` (1024px). This is the standard content width for every workspace page.

```
max-w-5xl (1024px)
├── px-4 (16px padding each side)
│   └── content area (992px max)
```

### Grid Systems

| Grid | Columns | Gap | Usage |
|---|---|---|---|
| Dense card grid | 2 cols → 3 cols (lg) | `gap-3` | Notes, company cards |
| Spacious card grid | 1 col → 2 cols (lg) | `gap-4` | Dashboard widgets |
| Dashboard grid | 2 cols → 3 cols (xl) | `gap-4` | Adaptive workspace |
| Feature grid | 2 cols → 4 cols (lg) | `gap-3` | MeHub feature cards |

### Breakpoints

| Breakpoint | Width | Tailwind |
|---|---|---|
| Mobile | < 640px | default |
| Tablet | ≥ 640px | `sm:` |
| Desktop | ≥ 1024px | `lg:` |
| Wide | ≥ 1280px | `xl:` |

---

## 9. Icon System

### Source

All icons come from **Lucide React**. No other icon library is permitted. If an icon doesn't exist in Lucide, design a custom SVG that matches Lucide's stroke style.

### Icon Properties

| Property | Value |
|---|---|
| Stroke width | `1.5` (Lucide default) |
| Size (standard) | 16px → `h-4 w-4` |
| Size (small) | 14px → `h-3.5 w-3.5` |
| Size (large) | 20px → `h-5 w-5` |
| Size (hero) | 24px → `h-6 w-6` |

### Icon Rules

1. **Icons in buttons** are `h-4 w-4` with `gap-1.5` between icon and text.
2. **Icons in headings** are `h-5 w-5` to match the `text-2xl` heading.
3. **Icons in navigation** are `h-[18px] w-[18px]` (sidebar rail).
4. **Icons in cards** are `h-4 w-4` for inline and `h-5 w-5` for hero icons.
5. **Never use emoji in UI elements.** Emoji renders differently across platforms and undermines product cohesion. The one exception is user-generated content (journal entries, community posts).

---

## 10. Dark Mode

### Strategy

DATAD is **dark-first**. New users see dark mode unless their OS explicitly prefers light. The in-app toggle persists via `localStorage`.

```css
/* Default state */
:root { /* light tokens */ }
:root.dark { /* dark tokens */ }
```

### Dark Mode Rules

1. Every component must have a `dark:` variant.
2. Dark mode is not "light mode inverted." Dark surfaces use the cool gray scale (`gray-900` for cards, `gray-950` for page bg).
3. Shadows in dark mode are replaced with subtle border highlights (`box-shadow: 0 0 0 1px rgba(255,255,255,0.07)`).
4. Semantic colors in dark mode are slightly desaturated to avoid eye strain.
5. The `.glass` effect uses `bg-gray-950/90` + `backdrop-blur-md` in dark mode.

---

## 11. The `.gradient-text` Rename

**Current state:** The class `.gradient-text` applies a solid indigo color (`text-indigo-600 dark:text-indigo-400`). It was formerly a gradient but is now a flat accent.

**Correct action:** Rename to `.accent-text` and update all references. The new class applies:

```
.accent-text {
  @apply text-indigo-600 dark:text-indigo-400 font-semibold;
}
```

Usage: Names, highlights, emphasis — never for complete sentences or paragraphs.

---

## 12. Consistency Checklist

Before adding a new class, utility, or component, verify:

- [ ] Does this match the neutral color scale?
- [ ] Does this use an existing semantic color correctly?
- [ ] Does this use `rounded-xl` or `rounded-2xl`?
- [ ] Does this use `text-sm` for body content?
- [ ] Does this use `p-5` for card padding?
- [ ] Does this have a `dark:` counterpart?
- [ ] Does this avoid inline styles?
- [ ] Does this avoid emoji?
- [ ] Does this respect the 4px spacing grid?
- [ ] Does this use a Lucide icon at the correct size?
