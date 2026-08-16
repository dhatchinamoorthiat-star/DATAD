# Talent Exchange — Phase 2 Production-Readiness Audit

Source of truth for the Phase 2.1 hardening pass. Severity ladder: Critical > High > Medium > Low.

## 🔴 CRITICAL

### C1 — `accept()` is not atomic: double-accept & slot oversubscription
`applicationService.accept` does read → check → `engagementService.create` → `app.save()` → `opp.slotsFilled += 1; opp.save()`, none of it atomic. Concurrent requests (double-click, retry, or two applicants on a 1-slot opportunity) both pass the guard and **both create an Engagement** (no unique constraint on `Engagement.application`); `slotsFilled` is under-counted (last-write-wins). In Phase 3 this means **double escrow holds**.
**Fix:** compare-and-swap application claim + `$inc` slot claim guarded by `slotsFilled < slotsTotal`; unique index on `Engagement.application`; wrap in a transaction.

## 🟠 HIGH

### H1 — Lifecycle transitions use `findOne`+`save` → duplicate events & lost updates
Every transition (engagement start/submit/complete/cancel; opportunity publish/close/update/archive; application withdraw/reject) is read-modify-write. Two concurrent `complete()` both emit `engagement.completed` → double reputation/credit in Phase 3. Also silent stale writes.
**Fix:** atomic `findOneAndUpdate({_id, status:<expectedFrom>}, …)`; emit only when a doc is returned.

### H2 — Multi-document writes are not transactional
`accept` (3 collections), `freeze` (engagement + case), `createConversation` (conversation + engagement) can partially fail, leaving inconsistent aggregates and, on `accept`, a committed mutation with **zero** events.
**Fix:** wrap in `session.withTransaction`; degrade gracefully (documented) when the server has no replica set.

### H3 — `apply()` bypasses the visibility check (IDOR)
`getById` enforces `canView` (public / same-program / owner) but `apply` only checks `status:'open'` + non-owner, so a user who obtains a private/foreign-program opportunity id can apply.
**Fix:** reuse `canView` inside `apply`.

## 🟡 MEDIUM (not in Phase 2.1 scope)
- M1 feed compound index `{status,createdAt:-1}`
- M2 stricter rate limiter on create/apply/message
- M3 soft-delete is convention-only
- M4 non-idempotent retries (mostly resolved by H1)

## 🟢 LOW (not in Phase 2.1 scope)
- L1 dead code `_internal.loadRaw`
- L2 duplicated visibility `$or` / `isParticipant`
- L3 inconsistent response shapes
- L4 `/reviews` body id vs nested route
- L5 unvalidated filter passthrough

## Phase 2.1 scope
Resolve **C1, H1, H2, H3** only, without schema redesign or API changes. Medium/Low deferred.
