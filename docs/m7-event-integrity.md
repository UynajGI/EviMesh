# M7 Event、完整性与透明日志

`@evimesh/domain` 的 `appendResearchEvent` 是正式 SRP Event 的统一写入边界：

- 仅接受完整、已签名且符合 `srp.event.v1` 的 Event；
- 在同一 repository transaction 中写入 Event 和每一条 parent link；
- 拒绝重复 Event、重复 parent 与不存在的 parent；
- 历史 Event 不通过该服务更新或删除，数据库的 append-only 规则继续作为最终防线。

对象链追加使用 `appendObjectResearchEvent`：先读取该对象当前的 Event hash，作为
`payload.integrity.previous_event_hash` 交给 Event factory，再验证 factory 返回的已签名
Event 确实包含同一个链头。首个 Event 的前序 hash 为 `null`。

`appendActorResearchEvent` 对每个 Actor 独立执行同一流程，使用
`payload.integrity.actor_id` 与 `previous_actor_event_hash`；对象链与 Actor 链彼此独立。

平台 Receipt 使用 `@evimesh/signatures` 的 `createSignedPlatformReceipt` 以 Ed25519 签名
`schema`、`event_id` 和 `server_time`，并可由公开的平台 SPKI key 通过
`verifyPlatformReceipt` 独立验证。

`getResearchEventSignature` 原样返回正式 Event 已持久化的 client signature，不重新编码、
规范化或替换该签名；缺失 Event 返回 `RESEARCH_EVENT_NOT_FOUND`。

## Event query boundary

`listResearchEvents` is the API-edge query boundary for formal Events. It delegates
object, Actor, type, and created-time filters to its repository, requires object type
and ID together, normalizes ISO-8601 bounds, and applies the shared opaque cursor
pagination by `(createdAt, eventId)`.

## Event NDJSON export

`exportResearchEventRangeNdjson` exports the inclusive Event range supplied by
`listResearchEventRange({ firstEventId, lastEventId })`. The repository owns the
authoritative event ordering and must return the complete contiguous range. The API
layer rejects an empty range, missing boundaries, duplicate IDs, or malformed rows
instead of silently producing a partial audit export.

## Transactional outbox

`appendResearchEventWithOutbox` is the formal Event command for downstream work.
It creates the signed Event, immutable parent links, and a `pending` `event_outbox`
row in one repository transaction. The outbox row references the new Event, so a
publisher only observes committed Events and a command cannot leave a committed
Event without its delivery record.

## Outbox claim lock

`claimOutboxJobs` is the worker boundary for claiming due `pending` outbox rows.
Its repository method must perform an atomic compare-and-set claim, transitioning a
row to `processing` with `lockedAt` before returning it. The utility validates that
returned locks are unique and complete, preventing a worker from treating an
ambiguous result as safely claimed work.

## Outbox success acknowledgement

`acknowledgeOutboxJob` confirms a completed `processing` job through an atomic
repository update. A successful acknowledgement must return the same outbox ID with
`status: processed` and the exact normalized `processedAt` timestamp; otherwise the
worker treats the acknowledgement as failed rather than assuming delivery state.

## Outbox retry

`retryOutboxJob` records a bounded error string, increments `attempts`, and returns a
failed `processing` job to `pending` at `availableAt = failedAt + min(baseDelay ×
2^attempts, maxDelay)`. The repository must perform this transition atomically and
return the complete new retry state; a stale or already completed job is rejected.

## Outbox dead letter

`deadLetterOutboxJob` stops automatic delivery when the failure being recorded makes
`attempts + 1 >= maxAttempts`. It atomically changes only a `processing` job to
`dead_letter`, retains the final error, and refuses to invoke the repository while
retry attempts remain. Dead-letter rows therefore cannot be accidentally returned to
the automatic pending queue.

## Merkle leaf encoding

`@evimesh/merkle` encodes a complete signed `srp.event.v1` under the
`evimesh.merkle-leaf.v1` domain separator using canonical JSON. Its leaf hash is
`sha256(canonical encoding)`, so the same formal Event always produces the same
leaf even when equivalent JSON objects arrive with different key order.

## Merkle tree construction

`buildMerkleTree` preserves Event order, hashes child pairs under the separate
`evimesh.merkle-node.v1` domain, and duplicates the final node at every odd-width
level. The returned immutable levels and root make the construction rule explicit
for checkpoint and proof callers.

## Merkle inclusion proof generation

`createMerkleInclusionProof` emits a stable sibling path for any leaf, including
the duplicated sibling at odd-width levels. Each step records the sibling hash and
whether it is on the left or right, with the source leaf hash and resulting root
bound into a versioned proof object.

## Merkle inclusion proof verification

`verifyMerkleInclusionProof` strictly validates the proof shape and replays its
ordered sibling path. Each path direction must match the parity of the declared
`leafIndex` at that tree level, so the proof authenticates both inclusion and
position. It returns `false` for malformed data or any altered leaf, index,
sibling, direction, or root, making proof validation safe for untrusted public
inputs.

## Merkle checkpoint creation

The Worker creates an unsigned `evimesh.merkle-checkpoint.v1` candidate from an
inclusive, repository-defined contiguous Event range. It binds the two range
endpoints, event count, and deterministic Merkle root; M7-18 signs this
candidate before it can be persisted as a published checkpoint.

## Merkle checkpoint signing

`signMerkleCheckpoint` signs the canonical checkpoint range, count, and root
with the platform Ed25519 key. `verifyMerkleCheckpoint` accepts the published
platform public key and fails if the root, range, count, or signature changes.

## Merkle checkpoint query

`getMerkleCheckpoint` is the API Edge query contract for a published checkpoint.
It returns the root hash, inclusive Event range, event count, and parsed platform
signature; missing checkpoints map to a typed 404 and malformed stored records
fail closed as internal errors.

## Research Event inclusion proof query

`getResearchEventInclusionProof` resolves the published checkpoint covering one
Event, rebuilds its inclusive range, and returns the Event's proof only when the
reconstructed root equals the published root. The resulting proof is directly
verifiable with `verifyMerkleInclusionProof`.

## Contribution statements

`appendResearchEventWithContributions` appends a signed formal Event and one or
more typed role statements atomically. Each persisted statement carries the
immutable `event_id` of the Event that produced it, so actor attribution stays
linked to its audit event. It rejects empty contribution lists and roles outside
the protocol's contribution-role vocabulary before persistence.

## Contribution produced edges

`addContributionProducedEdge` records a `produced` relation from an existing
contribution statement to one existing object revision. It validates both ends
and the positive revision number before writing the provenance edge.

## Contribution used edges

`addContributionUsedEdge` applies the same checks before recording a `used`
relation to an existing input object revision, preserving the distinction
between research inputs and outputs.

## W3C PROV export

`exportContributionProv` maps contribution graphs to PROV-JSON: actors become
Agents, contribution statements become Activities, and revision references
become Entities with explicit `used` and `wasGeneratedBy` relations.

## Object provenance query

`getObjectProvenance` returns the complete Actor → Event → immutable object
revision → Frontier path. It constructs `actorEvents` from contribution
statements' immutable Event links, while the contribution edges scope those
statements to the requested revision. It fails closed with a typed 404 if any
essential path segment is missing rather than presenting a partial provenance
chain.

## Event replay projection

`replayCoreProjections` clears only derived current-state projections represented
by signed Event `payload.projection` snapshots, then rebuilds those collections
in append order. The first integrated core path covers Claim creation, revision,
and lifecycle transitions; unsupported projections are preserved until their
Event producers emit compatible snapshots. Immutable Event history is never
cleared or mutated during replay.


## Event deletion guard

The opt-in database integration test provisions a disposable ordinary application
role inside a rolled-back transaction, grants it `DELETE`, and proves that
`DELETE` still raises the append-only PostgreSQL error (`55000`). The outer
transaction is rolled back, so neither the role nor the fixture Event remains.

## Revision update guard

The companion integration test creates an Actor, Claim, and ClaimRevision inside
the same rollback-only transaction. A disposable ordinary role receives UPDATE
permission and a matching temporary RLS policy, yet an in-place ClaimRevision
update is rejected with `55000`; the original statement remains intact.

## Platform key rotation

`rotatePlatformKeyring` signs the declaration with the outgoing private key,
makes the replacement key active, and retains the outgoing public key. Receipt
verification resolves its embedded `key_id` through the complete keyring, so
both pre-rotation and post-rotation receipts remain independently verifiable.

## Platform public keys endpoint

`GET /platform/keys` publishes the active and retained Ed25519 public keys with
their `key_id`; it never includes private key fields, even if a deployment
configuration accidentally contains them. Missing or malformed keyring
configuration fails closed with `503`. The checked-in OpenAPI contract exposes
the same public response and failure shapes for generated clients.
