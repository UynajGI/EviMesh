export function createEvidenceClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/evidence", { query: params }),
    get: (evidenceId) => http.request("GET", `/evidence/${encodeURIComponent(evidenceId)}`),
    create: (input) => http.request("POST", "/evidence", { body: input }),
    link: (evidenceId, input) => http.request("POST", `/evidence/${encodeURIComponent(evidenceId)}/links`, { body: input }),
    async *listAll(params = {}) {
      yield* http.paginate("/evidence", { query: params });
    },
  });
}
