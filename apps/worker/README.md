# @evimesh/worker

异步任务、验证和导出 Worker。

## Frontier Context compiler

`src/frontier-context-compiler.mjs` implements M8-01. Its worker entry point,
`compileFrontierContextJob`, loads one explicit Task revision, one immutable
Frontier snapshot, and the exact Claim revisions named by that snapshot.

The generated payload is deterministic and contains only:

- the Task revision's executable context fields;
- the fixed Frontier snapshot and its member Claim revisions; and
- `depends_on` edges whose two endpoints are already pinned Frontier members.

Attempt traces, current Claim projections, timestamps, and any dependency
outside the selected Frontier are deliberately excluded. A repository adapter
must expose the revision-oriented methods documented by the function's input
contract. Run its contract tests with `pnpm --filter @evimesh/worker test`.

## Blind Context compiler

`src/blind-context-compiler.mjs` implements M8-04. It starts with the same
immutable Frontier inputs, always removes the Task's `outputs`, then removes
each explicitly supplied non-root JSON Pointer from the compiled payload.
Invalid or missing pointers fail closed. The pointer list itself is not
included in the emitted bundle, preventing it from disclosing target-label
locations to a verifier.

## ContextBundle hash

`src/context-bundle-hash.mjs` implements M8-05 with the shared canonical JSON
and SHA-256 semantic-hash rules. `hashContextBundle` returns a prefixed
`sha256:<digest>` value; `verifyContextBundleHash` recomputes it for a
downloaded payload and fails closed on mismatch before that payload is trusted.
The integrity implementation lives in `@evimesh/protocol`, so the domain command
uses the exact same algorithm when it persists a bundle.
