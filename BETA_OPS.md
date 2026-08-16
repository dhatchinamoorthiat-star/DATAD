# DATAD Beta Operations

**Beta version:** v1.0-beta
**Branch:** `feat/cloudflare-workers-ai-fallback`
**Invite window:** November 2026 (4 weeks)
**Participants:** 20–30 final-year students

---

## 1. Beta Deployment Checklist

### Pre-Deployment (T-7 days)

```
[ ] All P0 items from BETA_READINESS.md completed
    [ ] Client analytics (track() + POST /api/beta/events)  
    [ ] Sentry crash reporting (VITE_SENTRY_DSN set)  
    [ ] Feature flag system (config/features.js + client/utils/features.js)  

[ ] Environment variables verified on production server
    [ ] MONGODB_URI         — production Atlas cluster (not dev)
    [ ] JWT_SECRET          — fresh, strong value (never reuse dev)
    [ ] CLIENT_URL          — production domain(s) in comma-separated list
    [ ] NVIDIA_API_KEY      — production key with quota
    [ ] NVIDIA_API_KEY_2    — standby key for failover
    [ ] AI_REQUEST_TIMEOUT_MS — set to 20000 (prevents hung sockets)
    [ ] ADMIN_EMAIL         — set to the actual admin's email
    [ ] VITE_SENTRY_DSN     — Sentry project DSN

[ ] CORS allow-list tested
    [ ] Production domain returns 200
    [ ] Unknown domain returns 403

[ ] Production build tested
    [ ] `npm run build` in client/ succeeds
    [ ] All API endpoints accessible through the build

[ ] Rate limits confirmed for beta scale (30 users)
    [ ] General: 1000 req/15 min — fine for 30 users
    [ ] Auth: 20 req/15 min — fine for registration wave
    [ ] Beta events: 120 req/min — fine for analytics

[ ] Analytics endpoint live
    [ ] POST /api/beta/events returns 201
    [ ] Events visible in BetaEvent collection

[ ] Migration run
    [ ] `node server/scripts/backfillPivotPlanType.js` executed (if DB has pre-existing data)

[ ] Sentry test
    [ ] Force an error on staging, verify it appears in Sentry dashboard
```

### Deployment Day

```
[ ] Production build deployed
    [ ] `cd client && npm run build` → dist/ uploaded
    [ ] Server started with production .env
    [ ] `curl /api/health` returns { status: 'ok' }

[ ] User invite link generated
    [ ] Registration URL shared with beta cohort
    [ ] Optional: referral codes pre-generated for 30 users

[ ] Sentry health check
    [ ] Sentry dashboard shows initial page-load transaction

[ ] Analytics test
    [ ] Register a test account, navigate to /career/roadmap
    [ ] Generate a roadmap
    [ ] Verify event appears in BetaEvent collection

[ ] All feature flags at defaults (enabled)
    [ ] FF_* vars not set → features enabled
```

---

## 2. Rollback Plan

### When to Roll Back

Trigger a rollback if any of these occur:

| Trigger | Threshold | Action |
|---------|-----------|--------|
| **API error rate** | >5% of requests return 5xx in a 5-min window | Roll back server |
| **Auth failure** | >3 reports of login/register failing | Roll back server |
| **Data loss** | Any user reports data disappearing | Roll back + restore DB backup |
| **AI generation pipeline down** | >60 min without successful roadmap generation | Disable `FF_AI_ROADMAP_GENERATION=false`, restart |
| **Sentry crash rate** | >10 errors in 1 hour from unique users | Roll back client |

### Rollback Steps

**Server rollback (2 min):**
```bash
# 1. Point to the previous deployment artifact
git checkout <previous-stable-tag>
npm install
pm2 restart datad-server

# 2. Verify health
curl /api/health

# 3. Notify users on the status page / in-app banner
```

**Client rollback (1 min):**
```bash
# 1. Rebuild previous client
git checkout <previous-stable-tag> -- client/
cd client && npm run build

# 2. Redeploy dist/ to CDN or static host

# 3. Verify by loading the app in a browser
```

**Feature flag rollback (instant):**
```bash
# 1. Disable the problem feature without deploying code
export FF_ROADMAP_AUTO_ADVANCE=false
pm2 restart datad-server

# OR set in production .env and restart
```

**Database rollback (last resort):**
```bash
# 1. Restore from the most recent Atlas snapshot
# Atlas automated snapshots: every 24h, retained 7 days

# 2. Verify data integrity with a test query
node -e "require('./models/PivotPlan').countDocuments().then(c => console.log(c))"

# 3. Re-run any necessary migrations
node server/scripts/backfillPivotPlanType.js
```

### Post-Rollback

```
[ ] Identify root cause (Sentry event + server logs)
[ ] Fix the issue in a new branch
[ ] Deploy the fix
[ ] Notify beta users that the issue is resolved
```

---

## 3. Monitoring Checklist

### Server Monitoring (daily checks)

```
[ ] API health endpoint
    [ ] curl /api/health → { status: 'ok' }
    [ ] Response time < 200ms

[ ] MongoDB Atlas monitoring
    [ ] Connections: < 50% of limit
    [ ] CPU: < 80%
    [ ] Disk I/O: no throttling events

[ ] AI provider availability
    [ ] NVIDIA API key valid
    [ ] Standby keys (NVIDIA_API_KEY_2, etc.) valid
    [ ] No >10% error rate from any provider

[ ] Error logs
    [ ] tail -n 100 server/logs/error.log (if file-based logging configured)
    [ ] No repeated errors or stack traces
```

### Client Monitoring (Sentry dashboard)

```
[ ] Error rate: < 1% of page loads
[ ] Crash-free rate: > 99%
[ ] No unhandled rejections or type errors
```

### Analytics Monitoring (MongoDB BetaEvent collection)

```
[ ] Events arriving consistently
[ ] No duplicate or malformed event names
[ ] All event names are snake_case (no spaces, no mixed case)
```

### Performance Monitoring

```
[ ] Roadmap generation: < 30s median
[ ] Dashboard page load: < 2s
[ ] API P95 latency: < 1000ms
```

---

## 4. Daily Beta Operations Checklist

### Morning (5 min)

```
[ ] Check Sentry dashboard for overnight errors
[ ] Check `PivotPlan` collection: active roadmap count increased?
    db.pivotplans.countDocuments({ planType: 'roadmap' })
[ ] Check `BetaEvent` collection: any events from yesterday?
    db.betaevents.distinct('event')
[ ] Quick health check: curl /api/health
[ ] One log scan: server/error.log tails
```

### Mid-Day (10 min — optional if all green)

```
[ ] Review any support messages from students
[ ] Check roadmap completion stats
    db.pivotplans.aggregate([
      { $match: { planType: 'roadmap' } },
      { $project: { total: { $size: '$skillGaps' }, done: { $size: { $filter: { input: '$skillGaps', cond: { $eq: ['$$this.status', 'done'] } } } } } }
    ])
[ ] Quick AI provider check: NVIDIA API responded in last hour?
```

### Weekly (30 min)

```
[ ] Export BetaEvent data for analysis
[ ] Check 7-day retention (users who returned after day 7)
[ ] Review Sentry weekly report
[ ] Prepare for Friday debrief call
```

---

## 5. First-Week Beta Review Template

### Day 1: Activation Check

Run these queries on day 1 evening:

```javascript
// How many invited users registered?
User.countDocuments({ createdAt: { $gte: oneDayAgo } });

// How many generated a roadmap?
BetaEvent.countDocuments({ event: 'roadmap_generated', timestamp: { $gte: oneDayAgo } });

// Activation rate
// (roadmap_generated count ÷ user count) × 100

// Any generation errors?
BetaEvent.countDocuments({ event: 'roadmap_generation_failed' });
```

### Day 3: Engagement Check

```javascript
// How many checked in daily?
BetaEvent.distinct('user', { event: 'daily_checkin_added', timestamp: { $gte: threeDaysAgo } });

// Average sessions per user
BetaEvent.aggregate([
  { $match: { event: 'dashboard_viewed', timestamp: { $gte: threeDaysAgo } } },
  { $group: { _id: '$user', sessions: { $sum: 1 } } },
  { $group: { _id: null, avgSessions: { $avg: '$sessions' } } }
]);

// Roadmap items completed
BetaEvent.countDocuments({ event: 'roadmap_item_completed', timestamp: { $gte: threeDaysAgo } });
```

### Day 7: Retention Check

```javascript
// 7-day retention
const activated = await BetaEvent.distinct('user', { event: 'roadmap_generated', timestamp: { $gte: sevenDaysAgo } });
const returned = await BetaEvent.distinct('user', { event: 'dashboard_viewed', timestamp: { $gte: sevenDaysAgo } });
// retained = users who were in BOTH sets (intersection)
// retention_rate = intersection.length / activated.length * 100

// NPS survey results from checkpoint 1
// manually collect from in-app survey
```

### Day 14: Mid-Point Review

```
Topics to cover in the debrief:
1. Activation rate — target ≥60%
2. Daily check-in rate — target ≥40%
3. Roadmap completion rate — target ≥20% (items toggled done)
4. Pain points reported in feedback calls
5. Top 3 bugs from Sentry
6. Any user churn — did someone stop using it entirely? Why?
7. Should we continue the beta for another 2 weeks?
```

### Day 28: Final Review

```
Topics:
1. Overall NPS — target ≥30
2. 7-day retention — target ≥50%
3. Feature adoption: which features did users actually use?
4. Top feedback themes from all 4 weeks
5. P0/P1 items to address before public launch
6. Launch decision: GO / CONDITIONAL / NO-GO
```

### Debrief Call Agenda (30 min, every Friday)

```
1. (5 min) Metrics review
   - Activation, retention, check-in rate, NPS
   - Green/yellow/red each metric

2. (10 min) User feedback themes
   - Top 3 positive signals
   - Top 3 pain points
   - Any WTF moments

3. (5 min) Bug report
   - New bugs from Sentry (last 7 days)
   - Regression check

4. (10 min) Decision
   - Continue beta? Adjust scope? Pivot?
   - Assign P0/P1 items for next sprint
```

---

## Appendix: Emergency Contacts

| Role | Person | Contact |
|------|--------|---------|
| Server ops | [Name] | [Phone/Slack] |
| DB admin | [Name] | [Phone/Slack] |
| AI provider billing | [Name] | [Email] |
| Product owner | [Name] | [Slack] |
