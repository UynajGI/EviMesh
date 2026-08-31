# @evimesh/domain

Scientific objects, lifecycle rules, and domain services.

`ensureActorForIdentity()` provisions a human Actor and its provider Identity
inside a repository transaction on first login. The repository is injected so
the domain service stays independent of a specific database driver.

`updateOwnActorProfile()` accepts only profile fields and requires the
repository to enforce the authenticated `actor_id` predicate in its update.

`registerActorSigningKey()` and `revokeActorSigningKey()` enforce one active
Ed25519 key per Actor; rotation declarations are a separate domain operation.

`createActorApiToken()` returns the generated plaintext once and persists only
its digest, prefix, scopes, and expiry metadata through the injected repository.

`assertApiTokenScopes()` enforces that all required scopes are present.
`revokeActorApiToken()` applies the authenticated Actor predicate, and
`markApiTokenUsed()` records successful use timestamps without exposing secrets.

## v2.1 legacy research-graph backfill runner

`runResearchGraphBackfill()` is the executable, repository-port-driven service
for importing legacy objects and relationships into the unified revision DAG.
It first pages strong legacy entity/revision tables into the `research_node`
registration phase, preserving stable IDs, exact revisions, actors, timestamps,
event anchors, and signed bytes where the source schema provides them. It then
pages raw Claim relations, Evidence links, Challenge target/impact references,
Task dependencies, and Run inputs/outputs. Scanner implementations must provide one
consistent source snapshot in stable deterministic cursor order and return
`{ rows, nextCursor }`. Rows must
already be plain JSON: timestamps use their exact ISO text and binary signature
bytes use an explicit reversible encoding such as base64 or hex. The runner
rejects class instances instead of silently changing provenance bytes.

Some legacy Claim relations and Task dependencies do not store revision
columns. A repository scanner may populate the runner's revision fields only
when it can join to explicit immutable event/revision evidence. It must never
substitute the current revision or assume revision 1; rows without a provable
anchor are intentionally persisted as unmapped archives with blocking findings.

Unsupported or ambiguous typed source coverage produces an explicit blocking
finding rather than being skipped. Registered revisions are assigned topological
rank before relationship materialization.

Non-dry runs atomically stage each page with a per-project checkpoint, record a
count and semantic checksum for every source, build the exact migration audit,
then materialize formal edges/motifs and their immutable
`LegacyRelationRecord`s in one repository transaction. A resumed run starts at
the last durable cursor; a completed run returns `noOp: true` without rescanning
or rewriting. `dryRun: true` performs the same scan, mapping, parity, and cutover
assessment entirely in memory.

The repository port names are published as
`RESEARCH_GRAPH_BACKFILL_REPOSITORY_METHODS`. In particular, the repository—not
this driver—owns SQL/event preservation for `materializeLegacyResearchEdge`,
`materializeLegacyResearchMotif`, and `materializeLegacyChallengeRevision`.
Missing exact revision anchors become immutable archive records with active
blocking findings. Cycles, self-loops, dangling revisions, Run I/O overlap, any
unmapped row, or parity mismatch fail closed. Call
`assertResearchGraphBackfillCutoverReady()` before enabling a kernel cutover.

This package ships the runner and its in-memory contract tests; it does not
assert that any deployment or production dataset has been migrated.

`createTask()` creates the initial immutable Task revision and signed research
event atomically. `reviseTask()` appends a new Task revision, updates only the
current Task projection, and requires a matching `If-Match` ETag to prevent
stale concurrent edits.
`transitionTask()` applies the protocol Task state machine, appends the state
change as a new revision, and records the from/to states in the research event.
`addTaskDependency()` rejects self, duplicate, and cyclic `depends_on` edges
before persisting the dependency and its research event.
`acquireTaskLease()` grants one exclusive time-bounded lease per Task,
rejecting active conflicts and recording the lease expiry in the event.
`renewTaskLease()` extends only an unexpired lease held by the authenticated
Actor and records both the previous and new expiry timestamps.
`expireTaskLeases()` soft-deletes leases whose expiry has passed and emits an
audit event for each cleaned-up lease.
`createAttempt()` validates the contributor's Task context bundle binding and
creates an active Attempt with its audit event atomically.
`transitionAttempt()` restricts state changes to the owning Actor, applies the
protocol Attempt state machine, and timestamps submitted or abandoned Attempts.
`createTraceEvent()` accepts only public summary fields, validates the signed
trace envelope, and rejects ordinary trace writes after Attempt submission.
`createClaim()` creates a hypothesis Claim, its first immutable revision, and
the corresponding ResearchEvent atomically.
`reviseClaim()` appends a new immutable Claim revision, updates only the current
Claim projection, and requires a matching `If-Match` ETag to prevent stale edits.
`createClaimRelation()` validates relation types, checks only active relations
for duplicate/cyclic `depends_on` edges, and records the relation plus its
ResearchEvent atomically. Relation events use schema-valid namespaced types
(`claim.relation.created`, `claim.relation.ended`, and
`claim.relation.replaced`). `endClaimRelation()` timestamps an active edge and
emits an ending event without deleting history; `replaceClaimRelation()` performs
that ending and inserts the replacement edge in one transaction.
`transitionClaim()` applies the protocol Claim state machine as a new revision,
updates the current Claim projection, and records the from/to states in an event.
`createChallenge()` verifies and locks an immutable target Claim revision before
atomically creating the initial open Challenge revision and ResearchEvent.
`transitionChallenge()` appends a validated Challenge state revision and emits
`challenge.upheld` when the transition reaches the upheld outcome, preserving
the locked target Claim revision in the event payload.
