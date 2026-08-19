# 06 · 个人界面规格

> 对应设计稿：`html/profile.html`（公开研究者主页）、`html/settings.html`（Account Settings）、`html/agent-center.html`（Agent 接入中心）。
> 个人界面分为公开身份与私有账户两层，永远不混在同一页面；OAuth 身份、公开链接与权限凭据分表建模（M13.7 5.3）。

## 1. 公开研究者主页（profile.html）

**回答的问题**：这个人是谁、身份可信吗、做过什么、用哪些 Agent 工作。

内容契约：

- 身份头：大头像、display name、bio、affiliation、research fields。
- **ORCID 呈现（硬合规）**：仅 OAuth 验证过的 iD 可显示「已验证」；展示为 官方 iD 图标 + 完整 URL（`https://orcid.org/XXXX-XXXX-XXXX-XXXX`）+ 可点击 + alt/ARIA；深色主题用反白图标。设计稿中用 Phosphor identification-badge 占位，**生产必须替换为官方 ORCID iD 图标**（见 00 调研 3.1）。手填 iD 只能作为普通链接并标注未验证，永不显示为已验证。
- GitHub 关联与个人网站为次级 meta。
- **公开贡献**：rolebar（六角色计数条 + 文字数值，仅计数）+ role 徽标时间线（每条可链接到事件/对象）+「按角色与时间，不排序不评分」。
- **参与的项目**：项目卡带角色徽标（maintainer / originator 等）。
- **她的 Agent 侧栏**：每个 agent 一张身份卡（名称、归属说明、模型 self_declared、scope、密钥指纹、最后活动）；只读 agent 与可起草 agent 分级展示。
- 私有性提示条：主页只展示本人选择公开的字段。

**禁止**：贡献热力图（易被误读为质量分）、关注者/点赞计数排位、把 agent 活动伪装成人类活动。

## 2. Account Settings（settings.html，私有）

**回答的问题**：我如何管理自己、身份与凭据。

结构：左上下文侧栏（Profile / Connected identities / Tokens / Security / Notifications），右侧分区纵向排布（锚点导航）。

内容契约：

- **Profile（私有）**：display name / bio / affiliation / research fields 表单；每个字段的公开可见性说明；「预览公开主页」出口（连接两层）。
- **Connected identities**：
  - GitHub 行：关联时间 + 已验证徽标；解除关联需重新认证并写入审计的说明。
  - ORCID 行：未关联时提供「关联 ORCID」（走 OAuth）；说明「手工填写的 iD 只能作为普通链接，永不显示为已验证」。
  - Email 行：回退路径 + 已验证。
  - 碰撞警示 alert：同 iD 已绑定其他账户时流程暂停并要求双方重新认证，不按邮箱自动合并（Supabase identity linking 结论）。
- **Tokens（高级路径）**：
  - 顶部 info alert：CLI/MCP 优先设备授权；Token 服务于自动化/SDK。
  - 表格列：名称 / scope（mono、人类可读）/ 创建与过期 / 最后使用 / 状态（active/expired）/ 撤销。
  - 撤销用 danger 色文字按钮（生产必须经 Confirm alertdialog）。
  - 创建流程要点：必须命名、默认过期、最小 scope、可选限定 Project；明文只显示一次（设计稿未画创建对话框，落地时按 D10）。
  - 明文 Token 不进入 URL、日志、handoff、Analytics 或浏览器持久存储。
- **Security**：Ed25519 签名密钥（指纹、轮换入口、runbook 链接）、活跃会话（设备授权条目可见）、结束其他会话。
- **Notifications**：critical 即时、每周 digest、被质疑即时、quiet 折叠说明。

## 3. Agent 接入中心（agent-center.html，/agent）

**回答的问题**：怎么让我的工具安全地读取并继续研究。

结构：Overview（连接向导）+ MCP / CLI / SDK / Read with an agent / Security 侧栏分区。

内容契约：

- **六步 stepper**（状态：done / current / pending，连线为发丝线）：
  1. 选择客户端（Codex/Claude/Cursor、sq CLI、SDK 三卡；推荐路径徽标给 MCP 客户端）。
  2. 登录并授权最小权限（设备授权完成态显示 scope）。
  3. 复制或自动生成配置：`codeblock__bar + codeblock` 展示 mcp.json；**示例使用 `auth: device-flow` 等占位，绝不出现真实 token**；一键复制按钮。
  4. 测试连接（握手与只读能力协商，显示成功/失败原因）。
  5. 读取一个真实公开 Question（指定 question id，返回范围/前沿/待办）。
  6. 查看来源与 handoff（核对 revision、Policy、签名，从 handoff 恢复上下文）。
- **Read with an agent**：对象语义、四视角、只读发现 vs 写入工具（confirm 标注）的说明 + 从 MCP schema 生成的工具目录表（工具 / 类别 / 只读·需 confirm·需 confirm+签名 三级徽标）。
- **Security 与撤销**：当前授权卡（scope、授权时间、最后活动）、调整 scope、撤销授权（danger ghost）；info alert：凭据不出现在示例、URL、日志或 handoff。

**禁止**：把长期 Token 作为新用户首选路径；示例中出现真实凭据；隐藏 scope 与撤销入口。
