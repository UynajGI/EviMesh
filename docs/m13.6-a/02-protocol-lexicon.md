# M13.6-A 协议词典

本词典把研究记录翻译成面向人的自然语言。默认先显示自然语言；只有在需要追溯、交换或核验时，才展开协议层技术细节。自然语言是解释入口，不改变协议对象的身份、版本或历史。

## 阅读规则

- **稳定 ID** 标识同一个对象；对象的历史不会因为当前状态改变而换 ID。
- **不可变 revision** 是对象在某一时刻的一份冻结内容。修订会产生新的 revision，并保留对前一 revision 的替代关系；旧 revision 不被原地覆盖。
- **当前状态** 是可由事件或投影得到的 mutable/current state。它可以变化，但不能改写已经保存的 revision、证据或回执。
- **Policy** 是作出筛选、验证或发布判断时所依据的规则版本；规则变更应指向新的 Policy revision。
- 技术详情可包含 **hash** 与 **signature**，用于确认内容完整性和来源，不把它们简化为“可信度分数”。
- 下面的协议名称是解释用的 counterpart，不要求用户记忆其编码或传输形式。

## 词条

### Question｜问题

**自然语言层**：希望研究、澄清或验证的一个问题。它描述要知道什么，不预先承诺答案，也不等同于某个 Claim。

**协议层**：`Question` 对象；问题正文的历史由不可变 revision 表达，可关联一个或多个研究任务、Attempt、Claim、Evidence 与 Challenge。

**技术详情标签**：稳定 ID `questionId`；不可变 revision `questionRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Research task｜研究任务

**自然语言层**：为回答一个问题而安排的一项可执行工作，包含目标、范围、责任和完成条件。任务是工作安排，不是研究结论。

**协议层**：`Task` 对象；任务的状态由研究事件推进，可关联 Question、ResearchContract、Attempt 和 VerificationReceipt。

**技术详情标签**：稳定 ID `taskId`；不可变 revision `taskRevisionId`（如任务说明被修订）；当前状态 `currentState`；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Attempt｜尝试

**自然语言层**：一次可归因、可复查的研究尝试，记录采用的方法、输入、参与者和产出。失败、暂停或放弃的尝试仍可提供研究线索。

**协议层**：`Attempt` 对象；它连接任务与执行痕迹、Artifact、Claim 或 Evidence，但不会因失败而删除这些关联。

**技术详情标签**：稳定 ID `attemptId`；不可变 revision `attemptRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Assertion / Claim revision｜断言／主张修订版

**自然语言层**：对研究对象或结果作出的可检验陈述。用户看到的“当前主张”只是某个 Claim revision 的当前呈现，不代表历史版本消失。

**协议层**：`Claim` 对象及其不可变 `ClaimRevision`；关系始终指向具体 revision。新的 revision 可以 supersede 前一 revision，但不能原地编辑旧内容。

**技术详情标签**：稳定 ID `claimId`；不可变 revision `claimRevisionId`；当前状态 `currentState`（例如待验证、已接受或受质疑）；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Evidence｜证据

**自然语言层**：支持、反驳、限定或复现某个具体主张修订版的可定位材料。证据不是证据数量，也不是自动生成的真伪分数。

**协议层**：`Evidence` 对象；其关系目标必须是不可变 `ClaimRevision`，并保留到 Artifact、Run、外部来源或采集过程的 provenance。

**技术详情标签**：稳定 ID `evidenceId`；不可变 revision `evidenceRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；内容完整性 `rawHash` / `semanticHash`；来源 `signature`。

### Verification receipt｜验证回执

**自然语言层**：一次验证活动留下的可复查收据，说明依据什么规则、在什么上下文中、对哪个主张修订版得到什么结果。回执不是把复杂判断压成一个分数。

**协议层**：`VerificationReceipt` 对象；冻结目标 Claim revision 与 Contract/Policy revision，并可关联 Finding、Run 与独立性信息。

**技术详情标签**：稳定 ID `receiptId`；不可变 revision `receiptRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Finding｜发现

**自然语言层**：验证或研究过程中发现的具体观察、限制、风险或问题。发现应能回到相关证据和验证回执，而不是只保留一句摘要。

**协议层**：`Finding` 对象；它通常由 `VerificationReceipt` 定位，并保留严重性、代码、位置、来源片段等可解释信息。

**技术详情标签**：稳定 ID `findingId`；不可变 revision `findingRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Challenge｜质疑

**自然语言层**：对某个主张、证据或验证结论提出的可追踪质疑。质疑可以被支持、驳回或解决，但不会抹除被质疑对象的历史。

**协议层**：`Challenge` 对象；它记录提出者、理由、影响对象、回应和由研究事件推进的状态。

**技术详情标签**：稳定 ID `challengeId`；不可变 revision `challengeRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

### Frontier snapshot｜前沿快照

**自然语言层**：某个发布时点可供后续研究使用的一组冻结结论。快照回答“当时哪些主张可被带走，以及依据是什么”，不会悄悄替换成最新结论。

**协议层**：`FrontierSnapshot` 对象；它固定成员 Claim revisions、选择依据和前后快照差异，可通过链式 revision 继续生成新快照。

**技术详情标签**：稳定 ID `frontierSnapshotId`；不可变 revision `frontierSnapshotRevisionId`；当前状态 `currentState`；Policy `policyId` + `policyRevision`；成员集合 `claimRevisionIds`；完整性 `hash`；来源 `signature`。

### Research event｜研究事件

**自然语言层**：记录研究对象发生了什么变化的事件，例如创建、修订、关联、验证或提出质疑。事件让当前状态可以被解释和追溯。

**协议层**：`ResearchEvent` envelope；事件按顺序追加，携带不可变 payload、父事件关系和对象引用。事件是历史记录，不是对旧记录的覆盖操作。

**技术详情标签**：稳定 ID `eventId`；不可变 revision `eventRevisionId`（事件本身不可改）；当前状态 `currentState`（仅表示处理或投影状态）；Policy `policyId` + `policyRevision`；完整性 `hash`；来源 `signature`。

## 用户语言边界

用户默认看到问题、任务、尝试、主张、证据、回执、发现、质疑和快照的自然语言解释，以及可读的当前状态。需要审计时再展开稳定 ID、具体 revision、Policy、hash、signature 和来源关系。

本词典不把数据库表名、代码仓库名、内部路由、堆栈跟踪或原始 API 错误暴露为用户词汇。底层失败应转换为可理解的上下文、影响和下一步；保留必要的技术详情时，也应放在技术层而不是自然语言默认层。
