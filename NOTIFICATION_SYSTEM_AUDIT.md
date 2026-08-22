# DATAD Notification System Audit — Phase 1

**Scope:** Full repo scan of `client/` and `server/` for existing toast, flash, banner, alert, notification, error-handling, loading-state, and event-bus infrastructure. Audit only — no code was modified.

**Methodology note:** `CLAUDE.md` requires using the `graphify` CLI (`graphify query/path/explain`) against `graphify-out/graph.json` before raw grepping. The `graphify-out/` artifacts (including `GRAPH_REPORT.md` and `graph.json`) exist in the repo, but the `graphify` binary itself is not installed anywhere on this machine (confirmed via `PATH`, `npm`/`npx`, `pip`, Homebrew, `node_modules/.bin`, and a filesystem-wide search — all failed). Per the fallback instruction, this audit was produced by reading the pre-generated `graphify-out/GRAPH_REPORT.md` for orientation, then verifying and extending every finding with direct `grep`/`Read` against the live source.

---

## 1. Existing systems

### 1.1 Frontend toast system (live, actively used — the de facto standard)

- **`client/src/utils/toast.js`** — single source of truth. Wraps `react-hot-toast` (`client/package.json:25`, `^2.6.0`). Exports `success/error/warning/info/loading/show/dismiss/remove/dismissAll/custom`, plus two important helpers:
  - `withToast(fn, { loading, success, error, id })` (lines 149–181) — wraps an async op, delays the loading toast by `LOADING_THRESHOLD_MS` (500ms) so fast ops don't flash a spinner, always clears it, shows success/error after.
  - `resolveErrorMessage(err, override)` (lines 188–209) — turns an axios error into a human message: prefers `err.response.data.message/.error`, then offline/timeout/network detection, then status-code-specific copy (401/403/404/429/5xx).
  - Auto-dedup: `autoId(type, message)` gives same-message toasts a stable id so repeats replace rather than stack (lines 57–60).
- **`client/src/context/ToastContext.jsx`** — thin React binding (`useToast()` hook) delegating to `utils/toast.js`. Mounted in `client/src/App.jsx:151` (`<ToastProvider>`) with `<Toaster>` rendered at `App.jsx:156`.
- **Adoption:** 49 files import the toast module or `useToast()` (pages, hooks, `DaxApp.jsx`, `OfflineBanner.jsx`, etc.) — this is genuinely the dominant, well-designed pattern in the codebase, not a stub.

### 1.2 Backend notification system (fully built, in-app + SSE — but see §2/§4 for the disconnect)

- **`server/models/Notification.js`** — Mongoose schema: `user, type (enum of 17 values), title, body, link, read, actor, groupCount`, timestamps, compound index on `{user, createdAt}`.
- **`server/notifications/NotificationRegistry.js`** — single source of truth for 17 notification types (`reaction, rsvp, mention, announcement, task, career_alert, placement_apply, milestone, subscription, billing, credit_alert, ai_complete, ai_error, suggestion, general, system, session`), each with label/icon/color/priority/channel defaults (`inApp/email/push`)/group window.
- **`server/notifications/NotificationService.js`** — the engine: `send()` (dedup by type+title-prefix within a 5-min window or `dedupUnread` mode for recurring reminders, bump-not-duplicate), `sendBulk()`, `getHistory()`, `getUnreadByType()`, `markRead()`, `markAllRead()`, `remove()`. Every create/dedup-bump triggers an SSE broadcast via `NotificationStream`.
- **`server/notifications/NotificationStream.js`** — Server-Sent Events broadcaster. `GET /api/notifications/stream`, per-user client `Map`, 30s heartbeat, `broadcastToUser/Users`. Initialized at server startup (`server/index.js:297`) and shut down gracefully (`server/index.js:316`).
- **`server/controllers/notificationController.js`** — REST surface (`list, markRead, markAllRead, remove`) plus the `notify()`/`notifyBulk()` helpers other controllers call (routes through `NotificationService`, respects `LOCAL_OFFLINE_MODE`).
- **`server/routes/notificationRoutes.js`** — `GET /stream` (SSE, dual auth: header or `?token=` query param for `EventSource`), `GET /`, `PATCH /read-all`, `PATCH /:id/read`, `DELETE /:id`.
- **`server/events/bindNotifications.js`** — event→notification bridge. Maps **57 domain event types** (career, study, planner, finance, AI/Dax, subscription/billing, achievements, social, admin, system, intelligence) to notification templates, registered once via `registerAll(events)`.
- **8 controllers/services** call `notify()`/`notifyBulk()` directly (e.g. planner, career, community/social, engagement) in addition to the 57 event-bridge mappings.

### 1.3 Backend event bus (custom, MongoDB-backed)

- **`server/events/index.js`** — lightweight async event bus. `emit(type, userId, data)` persists a `BusEvent` doc and processes it on `process.nextTick` (immediate path) or via the polling worker. `on(prefix, handler)` / `onAny(handler)` registration by dot-prefix (`"profile."` matches `"profile.refresh-needed"`), longest-prefix-first dispatch, per-handler try/catch (one handler failing doesn't block others), retry up to `MAX_RETRIES=3`.
- **`server/events/domainEvents.js`** — typed convenience emitters per domain (`events.career.applicationSubmitted(userId, data)`, `events.ai.creditsLow(...)`, etc.), all wrapped in `safe()` so an emit failure only logs a warning and never throws into the caller.
- **`server/events/handlers/index.js`** — registers `profile.` handler + the notification bridge (`bindNotifications.registerAll`). Runs inside **`server/worker.js`**, a separate process that polls `BusEvent` for pending events (`pollBatch`).
- This is **not** Node's `EventEmitter`, Socket.io, or Redis pub/sub — it's a bespoke Mongo-polling bus explicitly designed to be swapped later ("When volume demands it, swap the MongoDB polling for Redis pub/sub"). No client-facing pub/sub — the only realtime channel to the browser is the SSE stream in §1.2.

### 1.4 API error handling

- **`client/src/api/axios.js`** — single shared axios instance. Request interceptor attaches JWT + `X-Device-Id` + `x-program` headers and tracks in-flight request count (`utils/inflight.js`, used to gate loading UI). Response interceptor: on any non-auth, non-login-page 401, calls a registered `onUnauthorized` callback (see §1.5) — but does **not** itself show any toast/message; it only clears session state.
- **`server/middleware/errorHandler.js`** — centralized Express error middleware. Maps Multer size errors, Mongoose `ValidationError`/`CastError`, duplicate-key (11000), and custom `err.statusCode` errors to clean `{ message }` JSON with the right status; everything else becomes a generic `500 { message: 'Something went wrong' }` with the real error/stack only going to `logger.error` server-side. **No stack traces or raw error objects are ever sent to the client** — this part is solid and consistent.
- `client/src/utils/toast.js`'s `resolveErrorMessage()` (see §1.1) is the client-side counterpart that turns whatever the server/network gives back into user copy.

### 1.5 Authentication / session infrastructure

- **`client/src/context/AuthContext.jsx`** — `login/logout/switchProgram`. `logout()` clears `token`, `activeProgram`, and every `dax:`-prefixed localStorage key, then registers itself as the axios `onUnauthorized` handler (lines 55–58) so an expired/invalid JWT forces a clean logout instead of the app rendering "logged in" against an API that rejects every call.
- **No user feedback is shown when this fires.** The 401→logout path is silent — no toast, no message — the user is simply redirected to `/login` by route guarding, with no explanation of *why* (see §3).
- `NotificationRegistry.js` already reserves a `session` type ("Session expiry, login alerts, security events", `channels: { push: true }`) that is defined but never triggered from the auth flow (see §5).

### 1.6 DAX / AI architecture and its feedback surfaces

- **`server/ai/dax.js`** (46 lines) — not a service, just the shared identity/prompt composer (`withDaxIdentity()`, `DAX_CORE`). No error handling lives here.
- **`server/ai/daxService.js`** (1457 lines) — the actual capability implementations (resume review, planner suggestions, career advice, mock interview, company comparison, etc.). Pattern: typed errors (`NotFoundError`, `ValidationError`) are thrown from capability functions and presumably caught by the route layer into `errorHandler.js`; ancillary side-effects (`appendTopic(...)`, deep-dive telemetry) are deliberately fire-and-forget via `.catch(() => {})` — acceptable since they're non-critical background bookkeeping, not user-facing mutations.
- **Two parallel, inconsistent Dax chat UIs:**
  - **`client/src/components/chat/DaxPanel.jsx`** — the ambient embedded panel mounted globally in `AppShell.jsx:201` (`<DaxPanel context={routeContext(location.pathname)} />`), so it's present on every workspace page. Its error handling (lines 86–93) is a bare `try { await daxChat(msg) } catch { setMessages(prev => [...prev, { role:'assistant', content: "I'm having trouble connecting. Please try again." }]) }` — a single generic inline message for *every* failure mode (network error, 429 rate limit, 500, validation error all look identical to the user). No toast, no status-specific copy, no retry affordance.
  - **`client/src/dax/DaxApp.jsx`** + **`client/src/dax/hooks/useDaxChat.js`** (the full-page `/dax` experience) — much richer: per-message `status` (`pending/streaming/done/error`), a distinct 429 message ("Daily message limit reached" + `upgradeUrl` passed through for an upgrade CTA), abort/stop handling that distinguishes user-cancelled from real failures. This is the better pattern but it is **not** shared with `DaxPanel.jsx` — two different implementations of "Dax failed to respond" exist side by side with different UX (see §2).
- `client/src/dax/maintenance.js` currently has `DAX_MAINTENANCE = true` (line 27) — Dax is presently running in a scripted maintenance-mode fallback across both surfaces, with its own `DAX_MAINTENANCE_BANNER` string rendered inline in `DaxPanel.jsx:139-142` (a third, ad-hoc "banner" — not routed through the toast or backend-notification systems).
- Model/usage widgets (`ModelSelector.jsx`, `useAiUsage.js`) fail **silently** — see §3.

### 1.7 Loading states

- `client/src/components/common/Loader.jsx`, `Skeleton.jsx`, `DATADLoader.jsx` — reusable loading primitives, used broadly (`FeedSkeleton` in `ResumePage.jsx:352`, etc.).
- `disabled={loading}`/`disabled={saving}` button-guard pattern used in at least 11 files (spot-checked in `ResumePage.jsx:119,123,370,491,494`).
- `client/src/utils/inflight.js` — global in-flight request counter (`beginRequest/endRequest`) driven by the axios interceptor, used to gate a global loading indicator without every call site managing its own flag.
- No dedicated skeleton-vs-spinner convention is enforced; usage is per-page discretion (not a defect, just worth noting for the target architecture's guidance).

### 1.8 Optimistic updates

- Two confirmed usages: `client/src/hooks/useSearch.js` and `client/src/pages/study/AssignmentsPage.jsx`. Not a widespread pattern — most mutations are the standard "await → update local state from response → toast" shape seen in `ResumePage.jsx` and dozens of other pages.

### 1.9 Banners (a third, separate feedback surface from toast/notification-bell)

- **`client/src/components/pwa/OfflineBanner.jsx`** — sticky top banner for connectivity, driven by `PWAContext`. **Also fires toast messages for the identical events** (`toast.warning('You're offline…', { id: OFFLINE_TOAST_ID, duration: 0 })` at line 34, `toast.success('Back online', …)` at line 52, `toast.info('Syncing your changes…', …)` at line 61) — i.e. the same connectivity transition produces both a persistent banner *and* a toast simultaneously (see §2).
- **`client/src/components/pwa/UpdateBanner.jsx`** — sticky top banner for "new version available," with its own `applyUpdate()` CTA button. Pure banner, no toast counterpart, no dismiss-without-acting affordance.
- **`DaxPanel.jsx:138-143`** — ad-hoc maintenance-mode banner (see §1.6), not built on any shared banner primitive.
- There is no shared `Banner`/`AlertBanner` component — each of these three banners is implemented independently.

### 1.10 window.alert / window.confirm / window.prompt

Three real usages of native browser dialogs (bypassing every in-app feedback system):
- `client/src/dax/components/layout/ConversationListItem.jsx:68` — `window.prompt('Rename chat', conversation.title || 'New chat')`.
- `client/src/pages/career/LinkedInPage.jsx:94` — `window.confirm('Delete your imported LinkedIn profile and every analysis of it? This cannot be undone.')`.
- `client/src/pages/career/StarStoriesPage.jsx:149` — bare global `confirm('Delete this story?')` (same as `window.confirm`, just unprefixed).

No other alert/confirm/prompt usages found in `client/src` or `server` (verified excluding `client/dist` build output, which mirrors the same three via minified bundles and is not separately counted).

### 1.11 Error boundary

- **`client/src/components/common/ErrorBoundary.jsx`** — single class-based boundary, `componentDidCatch` only logs to `console.error`, renders a generic "This section hit an unexpected error" card with Refresh/Go-to-dashboard actions. Used app-wide (imported in `App.jsx`). Clean, consistent, no complaints — but it's a fourth independent "something went wrong" UI surface, alongside toast/banner/backend-notification, with its own visual language.

---

## 2. Duplicate / competing systems

1. **Two Dax chat error-handling implementations** (§1.6): `DaxPanel.jsx` (generic inline fallback string) vs. `useDaxChat.js`/`DaxApp.jsx` (status-based, rate-limit-aware, upgrade-CTA-aware). Same underlying feature, materially different failure UX depending on which surface the student is using.
2. **OfflineBanner fires both a banner and a toast for the same event** (§1.9): connectivity transitions produce a sticky top banner *and* a `toast.warning/success/info` simultaneously — genuinely redundant, not just parallel systems that happen to coexist.
3. **Backend notification-history model is fully built (§1.2) but has zero frontend consumer** (see §4 — this is the single biggest structural finding of the audit).
4. **Four independent "something's wrong" visual languages** with no shared design system: toast (rounded pill, bottom corner), banner (full-width sticky strip, two different implementations for offline vs. update), backend notification (bell/list — except there's no bell, see §4), and `ErrorBoundary` (centered card). None share styling tokens or a common `notify()`-style API.
5. **Dead/orphaned notification code confirms an abandoned integration attempt:**
   - `client/src/context/NotificationContext.jsx.backup` and `client/src/context/NotificationContext.jsx.notifications-backup` (both 11,570 bytes, byte-identical) — a fully-written `NotificationProvider` (SSE subscribe + polling fallback + `unreadCount`/`lastNotification`/read/delete mutations) exists only as two backup files with **no live `.jsx` file** at that path.
   - `client/src/App.jsx.notifications-backup` — an older version of `App.jsx` that *does* import and mount `NotificationProvider` (`import { NotificationProvider } from './context/NotificationContext';`, wrapping the tree). The **live** `App.jsx` has had that import and provider removed (diff confirmed: live `App.jsx` is missing exactly the `NotificationProvider` import/usage the backup has).
   - No `client/src/api/notifications.js` exists, and nothing in live `client/src` references `NotificationContext` or `useNotification` at all (`grep` returned zero matches outside the `.backup` files).
   - **Net effect:** the backend creates `Notification` documents, dedups them, broadcasts them over SSE, and exposes a full REST CRUD surface — and none of it is ever displayed to a user. There is no bell icon, no notification center/inbox, no badge, no dropdown anywhere in the live frontend.

---

## 3. Problems found

### Silent failures (catch blocks with console-only or empty handling, no user feedback)

- `client/src/dax/components/settings/ModelSelector.jsx:18-21` — failed model list fetch: `console.error('Failed to load models:', err.message)` only; component just returns `null` (line 35: `if (loading || !models.length) return null`), so the picker silently vanishes with no explanation.
- `client/src/dax/components/settings/ModelSelector.jsx:29-32` — **this is a mutation** (`setModelPreference(modelId)`) whose failure is entirely silent: `console.error('Failed to set model preference:', err.message)`, no toast, no revert of the optimistic `setPreference(modelId)` UI state on line... actually `setPreference` is only called on success here, but the user gets zero indication the save failed.
- `client/src/dax/hooks/useAiUsage.js:13-15` — usage-quota fetch fails silently; hook returns `{ usage: null, loading: false }` indistinguishable from "no usage data yet."
- `client/src/pages/EntertainmentDetailPage.jsx:59-60` (`handleAddMemory`) — silent `console.error('Failed to post memory:', err)`, **directly adjacent to** `onToggleLike`/`onToggleBookmark` in the same file which correctly call `toast.error(...)` on failure (lines ~36, 49) — a clear same-file inconsistency, not just a missing pattern elsewhere.
- `client/src/pages/ResumePage.jsx:295-309` — fetching the student's existing resume on mount uses `.catch(() => {})` before `.finally(() => setLoading(false))`. A genuine server error (not just "no resume yet") is indistinguishable from an empty state; the user could unknowingly overwrite a resume they believe doesn't exist.
- Server-side fire-and-forget patterns in `server/ai/daxService.js` (`.catch(() => {})` at lines 129, 222, 390, 391, 442, 506, 543, 580, 623) and empty `catch {}` blocks in `server/index.js:317`, `server/search/searchRegistry.js:205`, `server/search/searchRouter.js:118`, `server/ai/daxService.js:250`, `server/routes/daxRoutes.js:181` are **appropriate** — these are non-critical telemetry/cleanup paths, not user-facing mutations, and are called out here only to distinguish them from the client-side cases above, which are not appropriate.

### Missing/inconsistent feedback on session expiry

- `client/src/context/AuthContext.jsx:55-58` — the 401→logout path (triggered from `client/src/api/axios.js:62-64`) is completely silent. No toast, no banner, no use of the already-defined `session` notification type in `NotificationRegistry.js` (which explicitly lists "Session expiry, login alerts, security events" as its use case, with `push: true`). The user is simply bounced to `/login` with zero explanation.

### Inconsistent feedback style within the same feature

- Dax chat: two different failure UX depending on `DaxPanel` vs `DaxApp` (§1.6, §2).
- Native browser dialogs bypass the app's design system entirely in 3 spots (§1.10) — `window.confirm`/bare `confirm()` for destructive deletes (LinkedIn profile deletion, STAR story deletion) render an unstyled OS dialog while every other destructive-action confirmation in the codebase presumably uses the in-app `Modal` component (e.g. `StarStoriesPage.jsx` itself imports `Modal` from `../../components/common/Modal` for its edit flow, but not for delete confirmation).

### Raw error leakage

- **None found.** `server/middleware/errorHandler.js` consistently strips stack traces and internal error details before sending to the client; `resolveErrorMessage()` on the frontend has sensible fallbacks. This is a genuine strength to preserve in the target architecture, not a problem.

---

## 4. Missing coverage

- **The entire backend notification system has no frontend surface.** This is the headline finding: `Notification` model, `NotificationService`, `NotificationRegistry` (17 types), `NotificationStream` SSE broadcaster, `notificationController`/`notificationRoutes`, and the 57-event `bindNotifications` bridge are all live and running on the server, but a user can never see a notification, a bell icon, an unread badge, or a notification history — the one piece that would consume it (`NotificationContext.jsx`) exists only as two backup files and was removed from `App.jsx`.
- **Session expiry gives no feedback** (§3) despite a notification type existing specifically for it.
- **`ModelSelector.jsx` and `useAiUsage.js`** give no feedback on fetch/save failure (§3).
- **Resume-fetch-on-mount** gives no feedback on failure distinct from "empty" (§3).
- **`DaxPanel.jsx`** (the panel mounted on *every* workspace page via `AppShell.jsx:201`) gives no differentiated feedback for rate-limiting, auth errors, or server errors — everything collapses to "I'm having trouble connecting."

---

## 5. Architectural inconsistencies

1. **Backend built for a frontend that isn't wired up.** The notification system was clearly designed end-to-end (SSE, dedup, grouping, registry, 57 event mappings) and then the frontend integration was reverted/abandoned mid-flight (the `.backup` files are byte-identical, suggesting a deliberate "comment this out for now" removal rather than an accidental loss).
2. **Three unrelated "channel" concepts with no shared vocabulary:** transient toast (`utils/toast.js`), persistent backend notification (`Notification` model + `NotificationRegistry` types), and ad-hoc sticky banners (`OfflineBanner`, `UpdateBanner`, the inline Dax maintenance banner). `NotificationRegistry.js` already models `channels: { inApp, email, push }` per type — toast isn't a channel in that model at all, even though in practice toast *is* how most "inApp" feedback currently reaches the user for ephemeral events. A unified system needs to decide: is toast a *rendering* of an in-app notification, or a wholly separate, shorter-lived concept? Right now it's implicitly the latter, undocumented.
3. **Two Dax chat surfaces, two failure vocabularies** (§1.6, §2) for what the product explicitly wants to be "one intelligence" per `server/ai/dax.js`'s own doc comment ("Dax is one intelligence with many jobs").
4. **The event bus (`server/events/index.js`) already has the exact fan-out shape a notification system needs** (`emit(type, userId, data)`, prefix-based `on()`, catch-all `onAny()`) but only the backend notification bridge listens to it — nothing in the frontend is event-bus-aware, so there's no way today for, say, a real-time toast to fire off a domain event the way the backend notification does.
5. **No shared `notify()`-style single entry point.** Backend has one (`notificationController.notify()` / `NotificationService.send()`), frontend has one for toast (`utils/toast.js`), but they are not the same function and don't compose — a controller emitting a domain event gets an in-app notification row + SSE push automatically, but nothing bridges that SSE push back into a frontend toast today (because there's no SSE consumer at all, per §4).

---

## 6. Recommended target architecture

Naming follows the codebase's existing conventions (`ToastContext`/`useToast`, `NotificationService`/`NotificationRegistry`/`NotificationStream`, `domainEvents`) rather than introducing new vocabulary.

### 6.1 Frontend

- **Keep `client/src/utils/toast.js` and `client/src/context/ToastContext.jsx` as the transient-feedback layer** — they're well-built, widely adopted (49 files), and already have the right primitives (`withToast`, `resolveErrorMessage`, dedup-by-id). Do not replace `react-hot-toast`; extend what's there.
- **Restore and finish `NotificationContext.jsx`** from the `.backup` (it already has the right shape: SSE subscribe + polling fallback + `unreadCount`/`notifications`/`markRead`/`markAllRead`/`remove`). Rename the exported hook to `useNotifications()` (data layer) to avoid colliding with `useToast()`, matching the existing doc comment in the backup file: *"Toast display lives in ToastContext[;] Session expiry lives in AuthContext."*
- **Add the missing bridge**: when `NotificationContext` receives a new SSE `notification` event, it should optionally fan it out to `toast.show(...)` for high-priority types (`NotificationRegistry.getTypePriority(type) <= 1`, e.g. `session`, `mention`, `career_alert`, `credit_alert`) so time-sensitive events get an ephemeral toast *and* a persistent history entry, while low-priority types (`reaction`, `suggestion`) only join the history/bell. This directly resolves the "toast vs. notification, which is which" ambiguity in §5.2 with a concrete rule instead of an implicit one.
- **Build the missing UI**: `client/src/components/notifications/NotificationBell.jsx` (badge + dropdown/panel), consuming `useNotifications()`. Mount it in `AppShell.jsx` next to wherever the current header/nav lives (same file that already mounts `DaxPanel.jsx` at line 201, so the wiring pattern is established).
- **Consolidate the Dax chat error path**: extract `useDaxChat.js`'s status-based error handling (429-aware, `upgradeUrl`-aware) into a shared helper both `DaxPanel.jsx` and `DaxApp.jsx` import, so "Dax failed" means the same thing everywhere. At minimum, `DaxPanel.jsx`'s catch block should call `resolveErrorMessage(err)` from `utils/toast.js` instead of a single hardcoded string.
- **Fold banners into the same vocabulary**: give `OfflineBanner`/`UpdateBanner` a shared `Banner`/`SystemBanner` primitive, and stop `OfflineBanner` from firing both a banner *and* a toast for the same transition — pick one (the banner already carries an icon + copy; the toast is redundant unless the point is to catch users who are looking elsewhere, in which case say so explicitly rather than doing both by accident).
- **Wire session expiry through the same rail**: `AuthContext.logout()` should call `toast.warning("Your session expired — please sign in again", { id: 'session:expired' })` (the exact copy `resolveErrorMessage()` already produces for a 401 at `utils/toast.js:202` — reuse it) before clearing state, and/or emit a client-side `session`-type entry into `NotificationContext` so it's visible in history too.
- **Eliminate the three `window.confirm`/`window.prompt` call sites** (`ConversationListItem.jsx:68`, `LinkedInPage.jsx:94`, `StarStoriesPage.jsx:149`) in favor of the existing in-app `Modal` component (already used elsewhere in `StarStoriesPage.jsx` for editing) — a `ConfirmModal`/`PromptModal` wrapper around `Modal` would cover all three with one component.
- **Fix the four identified silent catches** (`ModelSelector.jsx:18,29`, `useAiUsage.js:13`, `EntertainmentDetailPage.jsx:59`, `ResumePage.jsx:309`) to call `toast.error(resolveErrorMessage(err))` at minimum, or set a visible error/retry state for read-only fetches.

### 6.2 Backend

- **Keep the entire backend stack as-is** — `NotificationService`, `NotificationRegistry`, `NotificationStream`, `bindNotifications`, `domainEvents`/`events/index.js` — it is well-designed (dedup windows, grouping, typed channels, retry) and does not need architectural changes, only a consumer.
- **Close the loop for session events**: add `events.system.sessionExpiry(userId, {})` calls (the `domainEvents.system.sessionExpiry` emitter already exists at `domainEvents.js:112` but appears unused by any caller — verify and wire it from the JWT-verification middleware on 401, or from a scheduled token-expiry sweep) so `session`-type notifications actually get created, closing the gap noted in §3/§4.
- **No new persistent model needed** — `Notification.js` already covers it; just needs a consumer.

### 6.3 Integration with existing AI/event infra

- Dax-originated feedback (`ai_complete`, `ai_error`, `suggestion`, `credit_alert` types already exist in `NotificationRegistry.js`) should flow through the *same* `domainEvents.ai.*` emitters already defined in `server/events/domainEvents.js:64-71` — several are defined but should be audited for actual call sites during implementation (e.g. confirm `ai.creditsLow`/`ai.creditsExhausted` are actually invoked from the credit-check logic, not just declared).
- The maintenance-mode banner in `DaxPanel.jsx` should become a `system`-type notification (or at minimum route through the new shared `Banner` primitive from §6.1) rather than being hardcoded inline JSX.

---

## 7. Migration plan

**Phase 2a — Frontend notification consumer (closes the biggest gap, §4):**
1. Restore `client/src/context/NotificationContext.jsx` from `NotificationContext.jsx.backup` (they're identical; delete the redundant `.notifications-backup` duplicate once restored).
2. Re-add `import { NotificationProvider } from './context/NotificationContext'` and wrap it back into `client/src/App.jsx` (the exact insertion point is recoverable from `App.jsx.notifications-backup`, which still has it).
3. Create `client/src/api/notifications.js` (thin axios wrapper around `GET /api/notifications`, `PATCH /read-all`, `PATCH /:id/read`, `DELETE /:id`, plus the SSE `EventSource` connection to `/api/notifications/stream`) — this file does not currently exist and `NotificationContext.jsx.backup` already imports it, so it must be created, not just restored.
4. Build `NotificationBell.jsx` and mount it in `AppShell.jsx`.
5. Delete the two `.backup`/`.notifications-backup` files once the restore is verified working, to remove the dead-code confusion flagged in §2.

**Phase 2b — Toast/notification bridge:**
6. Add the priority-based fan-out from SSE → toast described in §6.1, using `NotificationRegistry.getTypePriority()` (already exported from the service as `getTypePriority`) as the threshold.
7. Wire `AuthContext.logout()` to show a toast on forced (401-triggered) logout, distinct from a deliberate user-initiated logout (which should stay silent/immediate).

**Phase 2c — Consistency cleanup (low-risk, mechanical):**
8. Replace the 3 `window.confirm`/`window.prompt` call sites with a `ConfirmModal` built on the existing `Modal` component.
9. Fix the 4 identified silent catches to surface `toast.error(resolveErrorMessage(err))`.
10. Extract `useDaxChat.js`'s error-classification logic into a helper shared with `DaxPanel.jsx`.
11. Consolidate `OfflineBanner`'s duplicate banner+toast firing into one signal.

**Phase 2d — Backend loop closure:**
12. Verify/wire the `session` notification type from the JWT-expiry path (`domainEvents.system.sessionExpiry`, currently defined but apparently uncalled) and confirm `ai.creditsLow`/`ai.creditsExhausted` are actually invoked from credit-check logic (both are defined in `domainEvents.js` but their call sites weren't confirmed in this audit — flagged for Phase 2 verification, not assumed broken).

Each phase is independently shippable and testable; Phase 2a alone (restoring the frontend notification consumer) delivers the largest user-visible improvement since it turns on a fully-built backend system that currently does nothing observable.

---

## 8. Implementation status (Phases 2a–2d)

All four phases above have shipped in this pass.

### 2a — Frontend notification consumer
- Restored `client/src/context/NotificationContext.jsx` from the `.backup` (SSE + polling fallback, read/delete mutations); added an `error` state so the panel can distinguish "couldn't load" from "no notifications." Deleted both dead `.backup` files.
- Created `client/src/api/notifications.js` (didn't exist in the working tree; turned out to be byte-identical to the version deleted at commit `a9feb2c`, so no drift).
- Re-added `NotificationProvider` to `client/src/App.jsx`; deleted the now-redundant `App.jsx.notifications-backup`.
- Built `client/src/components/notifications/NotificationBell.jsx` (badge, Today/Earlier grouping, mark-read/mark-all-read, per-item dismiss, deep links, loading/error/empty states, `date-fns` for relative time) and mounted it in `AppShell.jsx`'s desktop and mobile header rows.
- Backend: `server/notifications/NotificationService.js` and `server/controllers/notificationController.js` now include `priority`/`icon`/`color` (via `NotificationRegistry`) in every notification payload — SSE and REST — so the frontend doesn't duplicate the registry's type metadata.

### 2b — Toast/notification bridge
- SSE→toast fan-out: notifications with `priority ≤ 1` also fire a toast (`TOAST_VARIANT_BY_TYPE` maps each registry type to success/error/warning/info); everything else joins the bell quietly.
- `AuthContext.logout(reason)`: a forced 401 logout now shows `toast.warning('Your session expired — please sign in again')`; a deliberate logout click stays silent, matching the audit's recommendation.

### 2c — Consistency cleanup
- Fixed the 4 identified silent catches (`ModelSelector.jsx`, `useAiUsage.js`, `EntertainmentDetailPage.jsx`, `ResumePage.jsx`) — each now surfaces `toast.error(resolveErrorMessage(...))` or an equivalent message; `ModelSelector`'s model-preference save is now optimistic-with-revert instead of silently failing.
- Replaced all 3 `window.confirm`/`window.prompt` call sites:
  - `LinkedInPage.jsx` and `StarStoriesPage.jsx` now use the **existing, already-widely-used** `ConfirmModal` (13 other pages already depended on it — see note below).
  - `ConversationListItem.jsx`'s rename prompt now uses a new `client/src/dax/components/common/PromptModal.jsx`, styled with Dax's own `--dax-*` tokens rather than the main app's `Modal`, matching how `SettingsPanel.jsx` already does it.
- Extracted `useDaxChat.js`'s status-based error classification (429/upgrade-aware) into `client/src/dax/lib/classifyDaxError.js`; `DaxPanel.jsx`'s catch block now uses it instead of one hardcoded string, so "Dax failed" reads the same on both surfaces.
- `OfflineBanner.jsx` no longer fires a redundant toast alongside the sticky offline/online banner (the banner is always on-screen while relevant); the background-sync toast is unchanged since it's the only signal for that case.

**Near-miss caught during this phase:** `client/src/components/common/ConfirmModal.jsx` already existed and was in live use by 13 other pages (`PlannerPage`, `AlbumsListPage`, `NoteDetailPage`, `JournalPage`, `DaxProfilePanel`, four Admin pages, `FinanceTrackerPage`, and now `LinkedInPage`/`StarStoriesPage`). An initial pass wrote a new, simpler `ConfirmModal.jsx` without checking for an existing component first, which would have changed prop defaults (`danger` and `confirmLabel`) and dropped `role="alertdialog"`/autofocus/Escape handling for every existing caller. Caught via `git status` showing the file as modified rather than new, verified against git history, and reverted before it reached the user. `LinkedInPage`/`StarStoriesPage` were then adapted to the real component's actual contract (fire-and-forget confirm with toast feedback, matching every other caller) rather than the other way around.

### 2d — Backend loop closure
- Found and fixed a real bug: `usageMeter.checkAndNotifyCredits(userId, tier)` was fully implemented (correct `credit_alert` thresholds for exhausted/low) but never called from any of the three `chargeCredits()` sites (`aiGateway.js` ×2, `daxService.js`) — no student had ever received a credit-alert notification. Wired it in as `.then(() => checkAndNotifyCredits(...))` after each charge, fire-and-forget like the existing metering calls.
- `domainEvents.ai.creditsLow`/`creditsExhausted` remain deliberately unwired: they're superseded by the now-active `checkAndNotifyCredits` path, and wiring both would create a second independent trigger for the same `credit_alert` type.
- `domainEvents.system.sessionExpiry` deliberately left unwired: the frontend session-expiry toast (2b) already closes the actual UX gap, and the backend equivalent would require decoding an already-expired-and-unverified JWT to recover a `userId` — meaningful added risk for a persistent notification that would arrive after the user has already been shown the login page.

### Testing
- `server/tests/usageMeterCreditAlerts.test.js` (new, 5 tests, all passing) covers `checkAndNotifyCredits`'s thresholds and its never-throws guarantee.
- Full backend suite: 392/400 passing. The 8 failures are all in `resumeDelivery.test.js`, caused by a leftover `priya@datad.test` user in the shared test database from **2026-08-18** — two days before this session, unrelated to any file touched here (confirmed via `git status` and record `createdAt`).
- Every touched frontend file passes `eslint` individually; `npm run build` succeeds. No frontend test runner exists in this project (no Jest/Vitest configured for `client/`), so frontend coverage is manual: verified end-to-end against the test database (bell badge, Today/Earlier grouping, mark-read, mark-all-read, deep-link navigation, priority/icon/color payload fields) via a disposable seed script, cleaned up afterward.
- Not done: broader coverage for Talent Exchange, Placement, and Admin/teacher event → notification wiring (the 57-event `bindNotifications` bridge itself was already live and unchanged by this pass — only the frontend consumer and the specific gaps above were in scope this round).
