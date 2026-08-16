# Student Intelligence Graph — V2 Semantic Foundation


## Principal Architect Review & Platform Redesign

> *The intelligence engine requires an operating system. This document defines the semantic foundation, canonical ontology, universal event taxonomy, permanent API contracts, and cognitive operating layer that the intelligence modules build upon.*

---

**Phase:** Version 2 Architecture Review
**Author:** Principal Architect
**Date:** July 23, 2026
**Scope:** Semantic foundation underneath all 26 intelligence modules

---
## Preamble: Critique of V1 Architecture


Before designing V2, I identify the structural weaknesses in the existing 26-module intelligence engine. These are NOT criticisms of ML quality. They are architectural observations about semantic consistency, extensibility, and long-term maintainability.

### Weakness 1: No Canonical Ontology


The existing architecture has ~65+ MongoDB models (User, Task, Note, Resume, JournalEntry, etc.), each designed independently. There is no single document defining every entity, its purpose, its lifecycle, its identity rules, or its relationship schema. Different models use different conventions for timestamps, ownership, versioning, and deletion. This creates semantic drift: the same concept ('skill') means different things in the Resume model vs the SkillListing model vs the StudentIdentity model vs the CareerCollector.

**Impact:** Intelligence modules cannot reliably join data across models. Every module maintains its own mapping layer, creating an implicit N*M integration matrix.
### Weakness 2: Events Are Not First-Class


The Event Bus (Layer 0) exists conceptually but is not backed by a universal event taxonomy. Events are ad-hoc: different producers emit events with different schemas, different payload shapes, different timestamp conventions, and no correlation IDs. There is no idempotency key, no replayability guarantee, no dead-letter queue, and no event evolution strategy. The stream processor cannot reliably replay from a checkpoint because events have no stable identity.

**Impact:** The Evidence Engine (Module 2) cannot trust event provenance. Deduplication is unreliable. Historical replay for model retraining is impossible.
### Weakness 3: No Permanent API Contracts


The 30+ route files are tightly coupled to their MongoDB models. When a model changes, the route changes, the controller changes, and the frontend changes. There is no stable intelligence API layer that persists across model refactors. The existing 'intelligence' endpoints return raw model data with attached scores, not structured intelligence objects with explicit confidence, provenance, and explanations.

**Impact:** Every model refactor requires rewriting API consumers. The intelligence layer cannot be versioned independently of the data layer.
### Weakness 4: Dax Is a Chatbot, Not an Operating System


Dax is implemented as a chat interface with tool-calling capabilities. It has no explicit cognitive structure: no working memory, no reasoning pipeline, no uncertainty detection, no conflict resolution, no meta-cognition. Dax's interaction with the intelligence layer is ad-hoc — it gets a context string injected into its prompt rather than having structured access to intelligence primitives.

**Impact:** Dax cannot reason systematically. Every new capability requires prompt engineering, not architecture changes. Dax cannot introspect its own knowledge boundaries.
### Weakness 5: Roadmaps Are Static


The existing planner/pivot system generates roadmaps as fixed plans. There is no dynamic reprioritization, no dependency graph, no fatigue detection, no momentum awareness, no learning velocity adjustment. Roadmaps do not integrate with the intelligence engine's causal estimates or predictions.

**Impact:** Roadmaps become stale within days. Students lose trust when plans don't adapt to their changing state.
### Weakness 6: No System Contracts Between Subsystems


The 26 intelligence modules interact through implicit interfaces: one module calls another's functions directly. There are no formal contracts defining inputs, outputs, latency expectations, failure modes, or retry semantics. A change to the Latent Trait Model can silently break the Prediction Engine without any compilation error or schema validation.

**Impact:** System is brittle. Adding a new intelligence module requires understanding all 25 existing modules. Horizontal scaling is blocked by implicit coupling.
### Weakness 7: Memory Has No Architecture


The existing Memory model (UserMemory) is a single document that stores AI-accumulated context. It has no structure: no episodic vs semantic separation, no retrieval strategy, no importance weighting, no consolidation pipeline. Every conversation overwrites rather than appends.

**Impact:** Memory is lossy. Long-term personalization is impossible because old information is silently overwritten.
### Weakness 8: No Explicit Opportunity Intelligence


Internships, jobs, scholarships, courses, hackathons are stored in separate models with no unified matching infrastructure. The existing 'matching' is keyword-based. There is no Career DNA compatibility model, no skill gap analysis, no counterfactual impact estimation, no expected ROI computation.

**Impact:** Students must manually evaluate opportunities. The intelligence engine has no mechanism to learn which opportunities lead to good outcomes.
### Weakness 9: Architectural Principles Are Undocumented


The existing architecture has implicit principles (Latent over Observable, Temporal over Static, etc.) but no documented system of invariants that every contributor must follow. New engineers cannot distinguish an invariant from an accident.

**Impact:** Design consistency degrades with each contributor. Architectural drift accelerates over time.
## Critique Summary


```
Weakness                    | Severity | Existing Cost
----------------------------|----------|-------------------------------
No canonical ontology       | CRITICAL | Semantic drift across 65 models
Events not first-class      | CRITICAL | No replay, unreliable dedup
No permanent API contracts  | HIGH     | API breaks on every model change
Dax is chatbot, not OS      | HIGH     | No systematic reasoning
Roadmaps are static         | HIGH     | Stale within days
No system contracts         | HIGH     | Brittle, unscalable coupling
Memory has no architecture  | MODERATE | Lossy, no long-term personalization
No opportunity intelligence | MODERATE | Manual evaluation, no learning
Principles undocumented    | MODERATE | Architectural drift over time
```

The V2 redesign addresses all nine weaknesses. The intelligence engine (26 modules) remains operational. This document builds the platform underneath it.


---

## Section 1: Canonical Student Ontology


### Design Philosophy

Every entity in DATAD is defined exactly once in a canonical registry. Every other system references entities by their canonical ID and schema. The ontology is versioned, extensible, and backward-compatible. Schema changes are additive only — fields are never removed, only deprecated.

The ontology follows a **temporal entity model**: every attribute has a history, every relationship has a time range, every entity has a lifecycle with explicit states.

### Entity Specification Format

Each canonical entity follows this specification:

```
EntityName:
  Purpose:  concise statement of what this entity represents
  Identity: the field(s) that uniquely identify this entity
  Version:  schema version number
  Ownership: who creates/owns this entity
  Lifecycle: the states this entity passes through
  Deletion:  what happens on delete (cascade, soft-delete, anonymize)
  Retention: how long the entity and its history are kept
  Tracking:  what historical data is retained
  Required:  list of required fields
  Optional:  list of optional fields
  Relations: list of relationships to other entities
  Inherits:  parent entity (if any)
```

### Core Entities


#### Student

```
Purpose:  A person using DATAD. The central entity around which all intelligence is built.
Identity: studentId (UUIDv7, immutable), email (stable identifier for auth)
Ownership: System (created on registration). Student controls their own profile.
Lifecycle: pending -> active -> suspended -> archived -> deleted
Deletion: Cascade: all owned entities are either deleted or anonymized. Profile data is soft-deleted (30-day recovery window). Anonymized data may remain for population models.
Required: studentId, email, createdAt, identityCommitment (hash of PII for dedup)
Relations: role, tier, batch, program, specialization, college, graduationYear, preferences, consentFlags, lifeStage, timezone, locale
```

#### Student Identity Sub-Entities


#### StudentProfile

```
Purpose:  Extended profile beyond identity: academic background, career goals, learning preferences.
Identity: profileId (UUIDv7), studentId (unique FK)
Ownership: Student
Lifecycle: empty -> partial -> complete -> verified
Deletion: Soft-delete with student. Anonymized after deletion window.
Required: studentId, displayName
Relations: bio, avatarUrl, targetRoles, targetIndustries, targetCompanies, preferredLocations, willingToRelocate, availableFrom, linkedInUrl, portfolioUrl, githubUrl
```

#### StudentIdentity

```
Purpose:  Verified identity attributes: batch, program, specialization, college. Used for cohort membership.
Identity: identityId (UUIDv7), studentId (unique FK)
Ownership: Student (initiated). Admin (verified).
Lifecycle: pending -> submitted -> verified -> rejected -> updated
Deletion: Soft-delete. Verification records retained for audit.
Required: studentId, batch, program, college, verificationStatus
Relations: specialization, admissionYear, graduationYear, rollNumber, documents (hash only), verifiedBy, verifiedAt
```

### Career Entities


#### Skill

```
Purpose:  A demonstrable capability. Canonical skill taxonomy (ESCO-extended).
Identity: skillId (UUIDv7), canonical SKill from taxonomy OR custom skill label (unique per student for custom)
Ownership: System (taxonomy). Student (custom).
Lifecycle: canonical -> deprecated | custom -> active -> merged
Deletion: Cascade to SkillProficiency. Taxonomy skills cannot be deleted, only deprecated.
Required: skillId, label, domain, category, source (taxonomy | custom)
Relations: alternativeLabels, description, prerequisites, relatedSkills, escoId, level (beginner/intermediate/advanced/expert)
```

#### SkillProficiency

```
Purpose:  A student's proficiency in a skill. Temporal: tracks evolution over time.
Identity: (studentId, skillId) unique compound
Ownership: System (inferred from evidence). Student (confirmed/rejected).
Lifecycle: inferred -> confirmed -> merged | inferred -> rejected -> archived
Deletion: Retained for trajectory tracking. Cannot be deleted individually (privacy: student can delete all evidence).
Required: studentId, skillId, proficiency (0-1), confidence (0-1), firstDetected, lastDemonstrated
Relations: evidenceCount, trajectory [{timestamp, proficiency, source}], endorsements, lastAssessmentScore
```

#### Experience

```
Purpose:  A position/role the student has held (internship, job, volunteer, project lead).
Identity: experienceId (UUIDv7)
Ownership: Student (created). System (may import from resume).
Lifecycle: draft -> published -> archived
Deletion: Cascade to achievements within experience. Soft-delete.
Required: studentId, title, organization, startDate, type (internship | job | volunteer | project | leadership)
Relations: endDate, description, achievements, skillsUsed, isCurrent, location, employmentType, industry
```

#### Achievement

```
Purpose:  A notable accomplishment. Can belong to an experience or stand alone.
Identity: achievementId (UUIDv7)
Ownership: Student (created). System (extracted from resume/conversations).
Lifecycle: draft -> published -> verified (optional)
Deletion: Soft-delete. Retained for career trajectory even if experience is deleted.
Required: studentId, title, date, type (award | certification | project | publication | competition | other)
Relations: description, issuer, link, associatedExperienceId, skillsDemonstrated, verificationUrl, isVerified
```

#### Goal

```
Purpose:  A career or learning goal the student is working toward.
Identity: goalId (UUIDv7)
Ownership: Student (created). System (may suggest from Career DNA).
Lifecycle: proposed -> active -> paused -> completed -> abandoned
Deletion: Soft-delete. Retained for trajectory analysis.
Required: studentId, title, category (career | learning | skill | placement | personal), targetDate
Relations: description, targetRole, targetCompany, targetIndustry, relatedSkills, parentGoalId, progress (0-1), priority, source (student | suggested | derived)
```

### Learning Entities


#### LearningResource

```
Purpose:  Any resource used for learning: article, video, book, course, module, case study, tool.
Identity: resourceId (UUIDv7), canonical URL (unique per source)
Ownership: System (curated). Student (submitted).
Lifecycle: pending -> published -> archived -> deprecated
Deletion: Soft-delete. Deprecated resources retain history for students who used them.
Required: resourceId, title, type (article | video | book | course | module | case | tool | paper), url, domain, topics
Relations: description, difficulty, duration, author, publisher, language, skillsTaught, prerequisites, rating, tags
```

#### LearningSession

```
Purpose:  A discrete period of focused learning activity.
Identity: sessionId (UUIDv7)
Ownership: System (automatically created from event stream).
Lifecycle: active -> completed -> abandoned
Deletion: TTL: 90 days (aggregated into weekly summaries after). Privacy: student can delete individual sessions.
Required: studentId, startTime, endTime, duration, type (study | practice | review | reflection), resourceId (optional)
Relations: eventCount, topic, focusScore (0-1), sentiment, notesExtracted, tasksCompleted, breakCount
```

#### Assessment

```
Purpose:  Any evaluation of the student's knowledge or skill: quiz, test, assignment, certification exam.
Identity: assessmentId (UUIDv7)
Ownership: System. External integration.
Lifecycle: scheduled -> in_progress -> completed -> reviewed
Deletion: Soft-delete. Scores retained for trajectory analysis.
Required: studentId, type (quiz | test | assignment | certification | mock | self), title, date, score, maxScore
Relations: topics, skillsAssessed, questionCount, correctCount, timeSpent, difficulty, proctored, feedback, attemptNumber
```

#### Reflection

```
Purpose:  A student's self-reflective entry. Strong privacy protections.
Identity: reflectionId (UUIDv7)
Ownership: Student.
Lifecycle: draft -> published -> archived
Deletion: Soft-delete. Content is encrypted at rest. Journal entries are private to the student (never exposed to any other user, including admin).
Required: studentId, timestamp, type (journal | weekly | project | career | gratitude | freeform), content (encrypted)
Relations: sentiment, topics, wordCount, moodTags, goalsReferenced, isPrivateEvenFromAdmin
```

### Career Preparation Entities


#### Resume

```
Purpose:  The student's resume. Versioned. Each version is a snapshot.
Identity: resumeId (UUIDv7), studentId (unique per active version)
Ownership: Student (created). Dax (coached).
Lifecycle: empty -> draft -> review -> completed -> archived -> version_history
Deletion: Previous versions are retained for trajectory analysis (min 5, max 50). Current version is soft-deletable.
Required: studentId, version, sections [{type, content}], skills, atsScore, lastReviewed
Relations: templateId, customizations, targetRole, versionHistory [{version, timestamp, atsScore, skills}]
```

#### MockInterview

```
Purpose:  A simulated interview session. Can be Dax-conducted or self-practice.
Identity: interviewId (UUIDv7)
Ownership: System (scheduled). Student (initiated).
Lifecycle: scheduled -> in_progress -> completed -> reviewed
Deletion: Soft-delete. Transcripts retained for skill analysis (anonymized after 90d for model training).
Required: studentId, type (technical | behavioral | case | hr | guesstimate), company (optional), role, date, duration, questions [{question, answer, feedback, score}]
Relations: overallScore, confidenceScore, communicationScore, technicalScore, areasForImprovement, transcript, recording (TTL 30d)
```

#### Application

```
Purpose:  A placement or internship application submitted by the student.
Identity: applicationId (UUIDv7)
Ownership: Student (created).
Lifecycle: draft -> submitted -> under_review -> interview -> offer | rejected | withdrawn
Deletion: Soft-delete. Retained for placement trajectory analysis.
Required: studentId, company, role, type (placement | internship | scholarship), submittedDate, status, statusHistory [{status, date}]
Relations: referralUsed, resumeVersionId, coverLetter, interviewRounds [{round, type, date, outcome, feedback}], offerDetails, rejectionReason
```

### Intelligence Entities


#### Dimension

```
Purpose:  A latent intelligence dimension. Defined by the system, discovered from behavior.
Identity: dimensionId (String, canonical name), e.g., 'learning_velocity', 'confidence'
Ownership: System. Cannot be created by students (except Max tier custom dimensions).
Lifecycle: proposed -> active -> mature -> deprecated
Deletion: Never deleted. Deprecated dimensions are hidden from new students but remain for historical analysis.
Required: dimensionId, displayName, description, category, weight, minValue, maxValue, defaultPrior, saturationPoint
Relations: alternativeNames, evidenceTypeMappings [{eventType, contribution}], subDimensions, parentDimension, isComposite, formula, modelVersion
```

#### DimensionEstimate

```
Purpose:  A student's current estimate on a dimension. Temporal.
Identity: (studentId, dimensionId) unique compound
Ownership: System (inference engine).
Lifecycle: prior -> emerging -> established -> confident -> recalibrating
Deletion: Retained for full history (aggregated to daily after 90d).
Required: studentId, dimensionId, value, confidence, velocity, acceleration, lastUpdated, evidenceCount
Relations: trajectory [{timestamp, value, confidence}], particleDistribution, uncertaintyBreakdown {epistemic, aleatoric}, regime, changepoints
```

#### CareerDNA

```
Purpose:  The student's Career DNA assignment. Temporal.
Identity: (studentId, version) unique compound
Ownership: System (inference engine).
Lifecycle: forming -> stable -> transitioning
Deletion: Full history retained. Snapshot every week.
Required: studentId, primaryArchetype, primaryProbability, confidence, timestamp
Relations: secondaryArchetype, secondaryProbability, fullDistribution [{archetype, probability}], entropy, stabilityScore, dimensionVector snapshot
```

#### Evidence

```
Purpose:  A single piece of evidence supporting an inference. Atomic, immutable.
Identity: evidenceId (UUIDv7)
Ownership: System (evidence engine).
Lifecycle: collected -> weighted -> applied -> decayed
Deletion: Retained per tier policy (30d Free, 1yr Pro, 2yr+ Max).
Required: evidenceId, studentId, eventId, eventType, timestamp, baseWeight, effectiveWeight, confidence, dimensionContributions [{dimensionId, contribution}], source (system | inferred | confirmed)
Relations: payload (original event data), features {duration, effort, quality, novelty}, provenance {pipelineVersion, enrichmentSteps}, decayLambda, ttl
```

#### Prediction

```
Purpose:  A forecast about the student's future state.
Identity: predictionId (UUIDv7)
Ownership: System (prediction engine).
Lifecycle: created -> active -> fulfilled -> missed -> recalibrated
Deletion: Retained for calibration tracking (min 1yr).
Required: studentId, type (readiness | placement | dimension | timeline), predictionDate, horizon, predictedValue, confidence, predictionInterval [{lower, upper}]
Relations: actualValue (set when outcome occurs), error, featuresUsed, modelVersion, components [{model, weight, value}], calibrationHistory
```

#### Insight

```
Purpose:  A generated insight: a natural language observation about the student.
Identity: insightId (UUIDv7)
Ownership: System (insight generation engine).
Lifecycle: generated -> ranked -> delivered -> read -> rated -> archived
Deletion: Retained for 90 days of history. Permanently if bookmarked.
Required: insightId, studentId, type (acceleration | correlation | milestone | risk | recommendation | discovery), body, dimensionsReferenced, timestamp
Relations: relevanceScore, noveltyScore, actionabilityScore, source, evidenceLinks, studentRating, wasDismissed, deliveredAt
```

#### Memory

```
Purpose:  A structured unit of the system's knowledge about the student. Higher-level than raw evidence.
Identity: memoryId (UUIDv7)
Ownership: System (memory consolidation).
Lifecycle: episodic -> consolidation_candidate -> semantic -> generalized
Deletion: Episodic memories have TTL (tier-dependent). Semantic memories persist.
Required: memoryId, studentId, type (episodic | semantic | procedural), content, importance (0-1), confidence, sourceEventIds, consolidationStatus
Relations: abstract (generalized form), retrievalCount, lastAccessed, relatedMemoryIds, ttl, embedding
```

### System Entities


#### Event

```
Purpose:  A universal event record. Every meaningful interaction is an Event.
Identity: eventId (UUIDv7), idempotencyKey (unique for dedup)
Ownership: Producer system (named).
Lifecycle: emitted -> ingested -> validated -> enriched -> routed -> stored
Deletion: Per tier (30d Free, 1yr Pro, 2yr+ Max). Raw events are append-only, never modified.
Required: eventId, eventType, producer, timestamp, studentId (optional), idempotencyKey, schemaVersion, payload (JSON), metadata {correlationId, causationId, sessionId, clientVersion}
Relations: privacyLevel (public | private | sensitive), importance (0-1), confidence (0-1), tags, ttl, orderingKey, partitionKey
```

#### Opportunity

```
Purpose:  Any external opportunity: job, internship, hackathon, competition, scholarship, course, certification, mentorship.
Identity: opportunityId (UUIDv7), canonicalSourceId (unique per source system)
Ownership: System (curated/integrated). External provider.
Lifecycle: discovered -> active -> closing -> closed -> archived
Deletion: Active opportunities retained. Archived after closing date + 90d.
Required: opportunityId, type (job | internship | hackathon | competition | scholarship | course | certification | mentorship), title, provider, url, deadline, applicationUrl
Relations: description, requiredSkills [{skillId, minProficiency}], preferredSkills, targetIndustries, targetRoles, location, remote, stipend, duration, difficulty, applicationCount, rating
```

#### Recommendation

```
Purpose:  A recommendation generated for a specific student at a specific time.
Identity: recommendationId (UUIDv7)
Ownership: System (recommendation engine).
Lifecycle: generated -> delivered -> followed | dismissed -> expired
Deletion: Retained 90d for feedback loop analysis.
Required: recommendationId, studentId, type (action | opportunity | resource | connection | reflection), targetId, expectedImpact, confidence, timestamp, context
Relations: alternativeIds (rejected alternatives), wasFollowed, followedAt, actualImpact, studentRating, explanation, framing
```

## Ontology Versioning and Evolution


```
The canonical ontology is versioned as a whole (v1.0, v2.0, etc.) and per entity.

Schema evolution rules:
  1. Fields are additive only (never removed, only deprecated with @deprecated tag)
  2. Deprecated fields remain readable for 2 major versions
  3. New required fields must have a default value
  4. Relationship cardinality can only increase (1:1 -> 1:N, never 1:N -> 1:1)
  5. Entity lifecycles can only add states, never remove them
  6. Identity fields are immutable once set
  7. Every schema change is recorded in /schemas/changelog

The ontology is stored as a JSON Schema registry: /schemas/registry.json
Each entity has a JSON Schema file: /schemas/{entityName}/{version}.json
```


---

## Section 2: Relationship Graph


### Design Philosophy

Relationships are first-class entities with their own identity, weight, confidence, temporal validity, and evidence requirements. A relationship is not an annotation on a node — it is a documented connection between two entities that the system can reason about.

Every relationship has:
- Direction (directed | undirected | bidirectional)
- Cardinality (1:1, 1:N, N:M)
- Weight (0-1): how strong the relationship is
- Confidence (0-1): how sure the system is that this relationship exists
- Temporal validity: when the relationship started/ended/is valid for
- Evidence: what evidence supports this relationship
- Mutability: static (never changes), evolving (changes slowly), dynamic (changes frequently)
- Storage: which graph backend stores this relationship type

### Relationship Catalog


#### IS_A

```
Direction:    directed (subject -> class)
Cardinality:  1:1 (student is one archetype at a time)
Weight:       0.5-1.0 (default: 0.5)
Confidence:   min 0.3
Validity:     Instantaneous (snapshot at evaluation time)
Mutability:   Evolving (weekly)
Storage:      JanusGraph (temporal edges)
Description:  A student IS_A particular Career DNA archetype at a given time. Changes as the student evolves.
```

#### HAS_SKILL

```
Direction:    directed (student -> skill)
Cardinality:  N:M (student has many skills, skill is had by many)
Weight:       0.3-1.0 (default: 0.3)
Confidence:   min 0.2
Validity:     Persistent with decay (skill fades without use)
Mutability:   Evolving (daily updates, slow decay)
Storage:      JanusGraph (temporal edge with weight trajectory)
Description:  Student possesses a skill at a demonstrable proficiency level. Weight = proficiency. Decays without evidence.
```

#### REQUIRES

```
Direction:    directed (entity -> skill)
Cardinality:  N:M
Weight:       0.5-1.0 (default: 0.5)
Confidence:   min 0.5
Validity:     Permanent (until taxonomy update)
Mutability:   Static (once defined)
Storage:      JanusGraph (static edges, cached in-memory)
Description:  An opportunity, role, or resource requires a skill. Weight = minimum proficiency needed.
```

#### LEARNS_FROM

```
Direction:    directed (student -> resource)
Cardinality:  N:M
Weight:       0.3-1.0 (default: 0.3)
Confidence:   min 0.2
Validity:     Instantaneous (session-bound)
Mutability:   Dynamic
Storage:      Cassandra (event-derived, ephemeral)
Description:  Student learns from a resource during a session. Weight = engagement depth.
```

#### PRACTICED

```
Direction:    directed (student -> skill via activity)
Cardinality:  N:M (with activity as edge entity)
Weight:       0.3-1.0 (default: 0.3)
Confidence:   min 0.2
Validity:     Instantaneous
Mutability:   Dynamic
Storage:      Cassandra (event log + aggregation)
Description:  Student practiced a skill through an activity (interview, task, project). The activity entity IS the edge.
```

#### BELONGS_TO

```
Direction:    directed (entity -> collection)
Cardinality:  N:1 (many entities belong to one collection)
Weight:       1.0 (deterministic) (default: 1.0 (deterministic))
Confidence:   min 1.0
Validity:     Persistent until changed
Mutability:   Student-controlled
Storage:      MongoDB (FK reference)
Description:  An entity belongs to a collection (workspace, portfolio, project). Set by student.
```

#### INFLUENCES

```
Direction:    directed (dimension -> dimension)
Cardinality:  N:M (causal graph)
Weight:       0.0-1.0 (|correlation|) (default: 0.0)
Confidence:   min 0.2
Validity:     Persistent with recalibration
Mutability:   Evolving (weekly recompute)
Storage:      JanusGraph (temporal with correlation history)
Description:  Dimension A's movements influence dimension B. Weight = absolute correlation. Direction = causal direction when known, bidirectional when correlational only.
```

#### MEASURES

```
Direction:    directed (event/evidence -> dimension)
Cardinality:  N:M
Weight:       0.1-1.0 (contribution weight) (default: 0.1)
Confidence:   min 0.1
Validity:     Instantaneous (single event) or Persistent (event type mapping)
Mutability:   Semi-static (mappings evolve with model updates)
Storage:      In-memory (event type registry) + JanusGraph (instance edges)
Description:  An event or evidence record measures/informs a dimension. Weight = contribution of that event to the dimension estimate.
```

#### DERIVED_FROM

```
Direction:    directed (inference -> evidence)
Cardinality:  N:M
Weight:       1.0 (deterministic when inference engine runs) (default: 1.0 (deterministic when inference engine runs))
Confidence:   min 1.0
Validity:     Permanent (audit trail)
Mutability:   Append-only
Storage:      JanusGraph (immutable, provenance graph)
Description:  An inference (dimension estimate, prediction, insight) was derived from specific evidence records. Complete provenance chain.
```

#### PREDICTS

```
Direction:    directed (entity -> outcome)
Cardinality:  N:M
Weight:       0.0-1.0 (correlation coefficient) (default: 0.0)
Confidence:   min 0.1
Validity:     Persistent with recalibration
Mutability:   Evolving (weekly with model updates)
Storage:      JanusGraph (temporal with prediction accuracy history)
Description:  Entity A statistically predicts outcome B. Weight = predictive power (correlation / feature importance). Confidence = statistical significance.
```

#### SIMILAR_TO

```
Direction:    undirected (student -> student)
Cardinality:  N:M
Weight:       0.0-1.0 (cosine similarity) (default: 0.0)
Confidence:   min 0.3
Validity:     Snapshot (recomputed weekly)
Mutability:   Evolving (weekly)
Storage:      FAISS/Annoy (embedding index) + JanusGraph (top-K edges)
Description:  Two students have similar behavioral profiles. Weight = cosine similarity of dimension vectors. Used for cohort comparisons.
```

#### MATCHED_TO

```
Direction:    directed (student -> opportunity)
Cardinality:  N:M
Weight:       0.0-1.0 (compatibility) (default: 0.0)
Confidence:   min 0.2
Validity:     Snapshot (recomputed on opportunity change or weekly)
Mutability:   Dynamic (on query)
Storage:      JanusGraph (on-demand edges, cached with TTL)
Description:  Student is matched to an opportunity with a compatibility score. Weight = match score. Not stored permanently (regenerated on query).
```

#### LED_TO

```
Direction:    directed (action -> outcome)
Cardinality:  N:M
Weight:       0.0-1.0 (causal effect) (default: 0.0)
Confidence:   min 0.1
Validity:     Permanent (once outcome materializes)
Mutability:   Append-only
Storage:      JanusGraph (provenance graph, temporal)
Description:  An action/intervention led to an outcome. Weight = estimated causal effect. Requires causal inference module.
```

#### CONTRADICTS

```
Direction:    undirected (evidence -> evidence)
Cardinality:  1:1 (evidence pairs)
Weight:       0.5-1.0 (default: 0.5)
Confidence:   min 0.5
Validity:     Permanent (once detected)
Mutability:   Append-only
Storage:      JanusGraph (temporal, audit)
Description:  Two pieces of evidence suggest conflicting interpretations. Used by uncertainty quantification.
```

#### SUPPORTED_BY

```
Direction:    directed (conclusion -> evidence)
Cardinality:  N:M
Weight:       0.0-1.0 (default: 0.0)
Confidence:   min 0.3
Validity:     Permanent
Mutability:   Append-only
Storage:      JanusGraph (provenance)
Description:  A conclusion (insight, prediction, recommendation) is supported by specific evidence. Complete traceability.
```

#### GENERATED_FROM

```
Direction:    directed (artifact -> process)
Cardinality:  N:1 (process generates many artifacts)
Weight:       1.0 (deterministic) (default: 1.0 (deterministic))
Confidence:   min 1.0
Validity:     Permanent (audit trail)
Mutability:   Append-only
Storage:      JanusGraph (provenance)
Description:  An artifact (report, insight, simulation) was generated by a process (model, agent, pipeline). Includes model version, parameters, timestamp.
```

#### HAS_TRAIT

```
Direction:    directed (student -> dimension)
Cardinality:  N:M
Weight:       0.0-1.0 (dimension value/100) (default: 0.0)
Confidence:   min 0.1
Validity:     Instantaneous with history
Mutability:   Evolving (per inference update)
Storage:      JanusGraph (temporal, full history with particle distribution)
Description:  Student has a particular level of a latent trait dimension. Weight = normalized dimension value.
```

#### EXHIBITS_PATTERN

```
Direction:    directed (student -> behavior pattern)
Cardinality:  N:M
Weight:       0.3-1.0 (habit strength) (default: 0.3)
Confidence:   min 0.3
Validity:     Persistent while habit exists
Mutability:   Evolving (daily)
Storage:      JanusGraph (temporal with habit strength trajectory)
Description:  Student exhibits a detected behavioral pattern or habit.
```

### Graph Storage Architecture


```
Three storage tiers for relationships:

Tier 1: JanusGraph (Primary Relationship Store)
  - All intelligence relationships (IS_A, HAS_SKILL, INFLUENCES, PREDICTS, DERIVED_FROM)
  - Temporal property graphs with full edge history
  - Backend: Cassandra (storage) + Elasticsearch (index)
  - Query: Gremlin/Cypher

Tier 2: MongoDB (Entity Relationships)
  - FK-based relationships between MongoDB documents
  - BELONGS_TO, ownership, creation provenance
  - Not duplicated in JanusGraph (single source of truth)
  - Query: MongoDB aggregation pipeline

Tier 3: Vector Index (FAISS/Annoy)
  - SIMILAR_TO relationships
  - Embedding-based similarity search
  - Student-to-student, opportunity-to-student, skill-to-skill
  - Rebuilt weekly from JanusGraph node embeddings

Cross-tier query pattern:
  1. MongoDB for entity-level lookups (fast, indexed)
  2. JanusGraph for relationship traversal (deep, multi-hop)
  3. Vector index for similarity (approximate nearest neighbor)
  4. Federation layer merges results
```


---

## Section 3: Universal Event Taxonomy


### Design Principles

1. **Events are immutable.** Once written, they are never modified. Corrections are new events.
2. **Events have identity.** Every event has an eventId (UUIDv7) and an idempotencyKey.
3. **Events are ordered.** Within a student's stream, events are ordered by timestamp. If timestamps are equal, eventId (which embeds a timestamp) breaks ties.
4. **Events are replayable.** The full event stream can be replayed from any point to reconstruct state.
5. **Events are evolvable.** Schema version is embedded. Old consumers see old schemas.
6. **Events are privacy-tagged.** Each event declares its privacy level.

### Event Envelope


```
EventEnvelope {
  eventId: UUIDv7 (globally unique, time-sortable)
  eventType: String (reverse-domain: 'datad.student.task.completed')
  schemaVersion: Int (monotonic, per eventType)
  producer: String ('dax' | 'task-service' | 'resume-service' | 'frontend' | ...)
  timestamp: DateTime (when the event occurred, not when ingested)
  ingestedAt: DateTime (when the event entered the system)
  studentId: UUID | null (null for system events)
  idempotencyKey: String (producer + eventType + unique-key)
  correlationId: UUID (trace across related events)
  causationId: UUID | null (which event caused this one)
  sessionId: UUID | null (which user session)
  payload: JSON (event-specific data)
  metadata: {
    clientVersion: String,
    clientTimestamp: DateTime,
    clientLatencyMs: Int,
    networkLatencyMs: Int,
    region: String,
    deviceType: String
  }
  privacy: 'public' | 'private' | 'sensitive'
  importance: Float32 (0-1, computed by producer)
  confidence: Float32 (0-1, how sure the producer is)
  tags: [String]
  ttl: Duration | null (null = retain per default policy)
}
```

### Event Types by Domain


#### Authentication Domain

```
datad.auth.registered       - Student creates account
datad.auth.logged_in         - Student signs in
datad.auth.logged_out        - Student signs out
datad.auth.password_reset    - Password reset requested
datad.auth.password_changed  - Password changed successfully
datad.auth.session_expired   - JWT expired
datad.auth.tier_changed      - Subscription tier changed
datad.auth.profile_updated   - Profile fields updated
datad.auth.consent_updated   - Privacy consent changed
datad.auth.deleted           - Account deletion requested
```

#### Learning Domain


```
datad.learning.note.created         - Study note created
datad.learning.note.updated         - Note edited
datad.learning.note.deleted         - Note deleted
datad.learning.session.started      - Study session began
datad.learning.session.completed    - Study session ended
datad.learning.session.abandoned    - Session ended prematurely
datad.learning.resource.opened      - Learning resource accessed
datad.learning.resource.completed   - Resource finished
datad.learning.resource.bookmarked  - Resource bookmarked
datad.learning.quiz.started         - Quiz begun
datad.learning.quiz.completed       - Quiz submitted
datad.learning.quiz.question_answered - Single question answered
datad.learning.module.started       - Module begun
datad.learning.module.completed     - Module finished
datad.learning.course.enrolled      - Student enrolled in course
datad.learning.course.completed     - Course completed
datad.learning.reflection.written   - Journal entry written
datad.learning.goal.created         - Learning goal created
datad.learning.goal.updated         - Goal modified
datad.learning.goal.completed       - Goal achieved
```

#### Career Domain


```
datad.career.resume.created         - New resume version created
datad.career.resume.updated         - Resume edited
datad.career.resume.section_added   - Section added to resume
datad.career.resume.score_updated   - ATS score recomputed
datad.career.resume.exported        - Resume exported (PDF, etc.)
datad.career.skill.inferred         - Skill inferred by system
datad.career.skill.confirmed        - Student confirmed a skill
datad.career.skill.rejected         - Student rejected a skill
datad.career.skill.proficiency_updated - Proficiency score changed
datad.career.interview.scheduled    - Mock interview scheduled
datad.career.interview.started      - Interview began
datad.career.interview.completed    - Interview finished
datad.career.interview.question_answered - Single Q&A exchange
datad.career.application.started    - Application drafted
datad.career.application.submitted  - Sent to company
datad.career.application.status_changed - Status updated (e.g., -> interview)
datad.career.application.offer      - Offer received
datad.career.application.rejected   - Rejection received
datad.career.company.researched     - Company profile viewed
datad.career.company.bookmarked     - Company saved for later
datad.career.placement.drive_started - Placement season began
datad.career.placement.offer_aced   - Offer accepted
datad.career.portfolio.item_added   - Portfolio item created
```

#### Task & Planning Domain


```
datad.task.created           - Task created by student or system
datad.task.updated           - Task modified
datad.task.completed         - Task marked done
datad.task.deleted           - Task removed
datad.task.due_date_changed  - Deadline moved
datad.task.priority_changed  - Priority level modified
datad.task.overdue           - Task passed due date
datad.project.created        - Project created
datad.project.updated        - Project modified
datad.project.completed      - Project finished
datad.project.milestone      - Milestone reached
datad.roadmap.created        - Roadmap generated
datad.roadmap.step_completed - Roadmap step done
datad.roadmap.reprioritized  - Roadmap reordered by system
datad.roadmap.adapted        - Roadmap adapted to student state
```

#### Conversation & Dax Domain


```
datad.dax.conversation.started      - Chat session began
datad.dax.message.sent              - Message sent by student
datad.dax.message.received          - Dax responded
datad.dax.conversation.ended        - Chat session ended
datad.dax.conversation.topic        - Topic detected in conversation
datad.dax.insight.generated         - Dax generated an insight
datad.dax.insight.rated             - Student rated the insight
datad.dax.recommendation.followed   - Student followed Dax's advice
datad.dax.recommendation.dismissed  - Student ignored advice
datad.dax.memory.updated            - Dax memory consolidated
datad.dax.uncertainty.detected      - Dax detected knowledge gap
datad.dax.clarification.asked       - Dax asked clarifying question
```

#### Intelligence Domain


```
datad.intelligence.dimension.updated       - Dimension estimate recomputed
datad.intelligence.dimension.crossed_threshold - Dimension hit significant level
datad.intelligence.dna.updated              - Career DNA recomputed
datad.intelligence.dna.transitioned         - Archetype changed
datad.intelligence.velocity.changed         - Velocity crossed threshold
datad.intelligence.correlation.detected     - New dimension correlation found
datad.intelligence.causal.estimated         - Causal effect estimated
datad.intelligence.prediction.made          - New prediction generated
datad.intelligence.prediction.fulfilled     - Prediction outcome recorded
datad.intelligence.prediction.missed        - Prediction was inaccurate
datad.intelligence.insight.generated        - Insight created
datad.intelligence.insight.delivered        - Insight shown to student
datad.intelligence.insight.rated            - Insight was helpful/not
datad.intelligence.recommendation.generated - Recommendation made
datad.intelligence.simulation.run           - Future simulation executed
datad.intelligence.report.generated         - Weekly report created
datad.intelligence.anomaly.detected         - Behavioral anomaly found
datad.intelligence.habit.detected           - New habit identified
datad.intelligence.habit.broken             - Habit disrupted
```

#### Finance Domain


```
datad.finance.expense.logged         - Expense recorded
datad.finance.expense.categorized    - Category assigned
datad.finance.budget.created         - Budget set
datad.finance.budget.updated         - Budget modified
datad.finance.budget.threshold_hit   - Budget limit approached
datad.finance.goal.created           - Savings goal set
datad.finance.goal.progressed        - Goal progress updated
datad.finance.goal.met               - Goal achieved
```

#### Community Domain


```
datad.community.post.created         - Discussion post created
datad.community.post.replied         - Reply to post
datad.community.post.reacted         - Reaction to post
datad.community.post.bookmarked      - Post saved
datad.community.event.rsvped         - RSVP to event
datad.community.event.attended       - Attended event
datad.community.skill.offered        - Skill listed for exchange
datad.community.skill.requested      - Skill requested from peer
datad.community.connection.made      - Peer connection established
datad.community.mentor.matched       - Mentor match created
```

#### System Domain


```
datad.system.model.updated          - ML model version changed
datad.system.schema.changed         - Entity schema version changed
datad.system.ontology.updated       - Ontology entity added/deprecated
datad.system.pipeline.completed     - Data pipeline run finished
datad.system.consolidation.ran      - Memory consolidation completed
datad.system.metrics.reported       - System metrics snapshot
datad.system.error.occurred         - Non-fatal error
datad.system.privacy.audit          - Privacy audit event
datad.system.admin.action           - Admin action performed
```

### Event Processing Guarantees


```
1. At-least-once delivery (consumers must deduplicate via idempotencyKey)
2. Partition ordering: events for the same student are in the same partition
3. Exactly-once semantics for producers (idempotencyKey ensures it)
4. Dead letter queue: events that fail validation go to /events/dead-letter
5. Retry policy: 3 retries with exponential backoff (1s, 4s, 16s)
6. Schema validation: every event validates against schema registry on ingestion
7. Schema evolution: backward-compatible changes (additive fields only)
   Backward-incompatible changes create a new eventType version (e.g., v2)
8. Replay: full event stream can be replayed from any timestamp
   Snapshot stored daily for fast recovery (state at midnight)
```


---

## Section 4: Intelligence API Layer


### Design Philosophy

The Intelligence API is the permanent contract between DATAD's frontend, backend, AI systems, and third-party integrations. It is designed to survive model replacements, schema migrations, and architectural refactors. Internal algorithms change. APIs do not.

Every intelligence endpoint returns three things:
1. **The result** (value, prediction, recommendation, insight)
2. **Confidence** (how sure the system is)
3. **Provenance** (which evidence, models, and processes produced this result)

### REST API Surface


#### Student Intelligence Endpoints


```
GET /v2/students/{studentId}/intelligence
  Purpose: Get the student's complete current intelligence profile
  Returns: {
    dimensions: [{dimensionId, value, confidence, velocity, acceleration, trend, lastUpdated}],
    careerDna: {primary, secondary, fullDistribution, stability, lastTransition},
    predictions: {readiness, placement, timeline},
    summary: {activeDays, evidenceCount, profileCompleteness, lastUpdated}
  }
  Cache: 5 minutes (ETag-based)
  Latency target: <200ms p95
  Auth: Student or Dax (service token)

GET /v2/students/{studentId}/intelligence/dimensions
  Purpose: Get all dimension estimates
  Returns: [{dimensionId, value, confidence, velocity, acceleration, trend, regime, lastUpdated}]
  Cache: 1 minute
  Latency: <100ms p95

GET /v2/students/{studentId}/intelligence/dimensions/{dimensionId}
  Purpose: Get a single dimension with full trajectory
  Returns: {
    dimensionId, currentValue, confidence, velocity, acceleration,
    trajectory: [{timestamp, value, confidence}],
    evidence: [{evidenceId, eventType, contribution, timestamp}],
    uncertainty: {epistemic, aleatoric, total},
    regime: String,
    changepoints: [{timestamp, previousSlope, newSlope}]
  }
  Cache: 1 minute
  Latency: <150ms p95

GET /v2/students/{studentId}/intelligence/dna
  Purpose: Get Career DNA
  Returns: {
    primary: {archetypeId, archetypeName, probability, confidence},
    secondary: {archetypeId, archetypeName, probability, confidence} | null,
    fullDistribution: [{archetypeId, archetypeName, probability}],
    stability: Float32,
    history: [{timestamp, primaryArchetype, probability, confidence}],
    transitions: [{from, to, timestamp, confidence}]
  }
  Cache: 1 hour (DNA changes slowly)
  Latency: <100ms p95

GET /v2/students/{studentId}/intelligence/predictions
  Purpose: Get all active predictions
  Returns: {
    readiness: {currentValue, estimatedDate, window: [from, to], confidence, trajectory},
    placement: {probabilities: {30d, 60d, 90d}, medianTimeline, salaryRange, confidence},
    dimensionForecasts: [{dimensionId, forecast: [{date, value, lower, upper}]}],
    history: [{type, predictedAt, outcome, error, calibration}]
  }
  Cache: 1 hour (predictions recomputed periodically)
  Latency: <500ms p95

POST /v2/students/{studentId}/intelligence/simulate
  Purpose: Run a future simulation
  Input: {
    actions: [{actionType, params, scheduledDay}],
    horizon: Int (days),
    ensembleSize: Int (1-100, default 10)
  }
  Returns: {
    scenarioId: UUID,
    outcomes: {
      readinessDate: DateTime | null,
      dimensionEndpoints: [{dimensionId, value, vsBaseline}],
      confidence: Float32
    },
    trajectory: [{date, dimensionValues}],
    uncertainty: {epistemic, aleatoric},
    generatedAt: DateTime,
    modelVersion: String
  }
  Cache: Results cached for 1 hour (same inputs == same result)
  Latency: <3s p95 (ensembleSize=10)

GET /v2/students/{studentId}/intelligence/insights
  Purpose: Get generated insights
  Query params: type, limit, offset, minRelevance
  Returns: [{
    insightId, type, body, dimensionsReferenced, relevanceScore,
    actionabilityScore, timestamp, wasRead, wasDismissed, studentRating
  }]
  Cache: no cache (real-time)
  Latency: <100ms p95

GET /v2/students/{studentId}/intelligence/recommendations
  Purpose: Get current top recommendations
  Query params: limit (max 5)
  Returns: [{
    recommendationId, type, targetId, targetDescription,
    expectedImpact: [{dimensionId, estimatedDelta}],
    confidence, feasibility, expectedValue,
    explanation: String,
    timeEstimate: Int (minutes),
    alternatives: [{type, targetId, expectedValue}],
    generatedAt, expiresAt
  }]
  Cache: 5 minutes
  Latency: <300ms p95

POST /v2/students/{studentId}/intelligence/explain
  Purpose: Get an explanation for any intelligence output
  Input: {
    inferenceType: String (dimension | prediction | recommendation | insight),
    inferenceId: String,
    detailLevel: String (light | moderate | deep)
  }
  Returns: {
    explanation: String,
    evidenceContributions: [{description, contribution, direction}],
    counterfactual: {whatIf, estimatedOutcome} | null,
    uncertainty: String,
    visualData: {highlightNodes, highlightEdges, animateTimeline} | null
  }
  Cache: no cache
  Latency: <500ms p95 (moderate)
````

#### Knowledge Graph Endpoints


```
GET /v2/students/{studentId}/graph
  Purpose: Get the student's knowledge graph
  Returns: {nodes: [{id, type, label, value, confidence, group}], edges: [{source, target, type, weight, confidence}]}
  Cache: 5 minutes
  Latency: <200ms p95

GET /v2/students/{studentId}/graph/neighborhood/{nodeId}
  Purpose: Get subgraph around a node
  Query params: depth (1-3), maxNodes
  Returns: subgraph (same structure)
  Cache: 5 minutes
  Latency: <150ms p95

GET /v2/students/{studentId}/graph/path/{fromNodeId}/{toNodeId}
  Purpose: Find shortest weighted path between two nodes
  Returns: {path: [{nodeId, nodeType, nodeLabel, edgeType, edgeWeight}], totalWeight, confidence}
  Cache: 1 hour
  Latency: <200ms p95

POST /v2/graph/query
  Purpose: Execute a graph query (Gremlin/Cypher)
  Auth: Admin or service token only
  Returns: query result
  Cache: no cache
  Latency: <1s p95
```

#### Evidence & Events Endpoints


```
POST /v2/events/ingest
  Purpose: Ingest a batch of events
  Input: {events: [EventEnvelope]}
  Returns: {ingested: Int, failed: Int, errors: [{eventId, error}]}
  Auth: Service token (internal services) or validated client
  Rate limit: 1000 events/second per producer
  Latency: <100ms p95 (batch of 100)

GET /v2/students/{studentId}/events
  Purpose: Get event history for a student
  Query params: eventType, from, to, limit, offset
  Returns: {events: [EventEnvelope], total, nextOffset}
  Auth: Student or Dax
  Cache: no cache
  Latency: <200ms p95

GET /v2/students/{studentId}/evidence
  Purpose: Get processed evidence (with weights, contributions)
  Query params: dimensionId, from, to, limit, offset
  Returns: {evidence: [{evidenceId, eventType, effectiveWeight, dimensionContributions, confidence}], total}
  Auth: Student or Dax
  Cache: 1 minute
  Latency: <200ms p95
```

#### Opportunity Intelligence Endpoints


````
GET /v2/students/{studentId}/opportunities?type=job|internship|scholarship|hackathon|certification
  Purpose: Get matched opportunities ranked by compatibility
  Returns: [{
    opportunityId, title, provider, type, compatibilityScore, confidence,
    breakdown: {positiveFactors, gapFactors},
    skillGapAnalysis: [{skillId, label, required, current, gap}],
    expectedROI: {readinessImpact, timelineImpact, salaryImpact},
    probabilityOfSuccess: Float32,
    timeInvestment: Int (hours),
    whyRecommended: String,
    alternativesRejected: [{title, reason}]
  }]
  Cache: 1 hour (recomputed daily, cached per student)
  Latency: <500ms p95

GET /v2/opportunities/{opportunityId}/compatibility/{studentId}
  Purpose: Get detailed compatibility for a specific opportunity
  Returns: full compatibility breakdown
  Cache: 1 hour
  Latency: <300ms p95
````

#### Memory Endpoints


```
GET /v2/students/{studentId}/memory
  Purpose: Get the student's semantic memory (what the system knows about them)
  Returns: {memories: [{memoryId, type, content, importance, confidence, lastAccessed}]}
  Auth: Dax (agent) or Student
  Cache: 1 minute
  Latency: <100ms p95

POST /v2/students/{studentId}/memory/consolidate
  Purpose: Trigger memory consolidation (episodic -> semantic)
  Auth: Dax (agent)
  Latency: <5s (async)

DELETE /v2/students/{studentId}/memory/{memoryId}
  Purpose: Delete a specific memory (student override)
  Auth: Student only
  Latency: <100ms
```

### GraphQL Schema


```graphql
type IntelligenceQuery {
  # Student Intelligence
  studentIntelligence(studentId: ID!): StudentIntelligence
  dimensions(studentId: ID!, filter: DimensionFilter): [DimensionEstimate]
  dimension(studentId: ID!, dimensionId: ID!): DimensionDetail
  careerDNA(studentId: ID!): CareerDNA
  predictions(studentId: ID!): PredictionSet
  insights(studentId: ID!, filter: InsightFilter): [Insight]
  recommendations(studentId: ID!, limit: Int): [Recommendation]
  simulate(studentId: ID!, input: SimulationInput!): SimulationResult
  explain(studentId: ID!, input: ExplanationInput!): Explanation
  
  # Knowledge Graph
  graph(studentId: ID!): KnowledgeGraph
  graphNeighborhood(studentId: ID!, nodeId: ID!, depth: Int): KnowledgeGraph
  graphPath(studentId: ID!, from: ID!, to: ID!): GraphPath
  
  # Opportunities
  matchedOpportunities(studentId: ID!, types: [String]): [ScoredOpportunity]
  opportunityCompatibility(opportunityId: ID!, studentId: ID!): CompatibilityDetail
  
  # Student
  student(id: ID!): Student
  studentProfile(studentId: ID!): StudentProfile
  skills(studentId: ID!): [ScoredSkill]
  events(studentId: ID!, filter: EventFilter): EventConnection
  evidence(studentId: ID!, filter: EvidenceFilter): EvidenceConnection
}

type Mutation {
  ingestEvents(input: EventBatchInput!): IngestionResult
  updateEvidenceFeedback(evidenceId: ID!, feedback: EvidenceFeedbackInput!): Boolean
  dismissInsight(insightId: ID!): Boolean
  rateInsight(insightId: ID!, rating: Int!): Boolean
  followRecommendation(recommendationId: ID!): Boolean
  dismissRecommendation(recommendationId: ID!): Boolean
  requestExplanation(inferenceType: String!, inferenceId: ID!): Explanation
  consolidateMemory(studentId: ID!): Boolean
  deleteMemory(studentId: ID!, memoryId: ID!): Boolean
}

type Subscription {
  intelligenceUpdated(studentId: ID!): IntelligenceUpdateEvent
  insightGenerated(studentId: ID!): Insight
  recommendationGenerated(studentId: ID!): Recommendation
  dimensionCrossedThreshold(studentId: ID!): DimensionThresholdEvent
  dnaTransitioned(studentId: ID!): DNATransitionEvent
  predictionFulfilled(studentId: ID!): PredictionOutcomeEvent
}
````

### Service-to-Service API (gRPC/Internal)


```protobuf
service IntelligenceService {
  rpc GetDimensionEstimates(DimensionRequest) returns (DimensionResponse);
  rpc GetCareerDNA(DNARequest) returns (DNAResponse);
  rpc GetPredictions(PredictionRequest) returns (PredictionResponse);
  rpc RunSimulation(SimulationRequest) returns (SimulationResponse);
  rpc GetRecommendations(RecommendationRequest) returns (RecommendationResponse);
  rpc GenerateInsight(InsightRequest) returns (InsightResponse);
  rpc GetGraphSubgraph(GraphRequest) returns (GraphResponse);
  rpc GetGraphPath(GraphPathRequest) returns (GraphPathResponse);
  rpc IngestEvents(stream EventEnvelope) returns (IngestionResponse);
  rpc Explain(InferenceRequest) returns (ExplanationResponse);
  rpc Simulate(SimulationRequest) returns (SimulationResponse);
}

service MemoryService {
  rpc GetMemory(MemoryRequest) returns (MemoryResponse);
  rpc StoreMemory(StoreMemoryRequest) returns (MemoryResponse);
  rpc ConsolidateMemory(ConsolidateRequest) returns (ConsolidateResponse);
  rpc SearchMemory(MemorySearchRequest) returns (MemorySearchResponse);
}

service OntologyService {
  rpc GetEntity(EntityRequest) returns (EntityDefinition);
  rpc GetRelationship(RelationshipRequest) returns (RelationshipDefinition);
  rpc ValidateEntity(ValidateRequest) returns (ValidationResponse);
  rpc ListEntities(Empty) returns (EntityList);
}
````

### API Versioning and Compatibility


````
1. API version is in the URL path (/v2/...)
2. A version is stable for minimum 12 months after release
3. Deprecation: v2 endpoints gain a 'Deprecated' response header 6 months before removal
4. During deprecation period, both v2 and v3 are served from the same codebase
5. Backward-compatible changes (new fields, new endpoints) do not require version bump
6. Breaking changes require: new version, migration guide, 6-month coexistence
7. Breaking = field removal, field type change, endpoint removal, auth change
8. All responses include a 'apiVersion' field and 'schema' link
```


---

## Section 5: Dax Cognitive Operating Layer


### Design Philosophy

Dax is NOT a chatbot. Dax is the cognitive operating system of DATAD.

A chatbot takes a prompt and produces a response. An operating system manages resources, coordinates agents, enforces policies, and provides stable APIs for higher-level reasoning.

Dax has: memory management, reasoning pipelines, uncertainty quantification, conflict resolution, evidence gathering, simulation capabilities, meta-cognition, and a persistent identity that evolves with the student.

### Dax Architecture


```
+-----------------------------------------------------------------+
|                    DAX COGNITIVE OS                               |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  | META-COGNITION LAYER                                         | |
|  |  Knows what it knows. Knows what it doesn't know.            | |
|  |  Decides when to speak, when to ask, when to stay silent.    | |
|  +-------------------------------------------------------------+ |
|         |          |           |           |                     |
|  +------v--+  +---v----+  +---v----+  +---v----+                |
|  | Working |  |Reason- |  |Memory  |  |Decide  |                |
|  | Memory  |  |ing     |  |Manager |  |Engine  |                |
|  |Manager  |  |Pipeline|  |        |  |(speak/ |                |
|  |         |  |        |  |        |  |silent) |                |
|  +---------+  +--------+  +--------+  +--------+                |
|         |          |           |           |                     |
|  +------v----------v-----------v-----------v----+                |
|  |           INTELLIGENCE API LAYER              |               |
|  |  (Section 4 contracts: stable, versioned)     |               |
|  +------------------------------------------------+               |
|         |          |           |           |                     |
|  +------v----------v-----------v-----------v----+                |
|  |    STUDENT INTELLIGENCE ENGINE (26 modules)  |               |
|  |    (V1 architecture, unchanged)              |               |
|  +------------------------------------------------+               |
|         |          |           |           |                     |
|  +------v----------v-----------v-----------v----+                |
|  |           DATA & EVENT LAYER                  |               |
|  |  (Universal Event Taxonomy, Knowledge Graph)  |               |
|  +------------------------------------------------+               |
+-----------------------------------------------------------------+
```

### Dax Cognitive Primitives


#### 1. Working Memory


Dax maintains a session-level working memory for each conversation:

```
WorkingMemory {
  conversationId: UUID,
  studentId: UUID,
  activeContext: {
    currentTopic: String,
    recentTopics: [String],
    studentIntent: String (query | explore | vent | decide | learn | reflect),
    emotionalState: {tone, activation, valence} | null,
    lastQuery: String,
    unresolvedThreads: [String]
  },
  sessionMemory: {
    factsEstablished: [{fact, confidence, source}],
    questionsPending: [String],
    hypothesesBeingExplored: [{hypothesis, supporting, contradicting}],
    actionsTaken: [{action, timestamp, outcome | null}]
  },
  knowledgeBoundaries: {
    certain: [String],
    uncertain: [String],
    unknown: [String]  // topics explicitly unknown
  },
  expiresAt: DateTime (TTL: 24h)
}
```

#### 2. Reasoning Pipeline


Dax does NOT generate responses directly. It runs a reasoning pipeline:

```
function reason(studentInput, workingMemory):
  # Phase 1: Understand
  intent = classifyIntent(studentInput)
  entities = extractEntities(studentInput)
  topic = classifyTopic(studentInput)
  urgency = estimateUrgency(studentInput)

  # Phase 2: Retrieve context
  intelligence = queryIntelligence(studentId, {topic, entities})
  memories = queryMemory(studentId, {topic, entities})
  recentEvents = queryEvents(studentId, window=7d)

  # Phase 3: Reason
  if intelligence.confidence < threshold:
    return askClarifyingQuestion(entities, intelligence.unknownDimensions)
  if intent == 'decide':
    alternatives = generateAlternatives(studentId, entities)
    scores = evaluateAlternatives(studentId, alternatives)
    recommendation = selectBest(scores)
    return presentDecision(recommendation, alternatives[1:3])
  if intent == 'explore':
    connections = queryGraph(studentId, {topic, depth=2})
    insights = generateInsights(connections)
    return presentExploration(topic, insights)
  # ... more intent handlers

  # Phase 4: Generate response
  response = formatResponse(intent, reasoning, confidence)

  # Phase 5: Update state
  updateWorkingMemory(workingMemory, {intent, entities, response})
  updateKnowledgeBoundaries(workingMemory, intelligence.unknown)

  return response
```

#### 3. Uncertainty Detection and Meta-Cognition


```
function estimateKnowledge(studentId, topic):
  intelligence = queryIntelligence(studentId)
  graph = queryGraph(studentId, {topic, depth=1})
  memories = queryMemory(studentId, {topic})

  knowledge = {
    evidenceCount: intelligence.evidenceCount,
    dimensionConfidence: [d.confidence for d in intelligence.dimensions if topic in d.tags],
    graphDensity: len(graph.nodes),
    memoryRelevance: [m.importance for m in memories],
    lastInteraction: mostRecentEvent(studentId, topic)
  }

  confidence = computeConfidence(knowledge)
  if confidence < 0.3:
    return 'unknown'
  elif confidence < 0.6:
    return 'uncertain'
  else:
    return 'confident'

  # Meta-cognition: the system knows what it doesn't know
  unknownDimensions = identifyKnowledgeGaps(studentId, topic)
  return {knowledgeLevel: state, confidence, unknownDimensions}
```

#### 4. The Decision to Stay Silent


Dax must sometimes choose not to respond. This is a cognitive choice, not a failure:

```
function shouldRespond(studentInput, context):
  # Never respond when:
  if detectVenting(intent) AND studentInput.sentiment == 'negative':
    return true  # actually, ALWAYS respond with empathy
  # Stay silent (or respond minimally) when:
  confidence = estimateKnowledge(studentId, topic)
  if confidence == 'unknown':
    if canAskClarifyingQuestion():
      return true, 'clarify'  # ask, don't guess
    else:
      return true, 'defer'  # 'I don't have enough information about that'
  if confidence == 'uncertain':
    if topic.isHighStakes:
      return true, 'qualified'  # respond with uncertainty caveats
    else:
      return true, 'respond'  # respond but note uncertainty
  return true, 'respond'  # default: respond

  # Dax NEVER ignores a student. It always says SOMETHING.
  # But it can say 'I don't know' or 'I'm not sure, but here's what I think'
```

#### 5. Interaction with Intelligence APIs


```
Dax accesses intelligence through the V2 API contracts (Section 4), NOT through:
- Direct database queries (bypasses versioning and caching)
- Internal function calls (tight coupling)
- Prompt injection (unstructured access)

Dax to Intelligence: POST /v2/students/{id}/intelligence/explain
Dax to Knowledge Graph: GET /v2/students/{id}/graph/neighborhood/{node}
Dax to Predictions: GET /v2/students/{id}/intelligence/predictions
Dax to Simulation: POST /v2/students/{id}/intelligence/simulate
Dax to Recommendations: GET /v2/students/{id}/intelligence/recommendations
Dax to Evidence: GET /v2/students/{id}/evidence
Dax to Memory: GET /v2/students/{id}/memory

This ensures Dax capabilities improve when the intelligence engine improves,
without Dax itself needing modifications.
```

#### 6. Career DNA Interaction


```
Dax uses Career DNA to personalize EVERY interaction:

dna = GET /v2/students/{id}/intelligence/dna

if dna.primary.archetype == 'Builder':
  framing = 'Your execution ability is strong. This builds on that.'
  style = 'action-oriented, concrete next steps'
elif dna.primary.archetype == 'Explorer':
  framing = 'This expands your understanding of the landscape.'
  style = 'curious, open-ended, comparative'
elif dna.primary.archetype == 'Analyst':
  framing = 'Here are the data points supporting this.'
  style = 'structured, evidence-heavy, logical'
elif dna.primary.archetype == 'Strategist':
  framing = 'This connects to your long-term trajectory.'
  style = 'big-picture, causal, systemic'

Dax does NOT explain Career DNA to the student as fact.
Dax uses it as a communication strategy.
If asked, Dax explains: 'Here is a PATTERN I noticed in your recent behavior...'
```

#### 7. Learning Over Time


```
Dax improves through feedback loops, not retraining:

1. Student rates insights (helpful / not helpful)
   -> insight generation model is updated (weighted by rating)

2. Student follows or ignores recommendations
   -> recommendation model is updated (CATE recalibration)

3. Student corrects Dax's statements
   -> evidence is updated (new event: student.correction)
   -> memory is consolidated (old belief flagged as contradicted)

4. Student asks follow-up questions
   -> Dax learns which explanations need more depth
   -> explanation length is calibrated per student

5. Student stops asking about certain topics
   -> Dax learns which topics are no longer relevant
   -> those memories are deprioritized (importance decay)

All learning is implicit. Dax never says 'I learned that...'
Dax just gets better at being helpful.
```


---

## Section 6: Adaptive Roadmap Engine


### Design Philosophy

A roadmap is not a static plan. It is a living strategy that adapts to the student's changing state, momentum, fatigue, and opportunities. The Adaptive Roadmap Engine continuously reprioritizes the student's plan based on intelligence signals.

### Architecture


```
+-----------------------------------------------------------------+
|                    ADAPTIVE ROADMAP ENGINE                        |
|                                                                   |
|  +----------------+  +----------------+  +----------------+     |
|  | Goal           |  | Dependency     |  | Scheduler      |     |
|  | Decomposer     |->| Resolver       |->| (time-aware)   |     |
|  +----------------+  +----------------+  +----------------+     |
|         |                   |                   |                 |
|  +------v-------------------v-------------------v----+            |
|  |            REPRIORITIZATION ENGINE                 |           |
|  |  (runs every time intelligence updates)            |           |
|  +-------------------+-------------------------------+           |
|                      |                                           |
|  +-------------------v-------------------------------+            |
|  |            INTELLIGENCE INTEGRATION                |           |
|  |  Learning Vel. | Fatigue | Momentum | Opportunities|           |
|  +-------------------+-------------------------------+            |
+-----------------------------------------------------------------+
```

### Core Algorithms


#### 1. Goal Decomposition


```
function decomposeGoal(goal):
  # Break a high-level goal into execution steps
  # Uses the skill dependency graph and learning resource taxonomy

  steps = []
  currentState = getStudentState(goal.studentId)
  gap = analyzeGap(currentState, goal.targetState)

  # Each gap becomes a sequence of learning steps
  for skill, requiredLevel in gap.skills:
    currentProficiency = getSkillProficiency(goal.studentId, skill)
    learningPath = getLearningPath(skill, currentProficiency, requiredLevel)
    steps.extend(learningPath.steps)

  # Add assessment checkpoints
  for milestone in goal.milestones:
    steps.append({type: 'assessment', target: milestone, afterSteps: milestone.prerequisites})

  # Create dependency graph
  dependencyGraph = buildDependencyGraph(steps)
  return dependencyGraph
```

#### 2. Dynamic Reprioritization


````
function reprioritize(studentId, roadmap):
  intelligence = GET /v2/students/{studentId}/intelligence
  dna = GET /v2/students/{studentId}/intelligence/dna
  recommendations = GET /v2/students/{studentId}/intelligence/recommendations

  for step in roadmap.pendingSteps:
    # Base priority from roadmap design
    priority = step.basePriority

    # Adjust for learning velocity
    lv = getDimension(intelligence, 'learning_velocity')
    if lv.velocity > 0.5:  # fast learner
      priority *= 1.2  # accelerate
    elif lv.velocity < 0.1:  # slow
      priority *= 0.8  # decelerate, don't pressure

    # Adjust for fatigue
    fatigue = detectFatigue(studentId)
    if fatigue > 0.7:
      highEffortSteps = [s for s in steps if s.effort > 0.6]
      for s in highEffortSteps:
        s.priority *= 0.5  # push hard steps to later
      alternative = findLowEffortAlternative(step)
      if alternative:
        roadmap.insertAlternative(step, alternative)

    # Adjust for momentum
    momentum = getDimension(intelligence, 'growth_momentum')
    if momentum.velocity > 1.0 and momentum.acceleration > 0:
      # Student is in flow — recommend harder tasks
      step.difficulty = min(step.difficulty + 1, 5)

    # Insert opportunistic actions
    for rec in recommendations[:3]:  # top 3 recommendations
      if rec.expectedValue > roadmap.currentStep.expectedValue * 1.5:
        roadmap.insertUrgentStep(rec, position='next')

  roadmap.reschedule()  # recompute dates
  roadmap.notifyStudentIfChanged()
  return roadmap
```

#### 3. Adaptive Scheduling


```
function scheduleSteps(roadmap, studentProfile):
  availableHours = estimateAvailableHours(studentProfile)
  fatigue = getFatiguePattern(studentProfile.studentId)
  peakHours = fatigue.peakPerformanceHours  # e.g., [8, 9, 10, 20, 21]

  for day in roadmap.days:
    day.fatigueForecast = forecastFatigue(studentProfile.studentId, day)
    day.availableHours = availableHours * (1 - day.fatigueForecast)

    scheduledSteps = []
    remainingBudget = day.availableHours
    for step in roadmap.pendingSteps (priority order):
      if step.estimatedHours <= remainingBudget:
        # Schedule in peak hours if high-difficulty
        if step.difficulty >= 4:
          step.scheduledTime = selectBestSlot(peakHours, day)
        scheduledSteps.append(step)
        remainingBudget -= step.estimatedHours

  return roadmap
```

#### 4. Failure Recovery


```
function handleStepFailure(studentId, failedStep):
  failure = analyzeFailure(failedStep)

  if failure.type == 'prerequisite_skill_missing':
    # Insert a prerequisite step
    prereqStep = createPrerequisiteStep(failure.missingSkill)
    roadmap.insertBefore(failedStep, prereqStep)

  elif failure.type == 'overestimated_capacity':
    # Student took on too much
    reduceParallelism(roadmap)
    extendTimeline(roadmap, days=7)
    calibrateEffortEstimate(studentId, failedStep.estimatedHours, failedStep.actualHours)

  elif failure.type == 'lost_interest':
    # Student disengaged
    alternativePath = findAlternativePath(roadmap.goal, dna.primary.archetype)
    roadmap.replaceBranch(failedStep.branch, alternativePath)
    notifyStudent('I found another way to approach this goal.')

  elif failure.type == 'external_disruption':
    # Exam break, illness, placement season
    roadmap.postpone(failedStep.branch, duration=estimateDisruptionDuration(studentId))
    roadmap.compactSchedule(compensate=True)  # make up time after recovery

  return roadmap
```

#### 5. Weekly Replanning


```
function weeklyReplan(studentId):
  # Every Sunday, replan the upcoming week
  roadmap = getCurrentRoadmap(studentId)
  intelligence = GET /v2/students/{studentId}/intelligence

  # This week's velocity vs planned velocity
  actualVelocity = intelligence.dimensions.find('learning_velocity').velocity
  plannedVelocity = roadmap.assumedVelocity
  velocityDelta = actualVelocity / plannedVelocity

  if velocityDelta > 1.3:  # moving faster than planned
    roadmap.accelerate(factor=velocityDelta)
    roadmap.addAssessmentCheckpoint()  # verify faster pace
  elif velocityDelta < 0.7:  # moving slower
    roadmap.decelerate(factor=velocityDelta)
    roadmap.addBufferDays(count=2)

  # Reassess next week's plan
  nextWeek = buildWeeklyPlan(roadmap, weekOffset=1)
  nextWeek = reprioritize(studentId, nextWeek)
  nextWeek = scheduleSteps(nextWeek, getStudentProfile(studentId))

  if nextWeek != lastWeekPlan:
    summarizeChanges(nextWeek, lastWeekPlan)
    presentToStudent('Your plan for next week has been adjusted based on your progress.')

  return nextWeek
```


---

## Section 7: Opportunity Intelligence Engine


### Design Philosophy

Opportunities (jobs, internships, hackathons, scholarships, courses, certifications, mentorships) are not search results. They are PERSONALIZED investments of the student's most scarce resource: their time and attention. Every opportunity must justify itself against the student's Career DNA, skill gaps, trajectory, and goals.

### Opportunity Scoring Pipeline


```
function scoreOpportunity(studentId, opportunity):
  scores = {}

  # 1. Career DNA Compatibility (30% weight)
  dna = GET /v2/students/{studentId}/intelligence/dna
  opportunityProfile = getOpportunityProfile(opportunity.type)
  dnaCompatibility = cosineSimilarity(dna.dimensionVector, opportunityProfile.idealVector)
  scores.dnaCompatibility = dnaCompatibility * 0.30

  # 2. Skill Gap Alignment (25% weight)
  studentSkills = GET /v2/students/{studentId}/intelligence/skills
  requiredSkills = opportunity.requiredSkills
  gaps = []
  for skill in requiredSkills:
    studentLevel = studentSkills.find(skill.id).proficiency
    gap = max(0, skill.minProficiency - studentLevel)
    gaps.append({skill, gap, importance: skill.importance})
  gapScore = 1.0 - mean(gap.importance * gap.gap for gap in gaps)
  scores.skillGap = gapScore * 0.25

  # 3. Readiness Alignment (20% weight)
  readiness = GET /v2/students/{studentId}/intelligence/predictions/readiness
  timeToOpportunity = daysUntilDeadline(opportunity.deadline)
  if readiness.estimatedDate + 14 < opportunity.deadline:
    readinessScore = 1.0  # enough time to prepare
  elif readiness.estimatedDate > opportunity.deadline:
    readinessScore = 0.3  # tight, but possible
  else:
    readinessScore = 0.0  # not ready in time
  scores.readiness = readinessScore * 0.20

  # 4. Expected Career Trajectory Impact (15% weight)
  simulation = POST /v2/students/{studentId}/intelligence/simulate
  with actions simulating pursuing this opportunity
  baselineSim = GET simulation for 'continue current path'
  trajectoryImpact = simulation.outcomes.readinessDate - baselineSim.outcomes.readinessDate
  scores.trajectoryImpact = sigmoid(trajectoryImpact) * 0.15  # negative -> 0, positive -> 1

  # 5. Probability of Success (10% weight)
  similarStudents = getSimilarStudents(studentId, min=20)
  successRate = count(accepted(similarStudents, opportunity)) / len(similarStudents)
  studentAdjustment = readiness.currentValue / 100  # more ready = higher prob
  probability = successRate * studentAdjustment
  scores.probability = probability * 0.10

  totalScore = sum(scores.values())
  return {
    score: totalScore, 
    breakdown: scores,
    confidence: computeScoreConfidence(studentId, opportunity),
    whyRecommended: generateNarrative(scores, dna),
    alternativesRejected: getRejectedAlternatives(studentId, opportunity)
  }
```

### Why Alternatives Were Rejected


```
function getRejectedAlternatives(studentId, selectedOpportunity):
  allOpportunities = getActiveOpportunities(studentId)
  scored = [scoreOpportunity(studentId, opp) for opp in allOpportunities]
  ranked = sortDescending(scored, key='score')

  selectedIndex = ranked.indexOf(selectedOpportunity)
  rejected = ranked[selectedIndex+1:selectedIndex+4]  # next 3

  explanations = []
  for alt in rejected:
    if alt.breakdown.dnaCompatibility < 0.3:
      reason = f'{alt.title} requires a different career profile than yours.'
    elif alt.breakdown.skillGap > 0.5:
      reason = f'{alt.title} needs skills you are still developing.'
    elif alt.breakdown.probability < 0.2:
      reason = f'{alt.title} has a lower success probability given your timeline.'
    else:
      reason = f'{alt.title} provides less trajectory impact than {selectedOpportunity.title}.'
    explanations.append({title: alt.title, reason, score: alt.score})

  return explanations
```

### Opportunity Types and Their Matching Models


```
Opportunity Type  | Primary Signal              | Weighting
------------------|-----------------------------|---------------------------
Job               | Skills + Readiness + DNA    | Skills 35%, Readiness 30%, DNA 20%, Impact 15%
Internship        | DNA + Career Clarity        | DNA 35%, Clarity 25%, Skills 25%, Readiness 15%
Scholarship       | Profile + Achievements      | Profile 40%, Achievements 35%, Goals 25%
Hackathon         | Skills + Curiosity          | Curiosity 35%, Skills 30%, Collaboration 20%, Fun 15%
Course            | Skill Gaps + Learning Vel.  | Gaps 40%, Velocity 25%, Difficulty 20%, Time 15%
Certification     | Readiness + Career Impact   | Impact 35%, Readiness 30%, Skill 20%, Cost 15%
Mentorship        | DNA + Goals + Growth        | DNA 35%, Goal Alignment 30%, Stage 20%, Availability 15%
Networking        | Goals + Industry            | Goal Alignment 40%, Industry 30%, Stage 20%, Proximity 10%
Competition       | Skills + Confidence         | Skill 35%, Confidence 25%, Risk Tolerance 20%, Fun 20%
Project           | Skills + Portfolio Gap      | Gap 35%, Interest 30%, Difficulty 20%, Collaboration 15%
```

### Opportunity Lifecycle Integration


```
When a student engages with an opportunity:

1. VIEWED: datad.opportunity.viewed event emitted
   -> Dax may ask: 'Interested in this? Want me to explain why it fits?'

2. SAVED: datad.opportunity.saved event
   -> Career DNA matching strengthened (if consistent with DNA)
   -> Recommendation engine notes: student prefers this type

3. APPLIED: datad.opportunity.applied event
   -> Readiness prediction updated (student is actively pursuing)
   -> Career trajectory simulation updated with new data point

4. OUTCOME: datad.opportunity.accepted or .rejected event
   -> CRITICAL FEEDBACK SIGNAL: was our compatibility score accurate?
   -> If student applied and was accepted: score was likely correct
   -> If student applied and was rejected: recalibrate probability model
   -> If student was accepted but declined: learn preference signal

Each outcome updates the matching model through the feedback loop (Module 22).
```


---

## Section 8: System Contracts


### Design Philosophy

A system contract is a permanent interface between two subsystems. It specifies what each side promises to deliver, what it expects from the other, and what happens when things go wrong. Contracts are the only allowed communication paths between subsystems. Internal implementation changes must never break a contract.

### Contract Registry


```
Every contract is registered at /contracts/registry.json
Each contract specifies:
  contractId, version, consumer, provider, purpose,
  interface type (REST | gRPC | Event | GraphQL),
  endpoints / topics, latency SLA, availability SLA, rate limits,
  authentication, retry policy, circuit breaker params,
  error handling strategy, version compatibility, breaking change policy
```

### Core System Contracts


#### Contract C1: Frontend <-> Backend API


```
  Consumer:     UI (React SPA, Mobile PWA)
  Provider:     Express API Server
  Interface:    REST + WebSocket (real-time) + GraphQL (complex queries)
  Auth:         JWT in Authorization header (7-day expiry)
  Latency:      <200ms p95 for 95% of endpoints, <500ms p95 for 5% (intelligence)
  Availability: 99.5% (target: 99.9%)
  Version:      URL-prefixed (/v2/...)
  Error format: {error: {code, message, details, requestId, documentationUrl}}
  Rate limit:   100 req/min per user (general), 20 req/min (intelligence)
  Cache:        ETag on list endpoints, Cache-Control: max-age on profile
  Breaking:     New version required for: field removal, endpoint removal, auth change
```

#### Contract C2: Backend <-> Intelligence Engine


```
  Consumer:     Backend Services (resumeService, plannerService, daxService)
  Provider:     Intelligence Engine (26 modules)
  Interface:    gRPC (internal, synchronous) + Event Bus (async)
  Auth:         Service token (mutual TLS)
  Latency:      <100ms p95 (synchronous), <5s p95 (simulation)
  Availability: 99.9%
  Version:      gRPC proto versioned (v2/IntelligenceService)
  Error:        Standard gRPC status codes + detailed error in response trailer
  Retry:        Exponential backoff (100ms, 500ms, 2s), max 3 retries
  Circuit brk:  Open after 50% error rate over 30s window, half-open after 60s
  Idempotency:  All mutation endpoints support idempotency key
  Streaming:    Server-sent events for real-time intelligence updates
```

#### Contract C3: Backend <-> Knowledge Graph


```
  Consumer:     Intelligence Engine, Dax, Backend Services
  Provider:     JanusGraph + MongoDB + Vector Index (federated)
  Interface:    gRPC (federation layer), Gremlin (internal, admin only)
  Auth:         Service token (mutual TLS)
  Latency:      <50ms p95 (node lookup), <200ms p95 (multi-hop traversal)
  Availability: 99.95%
  Consistency:  Eventual (Cassandra backend). Read-your-writes within 1s.
  Query:        Predefined traversal templates (no ad-hoc Gremlin from services)
  Pagination:  Cursor-based for edge lists
  Cache:        In-memory cache (Redis) for frequent queries (TTL: 5min)
```

#### Contract C4: Dax <-> Intelligence Engine


```
  Consumer:     Dax Cognitive OS
  Provider:     Intelligence Engine
  Interface:    gRPC (synchronous) via the V2 Intelligence API
  Auth:         Dax service token (scoped: can read all, write only memory/events)
  Latency:      <200ms p95 per call (Dax may make 3-5 calls per response)
  Total budget: <2s p95 for Dax response generation (including all intelligence calls)
  Contract:     Dax NEVER accesses databases directly. All intelligence through this API.
  Extensions:   Dax may call /v2/.../explain on any result for clarification
  Fallback:     If intelligence is unavailable, Dax operates with last-cached state
```

#### Contract C5: Event Producers <-> Event Bus


```
  Consumer:     Event Bus (Kafka/Pulsar)
  Provider:     Event Producers (all services, frontend, integrations)
  Interface:    REST (HTTP ingest endpoint) + Kafka producer (internal services)
  Auth:         API key (external), service token (internal)
  Schema:       Event schema registry (Avro, validated on ingest)
  Delivery:     At-least-once. Producers must provide idempotencyKey.
  Retry:        Producer retries on 429 (rate limit) or 503 (unavailable)
  Dead letter:  Events that fail schema validation go to /events/dead-letter
  Rate limit:   1000 events/s per producer, 100 events/s per student
  Latency:      <100ms p95 from ingest to available in stream
```

#### Contract C6: Intelligence Engine <-> Memory System


```
  Consumer:     Intelligence Engine (all modules)
  Provider:     Memory Service (episodic + semantic + procedural)
  Interface:    gRPC (synchronous), Event Bus (consolidation triggers)
  Auth:         Internal (service mesh mTLS)
  Latency:      <20ms p95 (memory lookup), <5s (consolidation)
  Consistency:  Strong (reads always reflect latest write for same student)
  Retention:    Memory service manages TTL, not consumers
  Compaction:   Automatic consolidation from episodic to semantic
  Query:        Semantic search (embedding-based) + exact match (by ID)
```

#### Contract C7: Roadmap Engine <-> Intelligence Engine


```
  Consumer:     Adaptive Roadmap Engine
  Provider:     Intelligence Engine
  Interface:    gRPC (pulls: dimension estimates, predictions, recommendations)
                Event Bus (push: on significant dimension changes)
  Latency:      <100ms p95 per pull
  Events:       Subscribe to datad.intelligence.dimension.crossed_threshold
                Subscribe to datad.intelligence.dna.transitioned
                These trigger reprioritization cycles
  Auth:         Service token
  Cache:        Roadmap engine caches intelligence state with 5-min TTL
```

#### Contract C8: Opportunity Engine <-> All Systems


```
  Consumer:     Opportunity Intelligence Engine
  Providers:    Knowledge Graph (skills, companies), Intelligence Engine (student state),
                Event Bus (student actions on opportunities)
  Interface:    Knowledge Graph: gRPC (traversal for skill and company data)
                Intelligence: gRPC (student dimension estimates, readiness, DNA)
                Events: subscribe to datad.opportunity.*
  Refresh:      Student-specific matching computed on-demand (cached 1h)
  Trigger:      Recompute when: student dimension changes, new opportunity arrives,
                student applies/receives outcome
```

#### Contract C9: Notification System <-> Intelligence Engine


```
  Consumer:     Notification System (push, in-app, email)
  Provider:     Intelligence Engine
  Interface:    Event Bus (subscribe to intelligence events)
  Events:       datad.intelligence.insight.generated (high relevance only)
                datad.intelligence.recommendation.generated (high value only)
                datad.intelligence.dimension.crossed_threshold (milestones)
                datad.intelligence.dna.transitioned (career DNA shifts)
                datad.intelligence.prediction.fulfilled (prediction outcomes)
                datad.intelligence.anomaly.detected (risk alerts)
  Throttle:     Max 3 push notifications/day from intelligence
  Priority:     milestone > risk > recommendation > insight
  Content:      Notification body generated by Intelligence, delivered by Notification System
  Tone:         Personalized by Career DNA (see Dax cognitive layer)
  Opt-out:      Per-event-type notification channel controls
```

### Contract Compliance Testing


```
Every contract has a compliance test suite that runs in CI/CD:

1. Contract provider publishes a formal contract specification (JSON Schema/Protobuf)
2. Contract consumer runs tests against a contract mock (not the real provider)
3. CI/CD pipeline checks: consumer tests pass against current contract
4. If contract changes, CI/CD rejects unless both sides are updated
5. Contract breaking change requires: DEPRECATE -> COEXIST -> MIGRATE -> REMOVE
   (minimum 6-month deprecation period)

Contract version pinning:
  - Each service declares which contract version it implements
  - Intelligence Engine v2.5 implements contracts C2-C9 at version 2.5
  - A service consuming C2 at v2.3 works with Intelligence Engine v2.3, v2.4, v2.5
  - Contract compatibility is verified at deployment time (not runtime)
```


---

## Section 9: Architectural Principles


### Immutable Principles

These principles govern all design decisions. They are not guidelines. They are architectural invariants. Violating a principle requires explicit exception and architect approval.

### P1: Single Source of Truth


Every piece of information exists in exactly one canonical location. Duplicated data is either a cache with a known TTL or a derivation with a known function. There is no 'also stored in.'

**Enforcement:** Every entity in the Canonical Ontology has exactly one primary storage. All other access goes through the entity's API. Cross-references use entity IDs, not embedded copies.

### P2: Everything is Evidence


Every interaction is a piece of evidence for the student's evolving state. There is no 'trivial' event. The Evidence Engine weights all events by their diagnostic value, but no event is discarded a priori.

**Enforcement:** All user-facing actions produce an Event. Events are immutable. The Evidence Engine processes all events, even if their weight is near zero. Weight thresholds only affect inference, not collection.

### P3: Every Belief Has Provenance


Every inference, prediction, recommendation, and insight can be traced back to the evidence that produced it. There is no 'the model says so.' Every belief must be explainable.

**Enforcement:** Every intelligence output includes a provenance chain: which evidence records, which model version, which parameters. Provenance is stored in the DERIVED_FROM relationship in the Knowledge Graph.

### P4: Intelligence Before UI


The intelligence layer produces all insights, predictions, and recommendations before the UI is consulted about format. The UI is a rendering layer, not a decision layer. Presentation logic never influences inference logic.

**Enforcement:** The Intelligence API returns structured intelligence objects with confidence and provenance. The UI formats them. There is no UI code in the intelligence engine. There is no intelligence logic in the frontend.

### P5: Every Decision is Explainable


The system can explain any of its outputs to the student in natural language. This is not an optional feature. It is an architectural requirement. An output without an explanation is a bug.

**Enforcement:** The Explainability Engine (Module 16) is called for every intelligence output before it reaches the UI. If explanation generation fails, the output is not delivered.

### P6: Temporal First


State is a point on a trajectory. Every entity and relationship carries temporal information: when it was created, when it was last updated, when it becomes valid, when it expires. There is no 'current state' without a timestamp.

**Enforcement:** Every entity schema includes createdAt, updatedAt, validFrom, validTo. Every relationship includes timestamp, weight history, confidence history. All queries default to time-range bounded.

### P7: Confidence is Explicit


Every numerical output is accompanied by a confidence score. No bare values. Confidence is tracked separately from the value itself. A value without confidence is undefined.

**Enforcement:** All intelligence API responses include a confidence field for every scalar and every composite. The Confidence Estimation module (Module 9) runs continuously. Calibration is verified daily.

### P8: Memory Never Disappears


Information about the student is retained at an appropriate level of abstraction indefinitely. Raw events may expire per tier policy, but semantic memories persist. The student's full trajectory is never lost.

**Enforcement:** Episodic memory has TTL. Semantic memory has no TTL. The consolidation pipeline (episodic -> semantic) runs before episodic data expires. Anonymized data (for population models) may persist after student deletion.

### P9: Events are Immutable


An event, once written, is never modified. Corrections are new events. The event stream is the authoritative record of what happened, in the order it happened. Replaying the event stream from genesis reconstructs the complete system state.

**Enforcement:** Events are append-only. There is no UPDATE or DELETE on events. Corrections create a new event of type *.corrected or *.reverted. Downstream consumers process corrections through the event stream.

### P10: Models are Replaceable


Every ML model in the system is replaceable without changing any other component. A new model may produce different values, but it must produce the same contract: dimension estimates, confidence, provenance. Model version is always returned.

**Enforcement:** Models communicate through the Intelligence API (Section 4), not through direct function calls. A model's output is always wrapped in the standard envelope: {value, confidence, provenance, modelVersion}. Rolling back a model only affects the inference layer.

### P11: Ontology is Stable


The Canonical Ontology (Section 1) defines entities that change rarely. Entities are additive. Relationships are additive. Any contribution that requires removing or renaming an entity is rejected without architect approval.

**Enforcement:** Ontology changes require Architecture Review Board approval. Entity additions are approved at monthly review. Entity deprecations require 6-month notice. Entity removal requires 12-month notice.

### P12: APIs are Contracts


Internal APIs are treated with the same rigor as external APIs. They are versioned, documented, tested for compatibility, and deprecated formally. Internal consumers pin their contract versions.

**Enforcement:** All internal APIs have contract specifications (gRPC proto definitions). CI/CD verifies backward compatibility. Breaking changes require new contract version and 6-month coexistence. See Section 8.

### P13: Knowledge Outlives Models


The Knowledge Graph contains information that transcends any single model. When a model is deprecated, its knowledge contribution to the graph remains. The student's discovered patterns, relationships, and history survive model changes.

**Enforcement:** Models write their outputs to the Knowledge Graph (dimension estimates, correlations, DNA assignments). When a model is replaced, the new model reads from the graph and updates estimates incrementally. The graph is the persistent layer; models are transient.

### P14: Reasoning is Observable


The system's reasoning process is transparent. Any output can be traced back through the reasoning chain. There is no 'it just works.' The system can show its work.

**Enforcement:** The Explainability Engine maintains a reasoning trace for every output. This trace is a directed acyclic graph of reasoning steps, each step linked to evidence or model output. The trace is stored with the DERIVED_FROM relationship. It is available for audit.


---

## Section 10: Self-Critique


### Honesty

Every architecture has weaknesses. Not identifying them is the only unforgivable architectural sin. Below, I critique the V2 design just as rigorously as I critiqued V1.

### Critique 1: Ontology Proliferation


**Weakness:** The Canonical Ontology defines ~40 entities. In practice, teams will propose new entities for every new feature. Within 2 years, this could grow to 100+ entities, making the ontology itself a barrier to understanding.

**Severity:** HIGH

**Mitigation:** Enforce strict entity creation criteria:
- A new entity requires at least 2 independent consumers (not just the proposing team)
- An entity that maps to an existing entity with additional fields should be an extension, not a new root
- Monthly ontology review: prune dead entities, merge similar ones, deprecate outdated ones
- If an entity has <10 instances across all students after 3 months, it's likely a metadata field, not an entity

**Redesign if still growing:** Introduce entity namespacing: `Career.Skill` vs `Learning.Skill` vs `System.Skill` with a shared base. Entities become fully qualified names, reducing collision risk.

### Critique 2: Event Taxonomy Completeness


**Weakness:** The Universal Event Taxonomy defines ~120 event types. This is comprehensive but creates a maintenance burden. Every new feature requires new event types. Event type proliferation makes the stream harder to query.

**Severity:** MODERATE

**Mitigation:**
- Event types follow a hierarchical namespace (datad.domain.action). Consumers can subscribe at any level.
- Wildcard subscription: datad.learning.* captures all learning events
- Event type documentation is generated from the schema registry
- Monthly audit: are all event types consumed? Unconsumed types are deprecated.
- Consider a 'thin event' model: most events carry a standard payload shape with type-specific metadata

**Redesign if maintenance grows unsustainable:** Introduce a dual event system: 'thin' events (standardized, 20 core fields, high volume) and 'thick' events (domain-specific, 50+ fields, low volume). Thin events are faster to process, cheaper to store, and cover 80% of use cases.

### Critique 3: Intelligence API Response Size


**Weakness:** Every intelligence endpoint returns confidence, provenance, trajectory, and evidence alongside the value. A `GET /dimension` response could be 5KB+ for a single dimension. For 25 dimensions, the full profile response could exceed 100KB+.

**Severity:** MODERATE

**Mitigation:**
- Responses have a `mode` parameter: `summary` (value + confidence only), `standard` (+ trajectory), `full` (+ evidence + provenance)
- Default mode is `summary` for list endpoints, `standard` for detail endpoints
- Provenance and evidence are linked (not embedded): the response includes evidenceIds, not full evidence objects
- GraphQL is preferred for complex queries: the client specifies exactly which fields to include

**Redesign if responses are still too large:** Split into two layers: a fast path (value + confidence, <100 bytes per dimension) and a deep path (full detail, on demand). The fast path serves the main graph. The deep path serves drill-downs.

### Critique 4: Dax Cognitive OS Overhead


**Weakness:** The Dax Cognitive Operating Layer adds significant latency (2-5 intelligence API calls per response). Each call is <200ms p95, but 5 sequential calls = up to 1s before Dax starts generating a response. Students expect near-instant responses.

**Severity:** HIGH

**Mitigation:**
- Dax maintains a cached intelligence snapshot (updated every 5 minutes). Most queries read from cache.
- Parallelize independent intelligence calls (dimensions, DNA, predictions can be fetched concurrently)
- Dax working memory caches recent queries: if the student asks about the same topic again within 5 minutes, no new intelligence calls needed
- The reasoning pipeline has a time budget: if budget runs out, respond with current state and flag uncertainty

**Redesign if latency is still problematic:** Implement a 'speculative execution' layer. Dax proactively pre-fetches intelligence data based on predicted next student action (using a lightweight prediction model of student behavior). The pre-fetched data is ready when the student acts.

### Critique 5: System Contract Maintenance


**Weakness:** The System Contracts specify 9 formal interfaces. Each contract requires its own compliance tests, versioning strategy, and deprecation policy. As the system grows, the number of contracts could grow to 20+, each requiring maintenance.

**Severity:** MODERATE

**Mitigation:**
- Contracts are managed by a centralized Contract Registry (JSON file in repo)
- CI/CD pipeline auto-generates compliance tests from the registry
- Version bumps are tracked automatically: if a gRPC proto changes, the contract version is bumped
- A contract dashboard shows: version, consumer, provider, test status, deprecation notices
- Contract 'health' metrics: test pass rate, error rate, latency compliance

**Redesign if contracts still cause friction:** Reduce the number of contract types. Not every communication pattern needs a formal contract. High-volume, low-criticality paths (event consumption) can use the Event Bus with schema validation instead of a full service contract. Reserve formal contracts for synchronous, high-stakes paths (intelligence queries, memory access).

### Critique 6: The Graph Database Dream


**Weakness:** The architecture assumes a graph database (JanusGraph) for the Knowledge Graph. Graph databases are operationally complex: they require specialized infrastructure, have different scaling characteristics than document stores, and are harder for new engineers to work with. At 100k+ students with 100+ relationships each, the graph could exceed 10M edges.

**Severity:** CRITICAL

**Mitigation:**
- The graph is partitioned by studentId. Each student's graph fits in memory (~1MB at 40 entities + 100 edges).
- Student-level queries never traverse multiple partitions.
- Cross-student queries use the vector index (FAISS/Annoy), not JanusGraph traversal.
- JanusGraph backend for individual student graphs, aggregated population graph in a separate read replica.
- Gradual rollout: start with MongoDB for entity + edge storage (simpler), add JanusGraph when the relationship model exceeds MongoDB's capabilities.

**Redesign if JanusGraph is too heavy:** Replace JanusGraph with a dual strategy:
  1. Per-student subgraph: stored as a JSON document in MongoDB (fits one student's entire graph).
  2. Cross-student queries: use the vector index (FAISS) + precomputed aggregate statistics.
  3. Relationship traversals: implement efficiently in-memory from the per-student JSON document.
  This eliminates the graph database entirely for the student-level use case. Only keep JanusGraph if global graph queries (across all students) are needed, which can be served from a separate read-optimized store.

### Critique 7: Privacy Architecture Overhead


**Weakness:** Federated learning, differential privacy, zero-knowledge proofs, on-device inference — these are powerful but operationally expensive. For a startup at 100k students, implementing all of them would consume half the engineering capacity.

**Severity:** HIGH

**Mitigation (priority order):**
1. MUST HAVE: Differential privacy for cross-student queries (minimum cohort size, Laplace noise, epsilon budget tracking)
2. MUST HAVE: Right to deletion (cryptographic erasure, anonymization pipeline)
3. SHOULD HAVE: Federated learning for population models (can wait until 50k+ students)
4. NICE TO HAVE: On-device inference (wait until mobile PWA is at scale)
5. FUTURE: Zero-knowledge proofs (only needed when employers/third parties verify skills)

The architecture defines the full vision. Implementation follows the priority order.

### Critique 8: The 'Every Decision Is Explainable' Debt


**Weakness:** P5 requires every output to be explainable. This is morally correct but operationally expensive. The Explainability Engine (Module 16) must be called for every intelligence output. If it fails, the output is not delivered. This creates a single point of failure for the entire intelligence pipeline.

**Severity:** MODERATE

**Mitigation:**
- The Explainability Engine has two tiers: a fast path (template-based, pre-generated) and a deep path (LLM-generated, on-demand)
- The fast path is always available: it combines the dimension name, value, confidence, top-3 evidence contributors, and a template sentence. This is deterministic and cannot fail.
- The deep path (LLM-generated narrative) is optional. If it fails, the fast path explanation is served with a note.
- Explanation generation is async: the fast path explanation is returned immediately; the deep path completes later and can be polled.

**Redesign if explanation is still a bottleneck:** Make explanation a property of the intelligence output itself, not a separate service. Include a pre-generated 'light explanation' in every intelligence response (computed as part of the inference, not as a post-hoc step). The heavy explanation is still a separate service call.

### Redesign Summary


```
Weakness                                | Severity  | Redesign
----------------------------------------|-----------|-----------------------------
Ontology proliferation (40->100 entities)| HIGH     | Namespaced entities, monthly review
Event taxonomy maintenance burden       | MODERATE  | Thin/thick event split
Intelligence API response size          | MODERATE  | mode=summary|standard|full
Dax latency from multi-call pattern     | HIGH      | Cached snapshot + parallel calls
System contract maintenance             | MODERATE  | Contract registry + auto tests
Graph database operational complexity   | CRITICAL  | Dual strategy: per-student JSON + vector index
Privacy architecture implementation cost| HIGH      | Priority-ordered rollout
Explain-everything operational burden   | MODERATE  | Fast-path template + deep-path LLM dual tier
```

## Final Word


### The Architecture as an Operating System

V1 of the Intelligence Engine was designed as a set of ML models. V2 redesigns the platform underneath:

1. **The Canonical Ontology** provides a stable language for every entity DATAD can reason about. Every model, every API, every event speaks the same language.

2. **The Relationship Graph** makes connections first-class citizens. DATAD does not just store entities. It stores how they relate, with explicit weight, confidence, and time bounds.

3. **The Universal Event Taxonomy** turns every interaction into an immutable, replayable, privacy-tagged record. The event stream is the single source of truth for all intelligence.

4. **The Intelligence API Layer** provides permanent contracts that survive model replacements, schema migrations, and architectural refactors. The API is the operating system's userspace interface.

5. **Dax as a Cognitive Operating System** transforms an LLM chatbot into a structured reasoning system with working memory, meta-cognition, uncertainty handling, and a decision engine.

6. **The Adaptive Roadmap Engine** makes plans alive — continuously reprioritizing based on the student's changing state, momentum, fatigue, and opportunities.

7. **The Opportunity Intelligence Engine** scores every opportunity against the student's Career DNA, skill gaps, readiness, and trajectory. Every recommendation has a 'why' and a 'why not.'

8. **System Contracts** define the only allowed communication paths between subsystems. Internal implementation changes never break external consumers.

9. **Architectural Principles** provide design invariants that every contributor follows. They are not guidelines. They are architecture.

10. **The Self-Critique** identifies 8 weaknesses in this very design, with concrete mitigations and redesign alternatives. No architecture is finished. This one is honest about its limits.

### What This Enables

With this semantic foundation:

- **The 26 intelligence modules** now have stable data structures and APIs to build upon. Module 7 (Latent Trait Model) reads from the Ontology and the Event Stream. Module 16 (Explainability) reads from the Relationship Graph. The modules no longer need to define their own data schemas.

- **The frontend** talks to the Intelligence API, not to databases. API versioning means the frontend doesn't break when models change.

- **Dax** reasons over structured intelligence, not prompt-injected context. Dax can explain its reasoning because every output has provenance.

- **Third-party integrations** (institutional partners, employers, certification providers) integrate through the System Contracts, not through ad-hoc APIs.

- **The student's data** is portable, deletable, and explainable. Every belief the system holds can be traced to the evidence that produced it.

### The Test

The architecture passes if, in 2028:

- A new engineer can add a feature without reading all 26 module specifications
- A model can be replaced without changing any other code
- A student can ask 'why does the graph think that?' and get a satisfying answer
- The event stream from 2026 can still be replayed to reconstruct a student's journey
- DATAD's ontology can describe entities that didn't exist in 2026
- The APIs defined in this document still work without modification
- A competitor with better AI cannot replicate the system because the moat is in the semantic layer, not the models

---

*End of SIG V2 Semantic Foundation Specification*

*July 23, 2026 — DATAD Pro — Principal Architect Review*

