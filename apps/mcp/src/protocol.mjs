import { createInterface } from "node:readline";

export const JSON_RPC_PARSE_ERROR = -32700;
export const JSON_RPC_INVALID_REQUEST = -32600;
export const JSON_RPC_METHOD_NOT_FOUND = -32601;
export const JSON_RPC_INVALID_PARAMS = -32602;
export const JSON_RPC_INTERNAL_ERROR = -32603;

export function errorResponse(id, code, message, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

export function successResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Minimal newline-delimited JSON-RPC 2.0 stdio transport for MCP.
 * `handle(message)` returns a result object, throws RpcError for protocol
 * errors, or returns undefined for notifications.
 */
export function serveStdio({ input = process.stdin, output = process.stdout, handle } = {}) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  const write = (message) => {
    output.write(`${JSON.stringify(message)}\n`);
  };

  lines.on("line", async (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      write(errorResponse(null, JSON_RPC_PARSE_ERROR, "message is not valid JSON"));
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.jsonrpc !== "2.0") {
      write(errorResponse(parsed?.id ?? null, JSON_RPC_INVALID_REQUEST, "message must be a JSON-RPC 2.0 object"));
      return;
    }
    const isNotification = parsed.id === undefined;
    try {
      const result = await handle(parsed);
      if (!isNotification) write(successResponse(parsed.id, result ?? {}));
    } catch (error) {
      if (isNotification) return;
      const code = typeof error?.code === "number" ? error.code : JSON_RPC_INTERNAL_ERROR;
      write(errorResponse(parsed.id, code, error?.message ?? "internal error", error?.data));
    }
  });

  lines.on("close", () => {
    // stdin closed: the host disconnected; exit cleanly.
  });

  return Object.freeze({ write, close: () => lines.close() });
}

export class RpcError extends Error {
  constructor(code, message, data = undefined) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}
