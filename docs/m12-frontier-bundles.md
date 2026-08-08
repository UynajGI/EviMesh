# M12 Frontier Bundle、公共镜像与迁移

## 目标

确保任何正式前沿（Frontier）可离线验证、公开镜像和重新导入。核心交付在
`packages/frontier-bundle`：导出器、离线验证器、导入器，以及镜像与见证模块。

## Frontier Bundle（M12-01..14）

- **目录规范与清单**（`spec.mjs`/`manifest.mjs`）：bundle 是内容寻址目录，
  `manifest.json` 为每个文件记录 `sha256`/`sizeBytes`/`role`。
- **导出器**（`exporter.mjs`）：从一个已发布 FrontierSnapshot 导出固定 Claim
  revision、引用 Evidence、依赖 VerificationReceipt、贡献图、Event NDJSON、
  Merkle checkpoint 与 inclusion proof、checksums.txt、report.md，并可产出
  ZIP（`zip.mjs`，stored 格式自实现）。
- **离线验证**（`verify.mjs`）：断网校验 hash/清单/checksums，并强制
  proof 根等于已验证 checkpoint 根（防"自洽但无关"的伪造 proof）。
- **导入**（`importer.mjs`）：`precheckBundleImport` 不写库输出冲突报告；
  `importFrontierBundle` 预检通过后事务写入。DR 演练（M12-26）证明
  "导出 → 空实例导入 → 再导出" 字节级一致。

## 公共镜像（M12-15..21）

- **镜像仓库**：`github.com/UynajGI/EviMesh-frontiers`（public），初始化含
  验证说明 README；每次前沿发布镜像为一个 GitHub Release + `<snapshotId>.zip` asset。
- **Release 客户端**（`github-release.mjs`）：REST API 创建 Release、上传 asset；
  token 只发往 api.github.com / uploads.github.com。
- **Worker 任务**（`apps/worker/src/mirror-release-worker.mjs`）：从 outbox 事件
  解析已发布 Frontier → 导出 ZIP → 镜像；成功 ack，失败按指数退避重排
  （`retryOutboxJob`），超限进入 dead-letter（M12-20）。
- **配置**（M12-16）：`GITHUB_MIRROR_OWNER`/`GITHUB_MIRROR_REPO` 为 wrangler
  vars，`GITHUB_MIRROR_TOKEN` 为 wrangler secret（仅 Worker 环境，未入库）。
  当前 dev 使用 gh CLI OAuth token；生产建议换成仅对镜像仓库开放
  Contents:read/write 的 fine-grained PAT。
- **回执与适配器**（`mirror.mjs`）：`recordMirrorReceipt` 保存 release URL/
  asset hash/时间（表 `mirror_receipts`）；`createMirrorAdapterRegistry`
  允许注册第二存储实现（M12-21）。

## 时间戳与见证（M12-22..25）

- **OTS**（`ots-adapter.mjs`）：`assertTimestampAdapter` 接口 + 本地实现；
  `storeOtsProof` 随 checkpoint 存储并在导出时携带（M12-23）。
- **Witness**（`witness.mjs`）：第三方对同一 Merkle root 以 Ed25519 签署
  `evimesh.witness-checkpoint.v1` 回执（M12-24）；`POST /witness-receipts`
  端点校验签名与 root 匹配后入库（表 `witness_receipts`，M12-25）。

## 数据模型变更

新增两张表（迁移 `0073_frontier_bundle_receipts.sql`）：`mirror_receipts`
（frontier_snapshot_id → release_url/asset_sha256/时间）、`witness_receipts`
（checkpoint_id → witness_id/public_key/signature/signed_at）。

## 已执行的真实验证

- `scripts/mirror-e2e.mjs`：用真实凭据把样例 Frontier 镜像到
  `UynajGI/EviMesh-frontiers`，创建 Release `frontier/project_1/3`、上传
  `frontier_1.zip` 并记录回执。
- 下载该 asset 后离线 `verifyFrontierBundle` 通过（sha256 与回执一致）。

## 边界

- bundle 导出/验证/导入只依赖注入式 `repository` 契约；真实 DB 适配器在
  部署阶段接入。
- 真实 Release/secret 配置依赖 Cloudflare/GitHub 凭据；除已执行的 e2e 外，
  生产 Worker 的自动镜像在部署后生效。
