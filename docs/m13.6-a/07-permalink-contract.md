# M13.6-A07：对象永久链接与阅读上下文契约

## 目的与边界

本契约定义面向人的、中文优先的研究对象永久链接（permalink）和可恢复的阅读上下文。永久链接用于定位研究记录及其明确的不可变锚点；阅读上下文只用于恢复用户当时的阅读入口、选择和展开方式。它不定义 Next 路由、页面实现、handoff 格式、OpenGraph 代码、API、读取模型或授权实现。

链接不得把研究图谱压缩为父子树，也不得把关系、证据、回执或快照解释为真伪、支持度或可信度分数。页面默认使用中文自然语言；本契约中的英文参数名和对象名仅为可审计的技术细节。

## 规范用语

- **规范永久链接**：只含规范路径和必要的不可变选择器；不含阅读上下文。它是复制“对象链接”时的默认结果。
- **带上下文链接**：规范永久链接加上本契约允许的查询参数。它可用于刷新或分享后恢复阅读状态，但不会改变规范对象。
- **规范不可变选择器**：能够唯一指向已冻结研究记录、revision、snapshot 或 event 的最小选择器。选择器位于路径，不以“当前”“最新”或可变状态代替。
- **阅读上下文**：`view`、`selection`、`expansion`、关系上下文、过滤上下文和观察边界；它是提示而不是授权凭据，也不是对象内容的载体。

除明确标为可选的上下文参数外，任何省略、无法解析或不可见的上下文均不得被补全、猜测或改写成别的对象或 revision。

## 稳定对象路径

路径段均为小写复数英文名；对象 ID 是不透明标识，必须原样保留。下表中的路径模式是稳定的公共语义，不规定具体 Web 框架或文件系统中的路由实现。

| 对象 | 规范不可变选择器 | 规范路径模式 | 约束 |
| --- | --- | --- | --- |
| 项目（Project） | `projectId` | `/projects/{projectId}` | 指向项目记录身份；页面中的当前投影必须标明自己的观察边界。 |
| 问题（Question） | `questionId` | `/questions/{questionId}` | 指向问题身份，不把它伪装成某个 Claim 的父节点。 |
| 任务（Task） | `taskId` | `/tasks/{taskId}` | 指向工作安排身份；可变状态由可追溯事件解释。 |
| 主张修订版（Claim revision） | `claimId` + `claimRevisionId` | `/claims/{claimId}/revisions/{claimRevisionId}` | **必须**同时出现两者；禁止 `/claims/{claimId}`、`latest` 或“当前 revision”作为可分享的 Claim 永久链接。 |
| 证据（Evidence） | `evidenceId` + 其不可变内容锚点 | `/evidence/{evidenceId}` | 页面必须显示并可追溯到该证据的 `evidenceRevisionId` 或内容 hash；若目标不是唯一冻结内容，链接不得称为永久链接。 |
| 验证回执（VerificationReceipt） | `receiptId` | `/verification-receipts/{receiptId}` | 回执本身不可变，且必须保留目标 `claimRevisionId` 与适用的 contract/policy revision。 |
| 发现（Finding） | `findingId` + 其不可变 revision 锚点 | `/findings/{findingId}` | 页面必须显示并可追溯到 `findingRevisionId`；不得将可变处置状态写入选择器。 |
| 质疑（Challenge） | `challengeId` + 其不可变 revision 锚点 | `/challenges/{challengeId}` | 页面必须显示并可追溯到 `challengeRevisionId`；活跃/已解决等状态属于阅读内容而非路径替身。 |
| 前沿快照（Frontier snapshot） | `frontierSnapshotId` | `/frontier/{frontierSnapshotId}` | **必须**指向明确快照；禁止“当前前沿”“最新快照”或以 `claimId` 集合代替快照。成员始终是该快照冻结的 `claimRevisionId[]`。 |
| 研究事件（ResearchEvent） | `eventId` | `/events/{eventId}` | 事件不可变且可排序；页面可显示其影响对象，但不以影响对象替换事件选择器。 |

对于 Evidence、Finding 和 Challenge，路径的稳定对象身份与页面展示的不可变内容锚点共同构成规范不可变选择器。实现不得在 URL 中虚构未定义的 revision 字段；若已知记录不能解析到唯一的冻结 revision 或 hash，必须明确显示“无法定位到不可变版本”，而不是静默指向当前内容。

## 阅读上下文

带上下文链接使用查询参数。所有参数均可选，且只能细化阅读方式；删除所有参数后仍必须得到上表所定义的同一规范对象。

| 语义 | 参数 | 允许值与规则 |
| --- | --- | --- |
| 阅读视图 | `view` | `argument`、`evidence`、`verification`、`frontier` 或 `record`。缺省为对象适用的 `record`，不得从链接发送者的权限或历史推断。 |
| 选择 | `sel` | 可重复。每项为已在页面可见范围内的对象选择器，例如 `claim:{claimId}@{claimRevisionId}`、`evidence:{evidenceId}@{hash}`、`receipt:{receiptId}`、`event:{eventId}`。选择不会改变路径目标。 |
| 展开 | `expand` | 可重复；仅允许受控的公开枚举：`provenance`、`history`、`relations`、`evidence`、`receipts`、`findings`、`challenges`、`members`、`events`。不允许自由字段路径、查询语句或内容片段。 |
| 关系上下文 | `rel` | 可重复。格式为 `{direction}:{relation}`，其中 `direction` 为 `in` 或 `out`，`relation` 是适用于对象类型的 canonical relation 枚举。关系方向固定为 source 到 target；该参数仅决定阅读焦点，不新增关系。 |
| 过滤上下文 | `filter` | 可重复。只允许公开、可枚举的谓词和值，例如 `state:active`、`outcome:inconclusive`、`severity:major`、`relation:supports`。过滤仅缩小当前已授权且已声明的输入集；不得携带全文、对象内容、任意表达式、SQL、正则或未受限 ID 列表。 |
| 观察边界 | `as_of` | 仅允许 `event:{eventId}` 或服务端定义的等价可排序事件边界。它说明读取截至何处；不是“最新”的别名，也不得修改路径所选 revision 或 snapshot。 |

`sel` 中 Claim 必须包含 `claimRevisionId`；Frontier 成员选择必须包含快照中的精确 `claimRevisionId`。关系和过滤结果必须保留输入集定义、`as_of`（如有）和各自的对象锚点；空集、未知、未提供和不适用必须继续彼此区分。

一个带上下文链接示意如下（示例 ID 均为占位符）：

```text
/claims/clm_7/revisions/clmr_12?view=evidence&sel=evidence%3Aev_4%40sha256_abc&expand=provenance&rel=in%3Asupports&as_of=event%3Aevt_9
```

该示例仍然只选择 `clm_7` 的 `clmr_12`；它不表示“当前 Claim”，也不使 `ev_4`、`evt_9` 在查看者无权读取时变得可见。

## 规范化与编码

1. 路径和参数名使用 ASCII 小写；对象 ID、revision ID、hash 与 event ID 视为不透明、区分大小写的协议值，禁止大小写折叠、别名替换、截断或重写。
2. 人类可读标签、搜索词和自由文本不得进入永久链接。若允许的枚举值含 Unicode，先按 Unicode NFC 规范化，再以 UTF-8 的 RFC 3986 百分号编码表示；空格必须编码为 `%20`，不得使用 `+`；十六进制字母使用大写。
3. 生成时按参数名排序；同名的可重复参数按其规范化后的完整值字典序排序，并去除完全重复项。路径末尾不得附加 `/`，除非它是根路径；不得保留空参数、未知参数或无效参数。
4. 解析后重新生成链接时必须产生唯一规范形式。无效、重复或与路径目标不一致的上下文项应被忽略并以可理解方式提示；不得改写路径目标、升级为当前 revision，或把错误项转化为更宽的筛选。
5. `filter` 的键和值及 `rel` 的 relation 均必须属于该对象和视图的受控枚举。未知枚举、重复语义冲突、超过实现公布上限的上下文项，均不得触发隐式的全量查询。

## 刷新、分享与授权

刷新和接收分享链接时，系统应先按当前查看者的授权、项目范围和可见性规则解析路径对象，再逐项应用可见且有效的阅读上下文。上下文恢复的优先级是：规范对象、观察边界、视图、选择、展开、关系、过滤。它不得扩大授权、跨越项目边界、绕过对象级可见性，或将不可见对象解释为“不存在”。

若路径对象不可访问，按现有授权语义处理，且不得泄露其存在、标题、关系、revision、成员数量或过滤结果。若路径对象可访问而某个上下文选择不可访问，只恢复其余可安全恢复的上下文，并将该项视为“不可恢复”，而不是将其替换为相邻对象、当前 revision 或空集结论。分享者与接收者可因权限不同而看到不同的可见子集；规范对象的 ID/revision/snapshot/event 锚点不得因此改变。

`as_of` 只能约束已经获准读取的历史范围。它不能使后来撤销权限的内容重新可见，也不能利用错误、计数、排序或缺失提示推断私有记录。

## URL 安全边界

永久链接和阅读上下文中严禁出现以下内容：

- 凭据、密码、API key、cookie、会话 ID、访问 token、refresh token、CSRF token、bearer token；
- 签名的私有 payload、可复用授权断言、临时下载签名、预签名资源地址或任何将授权能力嵌入 URL 的数据；
- 未受限的私有对象数据、研究正文、证据原文、附件内容、个人数据、内部错误、堆栈、任意查询或自由文本过滤；
- 通过压缩、加密、base64、JSON blob 或哈希片段规避以上禁止项的等价载荷。

链接只可传递受控枚举、不可变对象标识和本契约限定的阅读提示。任何需要私有内容或授权状态的恢复，必须在链接之外、通过接收者自己的当前授权会话完成。

## 一致性要求

- 同一对象的“复制链接”必须输出不含查询参数的规范永久链接；“分享当前阅读”才可输出带上下文链接。
- Claim 的任何分享链接都必须显式定位到一个 `claimRevisionId`；Frontier 的任何分享链接都必须显式定位到一个 `frontierSnapshotId`。
- 从 Argument、Evidence、Verification 或 Frontier 视图跳转时，路径选择器不得静默换成最新对象、另一 revision 或另一个 snapshot。
- 所有可恢复的聚合、关系、筛选和状态叙述都必须服从可见性和 `as_of`，并保留足以追溯的对象锚点；它们不是授权、真伪判断或支持度评分。
