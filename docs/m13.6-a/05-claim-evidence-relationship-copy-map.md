# M13.6-A06：Claim 与 Evidence 关系文案映射

本映射是面向阅读的中文优先文案层。协议方向始终是 `source → target`；“正向文案”从 source 打开关系，“反向阅读”从 target 回看有哪些对象指向它。页面必须同时保留两端对象的稳定 ID 与精确 revision，不能把关系渲染成父子树、支持率或真伪分数。

## 使用边界

- Claim→Claim 的 14 个关系连接两个 Claim（按实际协议上下文显示各自的 Claim revision）。它们表达论证、依赖、方法或数据等有类型的有向边。
- Evidence→immutable Claim revision 的 4 个关系连接 Evidence 到不可变的 `claimRevisionId`。Evidence 的 `supports` 只表示该证据与该 revision 的支持关系，不等同于 Claim→Claim 的 `supports`，也不等同于“已证明为真”。
- `source` 与 `target` 是协议字段，不随反向阅读改变；反向阅读只是换一个阅读入口。
- 计数校正：旧文案中的“11 项 Claim 关系”遗漏了 `implements`、`verifies`、`challenges`；此前出现的“15 项”是算术错误。本文件按协议冻结的 14 + 4 = 18 行记录。

## 关系文案表

| # | 协议关系 | 类型与 source → target | 正向自然文案（从 source 读） | 反向阅读（从 target 读） | 图例文案 |
|---:|---|---|---|---|---|
| 1 | `depends_on` | Claim source → Claim target | “此 Claim 依赖「target Claim」作为上游依据。” | “「source Claim」把此 Claim 作为上游依赖。” | 依赖 |
| 2 | `supports` | Claim source → Claim target | “此 Claim 支持「target Claim」。” | “「source Claim」支持此 Claim。” | Claim 支持 |
| 3 | `refutes` | Claim source → Claim target | “此 Claim 反驳「target Claim」。” | “「source Claim」反驳此 Claim。” | Claim 反驳 |
| 4 | `qualifies` | Claim source → Claim target | “此 Claim 限定「target Claim」的适用范围或条件。” | “「source Claim」限定了此 Claim 的适用范围或条件。” | Claim 限定 |
| 5 | `reproduces` | Claim source → Claim target | “此 Claim 复现「target Claim」所描述的结果。” | “「source Claim」复现了此 Claim 所描述的结果。” | Claim 复现 |
| 6 | `extends` | Claim source → Claim target | “此 Claim 扩展「target Claim」的结果或范围。” | “「source Claim」扩展了此 Claim 的结果或范围。” | Claim 扩展 |
| 7 | `supersedes` | Claim source → Claim target | “此 Claim 取代「target Claim」，成为后续使用的版本或主张。” | “「source Claim」取代了此 Claim；此 Claim 仍保留在历史中。” | 取代 |
| 8 | `contradicts` | Claim source → Claim target | “此 Claim 与「target Claim」相矛盾。” | “「source Claim」与此 Claim 相矛盾。” | 矛盾 |
| 9 | `derived_from` | Claim source → Claim target | “此 Claim 从「target Claim」推导而来。” | “「source Claim」由此 Claim 推导而来。” | 推导自 |
| 10 | `uses_method` | Claim source → Claim target | “此 Claim 使用「target Claim」所代表的方法。” | “「source Claim」使用了此 Claim 所代表的方法。” | 使用方法 |
| 11 | `uses_dataset` | Claim source → Claim target | “此 Claim 使用「target Claim」所代表的数据集。” | “「source Claim」使用了此 Claim 所代表的数据集。” | 使用数据集 |
| 12 | `implements` | Claim source → Claim target | “此 Claim 实现「target Claim」所定义的规范或论点。” | “「source Claim」实现了此 Claim 所定义的规范或论点。” | 实现 |
| 13 | `verifies` | Claim source → Claim target | “此 Claim 验证「target Claim」。” | “「source Claim」验证了此 Claim。” | 验证 |
| 14 | `challenges` | Claim source → Claim target | “此 Claim 对「target Claim」提出质疑。” | “「source Claim」对此 Claim 提出了质疑。” | 质疑 |
| 15 | `supports` | Evidence source → immutable Claim revision target (`claimRevisionId`) | “此 Evidence 支持 Claim revision「target revision」。” | “Evidence「source Evidence」支持此 Claim revision。” | Evidence 支持 |
| 16 | `refutes` | Evidence source → immutable Claim revision target (`claimRevisionId`) | “此 Evidence 反驳 Claim revision「target revision」。” | “Evidence「source Evidence」反驳此 Claim revision。” | Evidence 反驳 |
| 17 | `qualifies` | Evidence source → immutable Claim revision target (`claimRevisionId`) | “此 Evidence 限定 Claim revision「target revision」的适用范围或条件。” | “Evidence「source Evidence」限定了此 Claim revision 的适用范围或条件。” | Evidence 限定 |
| 18 | `reproduces` | Evidence source → immutable Claim revision target (`claimRevisionId`) | “此 Evidence 复现 Claim revision「target revision」所描述的结果。” | “Evidence「source Evidence」复现了此 Claim revision 所描述的结果。” | Evidence 复现 |

## 读图与无障碍约定

图例必须同时显示对象类型和方向，例如“Claim 支持（Claim → Claim）”与“Evidence 支持（Evidence → Claim revision）”。对同名关系，先读对象类型，再读关系词；不要把 Evidence 支持合并进 Claim 支持，也不要以两者数量计算百分比。列表视图、屏幕阅读器和深链接应复用同一行的正向与反向文案，并显示目标 `claimRevisionId`。
