# M13.6-A07：变化等级与解释规则

> 本文冻结四种变化等级的语义和解释边界。它是面向阅读的协议契约，不定义 watch、subscription、event projector、notification 或 home UI 的实现。

## 1. 核心边界

`critical`、`attention`、`update`、`quiet` 表示**注意优先级**：读者应该多快查看变化，以及变化可能需要多少上下文。它们不表示真值、接受状态、置信度、证据质量、科学共识、风险已经解除，或 Claim 应该被采纳。

变化等级不能由 Evidence 数量、颜色、百分比、支持率或任何未携带算法与来源的派生分数生成。每一个非 `quiet` 结论必须能回到至少一个正式 `ResearchEvent`；该事件及其影响对象的稳定 ID、精确 revision 和可用的 Receipt、Finding、Challenge 或 Frontier snapshot 必须保留。

`quiet` 只表示：在已经声明的观察窗口中，没有观察到符合本契约的 qualifying event。它绝不表示安全、正确、无争议、无人挑战、没有新信息，或系统已经检查完毕。

## 2. 观察边界与输入

每次分类必须声明：

- `asOf`：观察截止时间，包含不晚于该时间的事件；
- `window`：观察窗口。默认是 `[asOf - 7d, asOf]`，调用方可以选择更短或更长的窗口，但必须把实际起止时间和时区显示出来；
- `objectScope`：对象类型和稳定 ID，例如 `projectId`、`questionId`、`claimId + claimRevisionId`；
- `visibilityScope`：读者可见且被纳入判断的事件范围；不可见记录不能被当作不存在；
- 事件排序依据：协议事件顺序优先，时间戳只在协议允许的情况下用于展示，`eventId` 只作为仍然并列时的稳定次序。

“Qualifying event”是窗口内、属于 `objectScope` 或其明确影响范围、并且确实改变研究状态、关系、Evidence、Verification、Finding、Challenge 或 Frontier 成员资格的正式事件。仅访问、读取、展示或重新投影，不算 qualifying event，除非已有协议明确规定其改变研究状态。

若事件的可见性、关联对象、排序或窗口边界不足以支持判断，不得把结果写成 `quiet`；应明确标注“来源范围不足，无法判定变化等级”。这不是第五个等级，而是分类前置条件未满足。

## 3. 四级分类

### 3.1 `critical`：需要尽快查看

**触发条件**

窗口内至少有一个明确影响当前对象或其下游使用范围的高影响事件，包括：

- Claim revision 进入 `refuted` 或 `retracted`；
- 当前 Frontier 的成员、依赖或可用性受到污染，或某 Claim revision 被移除、替换并明确影响当前阅读对象；
- 新增或升级为 `critical` 的未解决 Finding，且该 Finding 关联目标 Claim revision、Verification receipt 或其明确下游；
- 正式 Challenge 被 `upheld`，并记录了对目标 Claim revision 或下游 Frontier 的影响；
- 其他协议事件明确表明当前对象的既有使用前提被阻断或需要立即重新审查。

“有严重名称”本身不够：必须有事件和对象关系证明其影响范围。`critical` 不等价于“该 Claim 为假”，而是“该变化的注意时效最高”。

**解释文案**

主文案：`需要尽快查看：研究状态或使用前提发生了高影响变化。`

根据事件补充一条事实文案，例如：`Claim revision {claimRevisionId} 被标记为 refuted；请查看对应的 Challenge、Finding 和 Verification 依据。`

禁止写成：`已证伪`、`不可信`、`风险已确认` 或任何把注意优先级改写成真值判断的句子。

**ResearchEvent 与对象 provenance**

至少展示作为主依据的 `eventId`、`eventType`、事件顺序或时间、`entity_type` 与对象 ID；对 Claim 必须带 `claimId + claimRevisionId`。按事件类型补充关联的 `findingId + findingRevisionId + receiptId`、`challengeId + challengeRevisionId + policyRevisionId`，或 `frontierSnapshotId + snapshotRevisionId + affected claimRevisionId`。可用时同时提供 actor、parent event、hash、signature／包含证明和永久链接。主依据之外的同窗口事件不得被静默丢弃。

**并列与降级规则**

- 同一对象同时有多个等级时，取最高等级；`critical` 优先于所有较低等级。
- 多个 `critical` 并列时，优先展示协议顺序最新且影响范围最明确的事件，保留全部并列依据；若仍并列，以稳定 `eventId` 排序，不以文案或数量猜测。
- 后续普通 revision、支持 Evidence 或无关事件不能自动降级 `critical`。
- 只有窗口内较新的正式事件明确解决、撤销或替代原 `critical` 影响时，才允许重新分类；重新分类必须同时链接原事件和解决/替代事件。若仍有未解决的 `critical` Finding、有效的高影响 Challenge 或 Frontier 污染，保持 `critical`。
- 窗口内没有新事件不能降级；窗口截断也不能把未解决的高影响事件变成 `quiet`。

### 3.2 `attention`：应优先查看

**触发条件**

窗口内至少有一个需要读者理解争议、阻塞或反向影响的事件，但未满足 `critical`，包括：

- Claim 或相关对象进入 `contested`；
- 新增或升级为 `major` 的未解决 Finding；
- 新增 `refutes` Evidence，或新增 Evidence 明确限制适用范围、改变 Verification 解释，但尚未达到 `critical`；
- Challenge 被创建、进入调查，或记录了明确的待处理影响；
- Verification outcome、independence profile、Policy/Contract revision 或 Frontier 成员变化要求重新阅读上下文，但尚未阻断当前使用。

**解释文案**

主文案：`建议优先查看：这里出现了争议、限制或待处理的研究变化。`

补充文案必须说清对象和事实，例如：`新增一项 major Finding，关联 Verification receipt {receiptId}；请查看影响位置和当前解决状态。` 或 `出现新的反驳 Evidence，目标是 Claim revision {claimRevisionId}；这不单独决定 Claim 的真值。`

**ResearchEvent 与对象 provenance**

展示触发事件的 `eventId`、`eventType`、顺序／时间、目标对象 ID 与 revision；Evidence 变化附 `evidenceId + evidenceRevisionId + relationType + claimRevisionId`，Verification 变化附 `receiptId + receiptRevisionId + contractRevisionId + policyRevisionId`，Finding 或 Challenge 变化附其稳定 ID、revision 和目标。事件 payload、actor、parent、hash、signature／包含证明和相关永久链接按可见性提供。

**并列与降级规则**

- 若同时存在 `critical`，整体分类为 `critical`，不得用 `attention` 覆盖它。
- 同级并列按协议事件顺序最新优先，`eventId` 仅作最终稳定 tie-break；保留会改变解释的全部来源。
- 新的 `critical` 事件可升级；新的 `update` 不能掩盖仍未解决的 `attention` 影响。
- 只有后续正式事件明确解决、关闭、撤回或替代触发影响，且没有更高或同级未解决影响时，才可降为 `update`；无新事件、已读、超时或用户未点击不构成降级理由。

### 3.3 `update`：有变化，按常规查看

**触发条件**

窗口内有 qualifying event，但其记录的影响不属于 `critical` 或 `attention`，包括新增或修订 Claim/Evidence、普通 Claim revision、`supports`／`qualifies`／`reproduces` 关系、一般 Verification 结果、普通 Frontier 成员变化，或项目、问题、任务、Attempt 的可追溯状态推进。

事件虽然是“正向”或“常规”变化，也只能分类为注意优先级；`update` 不表示支持成立、结果正确或风险较低。

**解释文案**

主文案：`有新的研究变化：建议在方便时查看更新内容。`

补充文案必须描述事实而非评价，例如：`新增一条 supports Evidence，目标为 Claim revision {claimRevisionId}。`、`Claim revision {claimRevisionId} 发生修订；上一版本仍可追溯。` 或 `Frontier snapshot {frontierSnapshotId} 新增成员 {claimRevisionId}。`

**ResearchEvent 与对象 provenance**

展示至少一个触发 `ResearchEvent` 的 `eventId`、`eventType`、顺序／时间、对象稳定 ID 与受影响 revision。关系变化附 source、target 和 relation type；Evidence 附 `evidenceId` 与目标 `claimRevisionId`；Frontier 附 snapshot 与成员 revision；Verification 附 receipt、Contract/Policy revision。可用时保留 actor、hash、signature／包含证明和父事件链。

**并列与降级规则**

- `critical` 或 `attention` 一旦存在，整体分类分别上调为对应等级。
- 同级按协议顺序最新优先，稳定 `eventId` 作为最终 tie-break；多条会影响“发生了什么”的事件都列为依据。
- `update` 不是对旧事件的清除。只有观察窗口内没有任何 qualifying event 时，才可产生 `quiet`；“更新已读”或“更新较旧”不改变这一事实。
- 若新的事件明确升级影响，立即升为相应高等级；若事件明确解决高等级影响，降级后仍应依据新的解决事件重新判断，不能直接跳到 `quiet`。

### 3.4 `quiet`：窗口内没有观察到符合条件的变化

**触发条件**

仅当同时满足以下条件：已声明 `asOf` 和明确 `window`；`objectScope`、`visibilityScope` 和事件排序完整；在窗口内没有观察到属于范围的 qualifying event。默认文案使用七日窗口，但必须把实际窗口写出来。

没有事件与“安全”“没有争议”“无人挑战”“没有 Evidence”“已被接受”或“已验证”为不同命题。窗口外的历史事件、不可见事件、未接入的事件源和无法排序的事件都不能被改写成窗口内没有变化。

**解释文案**

主文案：`在 {windowStart} 至 {asOf} 的已声明观察范围内，未观察到符合条件的研究变化。`

限定文案：`这不是安全、正确、无争议或无人挑战的结论；如需确认，请扩大时间或来源范围。`

**ResearchEvent 与对象 provenance**

`quiet` 没有可作为“发生依据”的事件，不能伪造 `eventId`。应展示分类的 `asOf`、窗口起止、对象范围、可见性范围和事件查询完整性；若产品需要说明最近已知历史，只能另列该事件的 `eventId`、对象 ID/revision 和时间，并明确它不属于本窗口的 qualifying event。

**并列与降级规则**

- `quiet` 只在没有任何 qualifying event 时成立；任意一个合格事件都会使分类至少变为 `update`，或按其影响升级。
- `quiet` 不是比 `update` 更低的安全等级，而是“窗口内无观察到变化”的注意状态。
- 不得因窗口结束、通知已读、用户忽略、没有订阅、查询为空、权限不足或事件投影延迟而自动赋予 `quiet`。
- 若完整性、可见性或排序变得不足，立即撤回 `quiet` 结论并标记来源范围不足；这不是把它降级为另一个等级。

## 4. 统一决策顺序

分类按以下顺序解释，避免把历史和当前状态混淆：

1. 固定 `asOf`、`window`、`objectScope` 和 `visibilityScope`，确认事件输入可见且可排序。
2. 只选取窗口内与对象有明确关系的 qualifying event，并保留每个事件的对象 ID 与 revision。
3. 按事件记录的影响匹配 `critical`、`attention`、`update`；若集合为空且输入完整，才匹配 `quiet`。
4. 采用 `critical > attention > update` 的最高优先级；同级以协议顺序最新为主事件，`eventId` 仅作最终稳定 tie-break，并展示其余解释性来源。
5. 任何降级都必须由较新的正式事件明确解决、关闭、撤回或替代旧影响；沉默、已读、过期、数量减少和窗口滚动都不是降级事件。

最终呈现必须同时回答三件事：**发生了什么**（事实文案）、**为什么需要这样快看**（注意优先级，不是真值判断）、**依据在哪里**（ResearchEvent 及对象 provenance）。
