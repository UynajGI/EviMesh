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

后续 M7 loop 会在这一边界上增加对象/Actor 哈希链、Outbox、Merkle checkpoint 与 provenance。
