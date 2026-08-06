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
