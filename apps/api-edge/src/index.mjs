import { Hono } from "hono";
import { authenticateSupabaseRequest, JwtVerificationError } from "./jwt.mjs";
import { RequestValidationError } from "./validation.mjs";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function requestIdFor(value) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : crypto.randomUUID();
}

function errorBody(code, message, requestId) {
  return { code, message, request_id: requestId };
}

const app = new Hono();

app.use("*", async (context, next) => {
  const requestId = requestIdFor(context.req.header("x-request-id"));
  context.set("requestId", requestId);
  context.header("x-request-id", requestId);
  await next();
});

app.use("*", async (context, next) => {
  const startedAt = Date.now();
  try {
    await next();
  } finally {
    console.log(JSON.stringify({
      event: "api.request",
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      status: context.res.status,
      request_id: context.get("requestId"),
      duration_ms: Date.now() - startedAt,
    }));
  }
});

app.get("/health", (context) => context.json({
  service: "evimesh-api-edge",
  status: "ok",
  environment: context.env.EVIMESH_ENV ?? "development",
}));

app.get("/auth/me", async (context) => {
  try {
    const claims = await authenticateSupabaseRequest(context.req.raw, context.env);
    return context.json({ subject: claims.sub, email: claims.email ?? null });
  } catch (error) {
    if (error instanceof JwtVerificationError || error instanceof SyntaxError) {
      return context.json(errorBody("unauthorized", "authentication required", context.get("requestId")), 401);
    }
    throw error;
  }
});

app.notFound((context) => context.json(errorBody("not_found", "route not found", context.get("requestId")), 404));

app.onError((error, context) => {
  if (error instanceof RequestValidationError) {
    return context.json({
      ...errorBody(error.code, error.message, context.get("requestId")),
      issues: error.issues,
    }, 400);
  }
  console.error("api request failed", error);
  return context.json(errorBody("internal_error", "internal server error", context.get("requestId")), 500);
});

export default app;
