# 04 布局、密度与动效（Layout, Density & Motion）

> **元信息**
> - 日期：2026-08-19
> - 层级：《EviMesh UI 设计书》设计语言层，第 04 章
> - 生产对应资产：`apps/web/app/globals.css`（space / radius / control / motion / z / layout token）与 `apps/web/components/`；历史 HTML 资产在 `docs/archive/design/m13.8-html/`

## 1. 栅格与容器

| Token | 值 | 用途 |
|---|---|---|
| `--evimesh-container-max` | 72rem（1152px） | 默认页面内容最大宽度（对应 max-w-6xl） |
| （page--wide 变体） | 80rem（1280px） | DAG 全屏视图、大数据表 |
| `--evimesh-container-px` | 1.5rem（24px） | 页面左右内边距；390px 以下降为 16px |
| `--evimesh-header-h` | 3.5rem（56px） | 全局 Header 高度（上限 80px 之内） |
| `--evimesh-sidebar-w` | 15rem（240px） | 上下文侧栏宽度 |
| `--evimesh-prose-max` | 65ch | 长文阅读行长上限 |

布局骨架：

```
gheader（sticky，56px，发丝线下边框）
└─ page（max-w 1152 居中，上 24 / 下 64 内边距）
   ├─ breadcrumb（可选，13px）
   ├─ pageheader（eyebrow / title / desc / actions，下发丝线）
   └─ layout（sidebar 240px + 主列，gap 32px；768px 以下单列）
```

- 主列内部用「区块（section）+ 区块间距 48px」组织；区块标题与内容间距 16px。
- 卡片网格 gap 16px；双列 / 三列网格在 768px 以下折为单列。
- 不使用复杂 flex 百分比数学；多列一律 CSS Grid。
- 满高场景用 `min-height: 100dvh`，禁止 `height: 100vh`（移动端地址栏跳动）。

## 2. 间距刻度（4px 基线）

| Token | 值 | 典型用途 |
|---|---|---|
| space-1 | 4px | 图标与文字、徽标内元素 |
| space-2 | 8px | 按钮内图标间距、meta 项之间、网格内的紧凑间隙 |
| space-3 | 12px | 输入框内边距、nav 项内边距、表单行内元素 |
| space-4 | 16px | 卡片网格 gap、区块标题与内容、表格单元格上下 |
| space-5 | 20px | 卡片内边距（p-5）、pageheader 底部间距 |
| space-6 | 24px | 页面左右内边距、pageheader 与正文间距 |
| space-8 | 32px | layout 侧栏 gap、区块内大分组 |
| space-10 | 40px | 预留 |
| space-12 | 48px | 区块间距（section margin-top） |
| space-16 | 64px | 页面底部收尾 |
| space-24 | 96px | 匿名 Landing 的大区块间距 |

纪律：禁止使用刻度之外的间距（如 13px / 17px / 23px）。需要「之间」的值时，取相邻刻度并保持一致。

## 3. 圆角体系（形状一致性锁定）

| Token | 值 | 用途 |
|---|---|---|
| `--evimesh-radius-sm` | 6px | 输入框、小按钮、行内代码、kbd |
| `--evimesh-radius-md` | 8px | 按钮、下拉、弹窗内控件 |
| `--evimesh-radius-lg` | 12px | 卡片、Alert、Dialog、DAG 容器 |
| `--evimesh-radius-full` | 9999px | 徽标、头像、角色条 |

规则：容器与控件不混用体系；徽标与头像是唯一允许 pill 形的元素。

## 4. 页面模板

### 4.1 PageHeader（所有页面统一）

结构槽位（顺序固定）：

1. eyebrow（可选，12px uppercase fg-subtle）
2. title（30px / 650）
3. desc（可选，14px fg-muted，行长 65ch）
4. actions（右侧槽：至多 1 个 primary + 若干 secondary/ghost；移动端折到标题下方）

PageHeader 下方是 1px 弱发丝线，与正文分隔。每屏主动作至多一个：如果页面已有 primary，则 actions 槽不再出现第二个 primary。

### 4.2 五类模板

| 模板 | 结构 | 例子 |
|---|---|---|
| list | PageHeader + 过滤条（search + filter + 排序）+ 行列表（发丝线分隔，无卡片包裹）或卡片网格 | Explore、Claims 列表 |
| detail | breadcrumb + PageHeader（对象徽标进 title 行）+ 主内容（左）+ 技术详情侧栏或折叠层 | Claim 详情、Question 详情 |
| workspace | PageHeader + 上下文 Tab（Summary / Frontier / Argument / Evidence / Verification / Activity）+ 视角内容 | Project / Question 工作区 |
| wizard | PageHeader + 步骤指示（当前步动词命名，不用 Stage 1/2/3）+ 表单列（max 36rem）+ 底部动作条 | Question / Claim 向导 |
| settings | 侧栏（Profile / Identities / Tokens / Security / Notifications）+ 表单区 | Account Settings、Agent Connection Center |

### 4.3 上下文导航

- 全局方向由 gheader 承载（Home / Explore / Work / Agent / Docs）。
- 区域内部用侧栏 NavList（settings / agent）或 Tab（workspace / explore 筛选）。
- breadcrumb 只在 detail 层出现，展示从一级入口到当前对象的路径。

## 5. 密度规范

两种密度模式，页面必须明确属于哪一种：

| 维度 | 列表密度（list） | 详情密度（detail） |
|---|---|---|
| 行高 | 44-56px（含内边距） | 不限，按区块组织 |
| 字体 | 13px 正文 / 12px meta | 14-16px |
| 分隔 | 行下 1px 弱发丝线 | 区块间距 48px |
| 徽标 | 每行至多 2 个（状态 + 可选角色） | 不限，但 emphasis 档每屏至多 1-2 个 |
| 数字 | 全部 tabular-nums | 全部 tabular-nums |
| 展开 | 行内不放长文；点击进详情 | 渐进展开：默认结论层，展开依据层 |

渐进展开规则（M13.6-3.2）：Claim 默认只显示 statement、state、Frontier 状态与状态摘要；展开顺序固定为「关联 Claim → Evidence → Verification → Finding → Challenge → revision history」。

禁止：用卡片堆叠制造「看起来丰富」；同一列表混用两种行高；在列表行内塞超过两行的文本。

## 6. 动效清单

总量级 MOTION_INTENSITY 2-3：动效只服务反馈、层级、上下文切换。仅动画 `transform` 与 `opacity`；禁止动画 top/left/width/height/box-shadow。全部动效在 `prefers-reduced-motion: reduce` 下降级为即时状态切换（生产样式全局兜底）。

| # | 场景 | 属性 | 时长 | 缓动 | reduced-motion 行为 |
|---|---|---|---|---|---|
| M1 | 按钮 hover / active（背景色与边框色变化） | background-color, border-color | 100ms | ease-standard | 即时变色 |
| M2 | 按钮按下反馈 | transform: translateY(1px) | 即时（:active） | 无 | 保留（无过渡） |
| M3 | 导航 / 侧栏 / 表格行 hover 底色 | background-color | 100ms | ease-standard | 即时变色 |
| M4 | 输入框 hover 边框 | border-color | 100ms | ease-standard | 即时 |
| M5 | 复制成功反馈 | 图标替换（copy → check）+ 文案 | 展示 2s 后还原，无过渡动画 | 无 | 相同 |
| M6 | Skeleton 微光 | transform: translateX | 1.4s 循环 | ease-standard | 停止微光，保留静态骨架 |
| M7 | 按钮 loading 转圈 | transform: rotate | 0.7s 循环 | linear | 保留转圈（状态指示，非装饰）；或按平台惯例换「加载中」文本 |
| M8 | Dialog / Confirm 进入 | opacity + translateY(4px) | 160ms | ease-enter | 即时出现 |
| M9 | Dialog 遮罩进入 | opacity | 160ms | ease-standard | 即时 |
| M10 | Tooltip 进入 | opacity | 100ms | ease-standard | 即时 |
| M11 | 折叠区展开（技术详情、revision history） | 不做高度动画；内容即时出现，可选 opacity 100ms | 100ms | ease-standard | 即时 |
| M12 | 视角 / Tab 切换 | 内容即时替换；不做滑动 | 0 | 无 | 即时 |
| M13 | 主题切换 | 无过渡（即时换 token） | 0 | 无 | 即时 |

禁止清单：滚动驱动动画、视差、磁吸按钮、环境漂浮渐变、入场瀑布流 stagger（除 M8 的单一容器）、任何无限循环装饰动画（M6/M7 是状态指示，例外）、hover 放大卡片（用边框色变化替代）。

## 7. z-index 刻度

| Token | 值 | 用途 |
|---|---|---|
| `--evimesh-z-sidebar` | 20 | 移动端抽屉侧栏 |
| `--evimesh-z-header` | 30 | sticky 全局 Header |
| `--evimesh-z-overlay` | 40 | 遮罩层 |
| `--evimesh-z-modal` | 50 | Dialog / Confirm |
| `--evimesh-z-toast` | 60 | 极少量全局提示（默认不使用 toast） |

禁止使用刻度外的 z-index 值。

## 8. 响应式断点

| 断点 | 目标 |
|---|---|
| 390px | 手机基准：单列、gnav 收折为菜单、搜索进菜单或图标化、container-px 16px、触控目标 44px |
| 768px | 平板 / 窄桌面：侧栏折叠到内容上方、双列网格折单列、PageHeader actions 折行 |
| 1440px | 桌面基准：完整壳（header + sidebar + 主列），内容最大 1152px 居中 |

断点行为必须在每个多列布局中显式声明，不允许「依赖框架自动处理」。
