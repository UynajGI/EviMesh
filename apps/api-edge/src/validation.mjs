export class RequestValidationError extends Error {
  constructor(issues) {
    super("request validation failed");
    this.name = "RequestValidationError";
    this.code = "VALIDATION_ERROR";
    this.issues = issues;
  }
}

/** Adapt any safeParse-compatible schema (Zod/TypeBox adapter) to a Worker request. */
export async function parseJsonBody(request, schema) {
  if (!schema || typeof schema.safeParse !== "function") {
    throw new TypeError("schema with safeParse is required");
  }
  let body;
  try {
    body = await request.json();
  } catch {
    throw new RequestValidationError([{ path: [], message: "body must be valid JSON" }]);
  }
  const result = await schema.safeParse(body);
  if (result.success) return result.data;
  const issues = (result.error?.issues ?? []).map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path : [],
    message: typeof issue.message === "string" ? issue.message : "invalid value",
  }));
  throw new RequestValidationError(issues);
}
