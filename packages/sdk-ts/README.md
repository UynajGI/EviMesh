# @evimesh/sdk-ts

EviMesh TypeScript SDK。为任意 Agent Harness 或开发者提供不依赖 Web 的科研语义客户端（M10）。

## 用法

```js
import { createClient } from "@evimesh/sdk-ts";

const client = createClient({
  baseUrl: "https://api.evimesh.com",
  // Supabase JWT 或 API Token 均以 Bearer 方式发送
  token: process.env.EVIMESH_TOKEN,
  // 或使用异步 provider：tokenProvider: async () => session.access_token
});

for await (const task of client.tasks.listAll({ status: "open", tag: "cpu-only" })) {
  console.log(task.taskId);
}

const detail = await client.claims.get("claim_...");       // 响应含 etag
await client.claims.transition("claim_...", "under_verification", { ifMatch: detail.etag });
```

## 能力

- `projects` / `questions` / `tasks` / `attempts` / `claims` / `artifacts` / `runs` / `evidence` / `verifications` / `challenges` / `frontier` / `events` / `contributions` 资源客户端；
- 写请求默认携带 `Idempotency-Key`，可用 `idempotencyKey` 覆盖或关闭；
- 服务端错误映射为类型化异常（`EviMeshAuthenticationError`、`EviMeshNotFoundError`、`EviMeshConflictError`、`EviMeshPreconditionError` 等），携带 `code` / `status` / `requestId`；
- `paginate` 与各资源 `listAll` 提供游标分页迭代；
- `artifacts.uploadPlan` + `artifacts.upload` 完成签名直传；
- `events.proof` + `verifyEventProof` 获取并本地验证 Merkle inclusion proof；
- `src/generated/types.d.ts` 由 `apps/api-edge/openapi.json` 生成（`node scripts/generate-types.mjs`），测试中以 `tsc --noEmit` 校验可编译。

## 测试

```bash
pnpm --filter @evimesh/sdk-ts test
```
