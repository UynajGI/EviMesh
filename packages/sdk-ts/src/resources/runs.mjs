export function createRunClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/runs", { query: params }),
    get: (runId) => http.request("GET", `/runs/${encodeURIComponent(runId)}`),
    create: (input) => http.request("POST", "/runs", { body: input }),
    async *listAll(params = {}) {
      yield* http.paginate("/runs", { query: params });
    },
  });
}
