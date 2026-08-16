# Knowledge Graph Schema

## Overview

All platform content (notes, cases, companies, users, posts, etc.) becomes typed **nodes** in a shared graph. Typed **edges** connect them, enabling cross-module discovery, semantic navigation, and AI context-building.

The graph lives in MongoDB alongside existing collections, using a dedicated edge collection with vector embeddings on both nodes and edges.

---

## Node Types

Each node maps to one or more existing Mongoose models. Nodes are stored in their original collections but register themselves with a uniform `GraphNode` envelope.

### Core / Identity
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `user` | User | name, email, role, tier, studentType |
| `profile` | UserProfile | college, course, specialization, batch, goals |

### Content
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `note` | Note | title, subject, content, semester |
| `post` | Post | title, body, type |
| `reply` | Reply | body |
| `announcement` | Announcement | title, body, priority |
| `journal_entry` | JournalEntry | title, content, mood |
| `content_item` | ContentItem | title, description, subject, tags |

### Academic
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `subject` | SubjectRegistry | name, code, semester |
| `program` | ProgramRegistry | name, slug, features |
| `resource` | Resource | title, type, subject, semester |

### Career / Professional
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `resume` | Resume | personal, summary, skills, experience |
| `company` | Company | name, sector, overview, roles |
| `internship` | Internship | company, role, location, stipend |
| `placement_drive` | PlacementDrive | company, role, package, deadline |
| `skill` | SkillListing | name, category |
| `daily_case` | DailyCase | title, category, scenario, question |

### AI / Metadata
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `memory` | Memory, UserMemory | topics, specializations, preferences |
| `ai_session` | ChatMessage (grouped) | conversation thread |
| `briefing` | DailyBriefing | summary, date |
| `reflection` | DailyReflection | content, date |

### Community
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `event` | Event | title, date, location, type |
| `album` | Album | title, description |
| `photo` | Photo | url, publicId |
| `listing` | MarketListing | title, price, category |
| `news_item` | NewsItem | title, summary, category, source |
| `entertainment_item` | EntertainmentItem | title, type, category |

### Productivity
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `task` | Task | title, dueDate, status, type |
| `project` | Project | name, description, status |
| `project_task` | ProjectTask | title, status, assignee |

### Financial
| Node Type | Source Model(s) | Properties |
|---|---|---|
| `expense` | Expense | amount, category, date |
| `budget` | Budget | monthlyLimit, category |
| `market_snapshot` | MarketSnapshot | symbol, price, change |

---

## Edge Types

Edges are stored in a single `GraphEdge` collection. Every edge has a `type`, `source` node ref, `target` node ref, optional `weight`, optional `properties`, and `module` scope.

### Ownership & Authorship
| Edge Type | Source → Target | Semantics |
|---|---|---|
| `authored` | note/post/journal → user | Content creator |
| `uploaded` | photo/content_item → user | Media uploader |
| `created` | event/project/task → user | Entity creator |
| `assigned` | task → user | Task assignee |

### Structural
| Edge Type | Source → Target | Semantics |
|---|---|---|
| `belongs_to` | task → project | Task in project |
| `child_of` | reply → post | Reply in thread |
| `part_of` | photo → album | Photo in album |
| `enrolled_in` | user → program | Program enrollment |
| `registered_for` | rsvp → event → user | Event registration |

### Semantic (Cross-Module Bridges)
| Edge Type | Source → Target | Module Scope |
|---|---|---|
| `relates_to` | any → any | Cross-module concept link |
| `references` | any → any | Explicit mention/link |
| `similar_to` | any → any | Embedding similarity > 0.85 |
| `prerequisite` | subject → subject | Course dependency |
| `teaches` | resource/note → subject | Content relevancy |

### Career & Placement
| Edge Type | Source → Target | Semantics |
|---|---|---|
| `recruits` | company → placement_drive | Company hiring |
| `applied` | placement_application → user → drive | Student application |
| `requires_skill` | placement_drive/internship → skill | Required competency |
| `has_skill` | user → skill | Skill proficiency |

### Engagement
| Edge Type | Source → Target | Semantics |
|---|---|---|
| `reacted` | user → post | Like/reaction |
| `bookmarked` | user → any | Bookmark |
| `solved` | user → daily_case | Case completion |
| `read` | user → news_item | News read tracking |

### Temporal
| Edge Type | Source → Target | Semantics |
|---|---|---|
| `succeeded_by` | project_task → project_task | Task dependency |
| `supersedes` | content_item → content_item | Version chain |
| `duplicate_of` | content_item → content_item | Exact/similar duplicate |

---

## Cross-Module Connection Strategy

Shared concepts act as bridge nodes that connect content across different programs (MBA, Engineering, Law, etc.).

### Concept Bridge Nodes

Nodes with type `concept` are lightweight entities in a new `Concept` collection:

```javascript
{
  _id: ObjectId,
  slug: "game-theory",           // unique, URL-safe
  label: "Game Theory",
  domain: "economics",           // broad domain
  aliases: ["strategic thinking", "interactive decision theory"],
  embedding: [Number],           // for semantic matching
  moduleTags: ["mba", "engineering", "law"],
  // Only fields that matter for routing between content
}
```

### Bridge Examples

| Concept | MBA Connection | Engineering Connection | Law Connection |
|---|---|---|---|
| `statistics` | Market analysis | Data structures | Evidence evaluation |
| `ethics` | CSR strategy | AI ethics | Legal ethics |
| `negotiation` | Deal-making | Requirements engineering | Plea bargaining |
| `game-theory` | Competitive strategy | Network protocols | Settlement strategy |
| `risk-analysis` | Investment risk | System reliability | Liability assessment |
| `communication` | Presentation skills | Technical writing | Courtroom argument |
| `project-management` | Case studies | Agile methodology | Case management |
| `data-analysis` | Business analytics | Data science | Discovery analytics |

### Auto-Linking via Embeddings

When content is created/updated:
1. Generate embedding using existing `embed()` function
2. Find top-3 concepts with similarity > 0.8
3. Create `relates_to` edges from content → concept
4. Concepts with shared edges create transitive `similar_to` edges between content in different modules

```javascript
// Pseudocode for auto-linking
async function autoLinkContent(contentNode, text) {
  const vec = await embed(text);
  const concepts = await Concept.find({})
    .sort({ embedding: { $meta: "vectorScore" } })
    .limit(3)
    .minScore(0.8);
  for (const c of concepts) {
    await GraphEdge.create({
      type: 'relates_to',
      sourceType: contentNode.type,
      sourceId: contentNode._id,
      targetType: 'concept',
      targetId: c._id,
      module: contentNode.module,
    });
  }
}
```

---

## GraphEdge Collection Schema

```javascript
const graphEdgeSchema = new mongoose.Schema({
  type:       { type: String, required: true },     // edge type from table above
  sourceType: { type: String, required: true },      // node type of source
  sourceId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, required: true },      // node type of target
  targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  module:     { type: String, default: 'mba' },      // source module
  weight:     { type: Number, default: 1 },          // 0-1 relevance score
  properties: { type: mongoose.Schema.Types.Mixed },  // edge-specific data
  createdAt:  { type: Date, default: Date.now },
});

graphEdgeSchema.index({ sourceType: 1, sourceId: 1 });
graphEdgeSchema.index({ targetType: 1, targetId: 1 });
graphEdgeSchema.index({ type: 1, module: 1 });
graphEdgeSchema.index({ sourceType: 1, sourceId: 1, type: 1, targetType: 1, targetId: 1 }, { unique: true });
```

---

## Query Patterns

### 1. Get all content connected to a concept (cross-module)
```
MATCH (c:Concept {slug: 'game-theory'})<-[:relates_to]-(n)
RETURN n.type, n.module, n.label
```
→ Returns notes from MBA, algorithms from Engineering, case law from Law

### 2. Get user's learning path
```
MATCH (u:User {_id: userId})-[:authored|solved]->(n)
RETURN n.type, count(n) as count
```
→ Returns distribution of user's activity across node types

### 3. Find related content in other modules
```
MATCH (n {_id: currentId})-[:relates_to]->(c:Concept)<-[:relates_to]-(m)
WHERE m.module != n.module
RETURN m
```
→ Cross-module recommendations

### 4. AI context assembly
```
MATCH (u:User {_id: userId})-[:authored|solved|bookmarked]->(n)
MATCH (n)-[:relates_to]->(c:Concept)
RETURN n, c
LIMIT 20
```
→ User's recent graph neighborhood for AI personalization

---

## Integration Points

### Existing embedding system (`server/ai/embeddings/`)
- `vectorStore.js` already stores embeddings per document in a `vectorstore` collection
- The new `GraphNode` wrapper adds node-type metadata on top
- `semanticSearch.js` becomes a graph-aware query layer

### Existing memory system (`server/ai/memory.js`)
- `UserMemory` already stores user preferences, topics, specialization
- These become `memory` nodes with `relates_to` edges to content the user engaged with

### AI pipeline (`server/ai/agents/pipeline.js`)
- RAG context building (`buildResumeRAGContext`, `buildPlannerRAGContext`) currently queries collections independently
- Graph edges enable a single `buildGraphContext(userId)` call that walks the user's graph neighborhood

### Module system (`server/modules/`)
- Every new module (Engineering, Law, etc.) defines its node types and cross-module concept bridges
- The concept bridge table lives in a shared config and auto-generates edges during content indexing

---

## Migration Path

1. Create `GraphEdge` collection and `Concept` collection
2. Backfill: index all existing documents, create concept bridge nodes, generate edges via embedding similarity
3. Seed base concepts (~200 domain-spanning concepts)
4. Enable auto-linking on content create/update hooks
5. Migrate AI context builders to use graph walks (opt-in, co-exist with collection queries)
6. Phase out collection-specific context builders as graph matures
