# DATAD — Master Implementation Roadmap


## From Architecture to Production

> *The architecture is frozen. This roadmap converts it into shippable software.*

---

**Author:** Chief Technical Officer & Principal Engineer
**Documents referenced:**
- `STUDENT_INTELLIGENCE_GRAPH.md` (Product Vision)
- `SIG_INTELLIGENCE_ENGINE.md` (26 Intelligence Modules)
- `SIG_V2_SEMANTIC_FOUNDATION.md` (Ontology, Events, APIs, Contracts)
- `DATAD_RUNTIME_ARCHITECTURE.md` (20 Services, Event Bus, AI Runtime)

**Total architecture:** ~12,000 lines / ~450KB | **Implementation: 0 lines written**

---
## Section 1: Dependency Graph

### Subsystem Dependency Map


```
LEVEL 0 (No dependencies except identity):
  [Identity/Auth]  -- registration, login, JWT, RBAC
  [Student Profile] -- profile CRUD, preferences, goals
  [Task/Planner]    -- tasks, projects, calendar
  [Notes]           -- study notes CRUD
  [Finance]         -- expenses, budgets
  [Community]       -- posts, replies, events, RSVP

LEVEL 1 (Depends on identity + event system):
  [Event Bus v1]    -- Redis pub/sub (MVP), Kafka (later)
  [Resume]          -- upload, parse, store, score
  [Journal]         -- reflection CRUD

LEVEL 2 (Depends on events):
  [Evidence Engine] -- consumes events, produces evidence records
  [Analytics v1]    -- consumes events, basic dashboards
  [Notifications v1]-- consumes events, push/email

LEVEL 3 (Depends on evidence):
  [Intelligence v1] -- first 7 dimensions (EnKF)
  [Career DNA v1]   -- GMM classification, 8 archetypes
  [Skill Extractor] -- NER over resume + notes + Dax chats

LEVEL 4 (Depends on intelligence + events):
  [Knowledge Graph v1]-- per-student JSON in MongoDB
  [Memory Service v1] -- episodic storage + semantic retrieval
  [AI Gateway v1]     -- single provider, simple routing

LEVEL 5 (Depends on knowledge + intelligence + AI):
  [Dax v1]         -- chat with context + working memory
  [Roadmap v1]     -- adaptive roadmap generation
  [Recommendation v1] -- EVA scoring, top-1 recommendation
  [Opportunity v1] -- basic compatibility scoring
  [Mock Interview] -- Dax-conducted interview + scoring

LEVEL 6 (Depends on all above):
  [Intelligence Full] -- all 26 modules
  [Career DNA Full]   -- stable archetypes with transitions
  [Knowledge Graph Full] -- JanusGraph, edge histories
  [Dax Full]          -- reasoning pipeline, meta-cognition
  [Roadmap Full]      -- fatigue detection, failure recovery
  [Opportunity Full]  -- 5-factor scoring with trajectory impact
  [Weekly Report]     -- full AI-generated report
  [Future Simulation] -- ensemble simulation engine

LEVEL 7 (Scale):
  [Cell Architecture]  -- partitioned by 100k students
  [Graph DB]           -- JanusGraph production cluster
  [Vector DB]          -- Qdrant production cluster
  [Multi-region]       -- active-active across regions
  [Global services]    -- identity, subscription, admin
```

### Critical Path (must exist before dependent work can start)


```
MUST EXIST FIRST (Month 1):
  1. Identity/Auth (everything needs it)
  2. MongoDB (primary database)
  3. Basic Express server + React SPA shell

MUST EXIST BEFORE INTELLIGENCE (Month 2):
  1. Event system (even Redis pub/sub)
  2. At least 3 data-producing features (tasks, resume, journal)
  3. Basic user interaction (enough to generate events)

MUST EXIST BEFORE DAX (Month 3-4):
  1. Intelligence v1 (7 dimensions)
  2. Career DNA v1 (archetypes)
  3. AI Gateway v1 (single provider)
  4. Basic context builder

MUST EXIST BEFORE ROADMAPS (Month 4-5):
  1. Intelligence v2 (15+ dimensions)
  2. Career DNA v2 (with evolution tracking)
  3. Skill extractor
  4. Task system (for step tracking)

MUST EXIST BEFORE FULL INTELLIGENCE (Month 6-8):
  1. Kafka (replaces Redis pub/sub)
  2. Full event taxonomy
  3. Knowledge Graph (MongoDB variant)
  4. Memory service
  5. AI Gateway (multi-provider)
```


---

## Section 2: Build Order


### Phase Strategy


```
Phase 0: Foundation (Weeks 1-3)    -- Platform shell, identity, first feature
Phase 1: Core Features (Weeks 4-8) -- 5 vertical slices, basic event system
Phase 2: Intelligence (Weeks 9-16) -- 7 dimensions, DNA, skill extraction
Phase 3: Dax + AI (Weeks 17-24)   -- Chat, interviews, roadmaps, recommendations
Phase 4: Full Intelligence (Weeks 25-40) -- 26 modules, knowledge graph, memory
Phase 5: Scale (Weeks 41-52)      -- Kafka, graph DB, vector DB, cell arch
Phase 6: Frontier (2027-2028)     -- Multi-region, marketplace, 1M+ users
```

### Why This Order


- **Phase 0 first:** Identity is the root of the dependency tree. Without auth, nothing is personalized.
- **Phase 1 before Phase 2:** Intelligence needs data. Tasks, resume, journal, and planner generate the events that feed the intelligence engine. Building intelligence before data sources is building in a vacuum.
- **Phase 2 before Phase 3:** Dax without intelligence context is a generic chatbot. Intelligence dimensions and Career DNA provide the personalization that makes Dax valuable.
- **Phase 3 before Phase 4:** Full intelligence (26 modules) needs the infrastructure that Phase 3 builds (AI Gateway, basic chat, interviews). Phase 4 completes what Phase 3 starts.
- **Phase 5 before Phase 6:** Cell architecture and graph DB are prerequisites for multi-region. You can't scale to 1M+ without partitioning.

### Parallel Workstreams


```
Always-on: UI component library, design system, test infrastructure, CI/CD

Phase 0 parallel:
  WS1: Backend (Identity, Profile, Express shell)
  WS2: Frontend (React SPA, Auth UI, App shell)

Phase 1 parallel:
  WS1: Task/Planner (full CRUD + events)
  WS2: Resume (upload, parse, events)
  WS3: Journal (reflection, sentiment)
  WS4: Event system (Redis pub/sub)

Phase 2 parallel:
  WS1: Evidence engine + 7 intelligence dimensions
  WS2: Career DNA v1
  WS3: Skill extraction (NER)
  WS4: Intelligence API (REST + gRPC)

Phase 3 parallel:
  WS1: AI Gateway (single provider)
  WS2: Dax chat (context building, working memory)
  WS3: Mock interview (question bank, scoring)
  WS4: Basic roadmap generation

Phase 4 sequential (modules build on each other):
  Evidence -> Dimensions -> DNA -> Knowledge Graph -> Memory -> Predictions
  -> Temporal -> Causal -> Recommendations -> Simulations -> Reports
  -> Explainability -> Meta-learning -> Self-improvement

Phase 5-6 sequential (infrastructure has ordering):
  Redis Cluster -> Kafka -> JanusGraph -> Vector DB -> Cell Architecture -> Multi-region
```


---

## Section 3: Milestones


### M0: Platform Shell (Week 1-3)


```
Goal: A running web app that students can log into

Deliverables:
  - Express server with health check
  - React SPA with routing and theme
  - JWT-based auth (register, login, logout)
  - MongoDB connection + User model
  - API Gateway (basic routing, JWT validation)
  - CI/CD pipeline (lint -> test -> build -> deploy)
  - Docker compose for local dev

Services: Identity (monolithic)
APIs: POST /register, POST /login, GET /me
Database: User collection in MongoDB
Events: none (not yet)
UI: Login page, Register page, App shell, Settings page

Acceptance: a new user can register, log in, see a blank dashboard
```

### M1: Core Features (Week 4-8)


```
Goal: Students can manage tasks, upload resumes, write journals

Deliverables:
  - Task CRUD (create, complete, delete)
  - Project CRUD with task grouping
  - Resume upload + parsing (Apache Tika)
  - Basic ATS scoring (keyword match)
  - Journal/reflection CRUD with sentiment analysis
  - Student profile CRUD
  - Event system v1 (Redis pub/sub)
  - Basic events: task.created, task.completed, resume.updated, journal.written
  - Notifications v1 (in-app only)

Services: Student, Task, Resume, Journal (monolithic)
APIs: REST CRUD for tasks, projects, resume, journal, profile
Database: Task, Project, Resume, JournalEntry, Notification collections
Events: 10 event types across 4 domains
UI: Dashboard, Tasks page, Resume page, Journal page, Profile page

Acceptance: student can manage their entire career prep workflow
```

### M2: Intelligence Foundation (Week 9-16)


```
Goal: The system can see the student — dimensions, DNA, skills

Deliverables:
  - Evidence engine (event -> evidence transformation)
  - 7 intelligence dimensions (Learning Velocity, Consistency, Confidence,
    Career Readiness, Execution Ability, Communication, Analytical Thinking)
  - Ensemble Kalman Filter for dimension estimation
  - Career DNA v1 (GMM with 8 archetypes)
  - Skill extraction (NER over resume + journal)
  - Basic knowledge graph (per-student JSON in MongoDB)
  - Intelligence API v1 (REST: /intelligence/dimensions, /intelligence/dna)
  - Intelligence UI (graph visualization in React)
  - 15 more event types (intelligence domain)

Services: Intelligence, Knowledge Graph, Evidence (monolithic)
APIs: GET /intelligence, GET /intelligence/dimensions, GET /intelligence/dna
Database: Intelligence collections, KnowledgeNode JSON documents
Events: 15 intelligence event types
UI: Intelligence Graph page (basic node visualization)

Acceptance: system shows 7 dimensions with >60% confidence for active students
```

### M3: Dax & AI Features (Week 17-24)


```
Goal: Students can talk to Dax, practice interviews, get roadmaps

Deliverables:
  - AI Gateway v1 (single provider, prompt building)
  - Context builder (intelligence -> LLM prompt)
  - Dax chat (conversation, working memory in Redis)
  - Mock interview (question bank, live scoring, feedback)
  - Basic roadmap generation (goal decomposition, prioritization)
  - Basic recommendation (EVA scoring, top-1 recommendation)
  - Basic opportunity matching (skill gap analysis)
  - Notification system v2 (push + email)
  - Career DNA v2 (with evolution tracking)
  - 5 more dimensions (total: 12)

Services: Dax, AI Gateway, Roadmap, Recommendation, Opportunity, Notification
APIs: POST /dax/chat, POST /interviews, GET /roadmap, GET /recommendations, GET /opportunities
Database: Conversation, DaxSession (MongoDB), working memory (Redis)
Events: 20 more event types (Dax, interview, roadmap, opportunity)
UI: Dax chat UI, Interview UI, Roadmap page, Opportunities page

Acceptance: student can have a personalized conversation with Dax
```

### M4: Full Intelligence (Week 25-40)


```
Goal: All 26 intelligence modules operational, full knowledge graph

Deliverables:
  - Kafka event bus (replaces Redis pub/sub)
  - Universal event taxonomy (120+ event types)
  - Full knowledge graph (JanusGraph, edge histories)
  - Memory service (episodic + semantic + procedural)
  - 14 more dimensions (total: 26)
  - Prediction engine (readiness, placement, salary)
  - Temporal reasoning (lead-lag, anomalies)
  - Causal reasoning (Double ML, causal forest)
  - Future simulation (ensemble, counterfactuals)
  - Explainability engine (template + LLM)
  - Weekly Intelligence Report
  - Full recommendation engine (multi-action, feasibility)
  - Multi-agent orchestration (inferrer, writer, critic)
  - Uncertainty quantification (epistemic vs aleatoric)
  - Feedback loops (prediction outcomes -> model updates)
  - Meta-learning (hyperparameter optimization)
  - Cross-student representation learning
  - Self-improving system (auto-repair, architecture search)

Services: all 20 services operational
APIs: all V2 API contracts
Database: all databases (MongoDB, JanusGraph, Cassandra, Qdrant, ClickHouse)
Events: full taxonomy
UI: All SIG UI components (full graph, timeline, simulation, matching)

Acceptance: full intelligence pipeline end-to-end, p95 latency <500ms
```

### M5: Scale & Production Hardening (Week 41-52)


```
Goal: Production-hardened at 100k+ students

Deliverables:
  - Cell architecture (100k students per cell)
  - Multi-region readiness
  - Vector DB production cluster
  - Graph DB production cluster
  - Distributed tracing (100% critical path)
  - SLA dashboards per service
  - Auto-scaling tuned for all services
  - Disaster recovery drills (quarterly)
  - Penetration testing
  - SOC compliance documentation
  - Cost optimization (AI cost per student < $0.50/month)
  - 99.9% uptime target

Acceptance: platform serves 100k+ students with 99.9% uptime
```


---

## Section 4: Vertical Slices


### Slice 1: Student Registration [Week 1-3]


```
End-to-end: click 'Register' -> see personalized dashboard

Frontend: Register page, Login page, App shell, Onboarding flow
Backend: Identity service (register, login, JWT)
Database: User collection in MongoDB
Events: datad.auth.registered, datad.auth.logged_in
Intelligence: none (first interaction)
Testing: E2E register -> login -> see dashboard
Team: 2 engineers (1 frontend, 1 backend)
Duration: 2 weeks
```

### Slice 2: Task Management [Week 4-5]


```
End-to-end: create task -> complete task -> see event in stream

Frontend: Tasks page, Task detail, Task creation modal
Backend: Task service (CRUD, events)
Database: Task collection in MongoDB
Events: datad.task.created, datad.task.completed, datad.task.deleted
Infrastructure: Redis pub/sub (event bus v1)
Testing: E2E create -> complete -> verify event in stream
Team: 1.5 engineers (1 backend, 0.5 frontend)
Duration: 1.5 weeks
```

### Slice 3: Resume Upload [Week 5-7]


```
End-to-end: upload PDF -> parsed -> skills extracted -> event emitted

Frontend: Resume page with upload, preview, ATS score
Backend: Resume service (upload, parse, score)
Database: Resume collection, Object Storage (S3-compatible)
Infrastructure: Apache Tika (parsing), basic NLP (skill extraction)
Events: datad.career.resume.updated, datad.career.skill.inferred
Intelligence: career_readiness dimension becomes measurable
Testing: E2E upload PDF -> verify parsed skills -> verify event
Team: 2 engineers (1 backend heavy, 1 frontend)
Duration: 2 weeks
```

### Slice 4: Journal + Reflection [Week 6-8]


```
End-to-end: write journal -> sentiment analyzed -> reflection stored

Frontend: Journal page with editor, entry list
Backend: Journal service (CRUD, sentiment analysis)
Database: JournalEntry collection (encrypted at rest)
AI: Basic sentiment classifier (small model, not LLM)
Events: datad.learning.reflection.written
Testing: E2E write -> verify sentiment -> verify event
Team: 1 engineer (full stack)
Duration: 1.5 weeks
```

### Slice 5: Intelligence Graph [Week 9-16]


```
End-to-end: student uses features -> graph shows growing dimensions

Frontend: Intelligence Graph page, dimension detail, trajectory view
Backend: Intelligence service (evidence engine, EnKF, dimensions)
Database: Evidence collection, DimensionEstimate collection
Infrastructure: Event consumer (reads from Redis pub/sub)
AI: Bayesian inference (EnKF), no LLM needed for this slice
Events: datad.intelligence.dimension.updated
Testing: generate events -> verify dimension estimates -> verify graph UI
Team: 2 engineers (1 ML, 1 full stack)
Duration: 6 weeks
```

### Slice 6: Dax Chat [Week 17-20]


```
End-to-end: ask Dax a question -> gets personalized answer

Frontend: Dax chat UI, message list, input, streaming response
Backend: Dax service, Context builder, AI Gateway
Infrastructure: AI provider (DeepSeek/Llama), Redis (working memory)
AI: LLM with context injection (dimensions + DNA + recent events)
Events: datad.dax.message.sent, datad.dax.conversation.topic
Testing: E2E ask question -> verify answer uses context -> verify event
Team: 2 engineers (1 backend AI-heavy, 1 frontend)
Duration: 4 weeks
```

### Slice 7: Mock Interview [Week 19-22]


```
End-to-end: start interview -> answer questions -> receive scores

Frontend: Interview UI (question display, answer input, timer, score display)
Backend: Career service (interview CRUD, scoring), AI Gateway (question generation)
AI: LLM with interviewer prompt, scoring rubric
Events: datad.career.interview.completed
Intelligence: interview_confidence dimension activated
Testing: E2E conduct full interview -> verify scores -> verify event
Team: 2 engineers (1 AI, 1 full stack)
Duration: 3 weeks (parallel with Dax slice)
```

### Slice 8: Adaptive Roadmap [Week 22-26]


```
End-to-end: system generates roadmap -> student completes steps -> roadmap adapts

Frontend: Roadmap page (step list, progress, timeline)
Backend: Roadmap service, reprioritization engine
Infrastructure: Intelligence API consumer
AI: Goal decomposition (rule-based + LLM for complex goals)
Events: datad.roadmap.created, datad.roadmap.reprioritized
Testing: generate roadmap -> complete step -> verify reprioritization
Team: 2 engineers (1 backend-heavy, 1 frontend)
Duration: 4 weeks
```

### Slice 9: Opportunity Matching [Week 26-30]


```
End-to-end: student views opportunities -> sees compatibility scores -> applies

Frontend: Opportunities page (list, match scores, compatibility breakdown)
Backend: Opportunity service (scoring pipeline, gap analysis)
Infrastructure: Intelligence API consumer, Knowledge Graph
AI: Compatibility scoring (formula-based, no LLM for scoring)
Events: datad.opportunity.viewed, datad.opportunity.saved, datad.opportunity.applied
Testing: seed opportunities -> verify match scores -> verify apply flow
Team: 2 engineers (1 backend, 1 frontend)
Duration: 4 weeks
```

### Slice 10: Weekly Intelligence Report [Week 30-35]


```
End-to-end: system generates -> pushed to student -> read in-app

Frontend: Report page (full-screen reading experience, export)
Backend: Intelligence service (report generation), AI Gateway (narrative)
Infrastructure: Kafka (scheduled event), Object storage (report PDFs)
AI: LLM for narrative generation (conditioned on dimension deltas)
Events: datad.intelligence.report.generated
Testing: generate report for test student -> verify content accuracy -> verify push
Team: 2 engineers (1 full stack, 1 ML)
Duration: 5 weeks
```


---

## Section 5: Engineering Backlog


### Epic: Core Platform [E0]


```
Priority: P0 (MUST have)

Features:
  F0.1: Identity (register, login, JWT, logout) [XS]
  F0.2: User profile CRUD [XS]
  F0.3: App shell (routing, theme, navigation) [S]
  F0.4: API Gateway (routing, JWT validation, rate limiting) [S]
  F0.5: CI/CD pipeline [M]
  F0.6: Local dev environment (Docker compose) [S]
  F0.7: MongoDB connection + base models [XS]
  F0.8: Error handling middleware [XS]
  F0.9: Logging infrastructure [XS]

Blocker: none
Estimated: 3 weeks / 2 engineers
```

### Epic: Data-Producing Features [E1]


```
Priority: P0 (MUST have — intelligence needs data)

Features:
  F1.1: Task CRUD + completion [M]
  F1.2: Project CRUD + task grouping [M]
  F1.3: Resume upload + parsing [XL]
  F1.4: Basic ATS scoring [S]
  F1.5: Journal/reflection CRUD [M]
  F1.6: Sentiment analysis [S]
  F1.7: Redis pub/sub event bus [M]
  F1.8: 10 base event types [XS]
  F1.9: In-app notifications [M]

Blocker: E0 (identity must exist)
Estimated: 5 weeks / 3 engineers
```

### Epic: Intelligence Engine [E2]


```
Priority: P0 (MUST have — core differentiator)

Features:
  F2.1: Evidence engine (event -> evidence transformation) [L]
  F2.2: 7 intelligence dimensions [XL]
  F2.3: Ensemble Kalman Filter implementation [XL]
  F2.4: Career DNA v1 (GMM, 8 archetypes) [L]
  F2.5: Skill extraction (NER) [L]
  F2.6: Per-student knowledge graph [M]
  F2.7: Intelligence API (REST) [S]
  F2.8: Intelligence Graph UI [XL]
  F2.9: 15 intelligence event types [S]
  F2.10: Dimension contributions view [M]

Blockers: E1 (needs event data)
Estimated: 8 weeks / 3 engineers (1 ML specialist)
```

### Epic: Dax & AI [E3]


```
Priority: P0 (MUST have — the face of the product)

Features:
  F3.1: AI Gateway (routing, prompts, caching) [XL]
  F3.2: Context builder (intelligence -> prompt) [L]
  F3.3: Dax chat UI (streaming, conversations) [XL]
  F3.4: Working memory (Redis, TTL 24h) [M]
  F3.5: Mock interview engine [XL]
  F3.6: Live interview scoring [L]
  F3.7: Basic roadmap generation [XL]
  F3.8: EVA recommendation engine [L]
  F3.9: Basic opportunity matching [L]
  F3.10: Career DNA v2 (evolution tracking) [L]
  F3.11: Push notifications [M]
  F3.12: 5 more dimensions [L]

Blockers: E2 (needs intelligence), E1 (needs events)
Estimated: 8 weeks / 4 engineers (1 AI specialist)
```

### Epic: Full Intelligence [E4]


```
Priority: P1 (SHOULD have for premium experience)

Features:
  F4.1: Kafka event bus [XL]
  F4.2: Universal event taxonomy (120+ types) [L]
  F4.3: JanusGraph knowledge graph [XL]
  F4.4: Memory service (episodic + semantic) [XL]
  F4.5: 14 more dimensions (total 26) [XL]
  F4.6: Prediction engine (readiness, placement) [XL]
  F4.7: Temporal reasoning [L]
  F4.8: Causal reasoning [XL]
  F4.9: Future simulation [XL]
  F4.10: Explainability engine [L]
  F4.11: Weekly Intelligence Report [L]
  F4.12: Multi-agent orchestration [XL]
  F4.13: Uncertainty quantification [L]
  F4.14: Feedback loops [L]
  F4.15: Meta-learning [XL]
  F4.16: Full opportunity engine [L]
  F4.17: Full recommendation engine [L]
  F4.18: SIG UI components (timeline, simulation, matching) [XL]

Blockers: E3 (needs Dax + AI infrastructure)
Estimated: 16 weeks / 5 engineers (2 ML specialists)
```

### Epic: Scale & Production [E5]


```
Priority: P2 (NICE TO HAVE until 10k+ users)

Features:
  F5.1: Cell architecture [XL]
  F5.2: Vector DB production cluster [L]
  F5.3: Graph DB production cluster [L]
  F5.4: Distributed tracing (100% critical path) [L]
  F5.5: SLA dashboards [M]
  F5.6: Auto-scaling tuning [L]
  F5.7: Disaster recovery drills [M]
  F5.8: Penetration testing [M]
  F5.9: SOC compliance [XL]
  F5.10: AI cost optimization [L]
  F5.11: Multi-region active-active [XXL]

Blockers: E4 (needs full stack to scale)
Estimated: 12 weeks / 2 engineers (infra specialists)
```


---

## Section 6: Service Implementation Order


### Service: Identity [Priority: P0]

```
Epic: E0
Dependencies: None
APIs: POST /register, POST /login, GET /me, POST /auth/refresh...
Events: datad.auth.registered, datad.auth.logged_in...
Database: User (MongoDB)
Testing: Unit: auth flows. Integration: register->login->JWT->protected endpoint. E2E: full auth cy...
```

### Service: Student Profile [Priority: P0]

```
Epic: E1
Dependencies: Identity
APIs: GET /profile, PUT /profile, GET /preferences...
Events: datad.profile.updated...
Database: StudentProfile, Goal, Preference (MongoDB)
Testing: Unit: CRUD operations. Integration: profile update->verify event. E2E: create profile->set...
```

### Service: Task/Planner [Priority: P0]

```
Epic: E1
Dependencies: Identity
APIs: GET /tasks, POST /tasks, PUT /tasks/{id}/complete, GET /projects...
Events: datad.task.created, datad.task.completed, datad.task.overdue, datad.project.completed...
Database: Task, Project, ProjectTask (MongoDB)
Testing: Unit: task CRUD, completion flow. Integration: task complete->verify event. E2E: create pr...
```

### Service: Resume [Priority: P0]

```
Epic: E1
Dependencies: Identity, Object Storage
APIs: GET /resume, PUT /resume, GET /resume/score...
Events: datad.career.resume.updated, datad.career.skill.inferred...
Database: Resume (MongoDB + S3), SkillProficiency (MongoDB)
Testing: Unit: upload, parse, score. Integration: upload->verify parsed skills->verify events. E2E:...
```

### Service: Journal [Priority: P0]

```
Epic: E1
Dependencies: Identity
APIs: GET /journal, POST /journal, GET /journal/{id}...
Events: datad.learning.reflection.written...
Database: JournalEntry (MongoDB, encrypted)
Testing: Unit: CRUD + sentiment. Integration: write->verify sentiment. E2E: multi-entry flow....
```

### Service: Redis Event Bus [Priority: P0]

```
Epic: E1
Dependencies: Redis
APIs: Internal: EventEmitter API...
Events: All E1 events...
Database: Redis pub/sub channels
Testing: Integration: produce event->verify consumer receives. Reliability: verify message delivery...
```

### Service: Evidence Engine [Priority: P0]

```
Epic: E2
Dependencies: Event Bus
APIs: Internal: processEvent(event) -> EvidenceRecord...
Events: datad.intelligence.evidence.processed...
Database: Evidence (MongoDB, append-only)
Testing: Unit: event transformation, weight computation. Integration: event->evidence->dimension up...
```

### Service: Intelligence v1 [Priority: P0]

```
Epic: E2
Dependencies: Evidence Engine, Knowledge Graph (basic)
APIs: GET /intelligence, GET /intelligence/dimensions, GET /intelligence/dna...
Events: datad.intelligence.dimension.updated, datad.intelligence.dna.updated...
Database: DimensionEstimate, CareerDNA, ParticleState (MongoDB + in-memory)
Testing: Unit: EnKF update, dimension computation. Integration: evidence ingested->verify dimension...
```

### Service: Knowledge Graph [Priority: P0-MVP]

```
Epic: E2
Dependencies: Intelligence, Event Bus
APIs: Internal: addNode, addEdge, getNeighborhood, findPath...
Events: datad.graph.edge.created, datad.graph.node.created...
Database: KnowledgeNode, KnowledgeEdge (MongoDB, per-student JSON)
Testing: Unit: node/edge CRUD. Integration: event->graph update. Traversal queries....
```

### Service: Skill Extractor [Priority: P0]

```
Epic: E2
Dependencies: Resume, Journal
APIs: Internal: extractSkills(text) -> [Skill]...
Events: datad.career.skill.inferred, datad.career.skill.confirmed...
Database: Skill, SkillProficiency (MongoDB)
Testing: Unit: NER precision/recall on test set. Integration: resume update->verify extracted skill...
```

### Service: AI Gateway v1 [Priority: P0]

```
Epic: E3
Dependencies: None (calls external LLM)
APIs: gRPC: Execute(prompt, context) -> Response, Stream(prompt, context) -> Stream<Response>...
Events: datad.ai.model.invoked, datad.ai.model.failed...
Database: PromptTemplate (Redis cache)
Testing: Unit: routing, prompt building. Integration: execute prompt->verify response. E2E: Dax que...
```

### Service: Dax v1 [Priority: P0]

```
Epic: E3
Dependencies: AI Gateway, Intelligence, Knowledge Graph, Memory
APIs: POST /dax/chat, POST /dax/stream, GET /dax/conversations...
Events: datad.dax.conversation.started, datad.dax.message.sent...
Database: Conversation, DaxSession (MongoDB), WorkingMemory (Redis)
Testing: Unit: intent classification, context building. Integration: chat->verify intelligence used...
```

### Service: Mock Interview [Priority: P0]

```
Epic: E3
Dependencies: Dax, AI Gateway
APIs: POST /career/interviews, GET /career/interviews/{id}...
Events: datad.career.interview.completed...
Database: MockInterview (MongoDB)
Testing: Unit: question generation, scoring. Integration: conduct interview->verify scores. E2E: fu...
```

### Service: Career DNA v2 [Priority: P0]

```
Epic: E3
Dependencies: Intelligence v1
APIs: GET /intelligence/dna (extended)...
Events: datad.intelligence.dna.transitioned...
Database: CareerDNA (extended: evolution history)
Testing: Unit: transition detection, stability scoring. Integration: dimension changes->verify DNA ...
```

### Service: Roadmap v1 [Priority: P0]

```
Epic: E3
Dependencies: Intelligence, Task, AI Gateway
APIs: GET /roadmap, POST /roadmap/regenerate, POST /roadmap/steps/{id}/complete...
Events: datad.roadmap.created, datad.roadmap.reprioritized...
Database: Roadmap (computed, cached in Redis)
Testing: Unit: goal decomposition, prioritization. Integration: complete step->verify reprioritizat...
```

### Service: Recommendation v1 [Priority: P1]

```
Epic: E3
Dependencies: Intelligence, Causal (basic)
APIs: GET /recommendations...
Events: datad.intelligence.recommendation.generated...
Database: Recommendation (computed, cached in Redis)
Testing: Unit: EVA computation. Integration: dimension change->verify recommendation update....
```

### Service: Opportunity v1 [Priority: P1]

```
Epic: E3
Dependencies: Intelligence, Knowledge Graph, Skill
APIs: GET /opportunities, GET /opportunities/{id}/compatibility...
Events: datad.opportunity.viewed, datad.opportunity.applied...
Database: Opportunity (MongoDB), OpportunityMatch (Redis, computed)
Testing: Unit: compatibility scoring. Integration: student data->verify match scores. E2E: browse->...
```

### Service: Notifications v2 [Priority: P1]

```
Epic: E3
Dependencies: Event Bus, Student Profile
APIs: POST /notifications/send, GET /notifications, PUT /notifications/preferences...
Events: datad.notification.sent, datad.notification.opened...
Database: Notification (MongoDB), NotificationPreference (MongoDB)
Testing: Unit: delivery, preference filtering. Integration: event->trigger notification. E2E: actio...
```

### Service: Kafka Event Bus [Priority: P2]

```
Epic: E4
Dependencies: Kafka cluster
APIs: Topics: datad.{domain}.{event-type}...
Events: All 120+ event types...
Database: Kafka topics (24 partitions, 3x replication)
Testing: Integration: produce->consume->verify ordering. Replay: reset offset->re-consume. P99 late...
```

### Service: Memory Service [Priority: P1]

```
Epic: E4
Dependencies: Kafka, MongoDB, Vector DB
APIs: gRPC: Store, Retrieve, Search, Consolidate, Delete...
Events: datad.memory.consolidated...
Database: EpisodicMemory (Cassandra), SemanticMemory (MongoDB + Vector DB), WorkingMemory (Redis)
Testing: Unit: storage/retrieval, search. Integration: store memory->retrieve. E2E: conversation->m...
```

### Service: Intelligence v2 (Full) [Priority: P1]

```
Epic: E4
Dependencies: Kafka, Memory, Knowledge Graph Full
APIs: All V2 intelligence APIs...
Events: All 50+ intelligence event types...
Database: All intelligence collections
Testing: Unit: per-module. Integration: full pipeline end-to-end. E2E: student action->full intelli...
```

### Service: JanusGraph Knowledge Graph [Priority: P2]

```
Epic: E4
Dependencies: Cassandra, Elasticsearch, JanusGraph cluster
APIs: Graph traversal API (gRPC)...
Events: datad.graph.full.*...
Database: JanusGraph (Cassandra backend + ES index)
Testing: Integration: import MongoDB graph->verify traversal. Performance: traversal latency < 200m...
```

### Service: Predictions v1 [Priority: P1]

```
Epic: E4
Dependencies: Intelligence v2, Causal
APIs: GET /predictions (readiness, placement, timeline)...
Events: datad.intelligence.prediction.made, datad.intelligence.prediction.fulfilled...
Database: Prediction (MongoDB)
Testing: Unit: model evaluation on holdout. Integration: dimension update->verify prediction update...
```

### Service: Causal Reasoner [Priority: P2]

```
Epic: E4
Dependencies: Intelligence v2, Temporal
APIs: GET /causal/effects, GET /causal/graph...
Events: datad.intelligence.causal.estimated...
Database: CausalState (MongoDB + in-memory)
Testing: Unit: synthetic data test. Integration: multiple intervention types->verify effect estimat...
```

### Service: Future Simulation [Priority: P2]

```
Epic: E4
Dependencies: Predictions, Causal
APIs: POST /simulate, POST /simulate/compare...
Events: datad.intelligence.simulation.run...
Database: SimulationScenario (MongoDB)
Testing: Unit: single simulation. Integration: simulate->verify trajectory. E2E: full 'what-if' flo...
```

### Service: Weekly Report [Priority: P2]

```
Epic: E4
Dependencies: Intelligence v2, AI Gateway
APIs: GET /intelligence/reports/{week}...
Events: datad.intelligence.report.generated...
Database: WeeklyReport (MongoDB)
Testing: Unit: report generation. Integration: generate->verify content. E2E: weekly report deliver...
```

### Service: Explainability Engine [Priority: P1]

```
Epic: E4
Dependencies: All intelligence modules
APIs: POST /intelligence/explain...
Events: None (called inline, not async)...
Database: ExplanationHistory (MongoDB, bounded)
Testing: Unit: template generation, evidence decomposition. Integration: explain prediction->verify...
```

### Service: Multi-Agent Orchestrator [Priority: P2]

```
Epic: E4
Dependencies: All intelligence modules, AI Gateway
APIs: Internal: orchestrate(task) -> Result...
Events: datad.intelligence.agent.run, datad.intelligence.agent.conflict...
Database: OrchestrationState (Redis, ephemeral)
Testing: Unit: agent routing. Integration: multi-agent task->verify output. E2E: complex reasoning ...
```

### Service: Cell Architecture [Priority: P3]

```
Epic: E5
Dependencies: Kubernetes, Infrastructure
APIs: Internal: cell-router (gateway), cell-manager (control plane)...
Events: datad.system.cell.created, datad.system.cell.failover...
Database: Cell-level MongoDB, Cell-level Redis, Cell-level Kafka
Testing: Integration: student in cell A->all requests served by cell A. Failover: cell A down->traf...
```

### Service: Analytics [Priority: P1]

```
Epic: E4
Dependencies: Kafka, ClickHouse
APIs: GET /analytics/dashboard, GET /analytics/cohorts...
Events: (consumes all events, produces none)...
Database: AnalyticsEvent (ClickHouse), Dashboard (ClickHouse + Redis cache)
Testing: Unit: aggregation queries. Integration: produce events->verify dashboard updates. E2E: bus...
```

### Service: Admin [Priority: P1]

```
Epic: E2 (stub), E4 (full)
Dependencies: All services (read-only)
APIs: GET /admin/users, GET /admin/metrics, POST /admin/announcements...
Events: datad.system.admin.action...
Database: AdminAction, AuditLog (MongoDB)
Testing: Unit: admin CRUD. Integration: admin action->verify audit log. E2E: full admin workflow....
```


---

## Section 7: Database Rollout


### Phase-by-Phase Database Introduction


```
Phase 0 (Week 1-3):
  MongoDB: User, Session (single Atlas cluster, M10)
  - No other databases needed

Phase 1 (Week 4-8):
  MongoDB: Task, Project, Resume, JournalEntry, Notification
  Redis: Event bus (pub/sub), Session cache
  Object Store: Resume files (S3-compatible, MinIO or Cloudflare R2)
  - Still single MongoDB Atlas cluster (M20)

Phase 2 (Week 9-16):
  MongoDB: Evidence, DimensionEstimate, CareerDNA, ParticleState,
           KnowledgeNode, KnowledgeEdge, Skill, SkillProficiency
  Redis: Intelligence cache, Event bus consumer offsets
  - MongoDB Atlas M30 (more collections, more indexes)
  - Redis Cloud 1GB (added: intelligence cache tier)

Phase 3 (Week 17-24):
  MongoDB: Conversation, DaxSession, MockInterview, Opportunity,
           Roadman (ephemeral, cached), Recommendation (cached)
  Redis: Working memory (Dax), Conversation state, Roadmap cache
  - MongoDB Atlas M30 sharded (2 shards) — event volume grows

Phase 4 (Week 25-40):
  MongoDB: Prediction, ExplanationHistory, WeeklyReport, AdminAction, AuditLog
  JanusGraph: Production knowledge graph (Cassandra backend)
  Vector DB (Qdrant): Semantic memory embeddings, similarity search
  Cassandra: Episodic memory events
  ClickHouse: Analytics events
  Kafka: Event bus (replaces Redis pub/sub)
  - MongoDB Atlas M60 sharded (4 shards). JanusGraph (3 nodes). Qdrant (3 nodes).
  - ClickHouse (3 nodes). Kafka (6 nodes, 3 AZs). Cassandra (3 nodes).

Phase 5 (Week 41-52):
  Cell-level instances of all databases
  Global: shared Identity DB, Subscription DB, Admin DB
  - Full production topology with replication, backup, DR

What to avoid until scale demands it:
  - JanusGraph (skip until 10k+ students — MongoDB JSON graph is sufficient)
  - Cassandra (skip until 50k+ — MongoDB can handle episodic memory)
  - ClickHouse (skip until 10k+ — MongoDB aggregation is sufficient for analytics)
  - Vector DB (skip until 5k+ — in-memory cosine similarity over MongoDB embeddings is fine)
  - Kafka (skip until 5k+ — Redis pub/sub handles MVP event volume)
  - Cell architecture (skip until 100k+ — single cluster is fine)
```


---

## Section 8: AI Rollout


### AI Capability by Phase


```
MVP (Weeks 1-8):
  - Sentiment analysis (small model, not LLM)
  - Resume ATS scoring (keyword-based, not ML)
  - Task difficulty estimation (rule-based)
  - NO LLM calls yet (cost awareness)

v1 (Weeks 9-16):
  - Skill extraction (fine-tuned RoBERTa NER, small model)
  - Dimension estimation (Bayesian EnKF, no LLM needed)
  - Career DNA classification (GMM, no LLM needed)
  - Basic correlation detection (Pearson R, no LLM)
  - NO LLM calls. Intelligence is purely statistical at this stage.

v2 (Weeks 17-24):
  - LLM chat (single provider, DeepSeek Flash)
  - Context building (intelligence -> LLM prompt)
  - Mock interview question generation (LLM + template)
  - Interview scoring (LLM + rubric)
  - Goal decomposition (LLM + rule-based fallback)
  - Recommendation framing (LLM + template)
  - Weekly report generation (LLM + template structure)
  - LLM cost tracking per student

v3 (Weeks 25-40):
  - Multi-provider AI Gateway (DeepSeek + OpenAI + Llama)
  - Automatic provider failover
  - Hallucination detection
  - Explainability (LLM for narrative + structured templates)
  - Future simulation narrative (LLM + simulation data)
  - Career DNA transition explanations (LLM + evidence)
  - Insight generation (LLM + pattern detection)
  - Multi-agent reasoning (specialized LLM agents)
  - Cost optimizer (route by complexity, latency requirements)
  - Prompt A/B testing (versioned, measured)

Scale (Week 41+):
  - Self-hosted Llama 8B (GPU cluster, reduces dependency)
  - Fine-tuned models (specialized for education domain)
  - Batch inference pipeline (weekly report generation at scale)
  - On-device inference (mobile, reduced latency)
  - Federated learning (privacy-preserving model improvement)
  - AI cost per student < $0.50/month (target)

What NOT to build in AI:
  - Custom model training (use existing models, fine-tune later)
  - On-device inference (wait for mobile PWA scale)
  - Federated learning (wait for 50k+ students)
  - Multi-agent system (wait for v3, after single-agent is stable)
  - Self-improving models (wait for v3, requires feedback loops)
```


---

## Section 9: Infrastructure Rollout


```
MVP Infrastructure (Weeks 1-8):
  Hosting: Single VM (Railway / Render / Fly.io)
  Database: MongoDB Atlas (M10, single region)
  Cache: Redis Cloud (250MB)
  Storage: S3-compatible (MinIO / R2)
  CI/CD: GitHub Actions
  Monitoring: Sentry (errors) + basic health checks
  AI: Direct API calls to DeepSeek (no gateway)
  Event Bus: Redis pub/sub
  Docker: single docker-compose.yml

v1 Infrastructure (Weeks 9-16):
  Hosting: Kubernetes (EKS/GKE, 3-5 node pool)
  Database: MongoDB Atlas (M30, single shard, 3-node replicaset)
  Cache: Redis Cloud (1GB)
  Monitoring: Prometheus + Grafana (RED metrics)
  CI/CD: GitHub Actions + Helm charts
  Secrets: GitHub Secrets / Doppler
  Feature Flags: LaunchDarkly (free tier, 5 flags)
  Docker: per-service Dockerfile

v2 Infrastructure (Weeks 17-24):
  Hosting: Kubernetes (10-15 node pool, 3 AZs)
  Database: MongoDB Atlas (M40, 2 shards, 3-node replicaset)
  Cache: Redis Cluster (5GB)
  AI Gateway: Dedicated service with provider routing
  Monitoring: Grafana dashboards per service
  Tracing: OpenTelemetry + Jaeger (10% sampling)
  Feature Flags: LaunchDarkly (20 flags)
  CI/CD: ArgoCD (GitOps, blue-green)

v3 Infrastructure (Weeks 25-40):
  Hosting: Kubernetes (20-30 node pool, 3 AZs)
  Kafka: Confluent Cloud / self-hosted (6 nodes, 3 AZs)
  JanusGraph: 3-node cluster (Cassandra backend)
  Vector DB: Qdrant (3-node cluster)
  ClickHouse: 3-node cluster
  Database: MongoDB Atlas (M60, 4 shards)
  Redis Cluster (10GB)
  Monitoring: Full SLA dashboards, PagerDuty integration
  Tracing: 100% critical path, 10% API, 1% batch
  Feature Flags: LaunchDarkly (100+ flags)
  CI/CD: ArgoCD + Canary analysis (Argo Rollouts)

Scale Infrastructure (Week 41+):
  Cell architecture: N * (K8s cluster + MongoDB + Redis + Kafka)
  Global: shared services (Identity, Subscription, Admin)
  Multi-region: primary + DR
  Auto-scaling: HPA + VPA + cluster autoscaler
  DR: cross-region replication, backup restore drills
  Compliance: SOC2 audit, penetration testing

What to delay:
  - Kubernetes (use single VM until 1k+ users)
  - Kafka (use Redis pub/sub until 5k+ users)
  - JanusGraph (use MongoDB JSON graph until 10k+ users)
  - Vector DB (use in-memory cosine similarity until 5k+ users)
  - ClickHouse (use MongoDB aggregation until 10k+ users)
  - Cell architecture (use single cluster until 100k+ users)
  - Multi-region (use single region until 50k+ users)
  - Distributed tracing (use basic logging until 1k+ users)
  - Feature flags (use env vars until 5+ engineers)
```


---

## Section 10: Technical Debt Strategy


### Intentional Shortcuts for MVP


### Debt: Modular monolith instead of microservices

```
Shortcut: All services are in one process but separated internally by module boundaries. API contrac...
Why acceptable: The 20-service architecture is correct for scale but adds deployment complexity. A monolit...
Upgrade trigger: When: sustained load exceeds 1k concurrent users OR team grows beyond 5 engineers
Migration: Use the module boundaries as extraction points. Extract Intelligence Service first (highes...
```

### Debt: Redis pub/sub instead of Kafka

```
Shortcut: Simple publish/subscribe with Redis channels. No schema registry, no replay, no partitioni...
Why acceptable: At <5k students, event volume is <100 events/second. Redis can handle this easily. Schema ...
Upgrade trigger: When: event volume exceeds 500/s OR the team needs replay for debugging OR the team needs partitioning for consumer parallelism
Migration: Switch Kafka side-by-side: produce to both Redis and Kafka for one week, validate, then cu...
```

### Debt: Per-student JSON graph in MongoDB instead of JanusGraph

```
Shortcut: Each student's knowledge graph is a JSON document: {nodes: [...], edges: [...]}. Queries t...
Why acceptable: Each student's graph is ~1MB (50 nodes, 150 edges). Loading and traversing in memory takes...
Upgrade trigger: When: cross-student graph queries are needed (cohort analysis, similarity search) OR graph size exceeds 20MB per student
Migration: Import MongoDB graphs into JanusGraph. Run both in parallel for one week. Cross-student qu...
```

### Debt: No vector DB (cosine similarity in memory)

```
Shortcut: Embedding vectors stored in MongoDB or Redis. Similarity search is linear scan over in-mem...
Why acceptable: Semantic memory search at MVP scale: <10k memories per student. Linear scan over 10k 768-d...
Upgrade trigger: When: per-student memory count exceeds 10k OR cross-student similarity search is needed OR search latency exceeds 50ms
Migration: Export embeddings to Qdrant. One-time import + incremental updates. Swap to vector DB at t...
```

### Debt: No CI/CD contract compliance testing

```
Shortcut: Deployments validated by integration tests (not contract compliance tests). Contracts are ...
Why acceptable: With <5 engineers, communication overhead is low. Breaking a contract is noticed immediate...
Upgrade trigger: When: team grows beyond 5 engineers OR external integration partner joins OR a contract breaks in production
Migration: Add contract testing to CI/CD: provider publishes spec, consumer tests against mock. Start...
```

### Debt: Manual AI provider routing instead of AI Gateway

```
Shortcut: Each service that needs AI calls the provider directly with a hardcoded model. No routing,...
Why acceptable: With one provider (DeepSeek) and one model per tier, a gateway adds complexity without ben...
Upgrade trigger: When: second provider is added OR first provider outage happens OR AI cost tracking is needed
Migration: Build AI Gateway as a thin proxy: wrap existing calls, add routing headers. Start with rou...
```

### Debt: No feature flags (env vars instead)

```
Shortcut: Feature toggles are environment variables or code comments. No gradual rollout, no A/B tes...
Why acceptable: With <5 engineers, feature branches + PR review are sufficient for coordination. A kill sw...
Upgrade trigger: When: team grows beyond 5 engineers OR concurrent feature development exceeds 3 features OR a feature needs gradual rollout
Migration: Introduce LaunchDarkly/Unleash. Start with 5 flags (kill switches for expensive features)....
```

### Debt: No distributed tracing (console.log instead)

```
Shortcut: Request debugging is done via structured logs with requestId. Cross-service traces require...
Why acceptable: At MVP scale, most requests touch 1-2 services. Manual correlation works. Distributed trac...
Upgrade trigger: When: a debugging session requires correlating >3 services OR p50 latency exceeds targets AND the bottleneck is unclear
Migration: Add OpenTelemetry instrumentation to the 5 most-critical services (API Gateway, Intelligen...
```

### Debt: Single-region deployment

```
Shortcut: All infrastructure in one cloud region (ap-south-1). No DR, no cross-region failover....
Why acceptable: At <10k users, a single-region outage affects everyone but is rare (cloud provider SLA: 99...
Upgrade trigger: When: user base exceeds 50k OR regulatory compliance requires data residency in multiple regions OR single-region downtime causes revenue loss >$10k/hr
Migration: Add second region as cold standby: replicate databases, keep services scaled to zero. Acti...
```


---

## Section 11: Risks


### TECHNICAL RISKS


```
Risk: AI Provider dependency
  Likelihood: HIGH | Impact: HIGH
  DATAD depends on DeepSeek API availability. If DeepSeek is down for hours, Dax is non-functional.
  Mitigation: Multi-provider fallback (Llama self-hosted). Response cache (50% of queries are repeat). Degraded Dax mode (no-AI FAQ pa

Risk: Eventual consistency surprises
  Likelihood: MEDIUM | Impact: MEDIUM
  Students see stale recommendations after completing an action. Trust erodes.
  Mitigation: Staleness indicators. Cache TTL < 30s for student's own data. Immediate invalidation on mutation.

Risk: MongoDB scaling limits
  Likelihood: MEDIUM | Impact: LOW
  MongoDB Atlas can scale to ~100k students on a single cluster (M200+). Beyond that, sharding complexity increases.
  Mitigation: Shard by studentId (hashed). Cell architecture before hitting limits. Migration plan ready at 50k users.

Risk: Graph traversal performance
  Likelihood: LOW | Impact: MEDIUM
  Per-student graph traversal in MongoDB JSON: <5ms for <500 nodes. At 2000+ nodes, may approach 50ms.
  Mitigation: Pre-compute frequent traversals. Cache neighborhood queries. Add JanusGraph when needed.

Risk: CI/CD pipeline flakiness
  Likelihood: MEDIUM | Impact: LOW
  Flaky tests block deployments. Integration tests with AI responses are non-deterministic.
  Mitigation: AI response snapshot testing (semantic similarity, not exact match). Deterministic unit tests for non-AI code.

```

### PRODUCT RISKS


```
Risk: Intelligence doesn't feel intelligent
  Likelihood: HIGH | Impact: HIGH
  If dimension estimates don't match student self-perception, trust is lost. 'The system says I'm confident but I'm terrif
  Mitigation: Progressive calibration: start with 'we're learning about you' messaging. Show confidence intervals. Let students correc

Risk: Cold start disappointment
  Likelihood: MEDIUM | Impact: HIGH
  New students see an empty graph with no insights. They churn before the intelligence engine has enough data.
  Mitigation: Cold-start phased experience (Section 24 of intelligence engine). Value-adding from day 1: basic recommendations without

Risk: Gamification perception
  Likelihood: MEDIUM | Impact: HIGH
  Students treat dimensions as scores to maximize rather than growth indicators. 'How do I raise my confidence score?' ins
  Mitigation: Remove absolute scores from UI. Show only deltas and comparisons to own history. Emphasize 'not a scoreboard' in onboard

Risk: Privacy concerns
  Likelihood: MEDIUM | Impact: HIGH
  Students are uncomfortable with a system that infers their personality from behavior. 'How does it know my confidence?'
  Mitigation: Radical transparency: show exactly which evidence contributed to each inference. Let students delete evidence. Privacy-f

```

### AI RISKS


```
Risk: Hallucination in student-facing content
  Likelihood: HIGH | Impact: CRITICAL
  Dax generates incorrect career advice or fabricated information. Student makes a bad decision based on wrong information
  Mitigation: Hallucination detection pipeline (Section 7 of runtime architecture). Structured outputs with evidence citations. Discla

Risk: Model bias
  Likelihood: MEDIUM | Impact: HIGH
  AI recommendations systematically favor certain backgrounds, genders, or programs. Some students receive worse advice.
  Mitigation: Regular bias audits (monthly). Training data balanced across demographics. Fairness constraints in recommendation scorin

Risk: Cost explosion
  Likelihood: MEDIUM | Impact: HIGH
  Free tier students generate high AI costs with low conversion. AI costs exceed revenue.
  Mitigation: Strict per-student cost tracking. Hard caps on free tier AI usage. Local models for free tier (Llama 8B). Cost optimizat

Risk: Prompt injection
  Likelihood: LOW | Impact: HIGH
  Student crafts a prompt that causes Dax to ignore constraints or reveal other students' data.
  Mitigation: Input sanitization. System prompt with security constraints. Output validation against guardrails. Never prompt-inject r

```

### SCALABILITY RISKS


```
Risk: Event stream backpressure failure
  Likelihood: MEDIUM | Impact: MEDIUM
  Consumer lag causes intelligence updates to be hours stale. Students see outdated graphs.
  Mitigation: Consumer lag monitoring (P1 alert). Auto-scale consumer groups. Priority-based consumption (critical events first).

Risk: Database connection pool exhaustion
  Likelihood: MEDIUM | Impact: MEDIUM
  MongoDB connection pool saturates under load. Services fail to query.
  Mitigation: Connection pooling (default: 100 per service instance). Pool monitoring (P2 alert). Auto-scale services before pool exha

Risk: Cache stampede
  Likelihood: LOW | Impact: MEDIUM
  Popular cache key expires simultaneously for multiple requests. All hit the database.
  Mitigation: Cache warming for known keys. Dogpile prevention (lock-based regeneration, stale-while-revalidate).

```

### OPERATIONAL RISKS


```
Risk: Team size vs complexity
  Likelihood: HIGH | Impact: CRITICAL
  20 services + 10 infrastructure components require 5+ engineers to operate. A 2-person team cannot maintain this.
  Mitigation: Modular monolith until team grows. Managed infrastructure (Atlas, Cloud Kafka). SRE rotation when team > 5.

Risk: Knowledge concentration
  Likelihood: MEDIUM | Impact: HIGH
  The ML engineer who built the EnKF and the causal reasoner is the only person who understands them. Bus factor = 1.
  Mitigation: Documented module specifications. Code review for all ML changes. Pair programming for critical modules. Knowledge trans

Risk: Debugging AI responses
  Likelihood: MEDIUM | Impact: MEDIUM
  Non-deterministic AI responses make debugging hard. 'Dax gave a bad answer but we can't reproduce it.'
  Mitigation: Log all AI requests/responses (with student consent). Replay capability. Deterministic mode for testing (fixed seed, tem

```


---

## Section 12: Final Roadmap


### Chronological Implementation Plan


```
WEEK 1-3  [M0: Platform Shell]
  Goal:          Running web app, student can register and log in
  Critical path: Identity/Auth -> Express server -> React shell -> CI/CD
  Team:          2 engineers (1 frontend, 1 backend)
  Demo:          Register -> Login -> See empty dashboard with navigation
  Validation:    10 test users can authenticate end-to-end

WEEK 4-8  [M1: Core Features]
  Goal:          Student can manage tasks, resume, journal, events
  Critical path: Tasks -> Resume -> Journal -> Event system (Redis pub/sub)
  Team:          3 engineers (1 frontend, 2 backend)
  Demo:          Create task -> Upload resume -> Write journal -> See events
  Validation:    50 test users actively using features

WEEK 9-12  [M2a: Intelligence Foundation]
  Goal:          Evidence engine + first 7 dimensions operational
  Critical path: Evidence engine -> EnKF -> 7 dimensions -> Intelligence API
  Team:          3 engineers (1 ML, 1 backend, 1 frontend)
  Demo:          Use features for 7 days -> See growing intelligence graph
  Validation:    Dimension estimates show >50% confidence for active users

WEEK 13-16 [M2b: Career DNA + Skills]
  Goal:          Career DNA + skill extraction + intelligence UI
  Critical path: GMM archetypes -> NER skill extraction -> Graph visualization
  Team:          3 engineers (same as above)
  Demo:          See Career DNA archetype -> See extracted skills
  Validation:    8 archetypes distinguishable on real student data

WEEK 17-20 [M3a: Dax MVP]
  Goal:          Dax can have personalized conversations
  Critical path: AI Gateway -> Context builder -> Dax chat UI -> Working memory
  Team:          4 engineers (1 AI, 1 backend, 1 full stack, 1 frontend)
  Demo:          'Dax, what should I focus on?' -> Response uses my dimensions and DNA
  Validation:    Dax response quality rating > 4/5 from beta testers

WEEK 21-24 [M3b: Interviews + Roadmaps + Opportunities]
  Goal:          Full AI feature set (interviews, roadmaps, matching)
  Critical path: Mock interview -> Roadmap generation -> Opportunity matching
  Team:          4 engineers (same as above + 1 backend)
  Demo:          Full interview -> See updated graph -> Get new roadmap -> Match opportunities
  Validation:    Complete end-to-end student journey from registration to placement prep
  *** FIRST SHIPPABLE PREMIUM PRODUCT ***

WEEK 25-30 [M4a: Full Intelligence Foundation]
  Goal:          Kafka, knowledge graph, memory service
  Critical path: Kafka deployment -> JanusGraph import -> Memory service
  Team:          5 engineers (2 ML, 2 backend, 1 frontend)
  Validation:    Event replay works. Graph traversals <200ms. Memory retrieval <50ms.

WEEK 31-35 [M4b: Predictions + Causal + Simulations]
  Goal:          14 more dimensions, prediction engine, causal reasoning
  Critical path: Remaining dimensions -> Prediction engine -> Causal engine -> Simulation
  Team:          5 engineers (same as above)
  Validation:    Predictions show <20% error on holdout data. Causal effects match known interventions.

WEEK 36-40 [M4c: Explainability + Reports + Multi-Agent + Self-Improvement]
  Goal:          All 26 modules operational, full SIG experience
  Critical path: Explainability -> Weekly report -> Multi-agent -> Meta-learning
  Team:          5 engineers (same as above)
  Validation:    26 modules pass evaluation. Weekly report generates successfully. E2E latency <500ms p95.
  *** FULL INTELLIGENCE PLATFORM OPERATIONAL ***

WEEK 41-46 [M5a: Scale Infrastructure]
  Goal:          Production-hardened at 10k+ users
  Critical path: Vector DB -> Cell architecture preparation -> Auto-scaling -> Tracing
  Team:          3 engineers (2 infrastructure, 1 full stack)
  Validation:    Load test at 10x current traffic. p95 latency <2x baseline.

WEEK 47-52 [M5b: Production Hardening]
  Goal:          99.9% uptime, SOC compliance, cost optimization
  Critical path: DR drills -> Penetration testing -> SOC2 -> Cost optimization
  Team:          3 engineers (same as above)
  Validation:    DR drill passes. Pen test passes. AI cost < $0.50/student/month.
  *** PRODUCTION-GRADE PLATFORM ***

2027-2028  [M6: Frontier]
  Goal:          Multi-region, marketplace, 1M+ users
  Critical path: Global services -> Multi-region active-active -> Extension marketplace
  Team:          10+ engineers
  Validation:    Platform serves 1M+ students with <200ms global p95 latency
```

### Workstream Allocation


```
Phase    | WS1 (Backend)  | WS2 (Frontend) | WS3 (ML/AI)   | WS4 (Infra)
---------|----------------|----------------|----------------|----------------
M0 (W1-3)| Identity+Auth  | Auth UI+Shell  | -              | CI/CD+Docker
M1 (W4-8)| Tasks+Resume+  | Task UI+Resume | -              | Redis+Events
         | Journal+Events | UI+Journal UI  |                |               
M2 (W9-16)|Intelligence API|Graph UI       | EnKF+GMM+NER  | MongoDB tuning
M3 (W17-24)|Dax+Interviews | Dax UI+       | Context+Recs  | AI Gateway+   
         |+Roadmaps+Opps  | Roadmap+Match | +Simulation    | Redis Cluster 
M4 (W25-40)|Full Intel API | Full SIG UI   | 19 more modules| Kafka+Janus+  
         |                |               |                | Qdrant+Click  
M5 (W41-52)|Cost tracking  | -             | Model opt      | Cells+DR+     
         |                |               |                | Compliance    
```

### Validation Checkpoints


```
Week 3:  10 users can register and log in
Week 8:  50 users actively using tasks, resume, journal
Week 12: Intelligence estimates show >50% confidence
Week 16: Career DNA is distinguishable (8 archetypes)
Week 20: Dax rated >4/5 by beta testers
Week 24: Complete student journey demo (registration -> placement prep)
Week 30: Event replay works, graph <200ms
Week 35: Predictions <20% error
Week 40: Full intelligence operational, latency <500ms
Week 46: Load test at 10x current traffic passes
Week 52: 99.9% uptime for 30 days. SOC2 in progress.
```

### Demo Goals


```
Week 3  Demo:  'Look, it's a running app!'
Week 8  Demo:  'I uploaded my resume and it extracted my skills'
Week 12 Demo:  'The graph is starting to know me'
Week 16 Demo:  'My Career DNA says I'm a Builder-Analyst'
Week 20 Demo:  'Dax knows my goals and talks to me like a mentor'
Week 24 Demo:  'I did an interview and my roadmap updated automatically'
Week 30 Demo:  'My weekly report told me something I didn't know about myself'
Week 40 Demo:  'I simulated my future and chose the best path'
Week 52 Demo:  'DATAD runs at 99.9% uptime with 10k students'
```

### Summary: DATAD Will Take ~12 Months to Full Production


```
Milestone  | Timeline  | Team Size | State
-----------|-----------|-----------|-------------------------------
M0: Shell  | Week 1-3  | 2         | Running web app with auth
M1: Core   | Week 4-8  | 3         | Career prep features + events
M2: Intel  | Week 9-16 | 3         | Intelligence foundation + DNA
M3: AI     | Week 17-24| 4         | Dax + interviews + roadmaps
M4: Full   | Week 25-40| 5         | All 26 modules operational
M5: Scale  | Week 41-52| 3         | Production-hardened at 10k+
M6: Future | 2027-2028 | 10+       | Multi-region, marketplace, 1M+

Total: 52 weeks to ship a production-grade Student Intelligence Operating System.
First premium-ready product: Week 24 (Dax + interviews + roadmaps).
Full intelligence platform: Week 40 (all 26 modules).
Production-hardened: Week 52 (99.9% uptime, SOC compliance).
```


---

*End of DATAD Master Implementation Roadmap*

*July 23, 2026 — Chief Technical Officer & Principal Engineer*

