export function createArtifactClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/artifacts", { query: params }),
    get: (artifactId) => http.request("GET", `/artifacts/${encodeURIComponent(artifactId)}`),
    revision: (artifactId, revision) => http.request("GET", `/artifacts/${encodeURIComponent(artifactId)}/revisions/${Number(revision)}`),
    create: (input) => http.request("POST", "/artifacts", { body: input }),
    uploadPlan: (input) => http.request("POST", "/artifacts/upload-plan", { body: input }),
    async *listAll(params = {}) {
      yield* http.paginate("/artifacts", { query: params });
    },
  });
}
