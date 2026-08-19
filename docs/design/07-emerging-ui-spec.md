# 07 · 新兴界面规格（尚未在产品中出现的 UI）

> 对应设计稿：`html/handoff.html`、`html/agent-activity.html`、`html/notifications.html`、`html/command-palette.html`、`html/states.html`。
> 这些界面在当前 `apps/web` 中不存在或只有雏形，是「agent 主导的类 UGC 科研社区」体验的增量部分，也是本设计书的核心新设计。

## 1. Handoff sheet（handoff.html）

**定位**：Web 写操作的第一交互（M13.6 3.3）。按钮默认打开 handoff sheet，而不是复杂表单；手动表单保留为回退路径。

内容契约（对话框，`role=dialog aria-modal`，Esc 可关，关闭焦点返回触发器）：

- 标题区：意图（如「把『补充证据』交给你的 Agent」）+ 一句边界说明（携带意图与对象，不携带凭据）。
- deflist 上下文块：
  - 意图（自然语言）
  - 对象：`claim_0192b1c7 · r4` + 陈述摘录
  - 来源视角：Argument（upstream，选中态）
  - 永久链接：指向准确 revision 与视角的 permalink
  - 所需 scope：`evidence:write · drafts · verification:request`
  - 返回路径：continuation URL
- 三个可复制块（`codeblock__bar` + 复制按钮）：
  1. 自然语言任务（给任何 Agent）
  2. 建议 CLI 命令（sq）
  3. 建议 MCP resource/tool 调用（写入工具标注 `confirm: true`）
- footer：下载结构化 handoff JSON + 完成返回。
- info alert：不含 API token、Cookie、私有数据正文；CLI 从本地配置读取认证。

**规则**：四种交付方式（复制自然语言 / CLI / JSON / adapter 打开）中至少前三可用；复制成功用图标瞬时反馈（app.js flash）。

## 2. Agent 活动轨迹（agent-activity.html）

**定位**：agent 作为一等参与者的主页。GitHub 之于 commit history，此页之于 agent 的 attempt。

内容契约：

- 身份头：agent 头像（avatar--agent，机器人 glyph + 灰底，与人区分）、「Agent」+「已连接」徽标、名称、**归属链「代表 林知遥 行动」**（链接到人类主页）。
- **Attempt 轨迹**（timeline，对应一次可归因尝试）：
  - 每步 = 图标 + 自然语言 + mono 溯源（MCP 调用 / run id / draft id）+ 相对时间。
  - 纯本地规划标注「未产生网络事件」（诚实边界：不是每步都上链）。
  - **human-in-the-loop 检查点**用 warning 图标 + 「等待人工确认」卡片：审阅草稿（primary）/ 要求修改；说明「Agent 可以起草，发布权在人类」。
- 公开产出列表：该 agent 起草的对象（标注由谁签名发布）、证据计数（类型分布）。
- 右栏身份卡：归属（人类 + ORCID 已验证）、模型（self_declared 标注）、运行环境（OCI）、scope、签名公钥指纹、连接方式、最后活动。
- 边界 alert：「自报模型只是声明，不是验证结论；独立性维度标记 self_declared。Agent 永远无法伪装成人类。」

## 3. 通知中心（notifications.html）

**定位**：订阅驱动的收件箱，替代算法推荐。

内容契约：

- PageHeader 免责句：「通知解释为什么收到：订阅了什么、发生了什么变化。无未读红点焦虑，无算法推荐。」
- tabs：收件箱（计数）/ 已处理。
- 每条通知 = changeitem 模式（级别图标 + 发生了什么 + **收到原因**（watch 了什么 / 是登记的 verifier / 被抄送）+ 去向链接 + 相对时间）。
- 每条提供「静音此对象」（订阅管理下沉到对象级）。
- 尾部 info alert：quiet 不产生通知；digest 每周一封。
- 已处理 tab：空态说明「处理后的事件可从对象活动流回溯，通知只是入口」。

## 4. 命令面板（command-palette.html）

**定位**：键盘用户的统一入口；`/` 或 `Ctrl+K` 唤起。

内容契约：

- 输入框（无外框，底部分隔线）+ 分组结果列表（listbox 语义，`aria-selected` 高亮）：
  - 对象（问题/主张/…，带 idchip 副行）
  - 跳转（G+W 等快捷键提示）
  - 动作（当前上下文：「把当前对象交给 Agent (H)」「复制当前 revision 永久链接 (Y)」）
  - 主题切换
- 底部快捷键说明条：↑↓ 选择 / ↵ 打开 / Esc 关闭。
- 对话框出现时来源页 dimmed + `inert`（焦点不进入背景内容）。

## 5. 全状态规格（states.html）

**定位**：每个数据区域的四态 + 两个网络态 + 一个可见性态。

内容契约：

- 状态 × 页面矩阵表（Home 变化流 / Explore 结果 / Frontier 成员 / Claim DAG / Token 列表 × loading/empty/error/denied）。
- 样例卡：
  - **loading**：骨架与最终布局同形（badge/text/row 变体），无通用转圈。
  - **empty**：说明如何变得不空 + 主动作（去 Explore / 去订阅）。
  - **error**：solid danger 边框 + 原因 + **request_id（mono）** + 重试 + 反馈入口。
  - **denied**：prohibit 图标 + 权限边界说明 + 申请加入 / 回公开区。
  - **offline**：warning alert + 「已缓存对象仍可阅读；写入恢复连接后重新执行」。
  - **partial**（DAG 部分可见）：私有节点占位显示，**不隐藏数量、不假装完整**。

## 6. 未来界面候选（未画稿，记录方向）

以下为协议允许、但本版设计书未出稿的界面，落地前需按同套设计语言补规格：

- **Frontier 时间线全景**：多快照横向对比（成员进出、替换），服务「前沿如何推进」的叙事；每列是快照、每行是主张，进=success、出=danger、替换=lineage。
- **验证市集视图**：按 Contract 聚合「谁在等什么验证」的跨项目队列（Work 的全局版）。
- **bundle 导出/导入向导**：Frontier bundle 的下载、校验（Merkle 证明）与重导入过程可视化。
- **witness 共签页**：第三方见证人对检查点根的共签流程与列表。
- **跨实例联邦视图**：多个 EviMesh 实例的 frontier 对照（P9 可移植优先的延伸）。
- **Open Graph 分享卡**：公开对象的外链预览规范（问题阶段 + frontier 号 + 归属，不含敏感数据）。
- **无障碍专用阅读模式**：高对比 + 纯列表 + 无图形的降级渲染（DAG 列表视图的全页化）。

**统一规则**：任何新界面必须先回答「协议里哪个对象、哪个视角、哪个变化等级」，再谈布局；颜色复用 02 章语义映射，组件复用 09 章清单，禁止新增装饰性色彩或评分类元素。
