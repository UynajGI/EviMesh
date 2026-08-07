export function createProjectClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/projects", { query: params }),
    get: (projectId) => http.request("GET", `/projects/${encodeURIComponent(projectId)}`),
    create: (input) => http.request("POST", "/projects", { body: input }),
    revise: (projectId, patch, { ifMatch } = {}) => http.request("POST", `/projects/${encodeURIComponent(projectId)}/revisions`, { body: patch, ifMatch }),
    async *listAll(params = {}) {
      yield* http.paginate("/projects", { query: params });
    },
  });
}
