# EviMesh 前端 UI 修订计划

## 设计判断

**模式：Targeted evolution，不做推倒重来。**

现有协议 IA、三层 token、状态语义、DAG/list 双视图、Radix 焦点管理和 259 个 web 测试都是有效资产。真正的问题不是“缺一套设计系统”，而是：协议数据没有稳定映射到视觉层、页面过度复用同一构图、组件规范没有收紧、设计书与实现互相漂移。

**目标语言：现代科研基础设施。**

- 受众：研究者、验证者、Agent 开发者
- 气质：可信、精密、可追溯、工作导向
- `DESIGN_VARIANCE: 4`：克制但不机械，每类页面有独立构图
- `MOTION_INTENSITY: 2`：仅状态反馈、Dialog、复制等必要动效
- `VISUAL_DENSITY: 7`：比现在更紧凑，以行、分区和 rail 组织信息
- 保留亮/暗双主题、现有品牌色、Lucide 单图标族和现有 token 系统

## 不变边界

- 不改路由、一级导航标签和协议对象层级
- 不引入第二套组件库
- 计数永不变成分数、百分比、排行或进度条
- Agent 产出必须显示 Agent + 人类 owner/signer 归属链
- Claim graph 保持 14 类有向边、d3-dag + React Flow，并保留键盘可达 list 等价视图
- ORCID 只有 OAuth 验证后才能显示 verified
- 不用装饰性渐变、投影卡片、过量胶囊、营销式 dashboard 假数据

---

## Phase 0：裁决设计事实源

先把设计书从“历史记录”恢复成可信契约，避免实现继续追逐互相冲突的文档。

### 变更

1. 新增 `docs/design/11-revision-decisions.md`
   - 定义本轮设计原则、旋钮、页面分层和验收矩阵
   - 裁决 Home：当前 private watchlist 变化流是正式形态，不再保留 10 §4.5 未落地的瀑布发现流声明
   - 定义 demo-stack 的视觉验收用途
2. 更新 `05-core-ui-spec.md`
   - 同步 Home 终局规格
   - 回写 topics、actor directory、saved / For you 等后来只存在于 10 章的增量契约
3. 更新 `06-personal-ui-spec.md`、`07-emerging-ui-spec.md`
   - 将“未实现/雏形”改为当前真实状态
4. 更新 `10-implementation-map.md`
   - 把“已落地”“数据门控”“待修订”拆成明确状态列
5. 清理 `docs/design/html/*.html` 注释残文；mockup 只做视觉参考，不再冒充当前事实源

### DoD

- 每个设计章节有 `current / superseded / planned` 状态
- 05、10 对 Home 不再互相矛盾
- 文档测试机械锁定状态标记和本轮决策文件存在

---

## Phase 1：先修协议可信性数据链

这是视觉重构的前置条件。先让页面显示正确内容，否则任何样式判断都不可信。

### 1A. 修正 demo-stack 种子形状

`scripts/demo-stack.mjs` 当前有多处不符合真实 schema 的演示字段：

- evidence link：`relation` → `relation_type`
- verification outcome：`supported` → `supports`
- question 增加 `project_id`、规范 state
- question revision 增加 `title` / `statement`
- research contract 改为规范字段：problem、scope、exclusions、falsification、acceptableEvidence、progressCriteria 等
- project：`title` → `name`，补 summary
- contribution statement 对齐 `originator + claim.created`，让 drafted-by/signed-by 链真实生成
- frontier member 补 `membership_type`
- 修正事件时间与 event id 单调顺序

### 1B. 修生产数据映射缺口

- `apps/web/lib/hydrate.mjs`
  - evidence relation 防御性兼容 `relationType ?? relation`
- `apps/web/app/claims/[claimId]/page.js`
  - Frontier projectId 优先读 claim 自身，避免绕 question 才能显示
  - 修复 evidence/outcome 分组计数与水合后的真实数据一致
- `apps/api-edge/src/contribution-query.mjs`
  - identity card 返回 profile 的 `orcidId`、`affiliation`
- `apps/web/app/questions/[questionId]/page.js`
  - contract 字段映射到真实 schema；`acceptance` 回退到 `acceptableEvidence`
- `apps/web/app/explore/page.js`
  - project 显示 `name`
  - agent 结果复用 `Attribution`，不再裸显示 `by actor-atlas`
- claim 归属链使用现有 `Attribution`，明确 “agent drafted / human signed”

### 测试

- 新增 `apps/web/test/hydrate.test.mjs`
- 扩展 `claim-detail.test.mjs`、`question-detail.test.mjs`、`redesign-pages.test.mjs`
- 扩展 api-edge contribution-query 测试
- demo-stack 增 schema/端点冒烟测试，防止以后迁移后再次漂移

### DoD

演示数据下必须满足：

- claim-a1b2：2 条 supports 证据、1 条 supports receipt、3 条 finding 计数正确
- 页头同时看见 state、Frontier、agent drafter、人类 signer
- workspace 标题和 Research Contract 字段完整
- profile 显示合规 ORCID 与 affiliation
- explore 的 question/project/claim/actor 每行都有可读标题和正确归属

---

## Phase 2：收紧视觉系统，而不是逐页堆 CSS

### 新增/统一的共享层

1. **`ObjectHeader`**
   - badge 行、IdChip、标题或 scoped serif statement、Attribution、动作槽
   - 用于 Claim / Question / Attempt / Project
2. **`TabNav`**
   - 全站统一为下划线式 tabs
   - 可选 URL 同步、overflow-x-auto、44px 移动触控
   - 替换 Explore、Work、Claim、Workspace 的四套实现
3. **`Rail` / `RailSection`**
   - 桌面统一 18rem sticky rail
   - 移动端按重要度重排到主内容中，而不是机械落到页面底部
4. **`ProvenanceList`**
   - events / claim / attempt 共用 hash、signature、parents 折叠结构
5. **`PageState`**
   - 为 list/detail/workspace 提供同形 loading、empty、error、denied 骨架

### Token 修订

- 保留现有 primitive → semantic → component 色彩体系
- 补 spacing、layout、motion component token，消除页面间距魔数
- 将两份 dark token 定义收敛，减少手工同步风险
- 明确 radius 规则：控件 6px、数据面 8px、Dialog 12px、pill 仅用于 status badge
- 统一 44px 触控目标，390px 下 container padding 改为 16px

### 明确不抽象

- Landing 的公开门面构图不塞进通用 PageHeader
- ClaimDag 保持独立，不把 rail 逻辑塞入图组件
- 各页数据 fetch/hydrate 保持页面所有权

### DoD

- 全站只有一套 tabs、一套 rail 尺寸、一套对象头
- 无重复 Graph/List 控件
- 无 claim rail 重叠、无 DAG 节点因长 ID 叠压
- 390 / 768 / 1440 无横向页面溢出

---

## Phase 3：先做三个方向样板页

不一次改完所有页面。先用三个页面验证语言，再铺开。

### 样板 1：Claim Detail（最重要）

**构图目标：科研对象检查台。**

- 顶部：status / Frontier / revision / idchip → serif claim statement → attribution → 单一主动作
- 主列：结构化字段 → Argument graph → Evidence → Verification / Findings → Revision history
- 右 rail：状态摘要、真实计数入口、质疑、最新 receipt、事件 hash、frontier snapshot
- 删除页面级 Graph/List 重复控件，只保留 ClaimDag 内部控制
- 状态摘要不再是大卡压住正文，改为分节 rail

### 样板 2：Explore（密度基准）

**构图目标：研究对象索引，而不是卡片画廊。**

- 搜索 + 下划线 type tabs + filters 合成一行工具栏
- 结果从 Card 改为开放行列表：type / title / scope / attribution / date / action
- 右 rail 合并 topic、排序、当前 filter 摘要，修复空侧栏和三子元素错位
- 明确 All 与 Researchers 的集合语义
- 计数只用于 tab 导航，不做视觉强调

### 样板 3：Landing（公开门面）

**构图目标：直接展示真实协议对象，而不是解释功能。**

- 12 列真正用满：左侧定位与 CTA，右侧放真实 `LandingExample`
- 首屏底部露出下一节，不做满屏营销 hero
- 信任机制从四张卡改为四条条款式纵列
- demo-stack 数据必须明确标注为 local demo；生产空数据使用诚实 fixture 标记
- 保持 sans hero，serif 只在展示的 claim statement 内出现

### 方向验收点

三个样板页完成后暂停铺开，产出：

- 浅色/暗色 × 390/768/1440 截图
- data / empty / error 三态
- 与现有生产截图、HTML mockup 三列对照
- 人工 judge 输出差距清单

只有三个样板共同通过后，才视为视觉方向定稿。

---

## Phase 4：按页面族铺开

### 4A. 对象与身份页

顺序：Workspace → Profile → Agent Activity → Attempt

- Workspace：对象头 + 六视角 TabNav + 工作台双列；Research Contract 不再是空卡
- Profile：身份头整合 avatar / ORCID / affiliation / IdChip；RoleBar 全宽；produced/used 用两列开放列表；删除空 Agents 卡
- Agent Activity：时间线主轴 + identity/provenance rail；human/agent 视觉区别始终清楚

### 4B. 工作与审计页

顺序：Events → Work → Notifications → Settings

- Events：DENSITY 7 审计行，固定时间列、事件类型、ID、可展开 provenance
- Work：保留下划线 tabs；Alert + Card 列表压缩成分组行
- Notifications：data/empty 两态同构，不用红点焦虑
- Settings：保留五分区 IA，统一表单与状态行

### 4C. Home

最后处理 Home，因为其最终产品职责最容易随推荐/订阅能力变化。

- 保留 private watchlist change stream
- 渐进水合继续使用
- rail 只保留有操作价值的 My work / Agent status / Recent visits
- 删除纯解释性卡片

---

## Phase 5：建立可重复视觉门禁

### demo 环境

根脚本增加只读启动命令：

- `demo:api`：运行 real api-edge + in-memory PostgREST
- `demo:web`：web 指向 127.0.0.1:8787

支持固定场景：`data / empty / partial / error`；不碰 hosted Supabase。

### 截图矩阵

- 关键路由：landing、explore、claim accepted、claim contested、workspace、profile、agent activity、events、work
- 主题：light / dark
- 视口：390 / 768 / 1440
- 固定时钟：2026-08-28T12:00:00Z
- 动效关闭：prefers-reduced-motion

### 门禁策略

- Playwright 负责稳定截图和键盘交互检查
- judge 负责人类视觉验收
- node tests 负责协议文案、ARIA、token 对比度、DAG list 等价、hook 顺序
- 不把全页像素 diff 设为强制门禁：跨 OS 字体和 1px 发丝线太脆弱
- 可对 claim/explore/workspace 做高阈值截图冒烟，只告警不阻塞

### 每页 DoD

- light + dark
- 390 + 768 + 1440
- loading + empty + error + data
- keyboard focus 完整
- DAG 有 list 等价视图
- Agent attribution 不断链
- 所有计数可点击或有明确去向，且没有评分暗示
- 无伪造 ORCID verified
- `node --test`、lint、Next build 全绿

---

## 交付拆分

建议拆成 6 个 PR，降低回滚和评审成本：

1. **PR-A：设计决策与 demo schema 修正**
2. **PR-B：协议可信性数据链修复**
3. **PR-C：ObjectHeader / TabNav / Rail / ProvenanceList 基础组件**
4. **PR-D：Claim + Explore + Landing 三个方向样板**
5. **PR-E：其余页面族铺开**
6. **PR-F：视觉 capture 工具、截图基线与设计书最终同步**

每个 PR 独立测试、独立截图、独立 judge；不把视觉重构与 API/schema 修复混在一个巨大 diff 中。