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
