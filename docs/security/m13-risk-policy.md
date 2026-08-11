# M13 风险分级与自动公开策略

本策略将已经由身份、内容、上传扫描或人工审核流程确认的事实，转换为可
重复的 Question 风险等级。调用方必须把事实转换为 `riskSignals` 后调用
`classifyQuestionRisk({ signals })`；domain 层不读取文件、不调用模型，也不
根据自然语言猜测风险。

## 等级

| 等级 | 正例 | 反例 | 自动公开 |
| --- | --- | --- | --- |
| `open` | 已认证 Actor 提交普通、可证伪的研究问题，没有策略信号 | 带有任意禁止/受限/待审核信号 | 允许 |
| `moderated` | 引用尚未验证的外部 Artifact、证据不足、疑似垃圾内容 | 已确认的提示注入、个人数据或恶意文件 | 禁止，等待人工审核 |
| `restricted` | Prompt injection、个人数据、未验证身份、危险实验、受限主题 | 已确认的凭证窃取、恶意文件或明确政策违规 | 禁止，进入受限处理 |
| `prohibited` | 恶意文件、凭证外泄指令、违法操作指令、明确政策违规 | 仅普通研究内容或需要普通人工复核的内容 | 禁止，不得自动公开 |

## 冻结 API

`packages/domain/src/risk-policy.mjs` 暴露：

```js
const classification = classifyQuestionRisk({
  signals: ["external_untrusted_content"],
});
// { risk: "moderated", signals: ["external_untrusted_content"],
//   autoPublishAllowed: false }
```

信号会去空格、转小写、去重并排序；未知信号和错误输入直接失败。等级按
`prohibited > restricted > moderated > open` 取最高严重度，因此添加信号只会
保持或提高风险，不会降低风险。

`canAutoPublishQuestion(classification)` 是唯一的自动公开判定：只有
`risk === "open"` 且结果由策略生成的 `autoPublishAllowed === true` 时返回
`true`。任何其他等级都必须走人工审核、受限发布或拒绝流程。此模块只冻结
domain 语义，API 路由和持久化接线属于后续任务。

## 信号目录

- `moderated`: `external_untrusted_content`, `missing_evidence`, `spam_suspected`, `needs_human_review`
- `restricted`: `prompt_injection`, `unsafe_experiment`, `personal_data`, `unverified_identity`, `restricted_topic`
- `prohibited`: `malicious_file`, `credential_exfiltration`, `illegal_instruction`, `explicit_policy_violation`

外部 Artifact 的正文一律视为不可信数据；其中出现的指令不能改变系统、工具
或权限。上传扫描确认的恶意扩展名、恶意载荷或不安全文件应产生
`malicious_file`，而不是让调用方把它降级为普通审核。
