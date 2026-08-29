# 11 · 修订决策（2026-08-29 起的设计事实源）

> 本章是本轮前端 UI 修订的裁决记录。与 01-10 章冲突时，以本章为准；
> 各章自身的过时段落已在原位标注 superseded，不再整章重写。
> 状态标记约定：每章头部声明 `current`（现行有效）/ `superseded by 11`（被本章覆盖的部分）/ `planned`（尚未落地的方向）。

## 1. 模式与目标

- **模式**：targeted evolution。协议 IA、路由、三层 token、状态语义、DAG/list 双视图、Radix 焦点管理全部保留；重做的是数据→视觉的映射保真度、页面构图分层与组件规范。
- **目标语言**：现代科研基础设施——可信、精密、可追溯、工作导向。受众是研究者、验证者与 agent 开发者。
- **设计旋钮**：`DESIGN_VARIANCE 4`（克制但不机械，页面族各有独立构图）/ `MOTION_INTENSITY 2`（仅状态反馈、Dialog、复制反馈；禁止滚动动画与装饰循环）/ `VISUAL_DENSITY 7`（比现状更紧凑；以行、分区和 rail 组织，而非卡片堆叠）。

## 2. 不可变边界（与 AGENTS.md 同义，违反即回滚）

1. 不改路由、一级导航标签与协议对象层级。
2. 不引入第二套组件库；颜色只经 `--evimesh-*` token。
3. 计数永不渲染成分数、百分比、排行、进度条或点赞量。
4. Agent 产出处处可见「agent + 人类 owner/signer」归属链（列表态也不例外）。
5. Claim graph 保持 14 类有向边 + d3-dag/React Flow + 键盘可达 list 等价视图。
6. ORCID 仅 OAuth 验证可示 verified；无验证徽标时只能裸示 iD。
7. 无装饰渐变、无投影卡片（浮层按 01 章 alpha<0.05 例外）、em-dash 与 emoji 零出现。
8. serif 仅限 `.prose-research` / `.claim-statement` 两个阅读作用域（03 章，重申——hero 事件已验证此规则易被违反）。

## 3. 页面分层（构图架构）

| 层 | 内容 | 实现 |
|---|---|---|
| Shell | gheader + footer + command palette + drawer | `template-shell.js`（保留） |
| ObjectHeader | badge 行 + IdChip + 标题/serif 陈述 + Attribution + 动作槽 | 新共享组件，claim/question/attempt/project 复用 |
| Inspection | 主列检查区（字段/图/证据/回执/修订） | 各页自有，但用共享 Tabs/ProvenanceList |
| Rail | 桌面 18rem sticky 侧栏；移动端按内容重要度并入主列 | 新 `Rail`/`RailSection`，替换现存 15/18/19rem 三种宽度 |
| Data state | loading/empty/error/denied 同形骨架 | `PageState` 包装 BlankShell |

**不抽象**：landing 的公开门面构图（一次性）；ClaimDag（唯图组件，不混 rail 逻辑）；各页 fetch/hydrate（保持页面所有权）。

## 4. 组件规范裁决

1. **Tabs 全站唯一形态**：下划线式（`html/assets/app.css` 的 `.tabs`），URL 可寻址可选，overflow-x-auto，触控 44px。替换 explore 胶囊、claim bg-accent、work 下划线、claim-dag 内部分段共四套实现。
2. **radius 规则**：控件 6px、数据面 8px、Dialog 12px、pill 仅用于 status badge。
3. **rail 宽度唯一**：18rem。
4. **触控目标**：全部 ≥44px（现状多个 h-8/h-9 按钮违规）。
5. **390 容器边距**：16px（现 24px 无降档）。
6. **间距 token 化**：补 `--evimesh-space-*`/layout/motion component token，页面禁止新增间距魔数。
7. **dark token 收敛**：`[data-theme=dark]` 与 `prefers-color-scheme` 两块合并为单一选择器组，消除 190 行手工同步。

## 5. Home 终局裁决（解决 05 §2 与 10 §4.5 冲突）

**Home = private watchlist change stream**（当前实现形态），10 §4.5 的"瀑布流发现流"声明**撤销**（未落地且引入推荐形态的复杂度与当前产品阶段不匹配）。保留：四级分组变化流、渐进水合、rail 三卡（My work / Agent 连接 / 最近访问）。删除：纯解释性文案卡。05 §2 仍是 Home 的内容契约。

## 6. 视觉验收协议（demo-stack）

- **数据源**：`node scripts/demo-stack.mjs`（真实 api-edge + 内存 PostgREST，锚定时钟 2026-08-28T12:00:00Z，只读 GET-only）。web 侧 `NEXT_PUBLIC_EVIMESH_API_URL=http://127.0.0.1:8787`。
- **矩阵**：关键路由 × light/dark × 390/768/1440 × data/empty/error。
- **分工**：Playwright 固定视口截图 + 人工 judge；node tests 负责协议文案/ARIA/token 对比度/DAG list 等价/hook 顺序；**不做门禁级像素 diff**（跨 OS 字体与 1px 发丝线太脆弱），可选高阈值冒烟只告警。
- **每页 DoD**：见 §8。

## 7. 交付阶段与状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| PR-A (#84) | 本章 + 各章状态回写 + demo schema 修正 | done |
| PR-B (#85) | 协议可信性数据链（计数/归属/徽标/契约字段） | done |
| PR-C (#86) | ObjectHeader/TabNav/Rail/ProvenanceList/PageState + token 收敛（单 dark 块） | done |
| PR-D (#87) | 三样板：Claim Detail / Explore / Landing（四轮 judge 定稿） | done |
| PR-E (#88) | 页面族铺开（workspace/work TabNav、events ProvenanceList、home Rail；notifications 保留 ARIA 更完整的本地 tabs） | done |
| PR-F | 视觉 capture 工具（scripts/visual-capture.mjs，含错误页判废）+ 基线 docs/design/baseline/ | done |

**验收记录**：方向样板经四轮 judge 审查定稿。R1 抓到 globals.css 括号错误；R2 抓到残留 dev server 进程服务旧代码（流程规则：截图前必须清杀全部 `next start-server` 进程，已固化进 capture 流程）；R3 抓到 project 标题解包缺失与状态徽标只写类型；R4 抓到 rail 行溢出与 d4e5 归属链缺口。全部闭环。

## 8. 每页 Definition of Done

- light + dark 双主题截图（390/768/1440）
- data / empty / error 三态（demo-stack + route abort）
- keyboard focus 完整；DAG 有 list 等价视图
- Agent attribution 链完整（含列表态）
- 计数只作导航入口、无评分暗示；无伪造 ORCID verified
- `node --test`、lint、`next build` 全绿
