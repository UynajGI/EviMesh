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
