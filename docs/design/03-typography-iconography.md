# 03 排版与图标（Typography & Iconography）

> **元信息**
> - 日期：2026-08-19
> - 层级：《EviMesh UI 设计书》设计语言层，第 03 章
> - 对应资产：`tokens.css`（font / text / lh / tracking token）、`app.css`（`.u-tabular` `.u-mono` `.kbd` `.prose-research` `.icon`）、`icons-sprite.html`

## 1. 字体栈

| 用途 | Token | 栈 |
|---|---|---|
| UI 与正文（默认） | `--evimesh-font-sans` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| 数据（ID / hash / 命令 / 代码） | `--evimesh-font-mono` | `ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace` |
| 长文阅读（仅 `.prose-research` 作用域） | `--evimesh-font-serif` | `Charter, "Bitstream Charter", Sitka, Georgia, Cambria, "Times New Roman", serif` |

规则：

- 三个栈全部为系统字体，零网络依赖、零字体加载偏移（CLS 友好）。
- serif 只允许出现在 `.prose-research` 与 `.claim-statement` 作用域内；标题、导航、徽标、表单、按钮一律 sans。serif 区块内的小标题仍用 sans，保持 UI 层级系统单一。
- 全站不引入任何 webfont；未来如需品牌字体，必须走 token 替换，禁止散落引用。

## 2. 字号阶梯

9 级，覆盖页面到徽标。产品正文默认 14px（base），阅读正文 16px（md）。

| Token | 尺寸 | 行高搭配 | 字重建议 | 用途 |
|---|---|---|---|---|
| `--evimesh-text-4xl` | 36px | tight 1.25 | 650 | 匿名 Landing / 文档首页大标题 |
| `--evimesh-text-3xl` | 30px | tight 1.25 | 650 | 页面标题（PageHeader） |
| `--evimesh-text-2xl` | 24px | tight 1.25 | 600 | 次级页面标题、登录页 |
| `--evimesh-text-xl` | 20px | snug 1.4 | 600 | 区块标题（SectionHeader） |
| `--evimesh-text-lg` | 18px | snug 1.4 | 600 | 卡片标题、lead 段落 |
| `--evimesh-text-md` | 16px | normal 1.55 | 400 | 阅读正文、输入框、长文 |
| `--evimesh-text-base` | 14px | normal 1.55 | 400 | 产品正文默认、按钮 |
| `--evimesh-text-sm` | 13px | normal 1.55 | 400 | 密集列表、元数据、表格 |
| `--evimesh-text-xs` | 12px | snug 1.4 | 600（徽标）/ 400 | 徽标、kbd、meta、眉题 |

行高 token：`--evimesh-lh-tight: 1.25`、`--evimesh-lh-snug: 1.4`、`--evimesh-lh-normal: 1.55`、`--evimesh-lh-relaxed: 1.7`（仅 prose-research）。

字距 token：`--evimesh-tracking-tight: -0.01em`（20px 以上标题）、`--evimesh-tracking-normal: 0`、`--evimesh-tracking-wide: 0.02em`（仅眉题 uppercase 小字）。

层级纪律：

- 层级优先靠字号 + 字重 + 颜色（fg / fg-muted / fg-subtle）建立；禁止用「更大 + 更粗 + 更艳」的叠加轰炸。
- 眉题（eyebrow）：12px、600、uppercase、tracking-wide、fg-subtle；每屏区域至多一个。
- 同一页面内 4xl 至 3xl 只出现一次（页面主标题）。

## 3. tabular-nums 规则

所有可能对齐或比较的数字必须等宽数字：

- 强制场景：ID、hash、revision 号、时间戳、计数、表格数字列、百分比与区间数字、相对时间。
- 实现：`.u-tabular`（`font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum"`），通常与 `.u-mono` 同时使用。
- 禁止：用比例数字显示 hash（会抖动）、在表格中对数字列左对齐又不加 tabular-nums。

## 4. 长 ID / hash 截断与复制规则

1. **截断格式**：对象前缀 + 前 6 位 + `…` + 后 4 位。示例：`claim_01HXYZ…AB3F`、`evt_01JA1M…9K2P`、`sha256:9f2c41ab…7e0d`。
2. **完整值位置**：完整 ID 放「技术详情」折叠层；列表与行内永远截断。
3. **复制交互**：截断 ID / hash / 永久链接 / handoff / CLI 命令旁提供复制按钮（icon-copy，14px），点击后复制全值，反馈为图标短暂换成 check + 文案「已复制」，2 秒后还原；不使用 toast。
4. **可点击性**：截断 ID 本体是链接（跳转对象页），复制是独立按钮，二者不合并，避免误操作。
5. **revision 表达**：稳定 ID + `@vN`（如 `claim_01J9X2AB@v3`），revision 号 mono + tabular；「当前 / 历史」用徽标区分（outline 档「历史」），不用删除线。

## 5. serif 阅读样式（.prose-research）

作用域：Claim statement 全文、Question 详情的背景叙述、验证报告的长文部分。禁止用于列表、表格、导航、徽标。

规格：

- 字体：serif 栈；字号 16px（md）；行高 1.7（relaxed）；行长上限 65ch（`--evimesh-prose-max`）。
- 段间距 16px；blockquote 左侧 2px 强发丝线 + fg-muted。
- 区块内标题（h2/h3）回到 sans（20px/18px，600），保证 UI 层级一致。
- 行内代码用 mono + `--evimesh-c-code-bg` 底 + 6px 圆角。
- `.claim-statement` 是 `.prose-research` 的紧凑变体：18px serif、1.7 行高、65ch，用于 Claim 卡片与详情页首屏。

## 6. Phosphor 图标规范

### 6.1 家族与权重

- 全站只用 Phosphor 一族；当前固定 **regular 权重**（官方 filled path 数据，`@phosphor-icons/core@2.1.1`，MIT）。
- 禁止混入其他图标库、emoji、手绘 path、装饰性自绘 SVG。
- regular 权重为填充式 path，渲染用 `fill: currentColor`；不要给它加 stroke 模拟其他权重。
- 需要强调的小场景（如空状态主图标）允许放大尺寸，而不是换 fill 权重；保持权重单一。

### 6.2 尺寸

| Class | 尺寸 | 场景 |
|---|---|---|
| `.icon--sm` | 14px | 徽标内、meta 行、复制按钮 |
| `.icon`（默认） | 16px | 按钮、导航、列表图标 |
| `.icon--lg` | 20px | 空状态 / 错误状态主图标 |
| `.icon--xl` | 24px | 页头标识、身份卡 |

图标颜色一律 `currentColor`，跟随所在文本的语义色；禁止给图标单独上装饰色。

### 6.3 Sprite 用法

- `assets/icons-sprite.html` 是「复制进每个页面 body 顶部」的片段（Chrome 下跨 file:// 的外部 sprite 引用不可用）。
- 引用方式：`<svg class="icon" aria-hidden="true"><use href="#icon-house"/></svg>`。
- 装饰性图标必须 `aria-hidden="true"`；图标单独承载含义时（无相邻文本），加 `role="img"` + `aria-label`。

### 6.4 symbol 清单（67 个）

| 分类 | symbol id |
|---|---|
| 导航与壳 | icon-house, icon-compass, icon-briefcase, icon-robot, icon-book-open, icon-magnifying-glass, icon-sun, icon-moon, icon-list, icon-bell |
| 对象类型 | icon-folder（project）, icon-question, icon-clipboard-text（task）, icon-chat-centered-text（claim）, icon-flask（evidence）, icon-shield-check（verification）, icon-scales（challenge）, icon-mountains（frontier）, icon-pulse（event）, icon-file-text（artifact）, icon-code（run）, icon-stack（revision） |
| 动作 | icon-copy, icon-share-network, icon-download, icon-link-simple, icon-funnel, icon-plus, icon-arrow-up-right, icon-arrow-square-out, icon-arrows-clockwise, icon-caret-down, icon-caret-right, icon-eye, icon-eye-slash, icon-sliders, icon-terminal-window, icon-paper-plane-tilt |
| 状态 | icon-info, icon-check-circle, icon-warning, icon-warning-circle, icon-x-circle, icon-check, icon-x, icon-minus-circle, icon-clock, icon-clock-countdown, icon-circle-dashed, icon-lock, icon-seal-check, icon-shield-warning |
| Agent 与身份 | icon-cpu, icon-plugs-connected, icon-key, icon-fingerprint, icon-user, icon-user-circle, icon-identification-badge, icon-github-logo, icon-globe |
| 结构与视图 | icon-tree-structure, icon-flow-arrow, icon-graph, icon-rows, icon-keyboard, icon-database |

### 6.5 ORCID 图标的例外

ORCID 官方展示规范要求使用 ORCID 官方 iD 图标（不得修改、不得用其他图标替代）。Phosphor 不含 ORCID 字形，因此：

- 一般身份场景用 `icon-identification-badge`。
- 展示「已验证 ORCID iD」的合规组件（官方图标 + 完整 URL `https://orcid.org/XXXX-XXXX-XXXX-XXXX` + 可点击 + alt/ARIA）需要单独内嵌 ORCID 官方 SVG（绿色 #A6CE39，深色背景用反白版），该 SVG 从 ORCID 官方品牌资产获取，不进入 Phosphor sprite。

### 6.6 生产适配注记（React 应用）

静态设计稿用 Phosphor sprite（file:// 直开的约束）；生产 React 应用使用仓库既有依赖 lucide-react 承载同一映射：
- 家族单一（仅 lucide）、currentColor、装饰图标 aria-hidden——规则不变。
- 尺寸阶对齐：12px（徽标内/复制按钮）、14-16px（按钮/导航/时间线圆）、20px（空态主图标）。
- 本章 6.4 的 symbol 清单在生产中对应同义 lucide 图标（icon-flask → FlaskConical、icon-mountains → Mountain 等），状态映射见 apps/web/components/ui/data.js 的 STATE_ICONS。
- ORCID 官方图标例外条款不变：合规组件仍须内嵌官方 SVG。

## 7. 文案排印禁令

1. 可见文案禁止 em-dash、en-dash 与中文破折号；用句号、逗号、冒号、括号或换行替代。
2. 禁止 emoji 与装饰符号（含勾号、叉号类 dingbat 字符）；状态一律用 Phosphor 图标 + 文本。
3. 禁止全大写正文；uppercase 仅限眉题与表头（12px 级小字）。
4. 数字区间用连字符（如 12-18），不用 en-dash。
5. 中文与英文、数字之间不强制空格，但同一页面必须风格统一。
