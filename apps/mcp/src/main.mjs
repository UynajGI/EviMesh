import { serveStdio } from "./protocol.mjs";
import { createMcpServer } from "./server.mjs";
import { resolveConfig, buildServerClient } from "./config.mjs";

/** Entry point: serve the EviMesh MCP server over stdio. */
export function main({ env = process.env, input, output, fetchImpl } = {}) {
  const config = resolveConfig(env);
  const client = buildServerClient({ config, fetchImpl });
  const handle = createMcpServer({ client, env });
  return serveStdio({ input, output, handle });
}
