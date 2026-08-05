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
`createClaimRelation()` validates relation types, rejects duplicate/cyclic
`depends_on` edges, and records the relation plus its ResearchEvent atomically.
