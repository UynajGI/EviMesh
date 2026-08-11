# M13 威胁模型：安全、可观测性、备份与运维

## 边界与资产

EviMesh 的主要资产是 Actor 身份与 API Token、Question/Claim/Artifact 等
研究对象、ResearchEvent 审计记录、R2 对象及哈希、数据库备份，以及用于
发布和运维的密钥。公开数据可被读取，但写入、权限、来源和完整性必须可
验证。任何 Secret、服务角色凭证和备份加密材料只能存在于受保护的运行时
或托管 Secret 中。

## 威胁面与控制目标

| 威胁面 | 典型攻击 | 控制目标 |
| --- | --- | --- |
| 身份 | 冒用 Actor、滥用 API Token、越权跨 Actor 读取或写入 | 身份与 scope 最小化；敏感操作绑定 Actor；异常授权失败并留审计记录 |
| API | 重放签名、暴力请求、CSRF、错误处理泄露信息 | nonce 一次性使用；Actor/Token 限流；写请求 CSRF 防护；稳定错误码与 request_id |
| R2/Artifact | 恶意文件、伪造哈希、对象枚举、同源备份丢失 | 上传前类型与配额检查；内容哈希与来源绑定；R2 清单；异地备份与恢复抽样 |
| Prompt injection | 外部 Artifact 伪装成系统指令，诱导工具调用或泄露 Secret | 外部内容显式标为 `untrusted_content`；工具 scope 与确认边界独立于研究文本 |
| 恶意文件 | 可执行脚本、伪装扩展名、压缩炸弹、含恶意载荷的文档 | 允许类型白名单/扩展名策略、大小配额、扫描拒绝；被拒对象不得进入正式 Artifact |
| 运维与供应链 | 依赖漏洞、浮动 CI Action、失误发布、Secret 泄露 | 高危依赖阻断 CI、Actions 固定 SHA、发布/泄露 Runbook、最小权限和轮换 |

## 风险分类的使用规则

调用方先完成身份、上传扫描和内容 provenance 检查，再把明确的策略事实
转换成 M13 风险信号。`classifyQuestionRisk` 只做确定性组合，不承担检测
责任。任何未信任外部文本必须至少产生 `external_untrusted_content`；确认
为 Prompt injection、个人数据、危险实验或未验证身份时，使用更高等级信号。
确认恶意文件、凭证外泄、违法操作指令或明确政策违规时，必须使用
`prohibited` 信号。

## 失败安全与证据

- 检测器不可用、输入不完整或信号无法映射时，不得默认为 `open`；调用方应
  停止自动公开并转入 `needs_human_review` 或受限错误路径。
- `open` 只表示当前已知信号集合中没有阻断项，不表示内容绝对安全。
- 每次拒绝或降级都应保留稳定 rule code、request_id、Actor/Token 维度的最小
  审计信息，不记录文件正文、Token 或个人敏感数据。
- RPO/RTO、备份和恢复演练必须有可脱敏证据；没有证据不能声称控制已完成。

## M13 后续验证边界

本文件和 risk policy 冻结 domain 契约。API 限流、重放保护、CSRF、安全头、
MCP scope、监控、备份、恢复演练和云端控制台接线由 M13 后续任务分别实现。
