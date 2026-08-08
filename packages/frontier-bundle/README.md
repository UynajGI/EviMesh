# @evimesh/frontier-bundle

Frontier Bundle 导出、离线验证与导入（M12）：让任何正式前沿可离线验证、公开镜像和重新导入。

## Bundle 目录规范（M12-01）

```
manifest.json                      清单：每个文件的 sha256/size/role（M12-02）
checksums.txt                      所有文件的 SHA-256 清单（M12-09）
report.md                          人类可读报告：accepted/contested/验证结果（M12-10）
frontier.json                      FrontierSnapshot 与成员
claims/<claimId>.json              每个成员固定的 Claim revision（M12-03）
evidence/<evidenceId>.json         引用的 Evidence（M12-04）
artifacts-manifest.json            引用 Artifact 的 hash/size/role
verification-receipts/<id>.json    前沿依赖的 VerificationReceipt（M12-05）
contributions.json                 贡献 produced/used 边（M12-06）
events.ndjson                      前沿依赖的 Event 区间（M12-07）
checkpoints/<checkpointId>.json    Merkle checkpoint + OTS proof（M12-08/23）
proofs/<eventId>.json              每个 Event 的 inclusion proof（M12-08）
```

## 用法

```js
import { exportFrontierBundle, verifyFrontierBundle, precheckBundleImport, importFrontierBundle } from "@evimesh/frontier-bundle";

// 导出（zip: true 同时产出 ZIP 字节，M12-11）
const { files, manifest, zip } = await exportFrontierBundle({ repository, snapshotId, zip: true });

// 离线验证（断网可用，M12-12）：hash、清单、checksums、proof-checkpoint 绑定
const verification = verifyFrontierBundle(files, { platformKey });

// 导入预检（不写库，输出冲突报告，M12-13）
const precheck = await precheckBundleImport({ repository, files });

// 导入（预检通过后写入，M12-14）
await importFrontierBundle({ repository, files });
```

## 镜像与见证

- `github-release.mjs`：GitHub Release 创建与 asset 上传（M12-17/18），token 只经 API。
- `mirror.mjs`：镜像回执记录（M12-19）、失败重试入队（M12-20）、第二存储适配器注册表（M12-21）。
- `ots-adapter.mjs`：OpenTimestamps 适配器接口与本地实现、OTS proof 存储（M12-22/23）。
- `witness.mjs`：第三方 Witness checkpoint 格式（M12-24）与回执导入（M12-25）。

仓库契约均为注入式（`repository` 参数），离线/测试用内存 fake 即可。

## 测试

```bash
pnpm --filter @evimesh/frontier-bundle test
```
