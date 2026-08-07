export function createFrontierClient(http) {
  return Object.freeze({
    latest: (projectId) => http.request("GET", `/projects/${encodeURIComponent(projectId)}/frontier/latest`),
    history: (projectId, params = {}) => http.request("GET", `/projects/${encodeURIComponent(projectId)}/frontier/history`, { query: params }),
    diff: (projectId, params = {}) => http.request("GET", `/projects/${encodeURIComponent(projectId)}/frontier/diff`, { query: params }),
    async *iterateHistory(projectId, params = {}) {
      yield* http.paginate(`/projects/${encodeURIComponent(projectId)}/frontier/history`, { query: params });
    },
  });
}
