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

    return json({ error: "not_found" }, 404);
  },
};
