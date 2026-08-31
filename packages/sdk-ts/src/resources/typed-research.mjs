function createTypedResearchClient(http, plural) {
  const base = `/${plural}`;
  return Object.freeze({
    list: (params = {}) => http.request("GET", base, { query: params }),
    get: (id) => http.request("GET", `${base}/${encodeURIComponent(id)}`),
    prepare: (input) => http.request("POST", `${base}/prepare`, { body: input }),
    submit: (input) => http.request("POST", base, { body: input }),
    async *listAll(params = {}) {
      yield* http.paginate(base, { query: params });
    },
  });
}

export function createTypedResearchClients(http) {
  return Object.freeze({
    answers: createTypedResearchClient(http, "answers"),
    rebuttals: createTypedResearchClient(http, "rebuttals"),
    evaluations: createTypedResearchClient(http, "evaluations"),
    datasets: createTypedResearchClient(http, "datasets"),
    tools: createTypedResearchClient(http, "tools"),
  });
}
