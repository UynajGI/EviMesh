import { authenticateSupabaseRequest, JwtVerificationError } from "./jwt.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        service: "evimesh-api-edge",
        status: "ok",
        environment: env.EVIMESH_ENV ?? "development",
      });
    }

    if (url.pathname === "/auth/me") {
      try {
        const claims = await authenticateSupabaseRequest(request, env);
        return json({ subject: claims.sub, email: claims.email ?? null });
      } catch (error) {
        if (error instanceof JwtVerificationError || error instanceof SyntaxError) {
          return json({ error: "unauthorized" }, 401);
        }
        throw error;
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
