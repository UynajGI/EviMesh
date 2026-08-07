import { RpcError, JSON_RPC_METHOD_NOT_FOUND, JSON_RPC_INVALID_PARAMS } from "./protocol.mjs";
import { SERVER_INFO, SUPPORTED_PROTOCOL_VERSIONS } from "./config.mjs";
import { listResources, readResource, McpResourceError } from "./resources.mjs";
import { listTools, callTool, McpToolError } from "./tools.mjs";

/**
 * Create the MCP method dispatcher. `client` is the EviMesh SDK client;
 * `env` supplies configuration and identity lookups for signing tools.
 */
export function createMcpServer({ client, env = process.env } = {}) {
  return async function handle(message) {
    const method = message.method;
    const params = message.params ?? {};

    switch (method) {
      case "initialize": {
        const requested = params.protocolVersion;
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
        return {
          protocolVersion,
          capabilities: { resources: { listChanged: false }, tools: { listChanged: false } },
          serverInfo: { ...SERVER_INFO },
          instructions: "EviMesh research network: read resources for context; write tools require confirm: true.",
        };
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return undefined;
      case "ping":
        return {};
      case "resources/list":
        return listResources();
      case "resources/read": {
        if (typeof params.uri !== "string") throw new RpcError(JSON_RPC_INVALID_PARAMS, "uri is required");
        try {
          const { data } = await readResource({ client, uri: params.uri });
          return { contents: [{ uri: params.uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
        } catch (error) {
          if (error instanceof McpResourceError) throw new RpcError(JSON_RPC_INVALID_PARAMS, error.message, { code: error.code });
          throw error;
        }
      }
      case "tools/list":
        return listTools();
      case "tools/call": {
        if (typeof params.name !== "string") throw new RpcError(JSON_RPC_INVALID_PARAMS, "tool name is required");
        try {
          return await callTool({ client, name: params.name, args: params.arguments ?? {}, env });
        } catch (error) {
          if (error instanceof McpToolError && error.code === "MCP_TOOL_NOT_FOUND") {
            throw new RpcError(JSON_RPC_INVALID_PARAMS, error.message, { code: error.code });
          }
          throw error;
        }
      }
      default:
        throw new RpcError(JSON_RPC_METHOD_NOT_FOUND, `method not supported: ${method}`);
    }
  };
}
