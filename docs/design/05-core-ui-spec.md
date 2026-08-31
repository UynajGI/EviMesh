# 05 · 核心界面规格（社区主径）

> **状态（2026-08-29）：current。** §2 Home 的内容契约有效（实现见 10 §4.6-4.7）；10 §4.5 的"瀑布流发现流"已被 `11-revision-decisions.md` §5 撤销，不再构成本章的替代规格。后续增量契约（topics、研究者目录等）见各节标注与 11 章。

> 对应设计稿：`html/landing.html`、`html/home.html`、`html/explore.html`、`html/work.html`、`html/workspace.html`、`html/claim.html`。设计稿是视觉参考，不再是当前实现的事实源。
> 本章冻结每个页面的内容契约：回答什么问题、必须出现什么、禁止出现什么。视觉规则见 02 至 04 章，组件见 09 章。

## 全局壳契约（所有产品页共享）

- 全局 Header（56px，sticky）：品牌入口、一级导航 Home / Explore / Work / Agent / Docs（≤6 项）、全局搜索（含 `/` 快捷键提示）、通知、主题切换（cycle：跟随系统 → 手动覆盖并持久化）、账户。
- 匿名态：导航退化为 Explore / Agent / Docs + 「登录」outline 按钮；不显示账户与通知。
- 每页首个可聚焦元素是 skip-link「跳到主要内容」。
- 页脚为薄页脚：设计稿标注 + 规范链接；生产替换为协议版本与状态链接。
- `demo-notice`：演示 fixture 必须可辨识（M13.7 契约：演示数据不伪装成实时内容）。生产页不渲染此条。

## 1. 匿名 Landing（landing.html）

**回答的问题**：EviMesh 是什么、可信从哪来、下一步去哪。

内容契约（M13.7 7.1 四件事，全部要有）：

1. 一句话定位（hero，左对齐，≤2 行，副文案 ≤20 词）+ 两条路径 CTA：「连接你的 Agent」（primary）/「浏览公开研究」（outline）。全页只此一组 CTA，同一意图只用一个标签。
2. 一个真实公开研究示例卡：问题标题、active 徽标、Frontier 快照号、代表性主张两条（一条 provisionally_accepted、一条 contested，展示状态可见性）、证据分组计数、归属链（人类 + agent）、进入工作区链接。
3. 信任机制四条（发丝线列表，不做卡片墙）：ORCID 验证身份 / revision 不可变 / 签名事件链 / 公开可分享。
4. 演示数据标注。

**禁止**：空列表充当叙事、营销渐变、版本角标、滚动提示、logo 墙。

## 2. 登录后 Home（home.html）

**回答的问题**：我关注的研究发生了什么变化，哪些需要我尽快看。

内容契约：

- PageHeader 声明观察窗口（asOf + window，含时区）与「变化等级只表示注意优先级」的免责句（M13.6-A07 文案规范）。
- 变化流按四级分组渲染，组头带计数徽标：
  - **critical**：badge--emphasis-danger + 主文案「需要尽快查看：研究状态或使用前提发生了高影响变化。」+ 事实句 + 依据区（对象徽标、idchip、到准确 revision/event 的链接）。
  - **attention**：warning 双档图标 + 发生了什么 + 为什么重要 + 去向链接。
  - **update**：info 图标 + 事实 + 展开入口。
  - **quiet**：折叠区，circle-dashed 图标，附「quiet 不代表安全或无争议」说明。
- 每条变化三问齐全：发生了什么 / 为什么重要 / 依据在哪里（链接到 revision 或 event）。
- 右栏：My work 计数入口、Agent 连接状态（含 human-in-the-loop 待确认警示）、最近访问。
- 时间显示相对时间 + tabular-nums；不显示「热度」。

**禁止**：红点未读焦虑设计、按热度排序、把数量换算成百分比。

## 3. Explore（explore.html）

**回答的问题**：平台上有什么值得看、可参与。

内容契约：

- 单一搜索框（大号）+ 类型 tabs（全部 / 问题 / 项目 / 主题 / 研究者）+ 筛选按钮（状态、时间、可参与性）。
- 结果卡顺序回答：类型徽标 → 标题 → 一句范围描述 → 阶段/最近变化/可参与性 meta → 动作（阅读 / 交给 Agent）。
- 稳定 ID 不占阅读位（放「技术详情」或 idchip 收纳）。
- 右栏：主题索引（计数）+ 排序依据（最近变化 / 最新创建 / 标题序）。排序区必须带「不提供热度排序」说明。
- 研究者结果卡显示 ORCID 已验证标记与近 30 天公开贡献计数（计数不是分数）。

## 4. Work（work.html）

**回答的问题**：我现在能做什么。

内容契约（五个 tab）：

- **任务**：状态徽标（active·已租赁 / open / blocked·等待上游）+ 租赁剩余时间 + 两类动作（交给 Agent 执行 = primary 风格入口；手动提交回执 = ghost 回退路径）。
- **验证队列**：顶部 info alert 解释「回执记录 outcome、独立性与发现，不产生总分」；盲验证任务明确 context_mode: blind 且不展示预期输出；需要签名密钥的提示。
- **质疑**：需要我回应的质疑（状态、提出者、反例摘要、影响范围、窗口剩余）；强调回应进入事件历史、不删除记录。
- **草稿**：本地草稿卡（agent 起草 / 手动），「审阅并签名」为 primary（human-in-the-loop 入口）。
- **贡献记录**：rolebar（六角色计数条 + 文字数值）+ role 徽标时间线；「只记录事件与角色，不构成评分」。

## 5. 研究工作区（workspace.html，Question 容器）

**回答的问题**：这个研究现在到什么阶段、争议与阻塞在哪、我能做什么。

内容契约：

- 面包屑：Explore → 项目 → 问题。PageHeader：类型/状态徽标、idchip、标题、Contract revision、创建与最近变化 meta。
- 动作区：关注（outline）/ 分享此快照（outline）/ **交给 Agent 继续（primary，全页唯一主动作）**。
- 六个 URL 可寻址视角（tabs，键盘可达）：
  1. **Summary**：若存在 critical 影响，首屏 danger alert（M13.6-A07 文案）；研究范围卡（ResearchContract r 的四字段 deflist）；当前 Frontier 卡（快照号、成员数、上一快照链接）；主要争议与验证阻塞卡；开放任务卡。
  2. **Current frontier**：成员表（主张 / revision / 状态 / 快照内状态），受影响成员用 danger 徽标标出；导出 bundle 按钮；历史快照永久可访问说明。
  3. **Argument**：默认展示 Frontier 内主张 + 高关注主张，渐进展开；每条提供「展开证据、验证与下游」链接；顶部说明「主张之间是 14 种有向关系构成的 DAG，不是父子树」。
  4. **Evidence**：四分组卡（supports / refutes / qualifies / reproduces），每条证据显示 idchip 前缀 + 一句事实。
  5. **Verification & challenges**：回执表（回执 ID / 目标 revision / outcome 徽标 / 独立性 mono / Finding severity+code）+ 质疑卡（investigating 等）。
  6. **Activity**：timeline 事件行 = 图标徽标 + 自然语言 + actor 归属链（人或 agent 区分）+ evt id + 相对时间；技术详情一层展开 hash/签名/父事件。
- Frontier 快照号、Contract revision、Policy revision 在摘要与详情中保持一致呈现。

## 6. 主张详情（claim.html）

**回答的问题**：这个主张说了什么、可信状态如何、依据与上下游是什么。

内容契约：

- PageHeader：类型徽标 + 状态徽标（provisionally_accepted 等）+ Frontier membership 徽标 + idchip；**statement 用 `.claim-statement`（serif 阅读模式）渲染在页头**，不用 H1 重复修辞化标题。
- meta：当前 revision、归属链（人类 + agent 起草）、r 发布时间。
- 主体两栏：
  - 左栏：
    1. 陈述与结构化字段卡（Scope / Assumptions / Falsification / Policy deflist）。
    2. 异构研究邻域：Graph 与键盘可达的 Relationship Index **同屏呈现**，桌面为 7:5、移动端上下堆叠，不使用 Graph/List tab；默认 both，可切 upstream/downstream、depth 1..3、type 与 state。d3-dag 只负责初始 Sugiyama 排布，React Flow 画布支持平移、缩放、节点本地拖拽、框选、fit/focus 与全屏，拖拽不写回协议图；节点以 family 形状 + Lucide 图标 + 明文类型共同编码，边保留方向、线型与可读标签。Relationship Index 按 `Upstream/Downstream → Node type → Relation → rows` 分组，每行明示 type、title、relation、distance、state 与 `ID@revision`，并与画布共享 selection/filter 模型。
    3. 修订历史卡：r(n) vs r(n-1) 字段级 diff（`diff__line--add/--del`），作者归属链 + evt id；「任何修订不覆盖旧版本」提示。
    4. 技术详情 `<details>` 折叠：稳定 ID、semantic_hash、raw_hash、最近事件签名、PolicyEvaluation。
  - 右栏状态摘要卡：证据四分组计数（含最近变化时间）、验证 outcome 分布 + 独立性 + 最高未解决 Finding 徽标、活跃质疑、Frontier 成员身份；底部固定文案「计数是导航入口，不是支持度分数」+ 生成 handoff 按钮。

**禁止**：把 evidence 计数画成进度条或百分比；隐藏 refuted/contested 等状态；把 DAG 渲染为单父树。
