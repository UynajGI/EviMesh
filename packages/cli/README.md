# @evimesh/cli

## Public Preview

```bash
pnpm --filter @evimesh/cli build
node packages/cli/dist/sq.mjs --help
sq config init --api-url https://api.evimesh.com
```

The public npm package has not been released yet. Until the capability manifest
announces a supported CLI version, run the Node 22+ build from a trusted source
checkout. `sq` is the future installed command.

Repository maintainers can run `pnpm package:test` to build both npm artifacts,
install their packed tarballs into clean temporary directories, and exercise
the installed `sq` command.

`sq` 是 EviMesh 的命令行入口，让 Agent 与开发者无需 Web 即可参与科研网络（M10）。

## 快速开始

```bash
sq config init --api-url https://api.evimesh.com
sq capabilities --json  # 唯一的服务端能力事实源；网络失败时返回保守清单
sq auth login            # 仅在 deviceAuthorization.enabled=true；或保存已有 --token
sq key create            # 交互式创建口令加密的本地 Ed25519 密钥
sq key export-public --out public-key.json
# 在 EviMesh 账户中登记 public-key.json；私钥永远不上传
sq task list --status open --tag cpu-only --json
sq task inspect task_...
sq context pull task_... --mode blind      # 下载并本地校验 ContextBundle hash
sq research draft answer --out answer.json
sq research prepare answer.json --out answer.prepared.json # capability-gated
sq research sign answer.prepared.json --out answer.signed.json
sq research submit answer.signed.json                       # capability-gated
sq bundle verify bundle.json               # 离线验证 hash / 签名 / proof
sq provenance claim claim_... --revision 1
```

## 约定

- 所有命令支持 `--json`（稳定机器可读输出）；
- `sq capabilities --json` 直接读取并严格校验 `GET /meta/capabilities`；网络、HTTP 或 schema
  失败时返回只保留读取、本地 draft/validate 与人类本地 sign 的保守清单；
- Device Auth、`research prepare`、`research submit` 在执行各自网络动作前重新检查清单并
  fail closed；离线 `--help` 不做网络请求，明确标注这些命令为 capability-gated；
- `auth login` 只保存固定 registry 内的 Agent scope；registry 不存在 `research:sign`，未知或管理 scope 会被拒绝；
- 配置目录默认 `~/.evimesh`，可用 `EVIMESH_CONFIG_DIR` 覆盖（测试使用）。
- Agent 可执行 draft、prepare 与 relay submit，但唯一签名入口是人类本地运行的 `sq research sign`；
- `research sign` 强制真实 TTY；签名前必须完整审阅 prepared 文件和提示中的研究语义、关系与 actor，再输入绑定本次 payload 的 `SIGN <signing-hash 前 12 位>` 并用本地口令解锁；不接受 `--yes`、`confirm:true`、Agent token、环境变量私钥或非交互 stdin；
- 任何曾以明文保存在旧配置中的私钥均视为已泄露：CLI 只保留其 compromised 公钥记录供服务端撤销，并生成全新 keypair；旧配置、备份和磁盘块仍可能保留旧私钥；
- 私钥以 scrypt 派生密钥和 AES-256-GCM 认证加密保存在 `~/.evimesh/signing-keys.json`；写入使用跨进程锁、generation CAS、临时文件和可用平台上的文件/目录 fsync；
- JavaScript 不能保证擦除运行时或原生库中的所有副本；签名完成后只对 CLI 自己持有的明文 `Buffer` 做 best-effort 覆写；
- `key revoke-local` 只移除这台机器当前 vault 中的加密副本，备份仍可能恢复它；只有账户设置中的服务端公钥撤销才是最终撤销；
- Windows 上 Node 不能可靠验证继承 ACL，也不能保证目录 fsync；CLI 会给出 `icacls` 检查指令，并对临时、共享、网络或用户目录外路径额外警告。

## 说明

`startDeviceLogin()` 与 `pollDeviceLogin()` 实现 device-code 契约。研究写入固定为
`draft → prepare → human-local sign → submit`；其中 prepare/submit 只有在生产能力清单
开启后才可用。`research sign` 是不依赖服务端 capability 的人类本地 TTY 操作；MCP
不包含签名工具。
