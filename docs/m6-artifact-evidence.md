# M6 Artifact、Evidence 与 Run 基线

当前 M6 第一组已提供：

- `@evimesh/artifact` 的流式 SHA-256（不缓存完整对象）和 Artifact revision object key；
- R2 上传后的 size/hash 流式核验，校验失败时不会进入 Artifact 接受流程；
- 单文件上传签名计划与 R2 multipart session 的过期、分片排序、完成和中止契约；
- 内容寻址 Artifact revision 的短时效签名 GET 下载 redirect 契约；
- Artifact 接受前的 malware scanner adapter 契约；感染或扫描服务不可用时 fail closed；
- API Edge 的 Run 列表、详情及 Artifact input/output 查询契约；
- API Edge 的 Evidence 列表、详情及 Claim revision link 查询契约；
- Run 创建会在同一事务内确认 input/output Artifact revision 存在，并拒绝重复引用；输出 revision 必须已有 `verified` hash 核验状态；
- domain 层 Artifact 创建命令，原子写入 Artifact、首个 revision、初始 location 与事件；
- Evidence 创建命令，链接固定的 Claim revision；
- Run 创建命令，链接不可变的 Artifact revision 输入/输出并记录可复现环境字段；容器必须使用不可变的 SHA-256 OCI digest，并规范化随机种子后记录稳定的 semantic hash；
- API Edge 的 `ARTIFACTS` R2 binding：development 使用 `evimesh-dev`，staging 使用
  `evimesh-staging`，production 使用 `evimesh-production`。

所有命令都通过 repository transaction 和 `eventFactory` 写入，事件 envelope 的签名、
数据库持久化与 API 路由接入仍由后续 M6/M7 loop 完成。R2 bucket 的 CORS 应按
[`infra-r2-cors.md`](infra-r2-cors.md) 针对环境单独生成和应用，禁止使用通配 origin。
