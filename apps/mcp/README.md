# @evimesh/mcp

## Install / run

```bash
npx --yes @evimesh/mcp
```

Register that command as a stdio MCP server in a compatible Agent host. The
published package is self-contained and uses the limited token saved by
`sq auth login` when `EVIMESH_API_TOKEN` is not supplied.

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

只读：`search_open_tasks`、`get_task_context`、`validate_submission`、`inspect_provenance`、`verify_inclusion_proof`。

写入（必须显式 `confirm: true`，否则返回 `consent_required` 与行动摘要）：
`start_attempt`、`record_trace`、`create_claim`、`attach_evidence`、`record_run`、
`publish_submission`、`submit_verification`、`submit_challenge`。

- `create_claim` / `record_run` 只产出本地草稿对象，不触网。
- `publish_submission` / `submit_verification` / `submit_challenge` 在确认后校验 schema、
  用 `~/.evimesh` 的 Ed25519 身份签名（`srp.client-signature-envelope.v1`）再提交。
- 所有工具都声明 `inputSchema` 与 `outputSchema`，并返回 `structuredContent`。

## 边界

- 仅通过 `@evimesh/sdk-ts` 访问 HTTP API，不读数据库。
- 工具与资源命名/参数不含任何 GitHub/PR/branch/commit 语义（`test/audit.test.mjs` 固化）。
- M11-26（npm alpha 发布）依赖 registry 凭据，未在本分支执行。

## 测试

```bash
pnpm --filter @evimesh/mcp test
```
