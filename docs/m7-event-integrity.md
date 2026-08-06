# M7 Event、完整性与透明日志

`@evimesh/domain` 的 `appendResearchEvent` 是正式 SRP Event 的统一写入边界：

- 仅接受完整、已签名且符合 `srp.event.v1` 的 Event；
- 在同一 repository transaction 中写入 Event 和每一条 parent link；
- 拒绝重复 Event、重复 parent 与不存在的 parent；
- 历史 Event 不通过该服务更新或删除，数据库的 append-only 规则继续作为最终防线。

后续 M7 loop 会在这一边界上增加对象/Actor 哈希链、Outbox、Merkle checkpoint 与 provenance。
