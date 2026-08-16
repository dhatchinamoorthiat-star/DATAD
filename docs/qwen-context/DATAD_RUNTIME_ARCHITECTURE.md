# DATAD Runtime Architecture & Execution Platform


## V3 — Production-Grade Execution for the Student Intelligence Operating System

> *The ontology defines what exists. The intelligence engine defines how it thinks. The runtime defines how it runs.*

---

**Phase:** Version 3 — Runtime & Execution Platform
**Author:** Chief Platform Architect
**Date:** July 23, 2026
**Scope:** Production execution architecture for all DATAD services

---
## Section 1: Runtime Philosophy


### Execution Principles


```
P1. Services are stateless by default. State lives in databases, caches, and event streams.
    Stateless services scale horizontally with zero coordination.

P2. Stateful services are isolated. Each stateful service owns its data exclusively.
    No other service reads or writes another's database.

P3. Communication is via APIs or events, never via shared databases.
    A service that reads another's database directly is a bug.

P4. Every operation has an owner. There is no 'shared nothing' ambiguity.
    Each side effect maps to exactly one service responsibility.

P5. Every mutation produces an event. Events are the audit trail.
    Replaying events reconstructs state. There is no silent mutation.

P6. Degrade gracefully. Every dependency can fail.
    Every service has a degraded mode with reduced functionality.

P7. Latency budgets are explicit. Every service declares its p95 SLA.
    A service that exceeds its SLA budget triggers an alert, not a cascade.

P8. Consistency is explicit. Every operation declares its consistency requirement.
    Strong consistency: synchronous with read-your-writes.
    Eventual consistency: acceptable for all intelligence and recommendations.

P9. Infrastructure is cattle, not pets. Every instance is disposable.
    No manual intervention for instance failure. Auto-healing is the only path.

P10. Observability is a feature. Every service exports logs, metrics, and traces.
     A service without observability is not production-ready.
```

### Service Boundaries


```
Boundary rule: a bounded context (Section 2) owns its data, its domain logic,
and its API contract. No context reaches into another context's database.

Communication between contexts happens through:
  1. Synchronous gRPC calls (for queries and commands requiring immediate results)
  2. Asynchronous events (for side effects and eventual consistency)
  3. Shared event stream (for analytics and intelligence consumption)

Cross-context transactions are forbidden. Saga patterns (Section 6) handle
multi-context operations with compensation logic.
```

### Sync vs Async Decision Logic


```
SYNCHRONOUS (gRPC, request-response):
  - The caller needs the result to proceed
  - The caller is a human waiting for a response
  - Consistency must be strong (read-your-writes)
  - The operation completes in < 500ms

ASYNCHRONOUS (Event Bus, queue):
  - The caller does not need the result immediately
  - The operation is a side effect of a primary operation
  - Multiple downstream consumers process the same event
  - The operation may take seconds or minutes
  - Retry is expected (transient failures are normal)
  - Eventual consistency is acceptable

STREAMING (WebSocket, SSE):
  - The consumer needs real-time updates
  - The consumer is a UI showing live state
  - The consumer is Dax needing to show intermediate reasoning
```

### Source of Truth Hierarchy


```
Level 0: Event Stream (the ground truth)
  - Every mutation is recorded as an immutable event
  - Replaying all events from genesis reconstructs the complete state
  - Events never expire (raw events may have TTL, but the stream is infinite)

Level 1: Domain Databases (the current state)
  - MongoDB, JanusGraph, Vector DB — each service maintains its own copy
  - Populated from the event stream (event sourcing)
  - Can be rebuilt by replaying events

Level 2: Caches (the fast path)
  - Redis, CDN, in-memory caches
  - Populated from Level 1 databases
  - Have explicit TTL and invalidation strategies
  - Loss of cache does not lose data — only performance

Level 3: Intelligence State (the derived truth)
  - Dimension estimates, Career DNA, predictions
  - Computed by the Intelligence Engine from evidence events
  - Not stored in a separate 'truth' — they are model outputs that can be regenerated
```

### Scalability Principles


```
1. Partition by studentId. Almost all operations are scoped to a single student.
   Cross-student operations are rare and use separate infrastructure.

2. Scale horizontally. Stateless services scale with instance count.
   Stateful services scale with shard count (partitioned by studentId).

3. Load shed before overload. Every service has a max concurrency.
   Beyond that, requests receive 429 (Too Many Requests).
   No service unboundedly queues work.

4. Degrade before fail. If a dependency is degraded, the service degrades
   that feature rather than failing the entire request.

5. Predictable latency over throughput. If latency exceeds SLA, the service
   reduces throughput (spawns more instances, sheds low-priority work).
```


---

## Section 2: Bounded Contexts


```
DATAD is partitioned into 20 bounded contexts. Each context:
  - Owns its data (one database per context, no sharing)
  - Owns its domain logic (no logic leaks across boundaries)
  - Publishes events for other contexts to consume
  - Has its own deployment unit (can be scaled independently)
  - Has its own failure domain (one context failing does not cascade)
```

### Identity

```
Responsibilities: Student registration, authentication, authorization, tier management
Owned Entities:  User, StudentIdentity, UserProfile, UserModelPref, Session
Public APIs:     POST /register, POST /login, POST /logout, GET /me, POST /verify-email...
Events:          datad.identity.registered, datad.identity.logged_in, datad.identity.tier_changed...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Student Profile

```
Responsibilities: Extended profile, preferences, goals, learning style
Owned Entities:  StudentProfile, Goal, Preference, LearningStyle, StudentIdentity-extended
Public APIs:     GET /profile, PUT /profile, GET /goals, POST /goals, GET /preferences...
Events:          datad.profile.updated, datad.goal.created, datad.goal.completed...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Learning

```
Responsibilities: Study notes, sessions, resources, assessments, reflections
Owned Entities:  Note, LearningSession, LearningResource, Assessment, Reflection, JournalEntry
Public APIs:     GET /notes, POST /notes, GET /sessions, POST /reflections, GET /resources...
Events:          datad.learning.note.created, datad.learning.session.completed, datad.learning.re...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Career

```
Responsibilities: Resume, skills, interviews, experiences, achievements
Owned Entities:  Resume, SkillProficiency, MockInterview, Experience, Achievement, StarStory
Public APIs:     GET /resume, PUT /resume, POST /interviews, GET /skills, POST /skills/confirm...
Events:          datad.career.resume.updated, datad.career.interview.completed, datad.career.skil...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Placement

```
Responsibilities: Applications, drives, offers, placement tracking
Owned Entities:  PlacementApplication, PlacementDrive, Offer
Public APIs:     GET /applications, POST /applications, GET /drives, POST /applications/{id}/stat...
Events:          datad.career.application.submitted, datad.career.application.status_changed, dat...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Roadmap

```
Responsibilities: Adaptive roadmap generation, prioritization, scheduling
Owned Entities:  Roadmap, RoadmapStep, RoadmapGoal (no direct DB — computed from career + learning state)
Public APIs:     GET /roadmap, POST /roadmap/regenerate, POST /roadmap/reprioritize, POST /roadma...
Events:          datad.roadmap.created, datad.roadmap.reprioritized, datad.roadmap.step_completed...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Finance

```
Responsibilities: Expenses, budgets, financial goals, savings
Owned Entities:  Expense, Budget, FinanceGoal, FinanceSnapshot
Public APIs:     GET /expenses, POST /expenses, GET /budgets, POST /budgets...
Events:          datad.finance.expense.logged, datad.finance.budget.updated, datad.finance.goal.m...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Planner

```
Responsibilities: Tasks, projects, deadlines, calendar
Owned Entities:  Task, Project, ProjectTask, CalendarEvent
Public APIs:     GET /tasks, POST /tasks, PUT /tasks/{id}/complete, GET /projects, POST /projects...
Events:          datad.task.created, datad.task.completed, datad.task.overdue, datad.project.comp...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Community

```
Responsibilities: Discussions, events, skill exchange, mentorship, feeds
Owned Entities:  Post, Reply, PostReaction, Event, RSVP, SkillListing, SkillRating, Connection
Public APIs:     GET /feed, POST /posts, GET /events, POST /events/rsvp, GET /marketplace...
Events:          datad.community.post.created, datad.community.event.rsvped, datad.community.conn...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Knowledge Graph

```
Responsibilities: Student knowledge graph: entities, relationships, embeddings
Owned Entities:  GraphNode, GraphEdge, GraphEmbedding (JanusGraph + Vector DB)
Public APIs:     GET /graph/{studentId}, GET /graph/neighborhood/{nodeId}, GET /graph/path/{from}...
Events:          datad.graph.edge.created, datad.graph.edge.updated, datad.graph.node.created...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Intelligence

```
Responsibilities: Dimension estimates, Career DNA, velocity, correlations, predictions
Owned Entities:  DimensionEstimate, CareerDNA, VelocityState, CorrelationEdge (NoSQL + in-memory)
Public APIs:     gRPC: GetDimensions, GetDNA, GetPredictions, RunSimulation, GetInsights, GetReco...
Events:          datad.intelligence.dimension.updated, datad.intelligence.dna.transitioned, datad...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Memory

```
Responsibilities: Long-term memory: episodic, semantic, procedural (non-event-store)
Owned Entities:  EpisodicMemory, SemanticMemory, ProceduralMemory (Redis + MongoDB + Vector DB)
Public APIs:     gRPC: Store, Retrieve, Search, Consolidate, Delete...
Events:          datad.memory.consolidated, datad.memory.importance_updated...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Dax

```
Responsibilities: AI cognitive OS: conversation, reasoning, tool execution
Owned Entities:  Conversation, DaxSession, DaxMemory (working memory in Redis)
Public APIs:     POST /dax/chat, POST /dax/stream, GET /dax/conversations, POST /dax/feedback...
Events:          datad.dax.conversation.started, datad.dax.message.sent, datad.dax.insight.genera...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### AI Gateway

```
Responsibilities: Model routing, provider failover, cost optimization, streaming
Owned Entities:  ProviderConnection, ModelRoute, PromptTemplate (in-memory + Redis)
Public APIs:     gRPC: Execute, Stream, GetModelStatus, GetCostMetrics...
Events:          datad.ai.model.invoked, datad.ai.model.failed, datad.ai.provider.failover...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Opportunity

```
Responsibilities: Opportunity discovery, matching, compatibility scoring
Owned Entities:  Opportunity, OpportunityMatch, CompatibilityScore (read-replica + in-memory)
Public APIs:     GET /opportunities, GET /opportunities/{id}/compatibility, gRPC: Score...
Events:          datad.opportunity.viewed, datad.opportunity.saved, datad.opportunity.applied...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Recommendations

```
Responsibilities: Recommendation generation, expected value scoring, framing
Owned Entities:  Recommendation, RecommendationStream (in-memory + Redis)
Public APIs:     GET /recommendations, POST /recommendations/feedback, gRPC: GetTopRecommendation...
Events:          datad.intelligence.recommendation.generated, datad.intelligence.recommendation.f...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Notifications

```
Responsibilities: Push, in-app, email notification delivery
Owned Entities:  Notification, NotificationPreference, NotificationChannel
Public APIs:     POST /notifications/send, GET /notifications, PUT /notifications/preferences...
Events:          datad.notification.sent, datad.notification.opened, datad.notification.delivered...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Subscriptions

```
Responsibilities: Tier management, billing, payment processing
Owned Entities:  Subscription, SubscriptionRequest, Invoice, PaymentMethod (PCI-compliant zone)
Public APIs:     GET /subscription, POST /subscribe, POST /cancel, GET /invoices...
Events:          datad.subscription.created, datad.subscription.tier_changed, datad.subscription....
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Analytics

```
Responsibilities: Business metrics, cohort analysis, usage reporting
Owned Entities:  AnalyticsEvent, CohortMetric, DashboardDefinition (clickhouse/warehouse)
Public APIs:     GET /analytics/dashboard, GET /analytics/cohorts, gRPC: RecordEvent...
Events:          (consumes all events, produces no domain events)...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```

### Admin

```
Responsibilities: User management, content moderation, system configuration
Owned Entities:  AdminAction, AuditLogEntry, SystemConfig (admin-only database)
Public APIs:     GET /admin/users, POST /admin/announcements, GET /admin/metrics...
Events:          datad.system.admin.action, datad.system.config.updated...
Dependencies:    (see Section 5 for full dependency map)
Failure Domain:  Independent. Degraded mode: see Section 5.
```


---

## Section 3: Complete Request Lifecycle


### Flow 1: Resume Upload

```
01. CLIENT:        POST /v2/career/resume (multipart upload)
02. GATEWAY:       Validate JWT, rate limit, content-type check
03. API GATEWAY:   Route to Career Service
04. CAREER SVC:    Validate file (size < 10MB, PDF/DOCX)
05. CAREER SVC:    Store raw file in Object Storage (S3-compatible)
06. CAREER SVC:    Parse resume (text extraction via Apache Tika)
07. CAREER SVC:    Update Resume entity in MongoDB
08. CAREER SVC:    Emit event: datad.career.resume.updated {version, skills, atsScore}
09. CAREER SVC:    Return 200 {resumeId, version, atsScore}

     [08 event is consumed by:]
10. KNOWLEDGE SVC:  Update HAS_SKILL edges (extracted skills)
11. KNOWLEDGE SVC:  Update SkillProficiency estimates
12. INTELLIGENCE:   Ingest as evidence (career_readiness, confidence dimensions)
13. INTELLIGENCE:   Recompute dimension estimates (career_readiness, confidence)
14. INTELLIGENCE:   Emit: datad.intelligence.dimension.updated
15. ROADMAP SVC:    Re-evaluate roadmap (career step velocities adjusted)
16. OPPORTUNITY:    Re-score matched opportunities with new skill data
17. RECOMMENDATION: Regenerate recommendations (if career_readiness changed significantly)
18. ANALYTICS:      Record resume update event
19. NOTIFICATIONS:  IF dimension.updated.career_readiness delta > 10%:
20. NOTIFICATIONS:     '{name}, your resume update significantly improved your career readiness.'

Latency budget: 500ms for CLIENT response. Event processing async: <5s completion.
```

## Flow 2: Mock Interview


```
01. CLIENT:         POST /v2/career/interviews {type, company, role}
02. GATEWAY:        Validate JWT, check subscription tier (Pro+ for interview)
03. CAREER SVC:     Create MockInterview entity (status: scheduled)
04. CAREER SVC:     Call AI Gateway -> Dax for interview conduct
05. AI GATEWAY:     Route to appropriate model (interview-specific prompt)
06. AI GATEWAY:     Stream questions to client via WebSocket
07. CLIENT:         Student answers (audio or text, streamed)
08. AI GATEWAY:     Real-time feedback generation per answer
09. AI GATEWAY:     Emit: datad.dax.interview.question_answered per Q&A
10. CLIENT:         Interview ends
11. CAREER SVC:     Compute overall scores (confidence, communication, technical)
12. CAREER SVC:     Update MockInterview entity (status: completed, scores)
13. CAREER SVC:     Emit: datad.career.interview.completed {scores, transcript, duration}

     [13 event is consumed by:]
14. INTELLIGENCE:   Ingest as high-weight evidence (interview_confidence +0.40,
                    communication +0.25, problem_solving +0.20, career_readiness +0.15)
15. INTELLIGENCE:   Recompute dimensions (EnKF update)
16. INTELLIGENCE:   Recompute Career DNA (interviews strongly influence archetype)
17. INTELLIGENCE:   Recompute learning velocity (interview performance delta)
18. INTELLIGENCE:   Emit: datad.intelligence.dimension.updated
19. KNOWLEDGE SVC:  Update HAS_SKILL for communication, problem_solving
20. MEMORY:         Store interview as episodic memory (high importance)
21. RECOMMENDATION: Regenerate (interview changed the causal effect estimates)
22. ROADMAP SVC:    Update career step priorities
23. NOTIFICATIONS:  IF interview score > 80: 'Great interview! Your confidence just jumped.'
                    IF score < 50: 'That was a tough one. Here is what improved: ...'

Latency budget: streaming during interview is real-time (<200ms per Q&A).
Post-interview processing: <10s async.
```

## Flow 3: Chat with Dax


```
01. CLIENT:         POST /v2/dax/chat {message, conversationId}
02. GATEWAY:        Validate JWT, rate limit (100 msg/hr per student)
03. DAX:            Load working memory for conversationId
04. DAX:            Classify intent (query | explore | decide | learn | vent | reflect)
05. DAX:            Knowledge boundary check:
05a.               Call INTELLIGENCE gRPC: GetDimensions, GetDNA
05b.               Call MEMORY gRPC: SearchMemory(topic)
05c.               Call KNOWLEDGE gRPC: GetNeighborhood(topic)
05d.               IF confidence < 0.3: prepare clarifying question
06. DAX:            Build reasoning context (intelligence + memory + graph data)
07. DAX:            Call AI Gateway -> LLM with structured context
08. AI GATEWAY:     Route to appropriate model (based on complexity + tier)
09. AI GATEWAY:     Stream response to Dax
10. DAX:            Validate response (hallucination detection, guardrails)
11. DAX:            Update working memory (new facts, updated confidence)
12. DAX:            Stream response to client via WebSocket
13. CLIENT:         Student reads response (may send follow-up)
14. DAX:            Emit: datad.dax.message.sent {intent, topic, responseLength}
15. DAX:            Emit: datad.dax.conversation.topic if topic changed
16. DAX:            IF new facts learned: call MEMORY gRPC: Store(fact, importance)

     [14 event consumed by:]
17. INTELLIGENCE:   Lightweight event processing (curiosity, career_clarity dimensions)
18. ANALYTICS:      Track conversation metrics

Latency budget: <2s p95 for first token. Subsequent tokens streamed at >50 tok/s.
```

## Flow 4: Roadmap Step Completion


```
01. CLIENT:         POST /v2/roadmap/steps/{stepId}/complete
02. GATEWAY:        Validate JWT
03. ROADMAP SVC:    Verify step exists and is pending
04. ROADMAP SVC:    Update step (status: completed, completedAt)
05. ROADMAP SVC:    Emit: datad.task.completed {taskId, stepId, duration, difficulty}
06. ROADMAP SVC:    Return 200 {completedStep, nextStep}

     [05 event consumed by:]
07. INTELLIGENCE:   Ingest as evidence (execution_ability, consistency dimensions)
08. INTELLIGENCE:   Recompute estimates (EnKF update)
09. INTELLIGENCE:   Check for milestone (steak, velocity threshold, dimension milestone)
10. ROADMAP SVC:    Re-evaluate roadmap priorities (reprioritize)
11. ROADMAP SVC:    Check for fatigue (if 5+ steps completed in 2 days, suggest rest)
12. RECOMMENDATION: Update (completion may change top recommendations)
13. NOTIFICATIONS:  IF milestone: '{milestone} reached! Your consistency is building.'
14. ANALYTICS:      Record completion metric

Latency budget: <200ms p95 for client. Full intelligence recompute <5s async.
```

## Flow 5: Weekly Intelligence Report Generation


```
01. SCHEDULER:      Cron trigger: every Monday 06:00 UTC
02. INTELLIGENCE:   SELECT all active students (with intelligence data > 7 days)
03. INTELLIGENCE:   For each student (batch, max parallelism=100):
03a.               Compute weekly deltas for all 25+ dimensions
03b.               Detect significant changes (velocity > 15%, acceleration > threshold)
03c.               Classify week theme (accelerating, decelerating, plateau, breakthrough)
03d.               Generate report sections via Explainability Engine
03e.               Call AI Gateway: Generate narrative (conditioned on sections)
03f.               Call MEMORY gRPC: Store weekly summary as semantic memory
04. INTELLIGENCE:   Emit: datad.intelligence.report.generated {studentId, weekNumber, theme}

     [04 event consumed by:]
05. NOTIFICATIONS:  Push: 'Your Week {N} Intelligence Report is ready'
06. ANALYTICS:      Record report generation metrics

Latency budget: <5s per student. Full batch of 10k: <10 minutes.
Scales linearly with student count (embarrassingly parallel per student).
```


---

## Section 4: Runtime Execution Engine


### Execution Pipeline (Per Request)


```
+-------------------------------------------------------------------+
|                    INBOUND REQUEST                                 |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 1. API GATEWAY (Kong/APISIX)                                       |
|    TLS termination, JWT validation, rate limiting, request routing |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 2. AUTH MIDDLEWARE                                                 |
|    Verify token, extract identity, check RBAC/ABAC, attach context |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 3. VALIDATION LAYER                                                |
|    Schema validation (JSON Schema), content-type, size limits,     |
|    idempotency check (idempotencyKey -> Redis lookup)              |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 4. COMMAND/QUERY DISPATCHER                                        |
|    Commands (mutations): route to command handler + emit event     |
|    Queries (reads): route to query handler (short-circuit cache)   |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 5. BUSINESS LOGIC LAYER                                            |
|    Domain service executes the operation                           |
|    If cross-context: orchestrate saga (Temporal workflow)          |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 6. PERSISTENCE LAYER                                               |
|    Write to domain database (MongoDB for this context)             |
|    Write-through cache (Redis) if critical path                    |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 7. EVENT EMITTER                                                   |
|    Publish event to Event Bus (Kafka)                              |
|    Event includes correlationId, causationId, producer identity    |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 8. RESPONSE                                                        |
|    Return 200/201 to client (with idempotencyKey for retry safety) |
+-------------------------------------------------------------------+
```

### Command vs Query Separation (CQS)


```
Every API endpoint is classified as either a Command or a Query.

COMMANDS (POST, PUT, PATCH, DELETE):
  - Mutate state
  - Emit events
  - Return 200/201/204 with result
  - Idempotent when idempotencyKey is provided
  - Processed through: Gateway -> Auth -> Validate -> Dispatch -> Execute -> Persist -> Emit -> Respond

QUERIES (GET, HEAD, OPTIONS):
  - Read state
  - Never emit events
  - Return 200 with data
  - Always idempotent
  - Cacheable (ETag, Cache-Control)
  - Processed through: Gateway -> Auth -> Cache Check -> DB Query -> Respond
  - May skip auth for public resources

GraphQL: queries are Queries, mutations are Commands.
gRPC: unary RPCs can be either. Streaming RPCs are typically Commands.
```

### Idempotency


```
Every mutation endpoint supports idempotency via a request header:
  Idempotency-Key: <UUIDv7>

Idempotency Store (Redis):
  Key: idempotency:{key}
  Value: {status (processing|done), response, expiresAt}
  TTL: 24 hours (keys older than 24h are ignored)

Flow:
  1. Client generates UUIDv7, sends with request
  2. Server checks Redis: if key exists and status=done, return cached response
  3. If key exists and status=processing, return 409 Conflict
  4. If key doesn't exist, create {status: processing}, execute, update to done
  5. On 5xx failure, client retries with same key -> server returns last response or re-executes

Key generation: client-side, UUIDv7 (time-sortable, unique).
Key scope: per {studentId, endpoint}. Keys are partitioned by studentId.
```

### Circuit Breakers


```
Every gRPC call between services is wrapped in a circuit breaker:

State machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED

CLOSED (normal operation):
  - Requests pass through
  - If error rate > 50% in 30s sliding window -> OPEN

OPEN (failing):
  - Requests fail immediately (fast-fail, no network call)
  - After 60s -> HALF_OPEN

HALF_OPEN (testing):
  - Let 1 request through
  - If success -> CLOSED
  - If failure -> OPEN (reset 60s timer)

Degradation on OPEN:
  - Service returns cached data (if available) or degrades the feature
  - Service emits circuit_breaker_opened event for monitoring
```

### Retry Engine


```
Retry policy (applied by the CALLING service):

Default retry:
  maxAttempts: 3
  initialInterval: 100ms
  multiplier: 4
  maxInterval: 10s
  jitter: 0.2 (% of interval)
  retryableStatuses: [UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED]

Non-retryable: [INVALID_ARGUMENT, NOT_FOUND, PERMISSION_DENIED, UNAUTHENTICATED]

After max retries exhausted:
  - Command: enqueue to dead letter queue with error context
  - Query: return 503 with 'temporarily unavailable'
  - Event: produce to dead letter topic with headers
```

### Backpressure


```
Every service implements backpressure at the HTTP/gRPC transport layer:

1. Max concurrent requests (per instance):
   - Stateless: 250 concurrent (adjustable via config)
   - Stateful: 100 concurrent (database connections are the constraint)

2. When concurrency limit is reached:
   - New requests receive 429 (Too Many Requests)
   - Response includes Retry-After header (30s)
   - Request is not queued — queueing would amplify the problem

3. Event consumer backpressure:
   - Kafka consumer pauses partition when processing lag > 1000 messages
   - Resumes when lag < 100
   - This allows the service to catch up without unbounded memory growth

4. AI Gateway backpressure:
   - Provider rate limits are monitored
   - Before sending, check if provider quota is available
   - If unavailable, queue or route to fallback immediately (no timeout waste)
```

### Health Checks


```
Every service exposes /health endpoint:

Return: {
  status: 'ok' | 'degraded' | 'down',
  version: String,
  uptime: Int,
  dependencies: {
    mongodb: {status, latencyMs},
    redis: {status, latencyMs},
    kafka: {status, lag},  // for consumers
    upstream_service: {status, latencyMs}  // for all gRPC dependencies
  },
  circuitBreakers: {
    upstream_service: 'closed' | 'open' | 'half_open'
  },
  load: {
    concurrentRequests: Int,
    maxConcurrent: Int,
    cpuPercent: Float,
    memoryMB: Int
  }
}

Orchestrator (K8s) probes:
  liveness: /health (fail if status=down, restart pod)
  readiness: /health (fail if status=degraded, remove from load balancer)
  startup: /health (delay until status=ok, max 60s)
```


---

## Section 5: Service Architecture


### Service Specification Format


```
Each service is specified with:
  - Responsibilities: what the service does
  - Owned data: what databases/tables it owns
  - Dependencies: what other services it calls
  - Scaling strategy: horizontal / sharded / singleton
  - Failure handling: what degrades, what fails, what is sacrificed
  - Deployment: k8s deployment config dimensions
```

## Section 5: Service Architecture


### Service Specification Format


```
Each service is specified with:
  - Responsibilities: what the service does
  - Owned data: what databases/tables it owns
  - Dependencies: what other services it calls
  - Scaling strategy: horizontal / sharded / singleton
  - Failure handling: what degrades, what fails, what is sacrificed
  - Deployment: k8s deployment config dimensions
```

### API Gateway Service

```
Responsibilities: TLS termination, JWT validation, rate limiting, request routing, response compression
Owned data:       None (stateless router)
Dependencies:     Identity Service (JWT validation)
Scaling:          Horizontal (CPU-bound, auto-scale on req/s)
Failure:          Without backend: return 503. Graceful degradation: 50% traffic to degraded mode.
Deployment:       32 CPU, 64GB RAM, HPA on req/s
```

### Identity Service Service

```
Responsibilities: Register, login, logout, token refresh, email verification, password reset, OAuth
Owned data:       User (MongoDB), Session (Redis)
Dependencies:     None (auth-only)
Scaling:          Horizontal (CPU-bound, auto-scale on login/s)
Failure:          Degraded: new registrations disabled. Existing sessions continue (JWT cached).
Deployment:       8 CPU, 16GB RAM, HPA on login rate
```

### Student Service Service

```
Responsibilities: Profile CRUD, preferences, goals, learning style, onboarding
Owned data:       StudentProfile, Goal, Preference (MongoDB)
Dependencies:     Identity Svc (auth context)
Scaling:          Horizontal (read-heavy, cache-mostly)
Failure:          Degraded: profile reads from cache. Writes queued.
Deployment:       4 CPU, 8GB RAM, HPA on active students
```

### Learning Service Service

```
Responsibilities: Notes CRUD, session tracking, resource management, assessment storage
Owned data:       Note, LearningSession, Resource, Assessment (MongoDB)
Dependencies:     Identity Svc (auth)
Scaling:          Horizontal (write-heavy during study peaks)
Failure:          Degraded: new notes queued, existing notes readable.
Deployment:       8 CPU, 16GB RAM, HPA on concurrent sessions
```

### Career Service Service

```
Responsibilities: Resume storage/parsing/scoring, interview scheduling/scoring, skill management, experience/achievement CRUD
Owned data:       Resume, MockInterview, SkillProficiency, Experience, Achievement (MongoDB + Object Storage)
Dependencies:     Identity Svc, AI Gateway (interview scoring), Knowledge Svc (skill updates)
Scaling:          Horizontal (CPU-bound for resume parsing, IO-bound for interview)
Failure:          Degraded: resume parsing queued (async). Interview scores cached from last model.
Deployment:       8 CPU, 32GB RAM, HPA on active interviews
```

### Roadmap Service Service

```
Responsibilities: Adaptive roadmap generation, reprioritization, scheduling, fatigue detection, failure recovery
Owned data:       Roadmap (computed ephemeral + cached in Redis)
Dependencies:     Intelligence Svc, Career Svc, Learning Svc, Planner Svc
Scaling:          Horizontal (compute-bound for reprioritization)
Failure:          Degraded: use last cached roadmap. Regeneration queued.
Deployment:       8 CPU, 16GB RAM, HPA on roadmap requests
```

### Planner Service Service

```
Responsibilities: Tasks, projects, deadlines, calendar events
Owned data:       Task, Project, TaskProject, CalendarEvent (MongoDB)
Dependencies:     Identity Svc
Scaling:          Horizontal (write-heavy during task creation peaks)
Failure:          Degraded: task creation queued. Calendar reads from cache.
Deployment:       4 CPU, 8GB RAM, HPA on task operations
```

### Finance Service Service

```
Responsibilities: Expense logging, budgeting, financial goals, savings tracking
Owned data:       Expense, Budget, FinanceGoal (MongoDB)
Dependencies:     Identity Svc
Scaling:          Horizontal (moderate load, user-specific)
Failure:          Degraded: read-only. New expenses queued.
Deployment:       2 CPU, 4GB RAM, minimal HPA (predictable load)
```

### Community Service Service

```
Responsibilities: Posts, replies, reactions, events, RSVP, skill exchange, mentorship, feed
Owned data:       Post, Reply, Reaction, Event, RSVP, SkillListing (MongoDB)
Dependencies:     Identity Svc, Notification Svc
Scaling:          Horizontal (read-heavy for feed)
Failure:          Degraded: feed serves from cache. New posts queued.
Deployment:       8 CPU, 16GB RAM, HPA on feed requests
```

### Knowledge Service Service

```
Responsibilities: Graph CRUD, traversal, embedding computation, correlation detection, path finding
Owned data:       GraphNode, GraphEdge (JanusGraph), GraphEmbedding (Vector DB)
Dependencies:     Identity Svc, Event Bus (consumes all events)
Scaling:          Sharded by studentId (graph partition). Horizontal per shard.
Failure:          Degraded: graph reads from cache. Writes queued. Embeddings stale.
Deployment:       8 CPU, 32GB RAM, shard by 10k students
```

### Intelligence Service Service

```
Responsibilities: Dimension estimation, Career DNA, velocity, correlations, predictions, simulations, insights, explanations
Owned data:       DimensionEstimate, CareerDNA, Prediction, Insight (MongoDB + in-memory particles)
Dependencies:     Knowledge Svc, Memory Svc, Event Bus (consumes evidence events)
Scaling:          Sharded by studentId (independent per student). Horizontal per shard.
Failure:          Degraded: serve last cached estimates. No new inference. Predictions use cached model outputs.
Deployment:       16 CPU, 64GB RAM, GPU optional for NN models
```

### Memory Service Service

```
Responsibilities: Episodic storage, semantic retrieval, procedural pattern storage, consolidation, importance scoring
Owned data:       EpisodicMemory (Cassandra), SemanticMemory (MongoDB + Vector DB), WorkingMemory (Redis)
Dependencies:     Event Bus (consumes events for automatic storage)
Scaling:          Sharded by studentId. Consolidation workers as separate deployment.
Failure:          Degraded: working memory only (in Redis). Long-term memory queries queued.
Deployment:       8 CPU, 32GB RAM, separate consolidation worker pool
```

### Dax Service Service

```
Responsibilities: Conversation management, working memory, intent classification, reasoning pipeline, tool execution coordination
Owned data:       Conversation, DaxSession (MongoDB), WorkingMemory (Redis)
Dependencies:     Intelligence Svc, Memory Svc, Knowledge Svc, AI Gateway
Scaling:          Horizontal (session-affinity via conversationId -> instance)
Failure:          Degraded: no intelligence context. Dax falls back to general AI with reduced personalization.
Deployment:       16 CPU, 64GB RAM, GPU for LLM inference
```

### AI Gateway Service

```
Responsibilities: Model routing, provider failover, prompt building, context assembly, streaming, cost optimization, caching, guardrails
Owned data:       ProviderConnection, PromptTemplate (Redis + in-memory)
Dependencies:     None (calls external LLM providers)
Scaling:          Horizontal (CPU-bound for routing). GPU instances for local models.
Failure:          CRITICAL FAILOVER: automatic provider switch. If all providers down: use cached responses for common queries.
Deployment:       32 CPU, 128GB RAM, GPU (A10G) for local models
```

### Opportunity Service Service

```
Responsibilities: Opportunity ingestion, compatibility scoring, skill gap analysis, trajectory impact estimation
Owned data:       Opportunity, OpportunityMatch (MongoDB + Redis cache)
Dependencies:     Intelligence Svc, Career Svc, Knowledge Svc
Scaling:          Horizontal (compute-bound for scoring on refresh). Cache-mostly for reads.
Failure:          Degraded: serve cached scores (max 1 hour stale). No new opportunity matching.
Deployment:       4 CPU, 16GB RAM, HPA on match requests
```

### Recommendation Service Service

```
Responsibilities: Expected value computation, action catalog management, personalization, framing
Owned data:       Recommendation, ActionCatalog (Redis + in-memory)
Dependencies:     Intelligence Svc, Career Svc, Learning Svc
Scaling:          Horizontal (compute-bound for EVA scoring on regeneration). Cache-mostly.
Failure:          Degraded: serve last cached recommendations. Highlight: showing cached recommendations.
Deployment:       4 CPU, 8GB RAM, HPA on rec requests
```

### Notification Service Service

```
Responsibilities: Push notification dispatch, in-app notification, email sending, preference management, rate limiting per channel
Owned data:       Notification, Preference, ChannelStatus (MongoDB + Redis queue)
Dependencies:     Event Bus (consumes notification-worthy events)
Scaling:          Horizontal (IO-bound, sending to push gateways). Queue-based consumption.
Failure:          Degraded: defer non-critical notifications. Critical notifications (password reset) still sent synchronously.
Deployment:       4 CPU, 8GB RAM, HPA on queue depth
```

### Analytics Service Service

```
Responsibilities: Event consumption, data warehouse population, cohort computation, dashboard serving, report generation
Owned data:       AnalyticsEvent (ClickHouse), CohortMetric, Dashboard (ClickHouse + Redis cache)
Dependencies:     Event Bus (consumes ALL events)
Scaling:          Horizontal (compute-bound for aggregation). Warehouse as separate cluster.
Failure:          Degraded: serve last cached dashboards. No real-time analytics.
Deployment:       8 CPU, 32GB RAM, separate warehouse cluster
```

### Subscription Service Service

```
Responsibilities: Tier management, payment processing, invoice generation, license enforcement
Owned data:       Subscription, Invoice, PaymentMethod (MongoDB, PCI-compliant zone)
Dependencies:     Identity Svc, Payment Provider (Razorpay/Stripe)
Scaling:          Horizontal (low volume, high importance). Queue-backed for payment idempotency.
Failure:          CRITICAL: payments must work. Degraded: dashboard inaccessible, billing still functional.
Deployment:       2 CPU, 4GB RAM (low volume but mission-critical)
```

### Admin Service Service

```
Responsibilities: User management, content moderation, system configuration, health monitoring
Owned data:       AdminAction, AuditLog, SystemConfig (MongoDB, admin-only)
Dependencies:     All services (read-only health checks)
Scaling:          Singleton (admin operations are low volume and sequential)
Failure:          Degraded: admin dashboard uses cached metrics. Actions queued.
Deployment:       2 CPU, 8GB RAM, singleton
```


---

## Section 6: Event Bus Architecture


### Infrastructure


```
Platform: Apache Kafka / Apache Pulsar (topic-per-context model)
Partitions: 24 per topic (configurable, aligned to studentId hash)
Retention: 7 days (hot), 90 days (warm tier), 1 year (cold/object store)
Replication: 3x across 3 availability zones
````

### Topic Model


```
DATAD uses a domain-event topic model:

Topic Naming: datad.{domain}.{event-type}
  Examples: datad.identity.registered, datad.career.resume.updated

Partition Assignment: partition = hash(studentId) % N
  Ensures all events for one student are ordered
  Key = studentId for student-scoped events
  Key = eventId for system events

Topic Types:
  - 'domain' topics: per bounded context, emitted by that context's services
  - 'system' topics: infrastructure events (deployments, config changes, alerts)
  - 'intelligence' topics: internal intelligence processing events
  - 'dead-letter' topics: events that failed processing
````

### Event Ordering Guarantees


```
Within a partition: total order (Kafka guarantee)
Within a student: total order (same partition for all student events)
Cross-student: no ordering guarantee (independent)

This means: events for Student A are ordered. Events for Student B are ordered.
Events across A and B are NOT ordered (and don't need to be).
```

### Event Schema & Versioning


```
Schema Registry: Apicurio / Confluent Schema Registry
Serialization: Avro (wire format) + JSON Schema (documentation)

Evolution rules:
  BACKWARD compatible: new schema can read old data
  - Adding optional fields
  - Adding default values
  FORWARD compatible: old schema can read new data
  - Removing fields
  - Adding fields with default values (also backward)
  FULL compatible: both backward and forward

Breaking changes create a new event type version:
  datad.career.resume.updated.v2
  Old consumers continue consuming v1
  New consumers consume v2
  Bridge consumer maps v1 to v2 if needed
```

### Delivery Semantics


```
Producer: at-least-once (default)
  - Write to Kafka, wait for ack from all ISR replicas
  - On failure: retry with same idempotencyKey
  - Exactly-once semantics available for critical events
    (enable producer idempotence + transactional API)

Consumer: at-least-once (standard)
  - Commit offset AFTER processing
  - Auto-commit disabled (manual commit)
  - On processing failure: retry up to 3, then send to dead letter topic
  - Idempotent consumers (process(event) is idempotent)

Exactly-once sink: supported for analytics (Kafka -> ClickHouse)
  - Use transactional producer + idempotent sink connector
```

### Dead Letter Queue & Poison Messages


```
Dead Letter Topic: datad.dead-letter.{consumer-group}
  Headers preserved + error metadata (exception, retryCount, originalPartition, originalOffset)

Poison message handling:
  - After 3 retries, send to DLQ
  - DLQ monitored by alerting (PagerDuty if rate > threshold)
  - DLQ events can be replayed manually (or automatically, if schema-compatible)
  - Max 7 days in DLQ before archival

Processing guarantee: every event is either successfully processed or in DLQ with error metadata.
Orphaned events (lost due to crash before commit) are re-processed on consumer restart.
```

### Saga Orchestration


```
Cross-context transactions use the Saga pattern (not distributed transactions):

Saga example: Student upgrades to Pro tier
  1. Subscription Svc: Create subscription (status: pending)
  2. Subscription Svc: Emit: datad.subscription.creating
  3. Payment Svc: Process payment
  4. IF payment fails:
  4a.  Subscription Svc: Cancel subscription
  4b.  Emit: datad.subscription.cancelled
  5. IF payment succeeds:
  5a.  Subscription Svc: Activate subscription
  5b.  Identity Svc: Update user tier
  5c.  Emit: datad.subscription.created (tier: pro)
  6. Intelligence Svc: Upgrade context quality (consume event)
  7. Dax Svc: Update model routing (consume event)

Saga coordinator: Temporal Workflow (durable execution)
  - Workflow steps are activity tasks
  - On failure: run compensation activities (reverse each step)
  - Temporal ensures exactly-once execution of the workflow
  - Workflow timeout: 5 minutes. After that, manual intervention.
```

### Correlation & Tracing


```
Every event carries:
  correlationId: UUID (generated by the original request)
  causationId: UUID (the event that caused this event)
  traceId: UUID (distributed trace, propagated from W3C trace context)

These form the event provenance graph: every event knows what caused it
and what it's part of. This enables:
  - Full request tracing across all services
  - Event chain visualization ('this resume update led to this notification')
  - Latency breakdown per event processing
  - Root cause analysis for failures
```

### Replay & Snapshots


```
Replay capability:
  - Any consumer group can reset to any offset and replay
  - Stateful services (Intelligence, Knowledge) support state rebuild from replay
  - Replay is a planned operation (not for production emergencies)

Daily snapshots:
  - Each domain database snapshotted daily (MongoDB Atlas snapshots)
  - Event stream uncompacted (full history retained for replay)
  - Snapshot + event stream = rebuild to any point in time

During replay:
  1. Suspend regular consumer (prevent double processing)
  2. Reset consumer offset to desired timestamp
  3. Optionally reset target database to snapshot before that timestamp
  4. Resume consumer (events will be re-processed from the reset offset)
  5. Monitor consumer lag. Suspended events will accumulate and be processed after replay.
```


---

## Section 7: AI Runtime


### Architecture


```
+-----------------------------------------------------------------+
|                      AI RUNTIME                                  |
|                                                                   |
|  +-------------------+  +-------------------+  +---------------+ |
|  | ROUTING ENGINE    |  | CONTEXT BUILDER   |  | PROMPT        | |
|  | Provider selector |  | Intelligence      |  | BUILDER       | |
|  | Model version     |  | Memory            |  | Templates     | |
|  | Cost optimizer    |  | Knowledge Graph   |  | Versioning    | |
|  | Latency optimizer |  | Recent events     |  | Assembly      | |
|  +--------+----------+  +--------+----------+  +-------+------+ |
|           |                      |                     |        |
|  +--------v----------------------v---------------------v------+ |
|  |                  PROVIDER EXECUTION LAYER                  | |
|  |  DeepSeek Pro | DeepSeek Flash | Llama 8B | (future)      | |
|  |  Streaming | Non-streaming | Batch | Retry | Fallback     | |
|  +-----------------------------+-----------------------------+ |
|                                |                              |
|  +-----------------------------v-----------------------------+ |
|  |                RESPONSE PROCESSING LAYER                  | |
|  |  Guardrails | Hallucination Detection | Confidence Est.  | |
|  |  Cost Accounting | Latency Recording | Cache Update      | |
|  +-----------------------------------------------------------+ |
+-----------------------------------------------------------------+
```

### Provider Router


```
Provider routing is determined by a policy engine. Not a fixed map.

Inputs: student.tier, query.complexity, latency.requirement, cost.target, model.availability

Policy: 
  if student.tier == 'free':
    route to Llama 8B (self-hosted, cost ~$0.0001/req)
  elif student.tier == 'pro':
    route to DeepSeek Flash (cost ~$0.001/req)
    EXCEPT if query.complexity == 'high': route to DeepSeek Pro (cost ~$0.01/req)
  elif student.tier == 'max':
    route to DeepSeek Pro (no cost optimization)
    SIMULATIONS: extra compute allocated

Fallback policy:
  1. Primary provider fails (timeout/error) and retries exhausted:
     -> Route to next tier down (e.g., Pro -> Flash, Flash -> Llama)
  2. All providers fail:
     -> Return cached response for similar query (if available)
     -> Return generic fallback: 'I'm having trouble connecting. Please try again.'
  3. Provider degraded (high latency):
     -> Route to lower tier if latency SLA cannot be met

Fallover is transparent to the caller. The response includes x-model-provider and x-model-version headers.
```

### Context Builder


```
function buildContext(studentId, query):
    context = {
        intelligence: GET /v2/students/{id}/intelligence {dimensions, dna, predictions},
        memory: MemoryService.Search({query, limit=10, minImportance=0.3}),
        knowledge: KnowledgeService.GetNeighborhood({query, depth=1}),
        recentEvents: EventStore.GetRecent(studentId, hours=24),
        identity: IdentityService.GetProfile(studentId),
        query: query
    }

    # Context size budget: max 12k tokens (leaves room for conversation + response)
    context = compressToBudget(context, maxTokens=12000)
    return context

Compression strategy:
  - Intelligence: include summary (no trajectory, no evidence)
  - Memory: top-5 by relevance, truncate content to 200 chars each
  - Knowledge: include only direct connections (depth=1, no edge histories)
  - Recent events: aggregate by type + count, not individual events
```

### Prompt Registry


```
Prompts are versioned templates stored in a registry (Git + Redis cache):

PromptTemplate {
  templateId: String (e.g., 'dax.career.interview-coach'),
  version: Int,
  template: String (Jinja2/Mustache with context slots),
  contextRequirements: [String] ('intelligence', 'memory', 'knowledge', 'identity'),
  maxTokens: Int,
  temperature: Float,
  model: String ('deepseek-pro' | 'deepseek-flash' | 'llama-8b'),
  fallbackTemplate: String (degraded version, fewer context requirements),
  changelog: String
}

Prompt evolution:
  - Prompts are Git-tracked (version control for prompt changes)
  - New prompt versions are A/B tested against the previous version
  - Metrics: response quality rating, student follow-up rate, task completion rate
  - Rollback: immediate (previous version is cached in Redis)
```

### Hallucination Detection


```
function detectHallucination(generatedResponse, context):
    # 1. Factual consistency check
    claims = extractClaims(generatedResponse)
    for claim in claims:
        if claim.type == 'factual':
            supported = checkAgainstContext(claim, context)
            if not supported:
                hallucinationScore += 1.0

    # 2. Numerical consistency check
    if generatedResponse contains numbers:
        consistent = checkAgainstKnownDimensions(generatedResponse, context.intelligence)
        if not consistent:
            hallucinationScore += 0.8

    # 3. Self-consistency check (sample 3 responses, check agreement)
    variations = generateVariations(query, n=3)
    agreement = computeAgreement(generatedResponse, variations)
    hallucinationScore += (1.0 - agreement) * 2.0

    if hallucinationScore > threshold:
        return HALLUCINATED, sanitizeResponse(generatedResponse, context)
    return CLEAN, generatedResponse

If hallucinated: strip the hallucinated claim, flag uncertainty in response,
re-route to lower-temperature model or regenerate with stricter instructions.
```

### Model Health Monitoring


```
Every provider connection is monitored:
  - Latency p50/p95/p99 per model
  - Error rate (5xx, timeout, rate-limit)
  - Token throughput (tokens/second)
  - Cost per request
  - Hallucination rate (per model)

Alert thresholds:
  - Error rate > 5% over 5 minutes
  - p95 latency > 5s
  - Hallucination rate > 3%

On alert: automatic provider failover, model version pinning
```


---

## Section 8: Memory Runtime


### Memory Hierarchy


```
+------------------------------------------------------------------+
|          WORKING MEMORY (Redis, TTL: 24h)                        |
|  Current conversation, active context, recent facts              |
|  Volatile. Loss on failure -> degrade but not data loss.        |
+------------------------------------------------------------------+
         |  (promotion via importance threshold)
         v
+------------------------------------------------------------------+
|          EPISODIC MEMORY (Cassandra, TTL: tier-dependent)        |
|  Specific events: 'student practiced interview on July 15'       |
|  High volume. Append-only. TTL-managed.                          |
+------------------------------------------------------------------+
         |  (consolidation: batch, nightly)
         v
+------------------------------------------------------------------+
|          SEMANTIC MEMORY (MongoDB + Vector DB, no TTL)           |
|  Generalized knowledge: 'student is strong in interviews'        |
|  Lower volume. Persistent. Indexed by embedding.                 |
+------------------------------------------------------------------+
         |  (extraction: weekly)
         v
+------------------------------------------------------------------+
|          PROCEDURAL MEMORY (MongoDB, no TTL)                     |
|  Behavioral routines: 'student studies best at 8 PM'             |
|  Low volume. Persistent. Updated by habit detection.             |
+------------------------------------------------------------------+
```

### Memory Operations API


```
Store(agentId, memory: {type, content, importance, tags, sourceEventIds}) -> memoryId
  Returns the memory ID. Importance is overridden if >= threshold.

Retrieve(memoryId) -> Memory
  Returns the full memory. Updates lastAccessed timestamp.

Search(query: str, limit, minImportance, tags) -> [Memory]
  Semantic search over all memory types. Returns relevance-ranked.
  Importance-weighted: low-importance memories need higher relevance to appear.

Consolidate() -> {episodicCount, semanticCreated, importanceDistribution}
  Batch process: aggregate episodic memories into semantic ones.
  Called nightly. Also triggered when episodic count exceeds threshold.

Delete(memoryId) -> {status}
  Soft-delete for semantic memories (cascade to episodic).
  Hard-delete for episodic (event-sourced, reconstructed on replay).
```

### Importance Scoring


```
Memory importance is computed at write time and can be overridden:

function calculateImportance(memory):
    baseScore = 0.3

    # Recency: recent events are more important
    if memory.timestamp > now - 7d: baseScore += 0.2

    # Emotional weight: high-sentiment events are more memorable
    if memory.sentiment.intensity > 0.8: baseScore += 0.15

    # Outcome significance: events with outcomes are more important
    if memory.type == 'outcome': baseScore += 0.25

    # Repetition: frequently recalled patterns increase importance
    patternStrength = getPatternStrength(memory.tags)
    baseScore += patternStrength * 0.2

    return clamp(baseScore, 0.0, 1.0)

Memories with importance < 0.2 may be automatically evicted during consolidation.
```

### Conflict Resolution


```
When new memory contradicts existing memory:

function resolveConflict(newMemory, existingMemory):
    if newMemory.importance > existingMemory.importance * 1.5:
        # New memory is significantly more important
        markContradicted(existingMemory, 'superseded')
        store(newMemory)
    elif newMemory.confidence < 0.4:
        # New memory is low confidence, keep existing, flag both
        linkAsAlternative(newMemory, existingMemory)
    else:
        # Keep both, let the retrieval ranker decide
        createContradictionEdge(newMemory.id, existingMemory.id)
        # The Explainability Engine will note this contradiction
```


---

## Section 9: Caching Strategy


### Multi-Level Cache Architecture


```
L0: Browser Cache (Service Worker)
  - Static assets: app shell, CSS, JS bundles
  - API responses: Cache-Control headers (s-maxage for CDN, max-age for browser)
  - Intelligence snapshots: stale-while-revalidate (serve stale, update in background)
  - Invalidation: Service Worker message on mutation

L1: CDN Cache (Cloudflare / Fastly)
  - Static assets: immutable caching (content-hashed file names)
  - API responses: Cache-Control: public, s-maxage=60 (1 minute)
  - GraphQL POST: cache-keyed by query hash (normalized query)
  - Invalidation: purge by tag on content update

L2: API Gateway Cache (Kong)
  - Response cache for GET endpoints with same parameters
  - TTL: 30s for dynamic, 300s for static
  - Cache key: method + path + query params + auth context (studentId)
  - Invalidation: cache-control from upstream, manual purge on deploy

L3: Redis Cache (per service)
  - Intelligence profiles: studentIntelligence:{studentId} (TTL: 5min)
  - Career DNA: careerDNA:{studentId} (TTL: 1h)
  - Recommendations: recommendations:{studentId} (TTL: 5min)
  - Roadmaps: roadmap:{studentId} (TTL: 5min)
  - Graph neighborhoods: graph:{studentId}:{nodeId} (TTL: 1h)
  - Skill proficiency: skills:{studentId} (TTL: 1h)
  - User profile: profile:{studentId} (TTL: 30min)

L4: In-Memory Cache (per service instance)
  - Schema registry (ontology definitions): TTL: 1h
  - Prompt templates: TTL: 1h
  - Action catalog: TTL: 5min
  - Provider health status: TTL: 30s
  - Model routing table: TTL: 1min
  - Feature flags: TTL: 1min

L5: Vector Cache (FAISS/Annoy in-memory index)
  - Similar student embeddings: loaded at startup, refreshed hourly
  - Similar opportunity embeddings: loaded at startup, refreshed hourly
  - Memory embeddings: per student, cached in Redis with TTL: 1h
````

### Cache Invalidation Strategy


```
Invalidation is event-driven, not time-based (except for static assets):

Write-through: critical-profile caches
  On mutation: update DB + update cache synchronously
  Used for: user profile, subscription tier, feature flags

Write-behind: intelligence caches
  On event: update DB, emit event, worker updates cache async
  Used for: dimension estimates, Career DNA, recommendations
  Stale data acceptable for up to cache TTL

Event-driven invalidation:
  - datad.career.resume.updated -> invalidate careerSkillCache:{studentId}
  - datad.career.interview.completed -> invalidate dimensionCache:{studentId}
  - datad.intelligence.dimension.updated -> invalidate profileCache:{studentId}
  - datad.student.profile.updated -> invalidate profileCache:{studentId}

Bulk invalidation on model deploy:
  - New model version -> full intelligence cache flush
  - Done gradually (canary cache region first, then full)
````


---

## Section 10: Database Runtime


### Database Per Context


```
Context             | Primary DB      | Cache       | Search/Index             | Notes
--------------------|-----------------|-------------|--------------------------|-----------------------------
Identity            | MongoDB         | Redis       | MongoDB indexes          | Small collection, high read
Student Profile     | MongoDB         | Redis       | MongoDB indexes          | Medium, read-heavy
Learning            | MongoDB         | Redis       | MongoDB text index       | Write-heavy during study
Career              | MongoDB + S3    | Redis       | MongoDB + Elasticsearch  | Resume parsing async
Placement           | MongoDB         | Redis       | MongoDB indexes          | Moderate volume
Roadmap             | (computed)      | Redis       | N/A                      | Ephemeral, recomputed
Finance             | MongoDB         | Redis       | MongoDB indexes          | Low volume, user-private
Planner             | MongoDB         | Redis       | MongoDB indexes          | Write-heavy
Community           | MongoDB         | Redis       | Elasticsearch            | Feed reads, content search
Knowledge Graph     | JanusGraph      | Redis       | Elasticsearch (edges)    | Temporal property graph
Intelligence        | MongoDB          | Redis       | In-memory particles      | Sharded by studentId
Memory              | Cassandra + MongoDB | Redis  | Vector DB (Qdrant)        | Episodic: Cassandra. Semantic: MongoDB.
Dax                 | MongoDB         | Redis       | N/A                      | Session data
AI Gateway          | (stateless)     | Redis       | N/A                      | Prompt cache only
Opportunity         | MongoDB         | Redis       | Elasticsearch            | Read-heavy, search
Recommendations     | (computed)      | Redis       | N/A                      | Ephemeral, recomputed
Notifications       | MongoDB         | Redis       | N/A                      | Queue-backed
Analytics           | ClickHouse      | Redis       | N/A                      | Columnar, aggregation-optimized
Subscriptions       | MongoDB         | Redis       | N/A                      | PCI-compliant zone
Admin               | MongoDB         | Redis       | N/A                      | Admin-only, low volume
```

### Consistency Model


```
Consistency is declared per operation, not per database:

STRONG (read-your-writes):
  - Identity operations (register, login, password change)
  - Subscription operations (upgrade, downgrade, cancel)
  - Resume save (user expects to see their changes immediately)
  - Goal creation, task completion
  -> Achieved via: primary reads on MongoDB (no replicas), write-concern: majority

EVENTUAL (acceptable staleness: seconds to minutes):
  - Intelligence dimension estimates (5-min cache TTL)
  - Career DNA updates (1-hour cache TTL)
  - Recommendations (5-min cache TTL)
  - Roadmaps (5-min cache TTL)
  - Feed posts (30-sec delay acceptable)
  -> Achieved via: secondary reads on MongoDB replicas, cached reads

WEAK (acceptable staleness: hours):
  - Analytics dashboards (1-hour refresh)
  - Weekly reports (generated once per week)
  - Batch similarity computations (hourly)
  -> Achieved via: ClickHouse reads, batch-computed aggregates
```

### Sharding Strategy


```
By collection/sharding key:

MongoDB:
  - Collections sharded by studentId (hashed shard key)
  - Bulk of queries include studentId filter
  - Config server replicaset, 3 shards minimum (production)
  - Each shard is a replicaset (3 nodes across AZs)

JanusGraph:
  - Graph partitioned by studentId (storage backend: Cassandra)
  - Each student's graph is one partition
  - Cross-student traversals use precomputed meta-graph

Vector DB (Qdrant):
  - Collections per entity type (student, skill, opportunity, memory)
  - Sharded by collection, replicated 2x
  - In-memory index for low-latency search

Cassandra (Memory):
  - Partitioned by studentId
  - Clustered by timestamp (descending for recent-first queries)
  - TTL-managed (tier-dependent retention)
```

### Disaster Recovery


```
Backup schedule:
  - MongoDB: daily snapshot (Atlas continuous backup), point-in-time recovery (24h window)
  - JanusGraph: weekly full backup (Cassandra snapshot), daily incremental
  - Cassandra: daily snapshot (nodetool snapshot), incremental commitlog backup
  - ClickHouse: daily backup (ALTER TABLE FREEZE), replicated across AZs
  - Redis: AOF persistence (every 1s), RDB snapshot (every 5min)
  - Object Store: cross-region replication (S3 CRR)

Recovery Time Objective (RTO):
  - Identity data: 15 minutes
  - Intelligence data: 1 hour
  - All other data: 4 hours

Recovery Point Objective (RPO):
  - Identity data: 1 second (AOF)
  - Intelligence data: 5 minutes (cache) + 1 hour (DB)
  - All other data: 24 hours (snapshot)

Runbook: https://runbook.datad.io/disaster-recovery
```


---

## Section 11: Plugin & Extension Architecture


### Design


```
DATAD extensions are not code plugins. They are CONFIGURED capabilities
that register themselves with the system.

Extension types:
  - AI skill: Dax gains a new capability (prompt + tools)
  - External integration: connects to a third-party API
  - Data import: ingests events from an external system
  - Custom dimension: a new intelligence dimension (Max tier)
  - Custom action: a new action in the recommendation catalog
  - Notification channel: a new way to reach the student
  - Content provider: a new source of learning resources/opportunities
```

### Extension Registration


```
Every extension registers via /extensions/register:

PUT /extensions/register {
  extensionId: String,
  type: 'ai-skill' | 'integration' | 'import' | 'dimension' | 'action' | 'channel',
  name: String,
  version: String,
  permissions: [String],  // what the extension can access
  hooks: {
    onEvent: String | null,  // event type to subscribe to
    onQuery: String | null,  // query type to intercept
    onResponse: String | null  // response type to modify
  },
  config: JSON (extension-specific)
}

Registration returns: {status, extensionKey, webhookSecret}
Extensions are sandboxed (dedicated process/container with resource limits).
```

### Lifecycle


```
1. DEVELOP: extension is built against the V2 API contracts
2. REGISTER: extension registers with the Extension Registry (admin approval optional)
3. ACTIVATE: extension is activated for specific students (opt-in or admin-assigned)
4. MONITOR: extension health is monitored (error rate, latency, data volume)
5. DEACTIVATE: extension is deactivated (possible bugs, abuse, or end-of-life)
6. ARCHIVE: extension metadata kept, runtime removed

Extensions have rate limits and resource caps separate from the core system.
An extension that exceeds limits is automatically deactivated.
```

### Marketplace Readiness


```
Extension marketplace (2028 target):
  - Students can browse and install extensions
  - Extensions have ratings, reviews, usage counts
  - Extension developer API with documentation and SDK
  - Revenue sharing for premium extensions
  - All extensions are reviewed before listing
  - Extensions are isolated in separate containers/processes
  - Extension failure never affects core system
````


---

## Section 12: Security Runtime


### Authentication & Authorization


```
Authentication: JWT (7-day expiry, signed with ES256)
  - Token contains: {userId, email, role, tier, iat, exp}
  - JWT is validated at the API Gateway (offloaded from services)
  - Token refresh: client-side token rotation (POST /auth/refresh)
  - Session invalidation: token blacklist (Redis, TTL = token expiry)
  - MFA: optional for admin accounts (TOTP)

Authorization: RBAC + ABAC
  Roles: member, pro, max, admin
  Permissions: per-endpoint, tier-gated
  Attribute-based: student can only access own data, admin can access platform data
  Dax/Service auth: mTLS with service tokens (SPIFFE/SPIRE identities)

API authentication hierarchy:
  1. Student request: JWT (Authorization: Bearer)
  2. Service-to-service: mTLS + service token (x-service-token header)
  3. Webhook (external): API key (x-api-key header, must match registered hash)
  4. Public endpoint: no auth (rate-limited, read-only)
```

### Secrets Management


```
Platform: HashiCorp Vault / AWS Secrets Manager

Secrets stored:
  - JWT signing keys (rotated every 30 days)
  - Database credentials (rotated every 90 days)
  - API keys for external services (OpenAI, DeepSeek, Stripe, Resend, Cloudinary)
  - Encryption keys (AES-256-GCM, rotated every 180 days)
  - OAuth client secrets

Access pattern:
  - Secrets are mounted as volumes at deployment time (K8s Secrets + Vault Agent)
  - Services request secrets via Vault sidecar (not directly from code)
  - Secret access is audited (who accessed what, when)
  - Dynamic secrets: database credentials are short-lived (TTL: 24h)
```

### Data Encryption


```
In transit:
  - TLS 1.3 for all external communication
  - mTLS for service-to-service (internal mesh)
  - Kafka: TLS + SASL/SCRAM
  - Database: TLS connections

At rest:
  - MongoDB: encryption at rest (AES-256)
  - Object store: server-side encryption (AES-256)
  - Redis: encryption optional (in-memory, no persistent PII)
  - Backup: client-side encryption before upload

Field-level encryption:
  - Journal entries: encrypted at application layer before DB write
  - Resume content: encrypted at rest, decrypted on access (audited)
  - Payment info: never stored (tokenized via Stripe/Razorpay)
```

### Audit Logging


```
Audit log scope:
  - All authentication events (login, logout, password change, token refresh)
  - All subscription events (create, change, cancel, payment)
  - All admin actions (user lookup, data access, config change)
  - All data deletion requests
  - All consent changes
  - All API key creation/deletion

Audit log storage:
  - Separate MongoDB collection (audit_events), append-only
  - Immutable: no delete, no update
  - Retention: 3 years (regulatory requirement)
  - TTL: only on old entries (>3 years)
  - Access: admin-only, read-only, audited
```

### Privacy Enforcement


```
Privacy level per event/entity:
  public: visible to cohort (anonymized aggregate)
  private: visible to student only
  sensitive: encrypted at application layer, visible to student only

Enforcement at the API layer:
  - API Gateway strips sensitive fields from responses unless request is from the data owner
  - GraphQL resolvers check privacy level before returning field data
  - Search index excludes sensitive fields
  - Analytics pipeline strips PII before warehousing

Cross-student queries (cohort comparisons):
  - Minimum cohort size: 20 students
  - Laplace noise added (epsilon=1.0) for all aggregate statistics
  - Individual student data never returned
  - Query rate limited: max 5 cross-student queries per student per hour
```


---

## Section 13: Observability


### Logging


```
Format: structured JSON (not plain text)
  Fields: timestamp, level, service, traceId, spanId, message, error, durationMs, studentId

Levels: DEBUG, INFO, WARN, ERROR, FATAL
  DEBUG: detailed debugging (not in production, sampled at 1%)
  INFO: operational events (request start/end, state transitions)
  WARN: degraded behavior (cache miss, retry, fallback)
  ERROR: failure (database error, provider error)
  FATAL: unrecoverable (service cannot start)

Storage: Loki (aggregated) + S3 (cold archive)
  - Hot retention: 7 days (Loki)
  - Warm retention: 30 days (Loki + object store)
  - Cold retention: 1 year (S3)
  - Query: Grafana (Loki datasource), LogQL
```

### Metrics


```
Platform: Prometheus + Grafana

RED metrics (Rate, Errors, Duration) per endpoint:
  - Request rate: req/s per endpoint
  - Error rate: 5xx/s per endpoint (with error code breakdown)
  - Duration: p50/p95/p99 latency per endpoint
  - Also tracked per: service, consumer, provider, student tier

USE metrics (Utilization, Saturation, Errors) per resource:
  - CPU utilization %, memory usage MB
  - Database connection pool saturation
  - Kafka consumer lag
  - Redis memory usage
  - Disk IOPS

Business metrics (per service):
  - Intelligence: events ingested/s, dimensions updated/s, insights generated/s
  - AI Gateway: tokens/s, cost/min, provider failover count
  - Knowledge Graph: traversals/s, edges created/s
  - Roadmap: regenerations/s, steps completed/s
  - Notifications: sent/s, opened/s, delivered/s

AI-specific metrics:
  - Provider latency (p50/p95/p99 per model)
  - Provider error rate (per model)
  - Cost per request (tracked per student per month)
  - Cache hit rate (response cache)
  - Hallucination rate (per model version)
  - Student satisfaction (ratings on insights/recommendations)
```

### Distributed Tracing


```
Platform: OpenTelemetry + Jaeger / Grafana Tempo

Trace policy:
  - 100% of traces for: auth, subscription, payment, admin actions
  - 10% of traces for: API requests (sampled)
  - 1% of traces for: event processing (sampled, enough for aggregate stats)
  - Trace context propagated via W3C traceparent header

Key traces:
  - Full request: API Gateway -> Auth -> Service -> DB -> Event -> Consumers
  - AI request: Dax -> Intelligence -> Memory -> AI Gateway -> Provider -> Response
  - Event chain: Producer -> Kafka -> Consumer -> DB -> Downstream events
  - Report generation: Scheduler -> Intelligence -> Writer -> Memory -> Notification

Tracing enables: latency waterfall, bottleneck identification, error root cause
```

### Alerting


```
Alert severity levels:

P0 (critical, 5min response):
  - Service down (all instances unreachable)
  - Error rate > 10% for 5 minutes
  - Database unreachable
  - AI provider all-down (all providers failing)
  - Critical event backlog (consumer lag > 1M messages)

P1 (high, 15min response):
  - Error rate > 5% for 5 minutes
  - p99 latency > 5x baseline
  - Individual provider down (fallback active)
  - Circuit breaker open (any service)
  - Cache hit rate < 50%

P2 (medium, 1hr response):
  - Error rate > 2% for 10 minutes
  - p99 latency > 2x baseline
  - Consumer lag > 100k messages
  - CPU/memory > 80% for 10 minutes

P3 (low, 24hr response):
  - Certificate expiry within 7 days
  - Disk usage > 80%
  - Deprecated API usage

Notification channels: PagerDuty (P0-P1), Slack (P2-P3), Email (daily digest)
```


---

## Section 14: Deployment Architecture


### Environment Topology


```
Development (dev):
  - Local docker-compose (minimal stack)
  - No external dependencies (mocked providers, local LLM)
  - Shared preview deployments per PR (Vercel + Railway)

Testing (test):
  - CI/CD integration tests (GitHub Actions)
  - Full stack deployed (ephemeral, per-PR)
  - Real database (ephemeral MongoDB Atlas dev cluster)
  - Mocked external services

Staging (staging):
  - Production-mirrored (same architecture, smaller scale)
  - Real external services (sandbox accounts)
  - Canary branch deploys before production
  - Synthetic load testing (daily)

Production (prod):
  - Multi-AZ (3 availability zones)
  - Multi-region (primary: ap-south-1, DR: us-east-1)
  - Auto-scaling (HPA on all stateless services)
  - Blue-green deploys with 5-min traffic drain
```

### CI/CD Pipeline


```
Platform: GitHub Actions + ArgoCD (GitOps)

CI (on every push):
  1. Lint (ESLint, Ruff)
  2. Unit tests (Jest, Pytest)
  3. Build (Docker image, tagged with git SHA)
  4. Push to container registry
  5. Contract compliance tests
  6. Integration tests (ephemeral environment)
  7. Security scan (Trivy, Snyk)

CD (on merge to main):
  1. Deploy to staging (ArgoCD sync)
  2. Smoke tests (staging health + critical path checks)
  3. Deploy to production (blue-green):
  3a.  Create new 'green' deployment (full parallel stack)
  3b.  Run smoke tests against green
  3c.  Shift 10% traffic to green, monitor for 5 min
  3d.  Shift 50% traffic, monitor for 5 min
  3e.  Shift 100% traffic
  3f.  Drain 'blue' deployment (5-min connection drain)
  4. Post-deploy checks (monitor dashboards for 30 min)
  5. Auto-rollback if alert triggers within 30 min
```

### Container Orchestration


```
Platform: Kubernetes (EKS / GKE / AKS)

Per service: Deployment, Service, HPA, PDB, ServiceAccount

K8s configuration per stateless service:
  replicas: 3 (minimum), HPA target: 70% CPU/req/s
  resources: requests (guaranteed), limits (burst)
  topologySpreadConstraints: spread across zones
  podDisruptionBudget: minAvailable=2
  readinessProbe: /health (initialDelay=10s, period=30s)
  livenessProbe: /health (initialDelay=30s, period=60s)

K8s configuration per stateful service:
  statefulSet: stable network identity, persistent volume
  replicas: 3 (minimum), anti-affinity across zones
  backup: volume snapshot (daily)
  no HPA (sharding handled at application layer)
```

### Feature Flags


```
Platform: LaunchDarkly / Unleash

Flag types:
  - release flag: gates new features (on/off per student tier)
  - experiment flag: A/B test (50/50 split, measured on outcomes)
  - ops flag: emergency kill switch (disable expensive queries, provider switch)
  - permission flag: tier access control (free vs pro vs max)

Flag lifecycle:
  1. Create flag (dev environment)
  2. Test flag (staging environment, all values)
  3. Enable for internal users (dogfooding)
  4. Enable for beta users (10% of students)
  5. Gradual rollout (25% -> 50% -> 75% -> 100%)
  6. Remove flag code (after 100% rollout + monitoring period)

All flags default to 'off' (safe default). New features must be explicitly enabled.
```


---

## Section 15: Runtime Contracts


### Service-to-Service Contract Registry


```
Every communication path between services is a registered contract.
Contracts are defined in /contracts/registry.yaml

Contract template:
  contractId: String (e.g., 'intel-to-memory')
  provider: String (e.g., 'memory-service')
  consumer: String (e.g., 'intelligence-service')
  transport: gRPC | Kafka | REST | WebSocket
  auth: mTLS | JWT | API-key
  timeout: Duration (e.g., '5s')
  retry: {maxAttempts, initialInterval, multiplier}
  rateLimit: Int (e.g., 1000 req/s)
  circuitBreaker: {errorThreshold, halfOpenAfter}
  sla: {p50, p95, p99, availability}
  version: String (semver, e.g., '2.0.0')
  breaking: String (description of what a breaking change looks like)
  compatibility: String (backward-only | full)
  deprecated: Boolean
  sunset: Date (if deprecated)
```

### Key Contracts Summary


```
C1: API Gateway -> Identity Service     [gRPC]  timeout=2s,  sla={p50:20ms, p95:100ms, 99.9%}
C2: All Services -> Identity Service     [gRPC]  timeout=1s,  sla={p50:10ms, p95:50ms,  99.9%}
C3: Intelligence -> Knowledge Graph     [gRPC]  timeout=3s,  sla={p50:30ms, p95:200ms, 99.5%}
C4: Intelligence -> Memory              [gRPC]  timeout=2s,  sla={p50:20ms, p95:100ms, 99.5%}
C5: Dax -> Intelligence                 [gRPC]  timeout=5s,  sla={p50:100ms,p95:500ms, 99.0%}
C6: Dax -> AI Gateway                   [gRPC]  timeout=30s, sla={p50:1s,   p95:5s,    99.0%}
C7: Roadmap -> Intelligence             [gRPC]  timeout=3s,  sla={p50:50ms, p95:300ms, 99.5%}
C8: Opportunity -> Intelligence         [gRPC]  timeout=5s,  sla={p50:100ms,p95:500ms, 99.0%}
C9: Recommendation -> Intelligence      [gRPC]  timeout=3s,  sla={p50:50ms, p95:300ms, 99.5%}
C10: All -> Event Bus (produce)         [Kafka] timeout=1s,  sla={p50:10ms, p95:50ms,  99.9%}
C11: All -> Event Bus (consume)         [Kafka] timeout=30s, sla={lag<1000, 99.5%}
C12: Analytics -> Event Bus (consume)   [Kafka] timeout=-,   sla={lag<100k}
C13: Notification -> AI Gateway         [gRPC]  timeout=5s,  sla={p50:200ms,p95:1s,   99.0%}
C14: Gateway -> Subscription            [gRPC]  timeout=2s,  sla={p50:20ms, p95:100ms, 99.9%}
```

### Contract Compliance


```
Every contract is verified at CI/CD time:
  1. Provider publishes contract specification (gRPC proto + YAML)
  2. Consumer runs compliance tests against contract mock (not real provider)
  3. Provider runs self-tests (are we meeting our contract?)
  4. CI/CD gate: if consumer compliance tests fail, deploy blocked
  5. Runtime monitoring: actual latency vs SLA, error rate vs threshold
  6. Contract health dashboard: every contract, every version, current status
```


---

## Section 16: Scalability Roadmap


### Stage 1: 10-100 Users (Day 1)


```
Architecture: Monolithic backend + React SPA
Database: Single MongoDB Atlas cluster (M10)
Cache: Redis Cloud (250MB)
AI: Direct API calls to DeepSeek/Llama (no router)
Event Bus: Redis pub/sub (not Kafka)
Deployment: Single VM (Railway / Render)
CI/CD: GitHub Actions, simple deploy
Key focus: feature velocity, not scale
Failure mode: single point of failure. Acceptable at this stage.
```

### Stage 2: 100-1,000 Users


```
Architecture: Modular monolith (separate modules in one process)
Database: MongoDB Atlas M20 + dedicated Redis (1GB)
AI: Simple provider router (tier -> model mapping)
Event Bus: Kafka (single-node, Confluent Cloud basic)
Deployment: 2-3 instances behind load balancer
Cache: Redis for session + intelligence cache
Key focus: feature completeness, reliability
Migration: extract Intelligence Service first (highest load)
```

### Stage 3: 1,000-10,000 Users


```
Architecture: Microservices (10 services)
Database: MongoDB Atlas M30 sharded (2 shards)
AI: AI Gateway as separate service with model routing
Event Bus: Kafka (3-node cluster)
Deployment: Kubernetes (EKS/GKE, 5-10 node cluster)
Cache: Redis Cluster (10GB)
Knowledge Graph: JanusGraph (single-cluster)
Key focus: service boundaries, event-driven architecture
Migration: extract Dax service, Knowledge service, Memory service
Add: OpenTelemetry tracing, centralized logging
```

### Stage 4: 10,000-100,000 Users


```
Architecture: Full microservices (20 services)
Database: MongoDB Atlas M60 sharded (4 shards + replicas)
AI: AI Gateway with provider failover + cost optimizer
Event Bus: Kafka (6-node, 3 AZs, 24 partitions)
Deployment: Kubernetes (20-30 node cluster, 3 AZs)
Cache: Redis Cluster (50GB)
Knowledge Graph: JanusGraph (3-node Cassandra backend)
Vector DB: Qdrant cluster (3 nodes)
Analytics: ClickHouse cluster (3 nodes)
Key focus: cost optimization, performance tuning, degradation patterns
Migration: shard stateful services by studentId
Add: blue-green deploys, canary analysis, feature flags, SLA dashboards
```

### Stage 5: 100,000-1,000,000 Users


```
Architecture: Cell-based architecture (cells of 100k students)
Database: MongoDB per cell (dedicated clusters)
AI: GPU cluster for local model serving (self-hosted Llama)
Event Bus: Kafka cell-local + cross-cell bridge for global events
Deployment: Kubernetes cell clusters + global management cluster
Cache: Redis per cell
Knowledge Graph: JanusGraph per cell (dedicated partitions)
Key focus: cell isolation, multi-region, cost per student
Migration: extract cells from monolith, cross-cell communication via global bus
Add: multi-region active-active, auto-scaling per cell, capacity planning
```

### Stage 6: 1,000,000-10,000,000 Users


```
Architecture: Cell-based + global services
  - Global: Identity, Subscription, AI Gateway routing, Admin, Analytics
  - Cell-local: all student-facing services, databases, caches
Database: MongoDB Atlas multi-region, ClickHouse global
AI: Hybrid: local GPU (inference), cloud API (training/fine-tuning)
Event Bus: Cross-cell bridge with aggregation + global fan-out
Key focus: global latency <200ms, cross-cell data minimal, cost per student <$0.10/mo
Global services: multi-region active-active (active in 2+ regions)
Cell isolation: a cell failure affects only its 100k students
Capacity: plan for 10x headroom, auto-provision cells
```


---

## Section 17: Failure Scenarios


### Scenario 1: AI Provider Outage


```
Trigger: DeepSeek API returns 5xx for all requests
Detection: AI Gateway health check failure (error rate > 50% in 30s)
Mitigation:
  1. AI Gateway circuit breaker opens for DeepSeek provider
  2. Router immediately fails over to fallback provider (Llama)
  3. Free tier students unaffected (already on Llama)
  4. Pro/Max students served by Llama with reduced quality
  5. Dax responses include: 'I'm running on a backup model — my answers may be simpler.'
  6. Cost accounting: Llama cost is 10% of DeepSeek, so no budget impact
  7. On provider recovery: circuit breaker half-opens after 5 min, tests 1 request, closes

Recovery time: automatic within 30s. No data loss. No manual intervention.
Post-mortem: provider failover count incremented. PagerDuty triggered for P1.
```

### Scenario 2: Database Primary Failure


```
Trigger: MongoDB primary node in a replicaset becomes unreachable
Detection: MongoDB driver detects primary loss, emits event, service health check fails
Mitigation:
  1. MongoDB replicaset automatically elects new primary (typically <10s)
  2. During election: reads served from secondaries (eventual consistency)
  3. Writes fail temporarily (no writable primary)
  4. Services buffer writes in memory queue (max 1000 events, 30s TTL)
  5. If election fails: switch to read-only mode
  6. Client: GET requests work, POST requests return 503 with Retry-After
  7. Background: primary standby promoted, old primary removed from replicaset

Recovery time: <10s automatic. Writes fail for <10s. No data loss (journal).
Post-mortem: root cause investigation, replicaset configuration review.
```

### Scenario 3: Kafka Event Backlog


```
Trigger: Consumer service is down or slow, event backlog grows to 1M+ messages
Detection: Consumer lag metric > 1M (alert P1)
Mitigation:
  1. Auto-scale consumer group (HPA on lag metric)
  2. If HPA at max and lag still growing:
     a. Reduce consumption priority: skip non-critical event types
     b. High-priority events (identity, subscription, event) processed first
     c. Low-priority (analytics, recommendations) dropped (logged)
  3. If consumer remains down:
     a. Pause consumer partition assignment (rebalance)
     b. Scale up replacement consumer instances
     c. Resume consumption from last committed offset
  4. After backlog cleared: remove priority filter, resume normal consumption

Recovery time: backlog cleared within 30 min (target).
Data loss: only low-priority events dropped. Critical events preserved.
```

### Scenario 4: Graph Database Failure


```
Trigger: JanusGraph backend (Cassandra) has node failure
Detection: Knowledge Service health check -> dependencies.cassandra.status=down
Mitigation:
  1. Knowledge Service enters degraded mode:
     a. Graph reads from Redis cache (stale data, up to 1 hour old)
     b. Graph writes queued to in-memory buffer (max 500, 5-min TTL)
     c. Traversals disabled (fewer than 3% of queries)
  2. Dax: no graph context for responses (reduced personalization)
  3. Intelligence: uses cached dimension estimates (graph correlations stale)
  4. Requested features that fail: opportunity matching (needs graph)
  5. Cassandra repair initiated (nodetool repair)

Recovery time: Cassandra repairs within 1 hour. Full graph operation restored.
Data loss: no (Cassandra is resilient). Stale data resolved within cache TTL.
```

### Scenario 5: Partial Deployment (Canary Failure)


```
Trigger: New version of Intelligence Service deployed to 10% of instances.
       Error rate spikes to 15% (vs 0.1% baseline).
Detection: Canary analysis (Argo Rollouts) detects error rate increase > 5x
Mitigation:
  1. Argo Rollouts automatically rolls back canary instances
  2. Previous version (stable) scaled up to replace rolled-back instances
  3. Traffic shifted back to stable version
  4. Affected students (those hitting canary): their requests go to stable on retry
  5. No global outage: 10% of students had degraded experience for <2 min
  6. Root cause: code change reverted from main. Dev team notified.

Recovery time: <2 min. Students affected: <10% for <2 min.
Post-mortem: why wasn't this caught in staging? Improve staging tests.
```

### Scenario 6: Network Partition


```
Trigger: Network failure isolates Service A from Service B within an AZ
Detection: Service A -> Service B gRPC calls timeout. Circuit breaker opens.
Mitigation:
  1. Services retry with exponential backoff within partition
  2. If partition persists (>30s): services rely on cached data
  3. No split-brain risk (Kubernetes endpoints controller removes unreachable pods)
  4. Clients (React app) use circuit breaker: switch to degraded UI mode
  5. If partition between AZs:
     a. Cross-AZ traffic fails, but each AZ continues independently
     b. Writes to each AZ may diverge (last-writer-wins on conflict)
     c. On partition healed: reconcile via event stream replay

Recovery time: automatic when network heals. Write reconciliation within 5 min.
Data divergence: rare (race conditions), resolved by event stream ordering.
```


---

## Section 18: Self-Critique


### Honest Assessment


### Weakness 1: Microservice Complexity


**Issue:** 20 services is a lot for a team of this size. The operational burden of running Kafka, JanusGraph, ClickHouse, Cassandra, Vector DB, Redis, MongoDB, and Kubernetes simultaneously is substantial.

**Severity:** CRITICAL

**Mitigation:**
  - Modular monolith first (Stage 1-2). Extract services only when load demands it.
  - Managed infrastructure (Atlas, Cloud Kafka, managed K8s) reduces ops burden by ~60%.
  - Standardized service template (cookiecutter) reduces per-service cost.
  - Target: 1 full-time SRE per 50k students. Before that, platform team owns operations.

### Weakness 2: Eventual Consistency Everywhere


**Issue:** Almost everything is eventually consistent. Intelligence, recommendations, roadmaps, graph — all have TTL-based staleness. For most use cases this is fine, but when it's not (student sees stale recommendation after completing a task), trust erodes.

**Severity:** MODERATE

**Mitigation:**
  - Show staleness indicators: 'Updated 3 minutes ago'
  - Optimistic UI: update immediately, reconcile when server responds
  - Intelligence events trigger cache invalidation for the affected student only
  - Student-facing consistency target: <10s for intelligence updates after action
  - If staleness becomes a trust issue: synchronous intelligence updates for Pro/Max tier

### Weakness 3: AI Gateway is the Critical Path


**Issue:** Every Dax conversation, interview, insight generation, and report goes through the AI Gateway. If it's down, the most visible features of DATAD are non-functional.

**Severity:** CRITICAL

**Mitigation:**
  - Multi-provider with automatic failover (3 providers minimum)
  - Local fallback model (Llama 8B self-hosted) for when all cloud providers fail
  - Response cache: 50% of Dax queries are repeat (same intent, same context). Cache eliminates provider dependency.
  - Degraded mode: Dax operates with cached responses + static FAQ patterns when providers unavailable
  - AI Gateway itself is stateless, horizontally scaled (no single point)

### Weakness 4: Knowledge Graph as JanusGraph


**Issue:** JanusGraph is operationally complex. It requires Cassandra, Elasticsearch, and a traversal server. For per-student queries (which are the 97% case), the overhead is unjustified. A simpler approach would serve most queries.

**Severity:** HIGH

**Redesign:**
  - Stage 1-3: per-student graph as JSON document in MongoDB (fits one student's entire graph)
  - Stage 4+: add JanusGraph only for cross-student traversals (cohort analysis, similarity)
  - JanusGraph complexity only justified when cross-student query volume justifies it
  - Vector DB (Qdrant) handles similarity queries independently of JanusGraph
  - Graph federation: MongoDB for per-student, JanusGraph for cross-student, Vector DB for similarity

### Weakness 5: Event Schema Evolution Cost


**Issue:** The Avro Schema Registry with full schema evolution creates overhead. Every event type change requires schema compatibility checking, consumer testing, and potential dual-version support. For a startup iterating quickly, this friction may slow development more than it helps.

**Severity:** MODERATE

**Mitigation:**
  - Start with JSON Schema (not Avro) for flexibility. Move to Avro when event volume justifies it.
  - Schema evolution rules enforced in CI, not at runtime
  - Allow 7-day grace period for consumer migration after schema change
  - Schema registry dashboard: which consumers are on which version

### Weakness 6: No Explicit Cost Per Request


**Issue:** The architecture does not track cost per request end-to-end. For a platform where AI costs dominate (each Dax request costs $0.001-$0.01), not knowing cost per student per month makes it impossible to optimize pricing or detect anomalies.

**Severity:** HIGH

**Redesign:** Add cost tracking to every AI Gateway call:
  - Per-student daily cost accumulator (Redis)
  - Per-request cost: provider cost + compute cost + storage cost
  - AI Gateway returns x-request-cost header
  - Cost alert: if any student's daily cost > $1, pause non-critical AI features
  - Monthly cost report: cost per student, cost per feature, cost per tier
  - Business model validation: Free tier cost < $0.10/student/month, Pro < $1, Max < $5

### Weakness 7: Testing AI Features


**Issue:** AI features are non-deterministic. Two calls with the same input may produce different outputs. Traditional CI/CD testing (assert response == expected) doesn't work. The architecture has no strategy for testing AI quality in production.

**Severity:** HIGH

**Mitigation:**
  - Snapshot testing: record AI responses for known inputs, diff on changes (not exact match)
  - Semantic similarity testing: generated response must have >0.8 cosine similarity to expected
  - A/B testing framework: deploy new prompt/model version to 5% of students, measure outcome metrics
  - Drift detection: monitor distribution of response length, sentiment, topic coverage
  - Human evaluation: sample 1% of Dax responses for quality rating
  - Continuous evaluation: 'would I want my student to see this?' — LLM-as-judge for quality

### Weakness 8: Developer Experience vs Production Rigor


**Issue:** The architecture requires Kafka, JanusGraph, Cassandra, and 20 services. A new developer's 'hello world' requires running 10+ containers. Development velocity suffers.

**Severity:** MODERATE

**Mitigation:**
  - Dev environment: all services mocked (in-memory implementations)
  - Only run services you're working on (others use gRPC mocks)
  - Structured contract testing: run against mocks in CI, integration tests in staging
  - 'Easy mode' docker-compose with simplified stack (MongoDB + Redis only, no Kafka)
  - Developer CLI: 'datad dev start' starts only necessary services

### Redesign Priority


```
Weakness                    | Severity | Priority | Action
----------------------------|----------|----------|-----------------------------
Microservice complexity     | CRITICAL | P0       | Modular monolith first, extract when needed
AI Gateway critical path    | CRITICAL | P0       | Multi-provider failover + local fallback + cache
No cost per request         | HIGH     | P1       | Add cost tracking to AI Gateway immediately
Testing AI features         | HIGH     | P1       | Snapshot + semantic similarity + A/B framework
JanusGraph complexity       | HIGH     | P1       | Per-student JSON in MongoDB, JanusGraph later
Eventual consistency staleness| MODERATE| P2       | Staleness indicators + targeted synchronous updates
Event schema evolution cost | MODERATE | P2       | JSON Schema first, Avro later
Developer experience        | MODERATE | P2       | Mocked dependencies, developer CLI
```

### Final Assessment


```
This runtime architecture is designed for a platform that:

1. Has 20 bounded contexts with strict ownership boundaries
2. Processes millions of events per day through Kaka
3. Serves AI responses with multi-provider failover
4. Maintains a knowledge graph of 100M+ relationships
5. Supports 10M+ students across multiple regions
6. Is built by a team of 20-50 engineers

The architecture is OVERKILL for Stage 1-2 (10-1000 users).
It is APPROPRIATE for Stage 4+ (100k+ users).
The key insight: START SIMPLE. GROW INTO THE ARCHITECTURE.

Start with a modular monolith (one process, many modules).
Extract services when: the team grows, latency demands, or isolation needs.
Don't deploy 20 services on day one.
Do design the contracts and boundaries on day one.
The ontology, events, and APIs are permanent. The deployment is provisional.
```


---

*End of DATAD Runtime Architecture & Execution Platform (V3)*

*July 23, 2026 — DATAD Pro — Chief Platform Architect*

