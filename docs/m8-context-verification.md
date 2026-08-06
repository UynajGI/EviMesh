# M8 Context and Verification

## Frontier Context compiler

M8-01 provides the first ContextBundle compiler in `@evimesh/worker`.
`compileFrontierContextJob` accepts a Task ID and revision plus a Frontier
snapshot ID. It obtains the immutable Task revision, the immutable snapshot,
each `frontier_members` row, and the exact Claim revision referenced by every
member.

The resulting `frontier` payload is intentionally bounded. It includes the
Task's inputs, outputs, and acceptance contract; the selected snapshot and its
checkpoint; revision-pinned Claim content; and only `depends_on` edges whose
source and target both occur in the snapshot. The compiler rejects duplicate
members, revision mismatches, foreign-snapshot members, and dependency
endpoints outside that fixed set.

This boundary prevents future revisions or Attempt Trace data from changing a
previously compiled Frontier context. Hashing, durable ContextBundle creation,
storage, and API download are delivered by subsequent M8 tasks.

## Full Trace Context compiler

M8-02 layers public Attempt Trace on top of the same fixed Frontier payload.
Trace data is accepted only when every payload key is one of `summary`,
`status`, `phase`, `duration_ms`, `step`, `metrics`, or `labels`. The compiler
rechecks that rule even when its repository adapter claims to return public
events, then sorts trace events by creation time and event ID. Private fields
or duplicate trace event IDs fail compilation rather than silently producing a
context that leaks data.

## Adversarial Context compiler

M8-03 requires an explicit, revision-pinned `mainstreamClaimKeys` classification
from the repository or policy layer. The compiler removes the `statement` only
from those classified Frontier members; it never tries to infer consensus from
free text. It then accepts only fixed-Frontier `refutes`, `qualifies`,
`contradicts`, and `challenges` relations as counter-material. Any relation or
classification outside the snapshot fails compilation.

## Blind Context compiler

M8-04 produces a revision-pinned `blind` bundle from the same fixed Frontier
contract. It always removes `task.outputs`, then applies caller-supplied,
non-root JSON Pointer redactions for fields such as target labels. The compiler
does not keep those pointers in the output bundle. A malformed, unsafe, or
missing pointer stops compilation rather than allowing an ambiguous context to
reach a verifier.

## ContextBundle hash

M8-05 hashes every compiled ContextBundle with the shared canonical JSON
algorithm and returns a lowercase `sha256:`-prefixed digest. Key-order changes
therefore do not affect the value, while any semantic change does. Consumers
call `verifyContextBundleHash` after download; it rejects a malformed expected
digest or a payload whose recomputed digest differs from the supplied one.

## ContextBundle create command

M8-06 adds `createContextBundle` in `@evimesh/domain`. It derives task,
revision, mode, Frontier snapshot, and content hash from the compiled bundle;
verifies that the named immutable Task revision and snapshot exist; then writes
the database row and `context_bundle.created` ResearchEvent in one transaction.
The stored manifest records only durable identity and storage metadata, while
the complete payload remains at the validated storage URI.

## Task Context query endpoint

M8-07 exposes `GET /tasks/{taskId}/context?mode=…`. It validates the requested
mode against the protocol vocabulary and returns the one stored immutable
ContextBundle for that Task/mode pair, including its manifest, content hash,
and storage URI. It never regenerates a context from mutable current
projections; a missing bundle is an explicit 404.

## Context access audit hook

M8-08 adds `recordContextBundleAccess` to the domain layer. The authorization
layer passes `accessRestricted: true` after it has approved a protected bundle
download; the hook then appends `context_bundle.accessed` with the immutable
bundle identity, content hash, actor, and access reason. Unrestricted reads do
not generate events, and an incomplete restricted-access audit envelope fails
closed.

## VerificationContract create command

M8-09 adds `createVerificationContract`. A maintainer creates the stable
contract and revision 1 atomically, with non-empty requirements, explicit
unique verification types, and protocol-valid context modes. The command
appends `verification_contract.created` in the same transaction, so every
subsequent VerificationReceipt can name an immutable contract revision.

## VerificationPolicy create command

M8-10 adds `createVerificationPolicyCommand`. It delegates policy-shape
validation to the protocol, then atomically writes the stable policy, immutable
revision 1, and `verification_policy.created` event. Empty requirements or
outcomes cannot enter persistence.

## Verification prepare

M8-11 adds `prepareVerification` at the API edge. It reads the requested Claim
and VerificationContract revisions by exact ID/revision pair and returns only
canonical `verification.submitted` signing bytes plus their SHA-256 hash. A
missing revision fails with 404; current projections are never substituted.

## Verification submit

M8-12 adds `submitVerification`. It checks the exact Claim and Contract
revisions, then writes the VerificationReceipt, all Findings, a verifier
ContributionStatement, and `verification.submitted` in one transaction.
Missing revisions prevent every write, preserving the receipt's provenance.

## Verification receipt query

M8-13 adds `getVerificationReceipt`, returning exactly one persisted receipt
and its persisted Findings by receipt ID. Missing receipts are explicit 404s;
the query never decorates results with mutable Claim or Contract projections.

## Claim verification list

M8-14 adds `listClaimVerifications`, querying persisted receipts by Claim with
optional outcome, context-mode, and actor filters. Results have a stable
creation-time/receipt-ID order for callers that need reproducible summaries.

## Duplicate verification detection

M8-15 binds every VerificationReceipt to an immutable Run. Before insertion,
the submit command confirms the Run exists, checks prior receipts for the same
Actor and Run, and records `duplicateOfReceiptId` when present. Both references
are persisted as restrictive foreign keys, so duplicates remain auditable rather
than being silently discarded.

## Policy JSON interpreter

M8-16 adds a deterministic interpreter for one immutable VerificationPolicy
revision. It evaluates the materialized input against each JSON requirement,
uses numeric requirements as lower bounds and all other JSON values as exact
matches, then emits a sorted explanation and the configured
`requirements_met` outcome only when every requirement passes. Missing or
malformed input fails closed; the domain-specific gates follow in M8-17 to
M8-21.

## Blocking Finding rule

M8-17 interprets `blocking_findings` as a maximum rather than a lower-bound
counter. A policy requiring zero blocking Findings therefore cannot recommend
a promotion while any critical or major Finding remains.

## Refuting Receipt rule

M8-18 gives a verified `refuting_receipts` count precedence over promotion:
when it is positive, the interpreter recommends the policy's
`any_refuting_receipt` outcome (normally `contested`) even if all promotion
requirements are otherwise satisfied.

## Blind receipt count rule

M8-19 treats `blind_reproductions` as a non-negative integer count. The
configured minimum must be reached before promotion is recommended; fractional
or negative values fail evaluation rather than weakening the independence gate.

## Distinct implementation rule

M8-20 treats `distinct_implementations` as an explicit non-negative count,
separate from the number of successful or blind receipts. The policy's minimum
must be met before promotion can be recommended.

## Challenge window rule

M8-21 interprets `challenge_window_hours` as a non-negative elapsed duration.
When the supplied elapsed duration is below the policy window, its requirement
does not pass and even an `accepted` policy outcome cannot be recommended.

## Policy evaluation Worker

M8-22 adds `evaluateClaimPolicyJob`. It materializes policy input only from the
Claim, exact Policy revision, VerificationReceipts, and their Findings, then
calls the deterministic interpreter. Unsupported rules and malformed temporal
inputs fail closed; persistence of the resulting evaluation follows in M8-23.

## Policy evaluation record

M8-23 persists each Policy evaluation as an append-only record with the exact
Policy revision, materialized input summary, per-requirement outcome, and final
recommendation. Restrictive Claim and Policy-revision foreign keys preserve the
audit boundary.

## Challenge impact calculation

M8-24 adds `calculateChallengeImpactJob`. For an upheld, revision-pinned
Challenge it returns the challenged Claim plus the deduplicated downstream
dependency set in stable order. Other Challenge outcomes have no impact set.

## Dependency tainting

M8-25 marks every impacted downstream Claim as `dependency_tainted` while
leaving the directly challenged source Claim in its own Challenge-derived
state. Already tainted Claims are not rewritten.

## Re-verification tasks

M8-26 creates one re-verification Task for each affected downstream Claim.
The worker excludes the challenged source Claim, de-duplicates Claim IDs, and
does not create a second task where one already exists for the same source.

## Merge proposals

M8-27 creates a MergeProposal only after loading the explicitly requested
Claim revision and VerificationPolicy revision. The persisted proposal and its
event pin both revision numbers; its status is `ready` only when the pinned
evaluation has met every policy requirement.

M8-28 exposes a proposal's pinned evaluation as two explicit lists:
`satisfied` and `unsatisfied` conditions. This prevents clients from inferring
merge readiness from mutable Claim or Policy projections.

## Frontier snapshots

M8-29 appends FrontierSnapshot records only at the next contiguous project
sequence. It fixes the immediately previous sequence, the project revision,
and a `ready` MergeProposal in the immutable checkpoint before emitting
`frontier.created`.

M8-30 adds a Frontier member only after loading both the named snapshot and
the exact Claim revision. The member record stores the revision number rather
than resolving a mutable current Claim projection.

M8-31 returns the FrontierSnapshot with the maximum valid sequence for a
project, returning `null` before genesis. Malformed repository sequence data
fails closed rather than being treated as a latest Frontier.

M8-32 pages immutable Frontier history with the existing opaque cursor scheme,
using stable `createdAt` and `snapshotId` keys within one Project.

M8-33 compares two fixed snapshots from the same Project and returns explicit
`added`, `removed`, and `statusChanged` Claim groups, retaining each member's
pinned revision in the diff result.

M8-34 publishes a Frontier by appending the immutable `frontier.published`
ResearchEvent; no published Snapshot row is updated or deleted.

M8-35 derives deduplicated follow-up Task suggestions from the named
Frontier's unresolved blockers. Each generated suggestion has type
`open_blocker` and is scoped to the fixed Frontier snapshot.

M8-36 adds versioned Policy test vectors. The same input evaluated against the
same Policy revision must reproduce the fixture's requirement outcomes and
recommended decision exactly.

M8-37 integrates Challenge impact computation with dependency tainting: an
upheld upstream Challenge leaves its source contested and marks every computed
downstream Claim as `dependency_tainted`.
