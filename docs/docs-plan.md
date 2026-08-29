# EviMesh Docs 建设计划

> **状态（2026-08-29）：planned。** 本文是 `/docs` 产品文档建设的事实源。
> 当前 `/docs` 仅重定向到 `/agent.md`，`apps/docs` 也只有一份骨架 README；
> 本计划把 Docs 建设为面向研究者、Agent 开发者、验证者和平台运维者的
> 一等产品入口，而不是工程仓库文件列表。

## 1. 目标与非目标

### 1.1 目标

Docs 必须让四类读者在 3 分钟内找到正确路径：

1. **研究者**：理解 EviMesh 的对象模型、如何浏览研究、关注问题、验证 Claim、发起 Challenge。
2. **Agent 开发者**：连接 MCP/CLI/SDK，读取对象，提交草稿，明确 human-in-the-loop 和签名边界。
3. **验证者**：理解 blind/context modes、Receipt/Finding、Frontier 与污染传播，完成可追溯验证。
4. **平台维护者**：完成本地环境、Supabase/Cloudflare 部署、密钥轮换、事故响应和生产排障。

文档产品的成功标准不是“仓库里有 Markdown”，而是：

- 每个核心工作流有唯一 canonical 页面；
- 文档中的命令、API 路径、状态枚举来自代码或生成产物；
- 页面之间可按读者任务导航，不需要理解 monorepo 目录；
- Agent 可通过 `llms.txt`、Markdown 路由和 MCP resource 读取同一事实；
- 每个发布版本能知道哪些文档随协议或 API 发生变化。

### 1.2 非目标

- 不把 `docs/design/`、ADR、审计报告和里程碑记录原样暴露给普通读者；
- 不在第一阶段引入另一套站点框架或第二个视觉系统；
- 不手写一份与 `openapi.json`、schema、CLI help 平行且会漂移的 API 参考；
- 不把文档搜索做成按热度、浏览量或“推荐分数”排序；
- 不把 Docs 变成营销博客、论坛或 changelog 系统。

## 2. 当前状态与问题

| 现状 | 问题 | 处理 |
|---|---|---|
| `apps/web/app/docs/page.js` 重定向 `/agent.md` | Docs 一级导航没有真正页面；研究者与运维者被错误导向 Agent 手册 | 移除重定向，建设 `/docs` 首页 |
| `apps/docs/README.md` 只有“当前为骨架包” | 单独 docs app 没有实现、部署或组件资产 | 冻结 `apps/docs`，短期不复活 |
| `docs/*.md` 与 `packages/*/README.md` 数量多 | 以里程碑和仓库所有权组织，不按用户任务组织 | 建 canonical 内容层，并保留源文件为工程参考 |
| `/agent.md` 是唯一公开文档资产 | 只覆盖 Agent 手册，且没有站内导航和相关内容 | 纳入 Agent 开发者路径，不再充当 Docs 全部内容 |
| `apps/api-edge/openapi.json` 有 62 个 paths | API 参考具备机器事实源，但没有可浏览产品界面 | 从 OpenAPI 生成或按 tag 渲染参考页 |
| CLI/MCP/SDK 各有 README | 内容重复、版本边界和命令示例容易漂移 | canonical 页引用包 README，命令块由测试锁定 |
| 设计书、ADR、运行手册混在 `docs/` | 对读者层级不透明，容易误把历史决策当现行用法 | 明确“产品文档 / 参考 / 运维 / 内部设计”四层 |

## 3. 架构裁决

### 3.1 文档先内建到现有 Web App

第一阶段选择 **`apps/web/app/docs/*`**，不复活独立 `apps/docs`：

- `/docs` 已是产品一级导航；
- 可直接复用当前 token、TemplateShell、TabNav、Rail、ProvenanceList 和状态组件；
- 与登录态、对象永久链接、command palette 和移动导航一致；
- 只有一个 Cloudflare 部署面和一个可访问性基线；
- 避免引入 Nextra/Docusaurus/Fumadocs 等第二套视觉系统。

`apps/docs` 保留为未来独立部署的占位包。只有满足以下条件才重新评估拆站：

- 文档构建时间显著拖慢 Web 发布；
- 需要多版本文档并行托管；
- 文档团队需要独立发布权限或独立域名；
- 内容数量超过现有 App Router 架构的合理维护范围。

### 3.2 内容格式

- canonical 内容放在 `docs/product/`，使用标准 Markdown；
- 页面路由使用小型 Markdown loader + 现有 React 组件渲染；
- 不允许在 Markdown 内嵌任意 HTML/JS；
- frontmatter 只允许：`title`、`description`、`audience`、`status`、`sourceOfTruth`、`updatedAt`；
- `sourceOfTruth` 必须指向代码、OpenAPI、schema、runbook 或 ADR，不能只写另一篇摘要。

建议目录：

```text
docs/product/
  index.md
  getting-started/
    researcher.md
    agent-developer.md
    verifier.md
    self-hosting.md
  concepts/
    object-model.md
    claim-lifecycle.md
    evidence-and-relations.md
    verification-receipts.md
    challenges.md
    frontiers.md
    attribution-and-signatures.md
  guides/
    browse-and-watch.md
    connect-an-agent.md
    submit-a-claim-draft.md
    attach-evidence.md
    run-a-blind-verification.md
    challenge-a-claim.md
    inspect-provenance.md
    export-a-frontier-bundle.md
  reference/
    api.md
    mcp.md
    cli.md
    sdk-ts.md
    schemas.md
    events.md
    status-and-error-codes.md
  operations/
    local-development.md
    hosted-readiness.md
    production-release.md
    signing-key-rotation.md
    incident-response.md
```

## 4. 信息架构

### 4.1 Docs 首页 `/docs`

首页不是文章列表，而是任务入口：

1. **Start here**：四张读者路径入口（研究者 / Agent 开发者 / 验证者 / 自托管）；
2. **Core concepts**：Question、Claim、Evidence、Verification、Challenge、Frontier 的关系图和 list 等价视图；
3. **Common workflows**：连接 Agent、浏览并关注、验证 Claim、检查 provenance；
4. **Reference**：API、MCP、CLI、SDK、schemas；
5. **Trust and safety**：签名、归属链、权限、无评分边界；
6. **Operations**：部署、密钥和事故响应，只对运维读者突出。

首页不显示“热门文档”、浏览量、完成百分比或评分。

### 4.2 文档页模板 `/docs/[...slug]`

桌面三列、移动单列：

- 左侧：Docs section 导航；
- 中间：文章主体（最大阅读宽度 72ch）；
- 右侧：本页目录 + source-of-truth + last updated；
- 移动端：section 导航进入 drawer，目录折叠在标题下；
- 代码块具备复制按钮、语言标签、长行横向滚动；
- 标题锚点可复制，避免只依赖视觉层级；
- 前后页导航按 IA 顺序，不按热度。

产品文档正文默认 sans。仅协议中的 Claim statement 示例可使用 scoped serif；不把 Docs 写成学术出版物。

### 4.3 搜索

MVP 使用构建期生成的静态索引：

- 索引标题、描述、标题层级和正文片段；
- 支持稳定 URL 与键盘导航；
- 排序只按字段匹配和文档分区，不显示相关度分数；
- 过滤维度：audience / section / type；
- 无结果时给出 CLI/MCP/API 参考入口和 GitHub issue 路径；
- 后续内容规模足够大再评估 Pagefind，不先引入搜索服务。

## 5. 第一批内容（MVP）

### 5.1 P0：必须先写

1. **What is EviMesh?**
   - 开放分布式研究网络；
   - agents draft, humans sign；
   - 计数是入口，不是支持分数；
   - Claim graph 是 DAG，不是 parent-child tree。
2. **Object model**
   - Question → Project → Claim → Evidence / Run / Receipt / Finding / Challenge → Frontier；
   - 每个对象的 stable id、revision 与 permalink；
   - 14 种 Claim relation 的方向语义。
3. **Researcher quickstart**
   - Explore → 打开 Question workspace → 关注对象 → 阅读 Claim / Evidence / Receipt → 继续给 Agent。
4. **Agent developer quickstart**
   - MCP 推荐路径；
   - token/scope；
   - read/draft/confirm/sign 分界；
   - 本地配置示例零真实凭据。
5. **Verifier quickstart**
   - context mode、blind verification、receipt、finding；
   - outcome 不等于真值；
   - critical finding 与 supported outcome 可以并存。
6. **API/MCP/CLI reference landing**
   - 指向生成参考和包文档；
   - 说明版本、认证、请求 id 和错误结构。

### 5.2 P1：工作流文档

- 连接并撤销 Agent；
- 起草 Claim；
- attach evidence；
- 记录 Run 和 artifact；
- 请求/执行 verification；
- 发起 Challenge；
- 浏览 DAG 与 list 等价视图；
- 导出/验证 Frontier bundle；
- 检查 event hash chain；
- 管理 ORCID/GitHub identity（明确 verified 规则）。

### 5.3 P2：运维与扩展

- 本地基础设施；
- hosted Supabase 与 RLS；
- Cloudflare Worker/Web 部署；
- R2 CORS；
- 平台签名密钥轮换；
- secret exposure 与事故响应；
- SDK 扩展和 schema 兼容策略。

## 6. 现有内容迁移映射

| 新 canonical 页面 | 现有来源 | 策略 |
|---|---|---|
| Object model | `README.md`、`packages/protocol/README.md`、`docs/m13.6-a/01-protocol-ux-map.md` | 重写为读者视角，链接协议源码 |
| Claim lifecycle | `packages/protocol/src/claim-state.mjs`、`docs/m13.6-a/03-claim-status-summary-contract.md` | 枚举/转移由测试读取源码校验 |
| Evidence relations | `docs/m13.6-a/05-claim-evidence-relationship-copy-map.md`、schema | 提炼 canonical copy map |
| Verification | `docs/m8-context-verification.md`、verification schema、OpenAPI | 重写 quickstart + 生成字段参考 |
| Agent quickstart | `/agent.md`、`apps/mcp/README.md`、`docs/m11-mcp-server.md` | `/agent.md` 保留纯 Markdown mirror |
| CLI | `packages/cli/README.md`、`docs/m10-sdk-cli.md` | 包 README 继续面向安装，Docs 面向工作流 |
| SDK | `packages/sdk-ts/README.md`、generated types | 自动列版本和公开入口 |
| Frontier bundle | `docs/m12-frontier-bundles.md`、`packages/frontier-bundle/README.md` | 工作流 + 格式/验证参考拆分 |
| Operations | `docs/hosted-readiness.md`、`docs/infra-*.md`、`docs/runbooks/*` | 保留 runbook canonical，Docs 提供入口和前置条件 |
| Internal design | `docs/design/*`、`docs/m13.7-a/*` | 不进入普通 Docs 导航；仅在 Contributor reference 暴露 |

迁移原则：不是复制粘贴。每个旧文件必须被标为以下之一：

- canonical（继续作为事实源）；
- source（Docs 从这里提炼，读者不直接导航）；
- superseded（头部链接到新页面）；
- internal（不进入产品 Docs）。

## 7. 技术实现阶段

### PR-Docs-A：Docs shell 与内容 loader

- `/docs` 首页替换 redirect；
- `/docs/[...slug]` App Router 页面；
- frontmatter parser、Markdown AST、标题锚点、代码块；
- `DocsNav`、`DocsToc`、`DocsArticle`、`SourceBadge`；
- loading/empty/not-found/error 状态；
- 390/768/1440 响应式布局；
- 不引入第二套组件系统。

### PR-Docs-B：P0 内容

- 4 个 quickstart；
- 7 个核心概念；
- API/MCP/CLI/SDK reference landing；
- `/agent.md` 与 Agent quickstart 的内容镜像策略；
- canonical/superseded 标记回写旧文档。

### PR-Docs-C：生成参考

- OpenAPI 按 tag 生成 endpoint 索引；
- schema 列表及版本；
- CLI `--help`、MCP tools/resources 生成校验；
- protocol 状态和 14 种 relation 枚举机械校验；
- CI 检测生成参考是否过期。

### PR-Docs-D：搜索和机器入口

- 构建期静态搜索索引；
- `/llms.txt`、`/llms-full.txt`；
- 每篇文章 `.md` mirror；
- sitemap、canonical metadata、robots；
- command palette 搜索 Docs；
- MCP resource 增加 canonical Docs 索引。

### PR-Docs-E：运维文档与验收

- operations 信息架构；
- runbook 链接检查；
- 生产 release 文档；
- 截图与键盘验收；
- 文档审查责任矩阵和更新 SLA。

## 8. 自动化与防漂移

### 8.1 必须机械校验

1. 所有内部链接和标题锚点有效；
2. frontmatter 必填字段完整；
3. canonical URL 唯一；
4. OpenAPI paths/tags 与生成参考一致；
5. protocol 状态、relation 类型、receipt outcome 与源码一致；
6. CLI 示例命令至少通过 parser 或 `--help` 冒烟；
7. MCP tool/resource 名称与注册表一致；
8. 代码块禁止真实 token、私钥、邮箱和生产 project ref；
9. 可见文案不出现公开 evidence scores、热度排行或伪 verified ORCID；
10. superseded 文件必须链接到 canonical 页面。

### 8.2 内容 ownership

| 内容 | 责任源 | 变更触发 |
|---|---|---|
| 协议概念/状态 | protocol/domain owner | schema 或 state machine 变化 |
| API reference | api-edge owner | `openapi.json` 变化 |
| MCP/CLI/SDK | 对应 package owner | 命令、tool、类型或版本变化 |
| Researcher workflows | Web/product owner | 页面流或 copy contract 变化 |
| Operations | Platform owner | workflow、infra、secret policy 变化 |
| Security | Security owner | threat model、incident procedure 变化 |

每个 PR 改动相应事实源时，CI 必须提示 Docs ownership；不能靠季度人工巡检发现漂移。

## 9. 视觉与交互规格

- 延续 `docs/design/11-revision-decisions.md`：现代科研基础设施，VAR 4 / MOTION 2 / DENSITY 7；
- 首页允许入口卡，但文章页不做卡片墙；用层级、留白和发丝线组织；
- prose 最大 72ch，代码/表格可突破阅读列但不得推动整页横向滚动；
- 标题默认 sans，协议 statement 示例可 scoped serif；
- 左导航和目录选中态只表示当前位置，不表示进度或排名；
- warning/danger 只表达安全、兼容性和不可逆操作；
- API endpoint 使用 method 文本 + 路径，不用彩色评分式标签；
- 所有代码块、tabs、搜索、drawer 和 heading anchor 键盘可达；
- reduced-motion 下无平滑滚动或自动高亮动画；
- 暗色与亮色共用 semantic token，WCAG 2.2 AA；
- Docs 页不能出现营销 hero、超大标题、三等分功能卡墙或渐变装饰。

## 10. Definition of Done

### 每篇文档

- 有明确 audience、目标、前置条件和成功结果；
- 命令和 API 示例可运行或被测试；
- 关键概念链接到 canonical 页面；
- 至少一个“下一步”；
- source-of-truth 和 updatedAt 在页面可见；
- 不泄露凭据，不伪造 verified，不产生 score 语义。

### Docs MVP

- `/docs` 不再重定向，四条读者路径可用；
- P0 内容全部上线；
- `/agent.md` 继续兼容但不再是唯一 Docs；
- API/MCP/CLI/SDK 参考入口可访问；
- light/dark × 390/768/1440 截图通过；
- 键盘完成：打开导航 → 搜索 → 进入文章 → 跳标题 → 前后页；
- 内部链接、OpenAPI、schema、CLI/MCP 名称同步检查全绿；
- Web 测试、lint、Next build 全绿；
- 文档首页 LCP < 2.5s，无第三方搜索阻塞首屏。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Docs 变成第二套设计系统 | 内建 `apps/web`，只用现有 tokens/components |
| Markdown loader 变成复杂 CMS | MVP 仅本地只读 Markdown + 白名单 frontmatter |
| API 参考很快过期 | 从 OpenAPI 生成并在 CI 检测 dirty diff |
| 包 README 与产品 Docs 重复 | README 负责安装/贡献，Docs 负责任务；互相链接不复制 |
| 内部历史文档误导用户 | canonical/source/superseded/internal 四态标记 |
| 搜索相关度被误读为价值排序 | 不显示分数，不按点击量/热度排序 |
| 文档内容与产品 UI 再次漂移 | Web 流程变化必须同时更新对应 guide；ownership 检查提示 |
| 多版本需求过早复杂化 | 先单一 current 版本；出现真实兼容窗口再拆站 |

## 12. 实施顺序与投入估算

| 阶段 | 产出 | 预计 |
|---|---|---|
| Docs-A | Shell、loader、首页、文章模板 | 2-3 天 |
| Docs-B | P0 内容与旧文档状态回写 | 3-5 天 |
| Docs-C | OpenAPI/schema/CLI/MCP 生成参考 | 2-4 天 |
| Docs-D | 搜索、llms.txt、Markdown mirror、sitemap | 2-3 天 |
| Docs-E | 运维内容、门禁、全矩阵验收 | 2-3 天 |

建议先完成 Docs-A + Docs-B，形成可用 MVP；Docs-C/D/E 在真实使用反馈下继续。
总投入约 11-18 个工程日，内容审查时间不计入编码估算。
