# 02 颜色语言（Color Language）

> **元信息**
> - 日期：2026-08-19
> - 层级：《EviMesh UI 设计书》设计语言层，第 02 章
> - 单一事实源：`docs/design/html/assets/tokens.css`（本章所有 hex 值与其一一对应）
> - 可视化展示：`docs/design/html/tokens.html`
> - 校验方式：OKLCH 定义，换算 sRGB 后按 WCAG 相对亮度公式计算对比度；84 个文本对 + 焦点环在亮/暗双主题下全部通过（全表见第 8 节）

## 1. 架构

三层 token，Primer 式命名纪律：

```
primitive（--evimesh-p-*）   原始色阶，只供 semantic 引用，组件禁止直连
semantic（--evimesh-{role}） 含义层，双主题换值，组件唯一引用入口
component（--evimesh-c-*）   组件决策层，把 semantic 映射到具体部件
```

主题机制：

- light 值定义在 `:root`。
- dark 值同时定义在两处（内容必须保持同步）：`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` 与 `[data-theme="dark"]`。
- `html[data-theme="auto|light|dark"]` 由 `theme.js` 管理并持久化到 localStorage。
- dark 不是反色：每个语义 token 在 dark 下单独取值（暗底徽标用「深底 + 浅色文字」，实底徽标用「更深的实底 + 近白文字」）。

基底：延续 M13.5 蓝灰体系。中性色 hue 255，品牌 hue 258，状态色相 success 152、warning 75、danger 27、info 240。

## 2. Primitive 层（全表）

### 2.1 neutral（蓝灰中性，hue 255）

| Token | Hex | 主要去向 |
|---|---|---|
| `--evimesh-p-neutral-0` | #FFFFFF | light: 卡片底、outline 按钮底、onEmphasis 文字 |
| `--evimesh-p-neutral-50` | #F9FAFB | light: 页面底 |
| `--evimesh-p-neutral-75` | #F4F6F8 | light: outline hover；dark: fg、onEmphasis |
| `--evimesh-p-neutral-100` | #EFF1F4 | light: inset 底、ghost hover、surface-muted |
| `--evimesh-p-neutral-150` | #EBEEF1 | light: secondary 按钮底、neutral 徽标底 |
| `--evimesh-p-neutral-200` | #E5E9ED | light: 弱发丝线、secondary hover |
| `--evimesh-p-neutral-250` | #DCE0E5 | light: 默认发丝线 |
| `--evimesh-p-neutral-300` | #CED3D9 | light: 强发丝线；dark: neutral 徽标文字 |
| `--evimesh-p-neutral-400` | #9FA5AD | dark: fg-muted；light 序列线（DAG lineage/neutral 边） |
| `--evimesh-p-neutral-450` | #8C939B | dark: fg-subtle |
| `--evimesh-p-neutral-500` | #737B85 | light: select 箭头、DAG 边暗色档 |
| `--evimesh-p-neutral-550` | #5C646F | light: fg-subtle |
| `--evimesh-p-neutral-600` | #555E6A | light: fg-muted |
| `--evimesh-p-neutral-700` | #3B4551 | light: neutral 徽标文字、emphasis-neutral；dark: 强发丝线 |
| `--evimesh-p-neutral-800` | #242F3D | light: secondary 按钮文字；dark: secondary hover |
| `--evimesh-p-neutral-850` | #1C2531 | dark: 默认发丝线、secondary 底、surface-muted |
| `--evimesh-p-neutral-875` | #171F2A | dark: 弱发丝线 |
| `--evimesh-p-neutral-900` | #111822 | light: fg、overlay；dark: 卡片底 |
| `--evimesh-p-neutral-925` | #0D131B | dark: outline 按钮底 |
| `--evimesh-p-neutral-950` | #090E14 | dark: 页面底 |
| `--evimesh-p-neutral-975` | #05080D | dark: inset 底 |

### 2.2 brand（品牌蓝，hue 258）

| Token | Hex | 主要去向 |
|---|---|---|
| `--evimesh-p-brand-100` | #EBF4FF | light: accent 徽标底、选中表面 |
| `--evimesh-p-brand-200` | #DBE9FE | light: accent 徽标边框 |
| `--evimesh-p-brand-300` | #BED6F9 | dark: accent 徽标文字 |
| `--evimesh-p-brand-400` | #70A6F5 | dark: 链接、焦点环、DAG positive/negative 亮档 |
| `--evimesh-p-brand-500` | #3E7AD3 | 储备（当前未绑定语义） |
| `--evimesh-p-brand-600` | #2063BF | 双主题: primary 按钮底、链接（light）、焦点环（light） |
| `--evimesh-p-brand-700` | #154E9C | light: accent 徽标文字、primary hover；dark: accent 徽标边框 |
| `--evimesh-p-brand-800` | #103A74 | dark: accent 徽标底、选中表面 |

### 2.3 success / warning / danger / info（状态四族）

| Step | success (152) | warning (75) | danger (27) | info (240) |
|---|---|---|---|---|
| 100 | #E5FAEA | #FFF0D6 | #FFEEEC | #E5F6FF |
| 200 | #CFF0D6 | #FFE2B8 | #FFE1DD | #D2EEFF |
| 300 | #A8DFB6 | #FBCB88 | #FDC9C2 | #B0DCFD |
| 400 | #60AC76 | #D79F4C | #E86156 | #5AA0D0 |
| 500 | #287B46 | #A86E00 | #D73431 | #20709F |
| 600 | #15733C | #965E00 | #BE2323 | #0E6A9B |
| 700 | #135C30 | #784A00 | #9B1F1D | #005581 |
| 800 | #124324 | #593800 | #721C19 | #024061 |

用途规律：100/200/300 供 light 徽标底/边框与 dark 徽标文字；600/700 供 light 徽标文字、实底与按钮；800 供 dark 徽标底；400/500 供 DAG 边线与图形元素（非文本，3:1 即可）。

### 2.4 数据可视化序列色（8 色）

| Token | Hex | 色名 |
|---|---|---|
| `--evimesh-p-series-1` | #3E71BC | blue |
| `--evimesh-p-series-2` | #B07A20 | amber |
| `--evimesh-p-series-3` | #2E918C | teal |
| `--evimesh-p-series-4` | #B54B43 | red |
| `--evimesh-p-series-5` | #378450 | green |
| `--evimesh-p-series-6` | #725B9A | violet |
| `--evimesh-p-series-7` | #238EA9 | cyan |
| `--evimesh-p-series-8` | #7E7F3C | olive |

使用规则：

- 只用于纯分类（贡献角色分布、多序列对比图），顺序固定为 1 至 8，相邻区分度优先。
- 序列色永不映射语义：禁止「红即坏、绿即好」式捷径；含义必须来自文本标签。
- 序列色不作为文本色使用（对比度未保证），只作图块、线段、小面积填充。

## 3. Semantic 层（全表）

格式：`token：light 值（来源 primitive）/ dark 值（来源 primitive），用途`。

### 3.1 表面与前景

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--evimesh-bg` | #F9FAFB (neutral-50) | #090E14 (neutral-950) | 页面基底 |
| `--evimesh-bg-inset` | #EFF1F4 (neutral-100) | #05080D (neutral-975) | 内嵌区、代码块底、下沉区域 |
| `--evimesh-bg-raised` | #FFFFFF (neutral-0) | #111822 (neutral-900) | 卡片、浮层、输入框底 |
| `--evimesh-bg-overlay` | #111822 (neutral-900) | #1C2531 (neutral-850) | 遮罩（配透明度使用） |
| `--evimesh-fg` | #111822 (neutral-900) | #F4F6F8 (neutral-75) | 正文 |
| `--evimesh-fg-muted` | #555E6A (neutral-600) | #9FA5AD (neutral-400) | 次级文本、元数据 |
| `--evimesh-fg-subtle` | #5C646F (neutral-550) | #8C939B (neutral-450) | 占位符、最弱文本（仍满足 4.5:1） |
| `--evimesh-fg-onEmphasis` | #FFFFFF (neutral-0) | #F4F6F8 (neutral-75) | 实底徽标与主按钮上的文字 |
| `--evimesh-fg-link` | #2063BF (brand-600) | #70A6F5 (brand-400) | 链接 |

### 3.2 边框

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--evimesh-border` | #DCE0E5 (neutral-250) | #1C2531 (neutral-850) | 默认发丝线（卡片、表格头下） |
| `--evimesh-border-muted` | #E5E9ED (neutral-200) | #171F2A (neutral-875) | 弱发丝线（卡片内行分隔、时间线） |
| `--evimesh-border-strong` | #CED3D9 (neutral-300) | #3B4551 (neutral-700) | 输入框、outline 按钮、空状态虚框 |
| `--evimesh-border-focus` | #2063BF (brand-600) | #70A6F5 (brand-400) | 焦点环（对背景 5.58:1 / 7.80:1） |

### 3.3 动作

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--evimesh-action-primary` | #2063BF (brand-600) | #2063BF (brand-600) | 主按钮底 |
| `--evimesh-action-primary-hover` | #154E9C (brand-700) | #154E9C (brand-700) | 主按钮 hover |
| `--evimesh-action-primary-fg` | #FFFFFF (neutral-0) | #FFFFFF (neutral-0) | 主按钮文字 |
| `--evimesh-action-secondary` | #EBEEF1 (neutral-150) | #1C2531 (neutral-850) | 次级按钮底 |
| `--evimesh-action-secondary-hover` | #E5E9ED (neutral-200) | #242F3D (neutral-800) | 次级按钮 hover |
| `--evimesh-action-secondary-fg` | #242F3D (neutral-800) | #EFF1F4 (neutral-100) | 次级按钮文字 |
| `--evimesh-action-outline` | #FFFFFF (neutral-0) | #0D131B (neutral-925) | outline 按钮底 |
| `--evimesh-action-outline-hover` | #F4F6F8 (neutral-75) | #1C2531 (neutral-850) | outline hover |
| `--evimesh-action-ghost-hover` | #EFF1F4 (neutral-100) | #1C2531 (neutral-850) | ghost hover 底 |
| `--evimesh-action-destructive` | #BE2323 (danger-600) | #BE2323 (danger-600) | 危险按钮底 |
| `--evimesh-action-destructive-hover` | #9B1F1D (danger-700) | #9B1F1D (danger-700) | 危险按钮 hover |
| `--evimesh-action-destructive-fg` | #FFFFFF (neutral-0) | #FFFFFF (neutral-0) | 危险按钮文字 |

### 3.4 派生表面

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--evimesh-surface-muted` | #EFF1F4 (neutral-100) | #1C2531 (neutral-850) | 骨架屏、弱填充、表格行 hover |
| `--evimesh-surface-accent` | #EBF4FF (brand-100) | #103A74 (brand-800) | 信息条表面 |
| `--evimesh-surface-selected` | #EBF4FF (brand-100) | #103A74 (brand-800) | 选中行、当前导航项 |

## 4. 状态色双档

每个状态角色两档：

- **muted 档**：`-bg`（浅底）+ `-fg`（同族深色文字，对底色与页面底都满足 4.5:1，因此 fg 也可脱离底色单独使用）+ `-border`（可选描边）。默认档位。
- **emphasis 档**：实底 + `fg-onEmphasis` 文字。保留给每个视图里最关键的少数状态（如 claim 列表中的 refuted），每屏克制使用。

| 角色 | muted 底 (light/dark) | muted 文字 (light/dark) | 边框 (light/dark) | emphasis 实底 (light/dark) |
|---|---|---|---|---|
| neutral | #EBEEF1 / #1C2531 | #3B4551 / #CED3D9 | #DCE0E5 / #3B4551 | #3B4551 / #3B4551 |
| accent | #EBF4FF / #103A74 | #154E9C / #BED6F9 | #DBE9FE / #154E9C | （用 emphasis-info 或 brand 实底，见实现） |
| success | #E5FAEA / #124324 | #135C30 / #A8DFB6 | #CFF0D6 / #135C30 | #15733C / #135C30 |
| warning | #FFF0D6 / #593800 | #784A00 / #FBCB88 | #FFE2B8 / #784A00 | #965E00 / #784A00 |
| danger | #FFEEEC / #721C19 | #9B1F1D / #FDC9C2 | #FFE1DD / #9B1F1D | #BE2323 / #9B1F1D |
| info | #E5F6FF / #024061 | #005581 / #B0DCFD | #D2EEFF / #005581 | #0E6A9B / #005581 |

对应 CSS：`--evimesh-status-{role}-bg|-fg|-border` 与 `--evimesh-emphasis-{role}`。徽标组件 `.badge--{role}` 与 `.badge--emphasis-{role}` 见第 09 章。

## 5. 协议语义色映射

映射只决定「用哪档颜色 + 哪个图标」，不引入新颜色。所有徽标文本先行，颜色不是唯一载体。

### 5.1 Claim 状态（10 态）

主推进链：`hypothesis → candidate → under_verification → provisionally_accepted → accepted`；任何阶段可进入 `contested / refuted / superseded / retracted / dependency_tainted`。

| 状态 | 徽标 | 图标 | 说明 |
|---|---|---|---|
| hypothesis | neutral muted | circle-dashed | 设想阶段 |
| candidate | neutral muted | question | 候选主张 |
| under_verification | accent muted | clock | 验证进行中 |
| provisionally_accepted | success muted | check-circle | 有条件接受 |
| accepted | success muted | seal-check | 在明确 Policy 版本下接受 |
| contested | warning muted | warning | 存在有效质疑 |
| refuted | danger emphasis | x-circle | 被反驳（每屏重点态） |
| superseded | neutral emphasis | stack | 被新版本替代（非错误） |
| retracted | danger emphasis | x | 作者撤回 |
| dependency_tainted | warning emphasis | shield-warning | 上游污染传播 |

### 5.2 Evidence 链接与 Verification outcome

| 关系 / outcome | 徽标 | 图标 |
|---|---|---|
| supports | success muted | check |
| refutes | danger muted | x |
| qualifies | warning muted | scales |
| reproduces | info muted | arrows-clockwise |
| inconclusive（outcome 专有） | neutral muted | minus-circle |

徽标只表达关系方向与性质；数量用分组计数呈现（可点入明细），绝不换算为分数或百分比。

### 5.3 Finding severity

| severity | 徽标 |
|---|---|
| critical | danger emphasis |
| major | danger muted |
| warning | warning muted |
| note | info muted |

### 5.4 Change level（只表注意优先级，不表真伪）

| level | 徽标 | 图标 |
|---|---|---|
| critical | danger emphasis | warning-circle |
| attention | warning muted | 无 |
| update | accent muted | 无 |
| quiet | neutral muted | 无 |

### 5.5 Challenge 状态

| 状态 | 徽标 | 图标 |
|---|---|---|
| open | neutral muted | scales |
| admissible | warning muted | 无 |
| investigating | accent muted | magnifying-glass |
| upheld | danger emphasis | 无 |
| rejected | outline 档 | 无 |
| resolved | success muted | check-circle |

### 5.6 贡献角色（序列色，纯分类）

| 角色 | 序列色 |
|---|---|
| originator | series-1 blue |
| contributor | series-3 teal |
| reviewer | series-6 violet |
| verifier | series-5 green |
| witness | series-7 cyan |
| maintainer | series-2 amber |

角色条 `.rolebar` 只呈现计数占比，必须携带说明「仅表示角色分布，不表示质量」的 aria-label 或邻近文本。

## 6. DAG 边编码（14 种关系的三重编码）

颜色族 + 线型 + 可读 relation 标签（边上或图例中），颜色永不单独承载语义。5 个颜色族覆盖 14 种关系：

| 颜色族 | Token（light / dark 各一档） | 线型 | 关系 | 关系图标 |
|---|---|---|---|---|
| positive | `--evimesh-c-dag-edge-positive`：#287B46 / #60AC76 | 实线 1.5px | supports, reproduces, verifies | check / arrows-clockwise / shield-check |
| negative | `--evimesh-c-dag-edge-negative`：#D73431 / #E86156 | 实线 2px | refutes, contradicts, challenges | x / x-circle / scales |
| qualify | `--evimesh-c-dag-edge-qualify`：#A86E00 / #D79F4C | 虚线 6 4 | qualifies | scales |
| structural | `--evimesh-c-dag-edge-structural`：#20709F / #5AA0D0 | 点线 2 3 | depends_on, uses_method, uses_dataset, implements | flow-arrow / flask / database / code |
| lineage | `--evimesh-c-dag-edge-lineage`：#737B85 / #9FA5AD | 点划线 10 3 2 3 | extends, supersedes, derived_from | arrow-up-right / stack / tree-structure |

规则：

- 每条边在图上带 mono 9px 的 relation 文本标签；密集图上允许只显示颜色族 + 线型，但图例必须常驻。
- 箭头用显式 path（不用 marker 的 context-stroke，兼容性不稳），class 为 `.dag__arrow--{family}`。
- 节点状态用边框色 + 节点内文本徽标双通道：`.dag__node--selected`（focus 色 2px 边框）、`--contested`（warning fg 边框）、`--refuted`（danger fg 边框）。
- 必须提供键盘可达的列表等价视图（Graph / List 切换）。

## 7. 焦点与非文本对比

- 焦点环 `--evimesh-border-focus` 对页面底：light 5.58:1，dark 7.80:1（均超过非文本 3:1 要求）。
- DAG 边线、图标、边框等非文本元素相对相邻表面满足 3:1（图形元素标准）；文本一律 4.5:1。

## 8. 对比度自检表（全量）

校验方法：OKLCH 定义色值，转换为 sRGB 后按 WCAG 2.1/2.2 相对亮度公式计算 `(L1+0.05)/(L2+0.05)`。下表为全部 84 个文本对（两主题各 42 对）与焦点环实测值，全部通过 AA。

| 主题 | 前景 token | 背景 token | 比值 | 场景 |
|---|---|---|---|---|
| light | fg | bg | 17.06 | body text |
| light | fg | bg-raised | 17.83 | body on card |
| light | fg-muted | bg | 6.29 | muted text |
| light | fg-muted | bg-raised | 6.57 | muted on card |
| light | fg-muted | bg-inset | 5.81 | muted on inset |
| light | fg-subtle | bg | 5.73 | subtle text |
| light | fg-subtle | bg-raised | 5.99 | subtle on card |
| light | fg-link | bg | 5.58 | link |
| light | fg-link | bg-raised | 5.84 | link on card |
| light | fg-onEmphasis | action-primary | 5.84 | primary button label |
| light | fg-onEmphasis | action-primary-hover | 8.07 | primary hover label |
| light | fg-onEmphasis | action-destructive | 6.08 | destructive label |
| light | fg-onEmphasis | action-destructive-hover | 8.05 | destructive hover |
| light | fg-onEmphasis | emphasis-success | 5.92 | solid success badge |
| light | fg-onEmphasis | emphasis-warning | 5.39 | solid warning badge |
| light | fg-onEmphasis | emphasis-danger | 6.08 | solid danger badge |
| light | fg-onEmphasis | emphasis-info | 5.91 | solid info badge |
| light | fg-onEmphasis | emphasis-neutral | 9.74 | solid neutral badge |
| light | action-secondary-fg | action-secondary | 11.64 | secondary button |
| light | action-secondary-fg | action-secondary-hover | 11.11 | secondary hover |
| light | action-secondary-fg | action-outline | 13.56 | outline button |
| light | fg | action-outline | 17.83 | outline button text |
| light | fg | action-ghost-hover | 15.76 | ghost hover text |
| light | fg-muted | action-ghost-hover | 5.81 | ghost hover muted |
| light | fg | surface-muted | 15.76 | text on muted surface |
| light | fg-muted | surface-muted | 5.81 | muted on muted surface |
| light | fg | surface-accent | 16.06 | text on accent surface |
| light | status-neutral-fg | status-neutral-bg | 8.36 | neutral badge |
| light | status-neutral-fg | bg | 9.32 | neutral badge fg on page |
| light | status-accent-fg | status-accent-bg | 7.27 | accent badge |
| light | status-accent-fg | bg | 7.72 | accent fg on page |
| light | status-success-fg | status-success-bg | 7.38 | success badge |
| light | status-success-fg | bg | 7.73 | success fg on page |
| light | status-warning-fg | status-warning-bg | 6.73 | warning badge |
| light | status-warning-fg | bg | 7.23 | warning fg on page |
| light | status-danger-fg | status-danger-bg | 7.17 | danger badge |
| light | status-danger-fg | bg | 7.71 | danger fg on page |
| light | status-info-fg | status-info-bg | 7.25 | info badge |
| light | status-info-fg | bg | 7.68 | info fg on page |
| light | action-primary-fg | action-primary | 5.84 | alias primary |
| light | action-destructive-fg | action-destructive | 6.08 | alias destr |
| dark | fg | bg | 17.87 | body text |
| dark | fg | bg-raised | 16.46 | body on card |
| dark | fg-muted | bg | 7.80 | muted text |
| dark | fg-muted | bg-raised | 7.18 | muted on card |
| dark | fg-muted | bg-inset | 8.08 | muted on inset |
| dark | fg-subtle | bg | 6.23 | subtle text |
| dark | fg-subtle | bg-raised | 5.74 | subtle on card |
| dark | fg-link | bg | 7.80 | link |
| dark | fg-link | bg-raised | 7.19 | link on card |
| dark | fg-onEmphasis | action-primary | 5.39 | primary button label |
| dark | fg-onEmphasis | action-primary-hover | 7.45 | primary hover label |
| dark | fg-onEmphasis | action-destructive | 5.61 | destructive label |
| dark | fg-onEmphasis | action-destructive-hover | 7.43 | destructive hover |
| dark | fg-onEmphasis | emphasis-success | 7.45 | solid success badge |
| dark | fg-onEmphasis | emphasis-warning | 6.98 | solid warning badge |
| dark | fg-onEmphasis | emphasis-danger | 7.43 | solid danger badge |
| dark | fg-onEmphasis | emphasis-info | 7.41 | solid info badge |
| dark | fg-onEmphasis | emphasis-neutral | 8.99 | solid neutral badge |
| dark | action-secondary-fg | action-secondary | 13.66 | secondary button |
| dark | action-secondary-fg | action-secondary-hover | 11.98 | secondary hover |
| dark | action-secondary-fg | action-outline | 16.48 | outline button |
| dark | fg | action-outline | 17.21 | outline button text |
| dark | fg | action-ghost-hover | 14.27 | ghost hover text |
| dark | fg-muted | action-ghost-hover | 6.23 | ghost hover muted |
| dark | fg | surface-muted | 14.27 | text on muted surface |
| dark | fg-muted | surface-muted | 6.23 | muted on muted surface |
| dark | fg | surface-accent | 10.31 | text on accent surface |
| dark | status-neutral-fg | status-neutral-bg | 10.27 | neutral badge |
| dark | status-neutral-fg | bg | 12.86 | neutral badge fg on page |
| dark | status-accent-fg | status-accent-bg | 7.54 | accent badge |
| dark | status-accent-fg | bg | 13.07 | accent fg on page |
| dark | status-success-fg | status-success-bg | 7.49 | success badge |
| dark | status-success-fg | bg | 12.81 | success fg on page |
| dark | status-warning-fg | status-warning-bg | 7.03 | warning badge |
| dark | status-warning-fg | bg | 12.91 | warning fg on page |
| dark | status-danger-fg | status-danger-bg | 7.55 | danger badge |
| dark | status-danger-fg | bg | 13.19 | danger fg on page |
| dark | status-info-fg | status-info-bg | 7.60 | info badge |
| dark | status-info-fg | bg | 13.37 | info fg on page |
| dark | action-primary-fg | action-primary | 5.84 | alias primary |
| dark | action-destructive-fg | action-destructive | 6.08 | alias destr |

焦点环对页面底：light 5.58:1，dark 7.80:1。

## 9. 维护规则

1. 组件只允许引用 semantic 与 component 两层 token；发现组件直连 primitive 或裸 hex 即视为缺陷。
2. 新增状态角色：先在 primitive 层补 8 阶色族，再按「bg/fg/border + emphasis」双档接入 semantic，并在本章补映射表，最后跑对比度校验。
3. `tokens.css` 中两处 dark 块（`[data-theme="dark"]` 与 media query 内）必须同步修改；建议用「BEGIN-DARK / END-DARK」注释块做复制边界。
4. 任何 hex 变更必须重跑对比度校验脚本并更新本章表格；禁止只改 CSS 不改文档。
