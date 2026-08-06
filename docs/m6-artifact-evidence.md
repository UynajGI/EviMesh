# M6 Artifact、Evidence 与 Run 基线

当前 M6 第一组已提供：

- `@evimesh/artifact` 的流式 SHA-256（不缓存完整对象）和 Artifact revision object key；
- domain 层 Artifact 创建命令，原子写入 Artifact、首个 revision、初始 location 与事件；
- Evidence 创建命令，链接固定的 Claim revision；
- Run 创建命令，链接不可变的 Artifact revision 输入/输出并记录可复现环境字段；
- API Edge 的 `ARTIFACTS` R2 binding：development 使用 `evimesh-dev`，staging 使用
  `evimesh-staging`，production 使用 `evimesh-production`。

所有命令都通过 repository transaction 和 `eventFactory` 写入，事件 envelope 的签名、
数据库持久化与 API 路由接入仍由后续 M6/M7 loop 完成。R2 bucket 的 CORS 应按
[`infra-r2-cors.md`](infra-r2-cors.md) 针对环境单独生成和应用，禁止使用通配 origin。
