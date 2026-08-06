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
