# 09 组件清单与命名约定（Component Inventory）

> **元信息**
> - 日期：2026-08-19
> - 层级：《EviMesh UI 设计书》设计语言层，第 09 章
> - 单一事实源：`docs/design/html/assets/app.css`（样式）+ `assets/icons-sprite.html`（图标）
> - 可视化基线：`docs/design/html/styleguide.html`
> - 实现基线：Primer React 模式（NavList / PageHeader / DataTable / Timeline / Banner / Blankslate / Label / Breadcrumbs / KeybindingHint），Radix 承载交互行为，视觉全部走 EviMesh token

## 1. class 命名约定（总则）

1. **BEM-lite 功能命名**：`.block`、`.block__part`、`.block--variant`。元素部分最多一级（不允许 `.a__b__c`）。
2. **语义命名，不用表象命名**：允许 `.badge--danger`，禁止 `.badge--red`；允许 `.blank--error`，禁止 `.blank--big-icon`。
3. **变体自包含**：每个 `--variant` 独立可用，不依赖与其他变体的叠加顺序。
4. **状态优先用 ARIA 属性选择器**：`aria-current="page"`（导航）、`aria-pressed`（切换）、`aria-invalid`（表单错误）、`aria-busy`（loading）、`aria-checked`（switch）、`:disabled`。仅为无法用 ARIA 表达的视觉状态加 class。
5. **颜色只从 token 来**：app.css 内禁止裸 hex（唯一例外是 select 箭头的 data-URI，已提供双主题变体并注明）。
6. **工具类以 `u-` 前缀**：`u-tabular` `u-mono` `u-truncate` `u-muted` `u-subtle` `u-sr-only`。
7. **图标统一**：`<svg class="icon [icon--sm|icon--lg|icon--xl]">` + `<use href="#icon-..."/>`；装饰图标 `aria-hidden="true"`。
8. **新组件流程**：先在 app.css 加 block，再在本章登记（用途 / 变体 / 状态 / 基线来源），页面子代理才可引用；禁止页面内私有样式承载可复用组件。

## 2. 组件清单

### 2.1 产品壳

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.shell` | 页面根（min-h 100dvh 列布局） | 无 | 无 | Primer PageLayout |
| `.gheader` | 全局 Header（sticky 56px） | `__logo` `__mark` `__spacer` | 无 | Primer Header |
| `.gnav__link` | 一级导航项 | 无 | hover、`aria-current="page"` | Primer Navigation（任务型五项） |
| `.gsearch` | 全局搜索 | `__icon` `__input` `__kbd` | focus | Primer FilteredSearch |
| `.iconbtn` | 图标按钮（32px 命中区） | 无 | hover、`aria-pressed` | Primer IconButton 模式 |
| `.account` | 账户菜单触发 | 无 | hover | Primer Header 账户区 |
| `.avatar` | 头像 | `--lg` `--agent` | 无 | M13.7 身份模型（agent 必须可辨识） |
| `.page` | 页面容器（1152px） | `--wide`（1280px） | 无 | Primer PageLayout |
| `.layout` + `.sidebar` | 侧栏布局（240px + 主列） | 无 | 768px 折单列 | Primer SplitPageLayout |
| `.navlist` | 上下文侧栏导航 | `__title` `__link` | hover、`aria-current` | Primer NavList |
| `.breadcrumb` | 面包屑 | 无 | 无 | Primer Breadcrumbs |

### 2.2 页面结构

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.pageheader` | 页眉（eyebrow/title/desc/actions 四槽） | `__eyebrow` `__title` `__desc` `__actions` | 无 | Primer PageHeader |
| `.section` | 区块容器（margin-top 48px） | 无 | 无 | 自研节奏 |
| `.sectionhead` | 区块标题行（标题 + 右侧 meta） | `__title` `__meta` | 无 | 自研 |

### 2.3 Button

| Class | 用途 | 变体 | 状态 | 基线 |
|---|---|---|---|---|
| `.btn` | 按钮与按钮式链接 | `--primary` `--secondary` `--outline` `--ghost` `--destructive` `--link`；尺寸 `--sm`(28px) 默认(36px) `--lg`(44px) | default / hover / active(translateY 1px) / focus-visible / disabled(opacity 0.55) / loading(`.btn__spinner` + aria-busy) | M13.5-B03 六变体 + Primer Button |

规则：每屏至多一个 `--primary`；`--destructive` 仅用于不可逆动作；loading 时保持宽度稳定（spinner 替换图标位，不新增布局）。

### 2.4 Badge（协议状态全集）

| Class | 用途 | 变体 | 状态 | 基线 |
|---|---|---|---|---|
| `.badge` | 状态徽标（22px 高，12px 字，pill） | muted 档：`--neutral` `--accent` `--success` `--warning` `--danger` `--info`；emphasis 档：`--emphasis-success` `--emphasis-warning` `--emphasis-danger` `--emphasis-info` `--emphasis-neutral`；`--outline`（密集表格） | 静态（不做交互态） | Primer Label/StateLabel + 调研 D2 |

协议状态到变体的映射见第 02 章第 5 节。徽标内图标 12px（`.icon` 覆写宽高 0.75rem）。

### 2.5 Card / Metadata

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.card` | 数据卡片（发丝线、无投影、12px 圆角） | `--flat`（仅上下发丝线）；`__header` `__title` `__body` `__footer` | hover 不加阴影（列表卡如需可点提示，用边框色变化） | M13.5-B07 + Primer Card |
| `.card-grid` | 卡片网格（gap 16px） | `--2` `--3` | 768px 折单列 | 自研 |
| `.meta` | 元数据行（13px muted） | `__item` `__sep`（1px 竖分隔） | 无 | 自研（替代滥用中点分隔） |
| `.deflist` | 字段化定义列表（技术详情 / 回执卡） | dt/dd | 无 | 调研 D3 字段化回执（OpenReview 模式转译） |

### 2.6 表单

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.field` | 表单字段容器（label 上、help、error 下） | `__label` `__help` `__error` | error 态配 `aria-invalid` | M13.5-B04 |
| `.input` / `.textarea` / `.select` | 文本输入 / 多行 / 下拉 | 无 | default / hover(边框加深) / focus(环) / invalid(2px danger 边) / disabled(muted 底) | M13.5-B04/B05 |
| `.check` | 复选 / 单选行（原生控件 + accent-color） | 无 | 原生状态 | M13.5-B05 |
| `.switch` | 开关（role="switch"） | 无 | `aria-checked` true/false | M13.5-B05 |

### 2.7 反馈

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.alert` | 行内提示条 | `--info` `--success` `--warning` `--danger`；`__title` | 静态；`role="note"` 或 `role="alert"` | M13.5-B06 + Primer Banner/Flash |
| `.blank` | 空状态 / 错误状态 / denied 共用布局 | `--error`；`__icon` `__title` `__desc` `__actions` `__request-id` | 静态 | M13.5-B06 + Primer Blankslate |
| `.skeleton` | 骨架加载 | `--text` `--title` `--badge` `--avatar` `--row` | 微光循环（reduced-motion 静止） | Primer Skeleton |

### 2.8 数据与阅读

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.tablewrap` + `.table` | 数据密集表格（圆角容器 + 横向滚动） | 无 | 行 hover（token 底） | Primer DataTable |
| `.kbd` | 快捷键（物理键样式） | 无 | 无 | Primer KeybindingHint + minimalist-ui kbd 规范 |
| `.prose-research` | serif 长文阅读区（16px/1.7/65ch） | h2/h3/blockquote/code/a 内置 | 无 | 已定决策 1 |
| `.claim-statement` | Claim 陈述（18px serif） | 无 | 无 | 已定决策 1 |

### 2.9 DAG / 时间线 / 贡献

| Class | 用途 | 变体 / 部件 | 状态 | 基线 |
|---|---|---|---|---|
| `.dag` | DAG 容器（发丝线 + 横滚） | `__node`(rect/text) `__node-sub` `__node--selected/--contested/--refuted` `__edge--positive/--negative/--qualify/--structural/--lineage` `__arrow--{family}` `__edge-label` | 选中节点 2px focus 边 | 调研 D7（d3-dag 布局 + 自绘 SVG 展示层） |
| `.dag-legend` | 常驻图例 | `__item` `__line--{family}` | 无 | 同上 |
| `.timeline` | 事件时间线 | `__item` `__icon` `__body` `__meta` | 行发丝线分隔 | 调研 D8 + Primer Timeline |
| `.rolebar` | 贡献角色分布条（只计数不评分） | `__seg--originator/--contributor/--reviewer/--verifier/--witness/--maintainer` | 必须带说明性 aria-label | 已定决策 2 |

### 2.10 工具类

| Class | 用途 |
|---|---|
| `.u-tabular` | 等宽数字（tnum） |
| `.u-mono` | mono 栈（0.92em 视觉校正） |
| `.u-truncate` | 单行截断 |
| `.u-muted` / `.u-subtle` | 次级 / 弱级文本色 |
| `.u-sr-only` | 读屏专用文本 |
| `.icon` / `.icon--sm/--lg/--xl` | 图标尺寸 |

## 3. 后续页面子代理必须遵守的三条最重要约定

1. **只用既有 class 与 token**：新页面只允许组合本章登记的组件与 `--evimesh-*` token；确需新组件时先在 app.css 与本章登记，禁止页面内私有样式、禁止裸 hex、禁止直连 primitive。
2. **状态全覆盖且文本先行**：每个数据区必须同时实现 loading（skeleton）/ empty（blank + 下一步动作）/ error（blank--error + request id + 重试）；每个徽标与状态都有文本标签，颜色永不单独承载含义；数字一律 `u-tabular`（数据加 `u-mono`）。
3. **壳与层级纪律**：沿用 gheader 五项导航与 PageHeader 四槽模板；每屏至多一个 primary 与一个 emphasis 实底徽标；间距只用 space 刻度；动效只按第 04 章清单取用；可见文案零 em-dash、零 emoji，图标只从 sprite 的 67 个 symbol 中取。
