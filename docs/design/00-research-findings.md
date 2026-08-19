# EviMesh UI 设计调研报告

> **元信息**
> - 日期：2026-08-19
> - 作者角色：UI/UX 设计研究员（本文件只做调研，不做界面设计）
> - 调研范围：开源设计系统与组件基线、科研平台 UI、开发者社区壳、DAG/图可视化、透明历史/审计 UI、Agent 时代 UI、无 gamification 社区模式、数据密集排版与可访问性。
> - 调研方法：仓库内文档用 Read/Grep 实读；外部来源用 WebFetch + npm/jsdelivr 注册表抓取。每条结论尽量带来源 URL。无法访问的站点换来源或标注"基于公开已知模式"，不臆造。
> - 约束前提：本报告尊重 EviMesh 硬约束 —— **无标量真相分/支持度分**、**无点赞/排行榜/推荐算法**、**Claim 关系是 14 种有向 DAG 而非父子树**、**revision 不可变**。
>
> **如何被设计书使用**：本报告的每个小节都以"模式描述 → 来源 → EviMesh 借鉴/避免决策"组织。第 10 节是直接喂给《EviMesh UI 设计书》的决策清单，可据此写 CSS token 和画高保真 HTML。文中出现的数值（对比度、间距、尺寸、token 值）可直接复用。

---

## 1. 执行摘要（10 条最关键设计结论）

1. **采用 Primer 的"functional token"分层 + EviMesh 品牌覆写**。Primer 用 `fgColor-* / bgColor-* / borderColor-*` 三层命名（property + role + emphasis/muted 变体），暗色模式靠"同名 token 换值"实现（`--bgColor-default: #ffffff → #0d1117`）。EviMesh 已有 `--evimesh-*` 语义 token，应补齐 **emphasis/muted 双档状态色** 与 **component 层 token**，即可获得 Primer 级主题能力而不复制 GitHub 品牌。（来源：`@primer/primitives` 11.10.0 `dist/css/functional/themes/light.css`，见 2.1）

2. **状态色必须成对提供 "muted 底 + emphasis 底 + 同色文字"，且颜色绝不能是唯一载体**。Primer 的每个语义角色都有 `-muted`（浅底，用于选中/信息）与 `-emphasis`（实底，用于徽标/强调）。EviMesh 的 Claim 11 态、Finding 4 级、Verification outcome、Change 4 级都应走这套徽标 = **文本标签 + 语义底色 + 图标（可选）**，文本先行。（来源：2.1 token 列表；3.2 OpenReview 结构化字段）

3. **VerificationReceipt 摘要借鉴 OpenReview 的"多字段结构化回执"而非单一分数**。OpenReview 官方评审表单字段为 `title / review / rating(10-1) / confidence(5-1)`，decision 表单为 `title / decision(Accept Oral|Poster|Reject) / comment`。EviMesh 应呈现 **outcome + 验证类型 + implementation/data 独立性 + Finding(severity) + contract revision**，用"字段化卡片"承载，天然避免把证据压成分数。（来源：OpenReview Default Review/Decision Form，见 3.3）

4. **身份呈现遵循 ORCID 官方展示规范**：已验证 iD 必须"官方图标（不改）+ 完整 URL `https://orcid.org/XXXX-XXXX-XXXX-XXXX` + 可点击 + alt/ARIA"；图标 SVG、常态 24×24px、紧凑 16×16px、深色背景用白色反白版；未认证 iD 必须用特殊图标并标注 "(unauthenticated)"。这是 M13.7 的硬合规项。（来源：ORCID iD display guidelines，见 3.1）

5. **Agent 作为一等参与者**：借鉴 MCP 客户端的 "Connectors" 连接模型（选客户端 → 输 URL → OAuth → 配工具权限），以及 GitHub Copilot coding agent 的"bot 身份 + 会话日志 + 完成后 @ 人 review"模式。EviMesh 的 agent 身份卡应显示：**归属（某人/某组织）+ 模型 + 工具/scope + 签名公钥指纹 + 最后活动时间**，并在每条 agent 产出上挂"by X's agent Y"归属链。（来源：MCP connect-remote-servers、GitHub changelog，见 7）

6. **DAG 渲染选型：d3-dag（Sugiyama 分层布局）做布局引擎 + 轻量自绘 SVG/HTML 做展示层**。d3-dag 是 TypeScript-first、bundle 远小于 elkjs（~500KB 转译 Java）、提供 Sugiyama/Zherebko/Grid 三种布局、并可作为 React Flow 的 dagre 替身。**纯 HTML 设计稿阶段用内联 SVG 手绘分层 DAG 示意即可**，不引入运行时依赖。（来源：d3-dag README via jsdelivr，见 5）

7. **透明历史用"区块浏览器 + Git commit"的复合模式**：事件行 = 事件类型徽标 + actor（人/agent 区分）+ 相对时间 + 对象链接 + hash 前缀（可复制）；hash/签名放"技术详情"折叠层，默认自然语言。普通科研用户看到的是"谁在何时改了什么、可追溯到哪个 revision"，不是裸 hash 墙。（来源：3.6、5，模式来自 Etherscan/Git 公开已知实践）

8. **活跃感来自"watchlist 变化流 + 贡献记录"，不来自点赞**。借鉴 GitHub watch/notification 的"订阅 → 收件箱 → 按 reason 分类"模型，但把 reason 换成 EviMesh 的 change taxonomy（critical/attention/update/quiet）。**不提供热度排序、不提供 upvote**；贡献可视化用"按贡献者聚合的事件列表 + 角色徽标"，而非热度图（heat map 易被误读为质量分，见 8）。（来源：GitHub notifications 文档，4；M13.6-A02/A03）

9. **数据密集排版三件套**：`tabular-nums`（MDN 已确认用于表格数字对齐）、等宽栈渲染 ID/hash/时间戳、长 ID 截断规则（前缀 + 前 6 位 + `…` + 后 4 位，hover/点击复制全值）。对比度工程沿用现有 `test/token-contrast.test.mjs` 的 ≥4.5:1 门禁，并为暗色单独调值（不是简单反色）。（来源：MDN `font-variant-numeric`，见 9）

10. **可访问性按 WCAG 2.2 AA 落地，关键三条**：焦点环 2px、`focus-visible`、在任何表面可见（EviMesh 已有）；指针目标 ≥24×24 CSS px（SC 2.5.8 AA，Primer 用 `--control-minTarget-coarse: 2.75rem`=44px 兼容触控）；键盘焦点不被作者内容完全遮挡（SC 2.4.11 AA）。DAG 图必须配"键盘可达的列表等价视图"（EviMesh C11 已有此约束，继续保留）。（来源：W3C WCAG22 TR，见 9）

---

## 2. 开源设计系统与组件基线

### 2.1 GitHub Primer（Primer React + Primer Primitives）

**模式描述。**
Primer 是 GitHub 的设计系统，分为"设计 token 层（`@primer/primitives`）"与"组件层（`@primer/react`）"。通过 npm/jsdelivr 实读 `@primer/primitives@11.10.0` 与 `@primer/react@38.35.1`，确认以下事实：

- **组件清单（权威，来自 `@primer/react@38.35.1` 包目录）**：`ActionBar, ActionList, ActionMenu, AnchoredOverlay, Autocomplete, Avatar, AvatarStack, Banner, Blankslate, BranchName, Breadcrumbs, Button, ButtonGroup, Card, Checkbox, CheckboxGroup, CircleBadge, ConfirmationDialog, CounterLabel, DataTable, Details, Dialog, FilteredActionList, FilteredSearch, Flash, FormControl, Header, Heading, Hidden, InlineMessage, IssueLabel, KeybindingHint, Label, LabelGroup, Link, NavList, Octicon, Overlay, PageHeader, PageLayout, Pagehead, Pagination, Popover, Portal, ProgressBar, Radio, RadioGroup, RelativeTime, ScrollableRegion, SegmentedControl, Select, SelectPanel, Skeleton, SkeletonAvatar, SkeletonText, Spinner, SplitPageLayout, Stack, StateLabel, SubNav, TabNav, Tabs, Text, TextInput, TextInputWithTokens, Textarea, Timeline, ToggleSwitch, Token, Tooltip, TopicTag, TreeView, Truncate, UnderlineNav, UnderlinePanels, VisuallyHidden`。
  - 与 EviMesh 最相关：`NavList`（上下文侧栏）、`PageHeader`（页眉 + 面包屑 + 动作区）、`UnderlineNav/Tabs`（工作区视角切换）、`DataTable`（数据密集表格）、`TreeView`（层级）、`Timeline`（事件流）、`Banner/Flash/Label/StateLabel`（状态反馈）、`Breadcrumbs`、`SegmentedControl`、`Blankslate`（空态）、`Skeleton*`（加载）。
- **Token 三层命名（权威，来自 `light.css`）**：functional token 采用 `{property}{Color}-{role}` 命名：
  - 前景：`--fgColor-default:#1f2328`、`--fgColor-muted:#59636e`、`--fgColor-accent:#0969da`、`--fgColor-success:#1a7f37`、`--fgColor-attention:#9a6700`、`--fgColor-danger:#d1242f`、`--fgColor-severe:#bc4c00`、`--fgColor-done:#8250df`、`--fgColor-neutral:#59636e`、`--fgColor-onEmphasis:#ffffff`、`--fgColor-link: var(--fgColor-accent)`。
  - 背景：`--bgColor-default:#ffffff`、`--bgColor-muted:#f6f8fa`、`--bgColor-inset: var(--bgColor-muted)`、`--bgColor-emphasis`（实底）、`--bgColor-accent-muted:#ddf4ff`（信息/选中浅底），且每个语义角色都有 `-muted` 与 `-emphasis` 双档（`accent/success/attention/danger/severe/done/open/closed/neutral/draft/sponsors/upsell`）。
  - 边框：`--borderColor-default:#d1d9e0`、`--borderColor-muted`、以及每个角色的 `-muted/-emphasis` 边框。
  - 每个 token 自带用途注释（如 "Subtle accent background for informational or selected elements"），即 **semantic pairing**。
- **暗色模式 = 同名 token 换值（权威，来自 `dark.css`）**：`--bgColor-default:#0d1117`、`--bgColor-muted:#151b23`、`--borderColor-default:#3d444d`、`--fgColor-default:#f0f6fc`、`--fgColor-accent:#4493f8`、`--bgColor-accent-muted:#388bfd1a`（带 alpha）。结论：暗色不是反色，而是对同一组语义 token 重新取值。
- **多主题与可访问主题**：`@primer/primitives` 内置 14 套主题 CSS —— `light / dark / dark-dimmed`，加 `high-contrast`、`colorblind`、`tritanopia` 的 light/dark 变体。这是"以 token 覆写实现多主题 + 无障碍主题"的成熟范例。
- **间距与控件 token（权威）**：`--space-xxs:0.125rem(2px) / xs:0.25rem(4px) / sm:0.5rem(8px) / md:0.75rem(12px) / lg:1rem(16px) / xl:1.5rem(24px)`（4px 基线）。控件尺寸 `--control-medium-size:2rem`、`--control-large-size:2.5rem`，`--control-minTarget-coarse:2.75rem(44px)`、`--control-minTarget-fine:1rem`，`paddingInline` 有 `condensed/normal/spacious` 三档。

**来源。**
- `@primer/react@38.35.1` 组件目录（jsdelivr data API）。
- `@primer/primitives@11.10.0` `dist/css/functional/themes/light.css`、`dark.css`、`functional/spacing/space.css`、`functional/size/size.css`（jsdelivr CDN 实读）。
- 官方文档入口：<https://primer.style/product/components/>、<https://primer.style/foundations/color/overview>（站点为 JS 渲染，WebFetch 仅得首页壳，故 token/组件事实以包内产物为准）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：采用 Primer 的 token 分层思想与命名纪律，落到 EviMesh 自己的 `--evimesh-*`：
  1. 为每个状态角色补 **`-muted`（浅底）+ `-emphasis`（实底）+ 同色 foreground** 三件套；现有 `globals.css` 只有单档 `--evimesh-success/-warning/-info/-destructive`，需要扩展为可承载徽标底色的浅档（参考 `#ddf4ff` 这类浅色）与强调档。
  2. 用 `data-color-mode` / `.dark` 覆写实现暗色（EviMesh 现用 `@media (prefers-color-scheme: dark)`，可并存；建议加手动切换开关，见 9）。
  3. 借鉴 Primer 的控件 token（`--control-*-size`、`--control-minTarget-coarse:44px`）支撑"触控 ≥44px"承诺。
  4. 组件上以 **Primer React 的 NavList/PageHeader/UnderlineNav/DataTable/Timeline/Banner/Blankslate 模式为实现基线**（与 M13.7-A06 ADR 一致），通过 EviMesh 适配层覆写品牌 token。
- **避免**：不复制 GitHub 品牌色（`#0969da` 仅作参照，EviMesh 用 hue 255 蓝灰）、不引入 Octicon 图标库（避免 GitHub 视觉污染）、不把 `open/closed/done/sponsors/upsell` 这类 GitHub 特有角色照搬；EviMesh 只需 `accent/success/attention(severe)/danger/neutral` 五档语义角色映射到自己的状态体系。

### 2.2 Radix UI Primitives

**模式描述。** Radix Primitives 是"低层、无样式、可访问"的组件原语库。官方文档明确：组件"ship without styles"，因此可适配任何样式方案；无障碍覆盖"aria 与 role 属性、焦点管理、键盘导航"，覆盖 accordion、checkbox、combobox、dialog、dropdown、select、slider、tooltip 等。

**来源。** <https://www.radix-ui.com/primitives/docs/overview/introduction>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：Radix 作为"行为层"与 Primer/shadcn 作为"视觉层"可共存。EviMesh 已在 `components/ui/dialog.js` 等用 Radix 做焦点管理（M13.5-B08 记载）。继续用 Radix 承载 Dialog/Tooltip/Select/Switch/Tabs 的键盘与 ARIA 语义，视觉用 EviMesh token。
- **避免**：不要同时引入多套"带样式"组件库（Primer + Radix + MUI 混用）——M13.7 非目标已禁止。边界应为：**Radix 管交互行为，EviMesh token 管视觉，Primer 模式管页面结构**。

### 2.3 shadcn/ui

**模式描述。** shadcn/ui 自我定位为"一套设计良好、可访问的组件 + 代码分发平台"，**不是组件库**，而是"你如何构建自己的组件库"。其主题用一组 CSS 变量定义（`--background/--foreground` 默认底色与文字、`--card` 抬升表面、`--primary` 高强调动作与品牌面、`--muted` 低调表面、`--accent` 交互 hover/focus/active、`--destructive` 危险、`--border` 默认边框、`--ring` 焦点环），暗色模式通过"在 `.dark` 选择器内覆写同一组 token"实现；默认圆角 `--radius: 0.625rem`。

**来源。** <https://ui.shadcn.com/docs>、<https://ui.shadcn.com/docs/theming>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh 现有 `globals.css` 的 token 结构（background/foreground/card/muted/secondary/accent/border/primary/destructive/ring）**与 shadcn/ui 几乎同构**，说明既有选择是主流且可维护的。保留此骨架，仅按 2.1 补齐 `-muted/-emphasis` 双档与 component 层。
- **避免**：不要把 shadcn/ui 的默认视觉（`--radius:0.625rem`、其默认灰）直接套到 EviMesh；EviMesh 已用 hue 255 蓝灰与 `rounded-lg(0.75rem)/md(0.5rem)/sm(0.375rem)`，保持既有圆角体系。

### 2.4 Tailwind CSS v4 语义 token

**模式描述。** Tailwind v4 用 `@theme` 指令定义"设计 token 即 CSS 变量"：`@theme { --color-mint-500: oklch(...) }` 既生成 `var(--color-mint-500)`，又生成 `bg-mint-500 / text-mint-500 / fill-mint-500` 等工具类。命名空间 `--color-*` 对应颜色工具类；可用 `--color-*: initial` 清空默认调色板只保留自定义 token。

**来源。** <https://tailwindcss.com/docs/theme>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh 已用 `@theme inline { --color-*: var(--evimesh-*) }` 把语义 token 桥接成 Tailwind 工具类——这正是 v4 推荐的"语义 token → 工具类"做法，保留。
- **避免**：不要在组件里混用"Tailwind 默认调色板（`bg-red-500`）"与语义 token；应像 Primer 一样只用语义 token。建议在 `@theme` 里 `--color-*: initial` 关掉默认色板，强制只走 `--evimesh-*`，从工具层杜绝 raw color。

### 2.5 Geist / Vercel 设计语言

**模式描述。** Geist 是 Vercel 的体验工具包，覆盖 color、type、materials、layout、components，强调"高对比、可访问的色彩系统""用 Geist Sans + Geist Mono 排版""网格是 Vercel 美学的核心"。其排版类把 `font-size/line-height/letter-spacing/font-weight` 预设成组合，scale 分为 headings(72–14)、buttons(16–12)、labels(20–12, 含 mono)、copy(24–13, 含 mono)；labels 面向单行，copy 面向多行，支持 subtle/strong 强调。

**来源。** <https://vercel.com/geist/introduction>、<https://vercel.com/geist/typography>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：Geist 的"排版类 = 字号+行高+字距+字重的预设组合"思路值得借鉴——EviMesh 应把"页面标题/区块标题/卡片标题/元数据行"固化为少数几个排版工具类，而不是散落 `text-xl font-semibold`。mono 用于 labels/数据与 EviMesh 的 `tabular-nums + mono` 方向一致。
- **避免**：不引入 Geist 字体（继续用系统 UI 栈 + mono 栈，M13.5-B02 已定），只借其"组合式排版"的组织方式。

---

## 3. 科研平台 UI 模式

### 3.1 ORCID 身份呈现（硬合规项）

**模式描述。** ORCID 官方展示规范（WebFetch 实读）：
- 展示的 iD **必须伴随 ORCID iD 图标**；提供三种布局——Full / Compact / Inline。
- 记录链接优先用**完整 URL** `https://orcid.org/XXXX-XXXX-XXXX-XXXX`（含 `https://`）；交互式展示应做成超链接，并带 alt/ARIA label。
- **官方图标不得修改**；优先 SVG；最佳尺寸 24×24px，紧凑 16×16px，空间允许可更大；常态用绿色图标，深色/无障碍背景用黑白高对比或白色反白版。
- **已验证（authenticated）iD** 来自 ORCID 的 authenticated workflow，用常态认证图标 + 完整 URL；**未认证 iD** 必须用特殊图标并标注 "(unauthenticated)"。

**来源。** <https://info.orcid.org/documentation/integration-guide/orcid-id-display-guidelines/>；签名/验证流程见 <https://info.orcid.org/documentation/integration-guide/orcid-oauth-sign-in-guidelines/>、<https://info.orcid.org/documentation/integration-guide/minimum-requirements-for-member-integrations/>（均被 M13.7 引用）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：研究者公开资料页、贡献者列表、Claim/Verification 署名处，统一用"官方 ORCID 图标 + 完整可点击 URL"组件；深色模式自动切换反白图标。
- **避免**：绝不手填 iD 后显示为已验证（M13.7 硬约束）；不裁切/改色 ORCID 图标；不把 iD 缩成纯数字串。

### 3.2 arXiv（含版本呈现）

**模式描述。** arXiv 摘要页（以 `arXiv:2401.04088` 为例，WebFetch 实读）元素：学科分类、arXiv ID + 日期、论文标题、作者列表、获取链接（PDF 等）、摘要（Abstract）、备注（Comments）、学科类别、DOI 链接、引用标识、**版本历史（Submission history）**、引用/书目小部件。**版本以 `[v1]` + 时间戳列出**，引用区把基础标识与该副本的 `arXiv:2401.04088v1` 分开。

**来源。** <https://arxiv.org/abs/2401.04088>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh 的 Claim revision 呈现可参考 arXiv 的"稳定 ID + 单调版本号 `[vN]` + 时间戳"的极简版本行；稳定 ID（`claim_<uuidv7>`）类似 arXiv ID，revision 类似 `vN`。摘要页"元数据块 + 摘要正文 + 版本历史"的结构适合 Claim 详情页的"statement + scope + revision history"。
- **避免**：arXiv 视觉陈旧、无状态语义；EviMesh 只借其"版本行 + 稳定 ID"信息结构，不借其排版密度失控的呈现。

### 3.3 OpenReview（最接近 EviMesh 验证语义）

**模式描述。** OpenReview 的评审 UI 建立在 **forum（论文线程）+ note（评审/评论/决定）** 模型上。通过官方 Default Forms 文档（WebFetch 实读）确认：
- **Default Review Form** 字段：`title`（评审简述）、`review`（评估 quality/clarity/originality/significance，含 pros/cons）、`rating`（10–1 量表）、`confidence`（5–1 量表）。
  - rating 量表：10 "Top 5% / seminal"，9 "strong accept"，8 "clear accept"，7 "Good paper, accept"，6 略高于录用线，5 略低于，4 okay but insufficient，3 clear rejection，2 strong rejection，1 trivial or wrong。
  - confidence 量表：5 fully certain & very familiar，4 confident not certain，3 fairly sure，2 may miss core parts，1 educated guess。
- **Default Decision Form** 字段：`title`（"Paper Decision"）、`decision`（`Accept (Oral)` / `Accept (Poster)` / `Reject`）、`comment`（可选）；API v2 用 select，v1 用 radio。

**来源。** <https://docs.openreview.net/reference/default-forms/default-review-form>、<https://docs.openreview.net/reference/default-forms/default-decision-form>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：这是 VerificationReceipt 的最佳参照。EviMesh 应把回执渲染成**字段化卡片**：`outcome`（类比 decision，用枚举徽标）+ 验证类型 + `implementation independence` / `data independence`（类比 confidence，用明确标签而非分数）+ Finding 列表（severity 徽标）+ 目标 `claimId@revision` 与 `contractId@revision`（类比被评审对象）。"结构化多字段 + 明确枚举"天然规避标量真相分。
- **避免**：**不引入 rating 10–1 量表**——那正是 EviMesh 要拒绝的"单一分数"。OpenReview 的 confidence 应转译为"独立性分类 + 依据可追溯"，而不是置信度数值。

### 3.4 Zenodo（DOI / 版本 / 完整性）

**模式描述。** Zenodo 记录页（以 record 10527678 为例，WebFetch 实读）：标题、作者、发布日期、"Version v1"；**DOI 在 Details 下以 "DOI" + "DOI Badge" 呈现**，Badge 提供 Markdown/reStructuredText/HTML/Image URL/Target URL 多种引用格式；"Versions" 标题 + 用量统计区分"All versions / This version"；**Files 面板列出文件名、大小、md5 checksum、操作（Download all / Preview / Download）**；元数据按标签块分组（Description / Additional details / Related works / Keywords and subjects / Rights / Technical metadata）。

**来源。** <https://zenodo.org/records/10527678>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh 的 Artifact/Evidence 页应仿 Zenodo 的 **Files 面板**：文件名 + 大小 + **hash（raw_hash/semantic_hash 前缀 + 复制）** + 下载/预览；版本区仿"All versions / This version"区分"该 Claim 全部 revision / 当前 revision"。DOI Badge 的"多格式引用导出"启发了 EviMesh 的"不可变分享链接 + Markdown/YAML/JSON 导出"（P8）。
- **避免**：Zenodo 用量统计（下载量）易被误读为影响力，EviMesh 不展示任何"热度/用量"类数字。

### 3.5 Hugging Face、Semantic Scholar、PubPeer、eLife（基于公开已知模式 + 部分实读）

> 注：huggingface.co 与部分站点在本环境被拦截（connect timeout / bot-gate），以下结论以公开已知产品模式为准，实读到的部分单独标注。

- **Hugging Face Papers / Spaces / Discussions**：HF Daily Papers 用"标题 + 作者 + upvote 计数 + 摘要/缩略图"的列表，社区通过 upvote 表达关注，论文页链接到对应 models/datasets。**EviMesh 决策**：借"研究对象 ↔ 可执行产物（model/dataset）互链"的信息结构（对应 Claim ↔ Evidence/Artifact/Run 互链），**拒绝 upvote 计数**（违反无 gamification 约束）。
- **Semantic Scholar**：论文页提供 **TLDR**（一句话 AI 摘要）、citation count、influential citations、references/citations、figures。**EviMesh 决策**：借"TLDR 式一句话概要"作为 Claim 的"自然语言摘要"层（M13.6-A02 协议词典的自然语言入口思想一致）；**citation count 仅作为可追溯的入边数量呈现，不做排名信号**。
- **PubPeer**（实读首页）：定位"在线 journal club"，通过粘贴 DOI/PubMed ID/arXiv ID 定位文章并发表讨论/质疑。**EviMesh 决策**：Challenge 的"针对某 revision 提出可追踪质疑"与 PubPeer 的 post-publication critique 同构；借鉴其"质疑锚定到具体对象 + 线程化回应"，但 EviMesh 的 Challenge 有状态机（open→admissible→investigating→upheld/rejected/resolved）与事件审计，比 PubPeer 更结构化。
- **eLife**（实读 about 页）：读者获得"每篇论文的详细评估（detailed assessments of every paper）"，采用 publish-review-curate（PRC）模型，公开评审与文章一同发布。**EviMesh 决策**：借"评审/验证与结论同屏、而非隐藏"的透明度——EviMesh 的 Verification/Finding 应与 Claim 同屏可达；借鉴 eLife 的 editor assessment 用"结构化评估块"呈现。

**来源（部分实读）**：<https://pubpeer.com/>、<https://elifesciences.org/about>；HF/Semantic Scholar 为公开已知模式（官方站点 <https://huggingface.co/papers>、<https://www.semanticscholar.org/>）。

### 3.6 科研排版与可信度信号小结

- **serif 正文？** 学术阅读传统用 serif，但数据密集的产品界面（GitHub/OpenReview）普遍 sans-serif。EviMesh 作为"科研状态阅读器"，正文用 sans（清晰、高密度），**把 serif 保留给"长篇 statement/论证正文"的阅读模式**（可选）。默认 UI 用系统 sans 栈（M13.5-B02 已定）。
- **可信度信号的正确载体**：ORCID 认证图标、签名/签名者、revision 不可变性、独立性标签、Finding 明细——**全部是"可追溯证据"，而非分数或热度**。这是 EviMesh 与一切"影响力指标"产品的根本分界。

---

## 4. 开发者社区壳模式

### 4.1 Watch / Follow 与通知

**模式描述。** GitHub 通知模型（WebFetch 实读官方文档）：通知是"你订阅的 GitHub 活动"，用户选择"活动类型"与"送达方式"，用 **inbox 收件箱**来"自定义、分诊、管理更新"，并可"跨 email 与 mobile 快速分诊同步"；提供"多种退订方式"与"定期回顾订阅与已 watch 仓库"。watch 有三档（Not watching / Watching / Ignore），通知按 reason 分类。

**来源。** <https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github>（WebFetch 实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh Home 的 Watchlist 变化流应采用"inbox + reason 分诊"心智：用户关注 Question/Project/Claim 后，变化按 **change taxonomy（critical/attention/update/quiet）** 分组呈现，每条变化带"是什么、为何重要、指向哪个 revision/event"。这是 GitHub 通知模型到科研语义的直接映射。
- **避免**：不建"未读计数焦虑"式的红点轰炸；change level 只表达**注意优先级**，不表达真伪（M13.7-A03 Job 3 已明确）。

### 4.2 Activity feed 与"无点赞的活跃感"

**模式描述。** GitHub 的活跃感来自"贡献活动流 + contribution graph + release/PR/issue 事件"，而非点赞。Profile 页用贡献热图（heatmap）展示一年内的活动密度；activity feed 按时间倒序列出 push/PR/issue/star 等事件类型。

**来源。** GitHub profile/notifications 官方文档（<https://docs.github.com/en/account-and-profile/...>，基于公开已知模式）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：活跃感用"**事件类型徽标 + actor + 相对时间 + 对象链接**"的活动流构造；个人/Agent 资料页展示"可追溯的公开贡献、验证、参与项目"（M13.7 5.3）。
- **避免**：**贡献热图（contribution heatmap）对 EviMesh 风险较高**——色块密度易被误读为"贡献质量/研究价值"。建议用"**按贡献者聚合的事件列表 + 贡献角色徽标（originator/contributor/reviewer/verifier/witness/maintainer）**"替代 heat map；若保留轻量活动指示，须配"仅表示活动时间，不表示质量"的说明。

### 4.3 Release 页与 Compare/Diff 视图

**模式描述。** GitHub Release 页以"版本号 + 发布时间 + changelog + 资产下载"呈现；compare/diff 视图用"左右/统一 diff、行级 +/- 着色、文件级折叠"展示两个 ref 之间的差异。

**来源。** GitHub releases / compare 公开已知模式（<https://docs.github.com/en/repositories/releasing-projects-on-github>）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：**Frontier snapshot 之间的差异**可借 compare/diff 的"文件级折叠 + 行级增删"模式：显示"Frontier 23 → 24 新增/移除/替换了哪些 Claim revision"。**Claim revision 之间的字段级 diff**（M13.5-C10 已有 revision-diff）应沿用"字段级变化 + 作者/时间徽标 + 长文本换行"。
- **避免**：diff 着色只用 success/danger 语义色表示增删，不引入第三种装饰色。

---

## 5. DAG 与图可视化方案对比

### 5.1 候选库事实（实读 npm/jsdelivr）

| 库 | 版本 | 官方描述（实读） | 定位 |
| --- | --- | --- | --- |
| `@xyflow/react`（React Flow） | 12.11.3 | "高度可定制的 React 库，用于构建 node-based 编辑器与交互式流程图" | React 交互式节点图；节点/边为纯对象（id/position/data；id/source/target）；可与 dagre/elk 布局集成；有 Accessibility 指南与 AriaLabelConfig |
| `d3-dag` | latest | "用于可视化有向无环图的布局算法" | **TypeScript-first、轻量 DAG 布局引擎**；Sugiyama / Zherebko / Grid 三布局；可作 React Flow 的 dagre 替身 |
| `cytoscape` | latest | "用于分析与可视化的图论（网络）库" | 成熟网络图库，多布局 + 图分析（中心性、路径） |
| `sigma` | 3.0.3 | "面向可视化成千上万节点与边的 JavaScript 库" | WebGL 大图渲染 |
| `elkjs` | 0.12.0 | "基于 Sugiyama 算法的自动图布局，专攻数据流图与端口" | 布局引擎（~500KB 转译 Java，较重） |
| `dagre` | latest | "JavaScript 图布局" | 经典分层布局（d3-dag 的前身/对照） |

**来源。** npm registry（`@xyflow/react`、`d3-dag`、`cytoscape`、`sigma`、`elkjs`、`dagre` 的 `latest` 元数据，curl 实读）；d3-dag README（jsdelivr GitHub 镜像实读）；React Flow <https://reactflow.dev/learn>（WebFetch 实读）。

### 5.2 d3-dag 关键细节（实读 README）

- 提供 **Sugiyama（分层/layered，经典 DAG 布局，适合引文/依赖图）**、**Zherebko（线性拓扑布局）**、**Grid（网格拓扑布局）** 三种算法。
- dagre 兼容 API（`rankdir/nodesep/rankersep`），可 `dagre.layout(grf, sugiyama().decross(decrossOpt()).coord(coordQuad()))` 渐进升级算法。
- **质量预设**：`fast`（simplex 分层 + DFS decross + greedy 坐标，184 节点约 5.1ms）、`medium`（默认，约 49ms）、`slow`（最优 decross，仅小图）。交互式场景用 `fast`。
- **bundle 远小于 elkjs（~500KB 转译 Java）**；TypeScript-first、泛型操作符、不可变 builder。
- 可作为 React Flow 的 **dagre drop-in 替身**。

**来源。** d3-dag README（`https://cdn.jsdelivr.net/gh/erikbrinkman/d3-dag@main/README.md`，curl 实读）。

### 5.3 选型建议表（EviMesh Claim DAG）

| 需求 | 推荐 | 理由 |
| --- | --- | --- |
| 布局算法（分层、可读、方向清晰） | **d3-dag Sugiyama** | 专为 DAG 设计；Sugiyama 分层最贴合"依赖/支持/反驳"的上下游阅读；轻量；可调 `rankdir` TB/LR |
| 交互层（React） | **React Flow（@xyflow/react）** | 成熟的节点交互、缩放、minimap、a11y 指南；用 d3-dag 做布局引擎 |
| 纯 HTML 高保真设计稿阶段 | **内联 SVG 手绘分层 DAG** | 不引入运行时依赖；用 `<svg>` + 分层 `<g>` + 节点 `<rect>/<text>` + 边 `<path>` 示意即可；节点状态用"底色 + 文本徽标 + 边框"编码 |
| 大图（>1k 节点）性能 | sigma（WebGL）或虚拟化 + 分层聚合 | 仅当真实图谱超大才需要；EviMesh 初期按 Project/Question 子图渲染即可 |
| 图分析（中心性/路径） | cytoscape | 如需"关键依赖路径"分析再引入；UI 展示不必 |

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：Claim DAG 用"d3-dag Sugiyama 布局 + React Flow 交互"，方向默认 TB（上游在上、下游在下）或 LR；**14 种边类型用"边颜色/线型 + 边标签 + 图例"区分**，且**颜色不能是唯一载体**——边上必须有可读 relation 标签（`supports/refutes/...`）或可 hover/选中展开。节点状态编码同样"底色 + 文本徽标"双通道。
- **避免**：**不把 DAG 渲染成树**（无单一父节点）；**不隐藏 revision 上下文**（选中节点要能看到所指 revision）；**必须提供键盘可达的列表等价视图**（EviMesh C11 已有 Graph/List 切换约束，保留并作为一等公民）。纯 HTML 稿阶段避免引入真实图库，用手绘 SVG 表达即可。

---

## 6. 透明历史与审计 UI

**模式描述（区块浏览器 + Git + CI 日志的复合范式）。**
> 注：Etherscan 在本环境被拦截（connect timeout），以下为其公开已知呈现模式，结合 Git/GitHub Actions 实读常识。

- **区块浏览器（Etherscan 类）**：交易详情页以"字段标签 + 值"的垂直列表呈现 —— Transaction Hash（可复制）、Status（Success/Pending/Fail 徽标）、Block、Timestamp（相对 + 绝对）、From → To（地址，带箭头与合约标识）、Value、Transaction Fee、Nonce、Input Data（折叠的原始数据）。核心是"**每个字段一行、可复制、状态用徽标、原始数据折叠**"。
- **Git commit 历史**：每行 = 提交信息 + 作者 + 相对时间 + commit hash 前缀（可点击复制完整）；展开看 diff。
- **GitHub Actions 运行日志**：run 列表（状态徽标 + 触发 + 时长）→ 单 run 的 job 树 → 单 job 的分步日志（可折叠、可搜索、行号）。

**来源。** Git/GitHub Actions 公开已知模式（<https://docs.github.com/en/actions>）；Etherscan 呈现为公开已知模式（官方站点被本环境拦截）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh ResearchEvent 时间线采用同一范式——
  - **事件行** = 事件类型徽标（created/revised/related/verified/challenged，用自然语言动词）+ actor（人/agent/组织图标区分）+ 相对时间（hover 绝对时间）+ 对象链接（稳定 ID）+ `hash` 前缀（可复制）+ 父事件链接（可追溯链）。
  - **默认自然语言层**（M13.6-A02 协议词典），**技术详情（hash/signature/payload/parent event）放折叠层**，需要审计时展开——仿 Etherscan 的 Input Data 折叠。
  - 提供"按对象/按 actor/按类型"过滤，仿 Actions 的 run 筛选。
- **避免**：**不向普通科研用户呈现裸 hash 墙或原始 JSON**；hash/签名只在"追溯/校验"语境展开；原始 API 错误不外露（M13.5 已有 ErrorState 约束）。

---

## 7. Agent 时代的 UI 模式（agent 身份、活动流、handoff）

### 7.1 MCP 客户端连接 UX（实读，最高保真来源）

**模式描述。** MCP 官方"连接远程 server"文档（以 Claude 的 Custom Connectors 为例，WebFetch 全文实读）给出标准连接流程：
1. **进入 Connector 设置**（Settings → Connectors 侧栏）；
2. **添加自定义 Connector**：点 "Add" → "Add custom connector"，弹窗输入远程 server URL（含 `https://` 与路径）；
3. **完成认证**：多为 OAuth（也可能 API key / 用户名密码），可能跳转第三方认证页；
4. **访问资源与 prompts**：连接成功后，server 的 resources/prompts 出现在会话附件菜单（"Add files, connectors, and more" → Connectors → 选择具体 resource）；
5. **配置工具权限**：回到 Connector 设置，**启用/禁用具体 tool、设置用量限制与安全参数**。
- 最佳实践：连接前验证 server 真实性、只连可信来源、审视认证时请求的权限、按用途组织多个 connector、定期移除不再使用的 connector。

**来源。** <https://modelcontextprotocol.io/docs/develop/connect-remote-servers>（WebFetch 全文实读）；MCP 概念见 <https://modelcontextprotocol.io/introduction>（实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：M13.7 `/agent` Connection Center 的六步（选客户端 → 授权最小权限 → 复制/生成配置 → 测试连接 → 读取真实公开 Question → 查看来源/revision/handoff）与 MCP 官方流程高度一致，**直接对齐**：用"Connectors 列表 + 每项的状态/权限/撤销"承载已连接客户端；工具权限用"启用/禁用 + scope 说明"呈现。
- **避免**：不让新用户第一步就手贴长期 Token（M13.7 已定：设备/浏览器授权优先，Token 为高级路径）；Token 明文只展示一次、不进 URL/日志/handoff。

### 7.2 Agent 身份与活动呈现

**模式描述（基于公开已知模式）。**
- **GitHub Copilot coding agent**（实读 changelog 片段）：Copilot 以 bot/agent 身份工作，完成任务后"tag 你来 review"，请求的改动通过"在 PR 里留 comment"表达。其模式是"**agent 作为有身份的参与者 → 产出可审查的工件（PR）→ 完成后 @ 人**"。
- **Devin / Claude Code 类**：用"计划器（plan）+ 分步时间线（step/tool call）+ 工件视图（shell/editor/browser）+ 会话记录"呈现 agent 工作过程；human-in-the-loop 通过"权限确认/审批点"介入。
- **通用 agent 活动流模式**：`plan → step → tool call → observation → result` 的时间线，每个 tool call 显示工具名、输入摘要、输出/状态，可折叠。

**来源。** GitHub Copilot changelog <https://github.blog/changelog/2025-05-19-github-copilot-coding-agent-in-public-preview/>（部分实读）；Devin/Claude Code 为公开已知模式。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：
  - **Agent 身份卡**应包含：归属（某人/某组织，可链接）、模型、工具/scope、签名公钥指纹、最后活动时间、连接状态。这与 MCP Connector 卡 + GitHub bot 身份的结合。
  - **每条 agent 产出**（Claim/Evidence/Attempt）挂归属链："by `<user>` 的 agent `<agent>`"，可点到 agent 身份卡与产生它的 Attempt。
  - **Agent 活动流**用 `plan/step/tool call` 折叠时间线（仿 Devin/Claude Code），默认只展开关键节点，避免刷屏。
  - **human-in-the-loop** 用明确的"审批/确认点"呈现（如 Verification 最终提交经 Confirm，M13.5-D07 已有）。
- **避免**：不把 agent 伪装成人（必须可辨识为 agent）；不隐藏 agent 的模型/scope（透明是信任前提）；不把 agent 的"赞成"当成科学证明（P5：Agent 赞成只是可审计意见）。

### 7.3 Handoff / Continuation

**模式描述。** Agent handoff 的核心是把"明确意图 + 稳定对象标识 + 当前上下文 + 继续执行的入口"交给下一个执行通道，而**不携带凭据**。MCP 文档强调 handoff 应携带足够上下文恢复同一研究状态。

**来源。** M13.6-A02（仓库内）+ <https://modelcontextprotocol.io/docs/develop/connect-remote-servers>。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：EviMesh 的 handoff sheet（M13.6）应固化为结构化对象：`intent + 稳定 ID/revision + 当前视角（Argument/Evidence/Verification/Frontier）+ 永久链接 + 建议的 CLI/MCP 动作 + 所需 scope + 继续 URL`，**不含 Token/凭据/敏感 payload**。UI 上用"复制 handoff / 在 CLI 打开 / 交给我的 Agent"三个动作呈现。
- **避免**：handoff 不含 secrets；不假设浏览器能启动任意 MCP 客户端（提供可复制的自然语言任务 + CLI 命令 + 结构化 handoff）。

---

## 8. 无 gamification 的社区活跃感

**模式描述与反面教训（基于公开已知模式 + 已实读的 GitHub 通知模型）。**
- **订阅/关注/通知/邮件 digest 的成熟做法**：GitHub 的"watch 三档 + notification inbox + reason 分诊 + 多通道送达 + 定期回顾订阅"（4.1 已实读）是"无点赞的活跃感"最成熟范式。邮件 digest 按"自上次访问以来的变化"聚合，而非实时推送。
- **Stack Overflow 声誉系统的反面教训**：reputation/徽章驱动了"为分数而答"、刷票、抢答、答案同质化，并把"投票数"误当作"正确性"。这是把"社区信号"与"内容真伪"耦合的典型失败。
- **OpenReview 的多维评价替代单一分数**：用结构化多字段（rating + confidence + 明细 review）而非单一 like/dislike；EviMesh 更进一步——**连 rating 都不用**，改用 outcome + 独立性 + Finding。

**来源。** <https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github>（实读）；Stack Overflow / OpenReview 为公开已知模式（<https://stackoverflow.com/help/whats-reputation>、OpenReview Default Forms 已实读）。

**EviMesh 借鉴 / 避免决策。**
- **借鉴**：活跃感三件套 =（1）watchlist 变化流（change taxonomy 分组）；（2）按贡献者聚合的贡献记录 + 角色徽标；（3）可订阅的邮件 digest（"自上次访问以来的变化"）。全部围绕"可追溯的变化"，而非"人气"。
- **避免**：**不提供 upvote/like/star 计数、不提供排行榜、不提供推荐算法排序**（M13.7 非目标已明确）；Explore 的排序用"相关性/更新时间/状态/可参与性"等可解释维度，**不用热度**。

---

## 9. 数据密集排版与可访问性

### 9.1 数据排版

- **`tabular-nums`（实读）**：MDN 确认 `font-variant-numeric: tabular-nums`（对应 OpenType `tnum`）让数字等宽，便于表格/数据列对齐。EviMesh 已有 `.tabular-nums` 工具类与 `font-feature-settings:"tnum"`，保留并对所有 ID/hash/时间戳/计数应用。来源：<https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric>。
- **等宽数据列**：ID、hash、时间戳、命令用 `--font-mono` 栈；正文用 sans。
- **长 ID / hash 截断规则**（建议，综合 GitHub/Etherscan 公开模式）：`claim_` 前缀 + 前 6 位 + `…` + 后 4 位（如 `claim_01HXYZ…AB3F`），hover 显示全值 + 点击复制（带 "Copied" 反馈）。完整 hash 放技术详情层。
- **复制交互**：所有稳定 ID、hash、分享链接、handoff、CLI 命令都应有"一键复制 + 成功反馈"；示例代码默认用环境变量占位符（M13.7 6.2）。

### 9.2 深浅双主题对比度工程

- **策略（结合 Primer 实读）**：暗色不是反色，而是对同一组语义 token 重新取值。参考 Primer：`--bgColor-default #ffffff→#0d1117`、`--bgColor-muted #f6f8fa→#151b23`、`--borderColor-default #d1d9e0→#3d444d`、`--fgColor-default #1f2328→#f0f6fc`、`--fgColor-accent #0969da→#4493f8`、`--bgColor-accent-muted #ddf4ff→#388bfd1a`（暗色用 alpha 底）。
- **EviMesh 现状**：`globals.css` 已为 `prefers-color-scheme: dark` 单独取值（`--evimesh-background oklch(0.985...)→oklch(0.16...)` 等），方向正确。建议：（1）沿用 `test/token-contrast.test.mjs` 对 light/dark 双主题每对文本色 ≥4.5:1 的门禁；（2）为新增的 `-muted/-emphasis` 状态色在双主题下都过对比度；（3）提供手动主题切换（除跟随系统外），切换走 token 覆写。

### 9.3 WCAG 2.2 关键条款（实读 W3C TR）

- **SC 2.5.8 Target Size (Minimum)，AA**：指针目标 ≥ **24×24 CSS px**；例外含足够间距、等价合规控件、内联文本、未改动的 UA 尺寸、必要/法定呈现。来源：<https://www.w3.org/TR/WCAG22/#target-size-minimum>。
- **SC 2.4.11 Focus Not Obscured (Minimum)，AA**：键盘焦点组件不得被作者创建内容完全遮挡。
- **SC 2.4.13 Focus Appearance，AAA**：焦点指示器面积 ≥ 未聚焦项 2px 周长面积，且变化像素对比 ≥3:1。EviMesh 目标 AA，但可按 AAA 标准提升焦点可见性。
- **EviMesh 落地**：焦点环 2px + `focus-visible` + `outline-offset:2px`（已有）；触控目标取 Primer `--control-minTarget-coarse:44px`（比 24px 更稳）；DAG/图必须配键盘可达列表视图（C11 已有）。
- **reduced-motion**：尊重 `prefers-reduced-motion`，动效只服务反馈/层级/上下文切换（M13.6 MOTION 2-3），可整体降级为即时切换。

**来源。** <https://www.w3.org/TR/WCAG22/>（WebFetch 实读 focus-appearance、target-size-minimum 锚点）。

---

## 10. 综合结论：EviMesh 的设计机会与风险清单

### 10.1 直接喂给设计书的决策清单（DO）

| # | 决策 | 依据 |
| --- | --- | --- |
| D1 | Token 采用 Primer 式三层命名：`--evimesh-{fg/bg/border}-{role}` + 每角色 `-muted/-emphasis` 双档；暗色 = 同名 token 覆写 | 2.1 |
| D2 | 状态徽标 = 文本标签 + 语义底色 + （可选）图标，文本先行、颜色非唯一载体；覆盖 Claim 11 态、Finding 4 级、Verification outcome、Change 4 级、贡献角色 6 类 | 2.1 / 3.3 |
| D3 | VerificationReceipt 用字段化卡片（outcome/验证类型/独立性/Finding/目标 revision），不用分数 | 3.3 |
| D4 | ORCID 呈现 = 官方图标 + 完整 URL + 可点击 + alt/ARIA；深色用反白图标；未认证标注 (unauthenticated) | 3.1 |
| D5 | Claim revision 呈现 = 稳定 ID + `[vN]` + 时间戳 + "当前/历史"区分；diff 用字段级增删 | 3.2 / 4.3 |
| D6 | Artifact/Evidence 用 Zenodo 式 Files 面板（名/大小/hash 前缀/复制/下载） | 3.4 |
| D7 | Claim DAG = d3-dag Sugiyama 布局 + React Flow 交互 + 列表等价视图；14 种边带可读 relation 标签 | 5 |
| D8 | ResearchEvent 时间线 = 事件徽标 + actor（人/agent 区分）+ 相对时间 + 对象链接 + hash 前缀（折叠技术详情） | 6 |
| D9 | Agent 身份卡 = 归属 + 模型 + scope + 公钥指纹 + 状态；产出挂 "by X's agent Y" 归属链 | 7.2 |
| D10 | `/agent` Connection Center 对齐 MCP Connectors 流程；Token 为高级路径、明文一次性 | 7.1 |
| D11 | Home = watchlist 变化流（change taxonomy 分诊），无红点焦虑、无热度排序 | 4.1 / 8 |
| D12 | 排版：`tabular-nums` + mono 数据 + 长 ID 截断 + 一键复制；正文 sans、长论证可选 serif 阅读模式 | 9.1 / 3.6 |
| D13 | 可访问性：焦点环 2px focus-visible、目标 ≥24px（触控取 44px）、焦点不遮挡、reduced-motion、DAG 列表等价视图 | 9.3 |
| D14 | handoff sheet = intent + ID/revision + 视角 + 永久链接 + 建议动作 + scope + 继续 URL，不含凭据 | 7.3 |

### 10.2 风险清单（AVOID）

| # | 风险 | 为什么避免 |
| --- | --- | --- |
| R1 | 把 Evidence 数量/颜色/活跃度换算成支持度、真相分、质量分 | 硬约束；OpenReview/Stack Overflow 教训 |
| R2 | upvote/like/star/排行榜/推荐算法 | 硬约束；活跃感用 watchlist + 贡献记录替代 |
| R3 | 把 Claim DAG 渲染/叙述成父子树 | 硬约束；14 种有向边、多父、supersedes 非层级 |
| R4 | 隐藏 contested/refuted/retracted/dependency_tainted 状态 | 可信度依赖完整状态可见 |
| R5 | 用热度图（contribution heatmap）表达贡献价值 | 易被误读为质量分；用角色徽标 + 事件列表 |
| R6 | 手填 ORCID 显示为已验证 | M13.7 硬约束；仅 OAuth/OIDC 回调产生 verified |
| R7 | 新用户首选长期 Token；Token 进 URL/日志/handoff/前端持久化 | 安全；设备授权优先、明文一次性 |
| R8 | 同时引入多套带样式组件库（Primer+MUI+Ant） | M13.7 非目标；单一设计系统家族 |
| R9 | 向普通用户裸露 hash 墙/原始 JSON/原始 API 错误 | 用自然语言层 + 折叠技术详情 |
| R10 | 把 agent 伪装成人、隐藏模型/scope | 透明是 agent 信任前提 |
| R11 | 用 GitHub 品牌色/Octicon/仓库概念 | 只借 Primer 模式与 token 架构，不借品牌 |
| R12 | 暗色模式简单反色 | 应为语义 token 单独取值（Primer 范例） |

### 10.3 留给 Leader 决策的开放问题

1. **serif 阅读模式**是否纳入首版设计书（正文 sans 已定，长论证 serif 为可选项）。
2. **贡献可视化**最终形态：纯"角色徽标 + 事件列表"，还是保留一个极轻量、带"仅表时间不表质量"说明的活动指示。
3. **手动主题切换**是否纳入首版（现为跟随系统 `prefers-color-scheme`）。
4. **DAG 默认方向**：TB（上下游纵向）还是 LR（横向），需在原型中做一轮可读性验证。

---

## 附录：来源索引

**仓库内（实读）**
- `EviMesh_Roadmap_v0.3.md`（设计原则 P1-P10、参与者/权限、对象模型、Claim 状态机、Claim DAG、Frontier）
- `docs/m13.5-design-system.md`（视觉方向与 token）
- `docs/m13.6-a/00-agent-first-charter.md`、`01-protocol-ux-map.md`、`02-protocol-lexicon.md`
- `docs/m13.7-mature-product-identity-agent-onboarding.md`、`docs/m13.7-a/02-official-pattern-benchmark.md`、`03-researcher-jtbd-map.md`、`04-global-product-ia.md`
- `apps/web/app/globals.css`（现有 token 值）

**外部（WebFetch / npm / jsdelivr 实读，标注"实读"）**
- Primer：`@primer/react@38.35.1` 组件目录、`@primer/primitives@11.10.0` `light.css/dark.css/space.css/size.css`（jsdelivr，实读）；<https://primer.style/product/components/>（首页壳）
- Radix：<https://www.radix-ui.com/primitives/docs/overview/introduction>（实读）
- shadcn/ui：<https://ui.shadcn.com/docs>、<https://ui.shadcn.com/docs/theming>（实读）
- Tailwind v4：<https://tailwindcss.com/docs/theme>（实读）
- Geist：<https://vercel.com/geist/introduction>、<https://vercel.com/geist/typography>（实读）
- arXiv：<https://arxiv.org/abs/2401.04088>（实读）
- OpenReview：<https://docs.openreview.net/reference/default-forms/default-review-form>、`default-decision-form`（实读）
- Zenodo：<https://zenodo.org/records/10527678>（实读）
- ORCID：<https://info.orcid.org/documentation/integration-guide/orcid-id-display-guidelines/>（实读）；OAuth/minimum-requirements（被 M13.7 引用）
- PubPeer：<https://pubpeer.com/>（部分实读）；eLife：<https://elifesciences.org/about>（部分实读）
- MCP：<https://modelcontextprotocol.io/docs/develop/connect-remote-servers>、<https://modelcontextprotocol.io/introduction>（实读）
- GitHub notifications：<https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github>（部分实读）；Copilot changelog（部分实读）
- MDN：<https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric>（实读）
- W3C WCAG 2.2：<https://www.w3.org/TR/WCAG22/>（focus-appearance、target-size-minimum，实读）
- DAG 库：npm registry（`@xyflow/react`、`d3-dag`、`cytoscape`、`sigma`、`elkjs`、`dagre`，实读）；d3-dag README（jsdelivr，实读）；React Flow <https://reactflow.dev/learn>（实读）

**基于公开已知模式（站点被本环境拦截，已标注，未臆造具体数值）**
- Hugging Face Papers、Semantic Scholar TLDR、GitHub contribution graph / releases / Actions 日志、Etherscan 交易详情、Stack Overflow reputation、Devin / Claude Code 任务时间线。
