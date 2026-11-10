# @evimesh/mcp

## Public Preview

The public npm package has not been released. Do not advertise an install
command until `GET /meta/capabilities` reports `clients.mcp.available=true`
and the corresponding signed package exists.

Future install / run:

```bash
npx --yes @evimesh/mcp
```

After an npm release, register that command as a stdio MCP server in a
compatible Agent host. The Node 22+ package is self-contained and uses the
limited token saved by `sq auth login` when `EVIMESH_API_TOKEN` is not supplied.

Repository maintainers can run `pnpm package:test` to build both npm artifacts,
install their packed tarballs into clean temporary directories, and initialize
the installed `evimesh-mcp` server.

Model Context Protocol 服务器：以科研语义向任意支持 MCP 的 Agent 暴露上下文与工具（M11）。

## 运行

```bash
EVIMESH_API_URL=https://api.evimesh.com \
EVIMESH_API_TOKEN=evimesh_... \
node apps/mcp/bin/evimesh-mcp.mjs
```

在 MCP 宿主（支持 MCP 的 IDE / Agent harness）里把上面配置为一个 stdio server 即可。
`EVIMESH_API_TOKEN` 缺省时会回退读取 `sq auth login` 保存的受限 token（`~/.evimesh/state.json`，
可用 `EVIMESH_CONFIG_DIR` 覆盖）。

## Resources（读取上下文）

| URI | 说明 |
|---|---|
| `evimesh://projects` | 项目列表 |
| `evimesh://questions/open` | 开放问题（proposed/under_review/admissible/active） |
| `evimesh://tasks/open` | 开放任务 |
| `evimesh://tasks/{taskId}/context/{mode}` | 不可变 ContextBundle（frontier/full_trace/adversarial/blind） |
| `evimesh://claims/{claimId}/revisions/{revision}` | 固定 Claim revision |
| `evimesh://projects/{projectId}/frontier/latest` | 最新 Frontier |
| `evimesh://projects/{projectId}/frontier/sequence/{sequence}` | 按序号读取 Frontier |
| `evimesh://actors/{actorId}/contributions` | Actor 贡献 |

## Tools（采取行动）

只读：`inspect_research_neighborhood`、`browse_typed_research_nodes`、
`inspect_typed_research_node`、`search_open_tasks`、`get_task_context`、
`validate_submission`、`inspect_provenance`、`verify_inclusion_proof`。

本地草稿：`draft_typed_research_node`、`create_claim`。本地 schema validation、proof
验证和全部只读工具不依赖研究写入能力。

`prepare_typed_research_submission` 只在 live manifest 的 `research.prepare=true` 时出现在
`tools/list`；它从服务端取得需要交给人类审阅的 canonical bytes/hash，不签名。
`submit_typed_research_submission` 只在 `research.submit=true` 时出现，且只 relay 调用方
提供的 `srp.client-signature-envelope.v1`；网络写入仍需显式 `confirm: true`，但确认不能
生成、替代或绕过人类签名。

能力获取失败或 manifest 无效时，MCP 只保留读取、本地 draft/validate 和本地 proof
验证。`tools/call` 会重新检查能力，不能通过绕过 `tools/list` 直调隐藏工具。
`start_attempt`、`record_trace`、`attach_evidence`、`record_run`、`prepare_submission`、
`publish_submission`、`submit_verification`、`submit_challenge` 是当前永久 fail-closed 的
legacy 路径：既不广告，也不能直调。它们要等各自类型拥有服务端 canonical prepare 与
外部签名 submit 后以正式接口替代，而不是因 typed capability 开启而复活。

- MCP 没有 signer、`research:sign` scope、私钥读取/存储能力或通用 shell/命令执行工具。
  人类签名只能在真实本地终端运行 `sq research sign`；私钥不进入 MCP 进程。
- 所有工具都声明 `inputSchema` 与 `outputSchema`，并返回 `structuredContent`。

## 边界

- 仅通过 `@evimesh/sdk-ts` 访问 HTTP API，不读数据库。
- `tools/list` 和 `tools/call` 都消费 SDK 对 `/meta/capabilities` 的严格、保守解析结果。
- 不读取 `~/.evimesh/signing-keys.json`，也不接受环境变量私钥。
- 工具与资源命名/参数不含任何 GitHub/PR/branch/commit 语义（`test/audit.test.mjs` 固化）。
- M11-26（npm alpha 发布）依赖 registry 凭据，未在本分支执行。

## 测试

```bash
pnpm --filter @evimesh/mcp test
```
