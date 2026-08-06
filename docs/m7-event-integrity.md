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

后续 M7 loop 会在这一边界上增加对象/Actor 哈希链、Outbox、Merkle checkpoint 与 provenance。
