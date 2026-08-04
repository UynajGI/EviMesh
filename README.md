# EviMesh

EviMesh 是开放分布式科研推进网络项目。

当前项目文档：

- [Roadmap](EviMesh_Roadmap_v0.3.md)
- [Task](EviMesh_Task_v0.3.md)

## 本地环境

本仓库使用 Git、Lefthook 和 CodeGraph 维护基础工程质量。具体开发语言和运行时将在实现阶段按模块补充。

## 常用命令

```powershell
lefthook install
codegraph status
pnpm install
pnpm lint
pnpm --filter @evimesh/protocol test
```

## Workspace

`apps/*` contains product and runtime entry points. `packages/*` contains the
domain, protocol, schema, database, artifact, policy, SDK, CLI, and UI layers.

The protocol package currently defines the M1-01 object ID format and M1-02
UUIDv7 generation. Its IDs use stable type prefixes such as
`claim_<canonical-uuid>`; duplicate IDs are rejected by the server and clients
must retry with a newly generated ID. Revision records are append-only: revision
1 starts a lineage, later revisions supersede the previous revision, and
`current` is a projection pointer.
The protocol also distinguishes `raw_hash` (exact submitted bytes) from
`semantic_hash` (canonical JSON semantics).
Project lifecycle validation is frozen as `draft → active → archived`, with
`archived` terminal and illegal reverse transitions rejected.
Question lifecycle validation covers proposal, review, admissibility, active,
resolution, archival, and rejection transitions.
Task lifecycle validation covers open/active execution, blocked recovery,
verification requests, completion, and cancellation.
Attempt lifecycle validation covers active/paused execution and submitted or
abandoned terminal outcomes while retaining trace and evidence associations.
Claim lifecycle validation covers staged promotion plus contested, refuted,
superseded, retracted, and dependency-tainted outcomes.
Challenge lifecycle validation covers admissibility, investigation, and upheld,
rejected, or resolved terminal outcomes.
Frontier snapshots are immutable and append-only, with contiguous `previous`
references and fixed revisions.
ClaimRelation validation freezes all 14 typed edges with explicit source-to-target
semantics.
Dependency validation rejects self-dependencies and direct or indirect
`depends_on` cycles before graph writes.
Evidence validation freezes formal, numerical, experimental, dataset, literature,
counterexample, benchmark, statistical, code-test, negative-result, and expert
assessment types.
Evidence links are restricted to supports, refutes, qualifies, and reproduces,
and target a specific ClaimRevision.
Run Receipt validation covers task/context, input/output artifacts, execution
environment, command, seed, timing, network access, exit code, actor, and signature.
