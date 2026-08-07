export function createClaimClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/claims", { query: params }),
    get: (claimId) => http.request("GET", `/claims/${encodeURIComponent(claimId)}`),
    create: (input) => http.request("POST", "/claims", { body: input }),
    revision: (claimId, revision) => http.request("GET", `/claims/${encodeURIComponent(claimId)}/revisions/${Number(revision)}`),
    revise: (claimId, patch, { ifMatch } = {}) => http.request("POST", `/claims/${encodeURIComponent(claimId)}/revisions`, { body: patch, ifMatch }),
    transition: (claimId, toState, { ifMatch } = {}) => http.request("POST", `/claims/${encodeURIComponent(claimId)}/transitions`, { body: { toState }, ifMatch }),
    graph: (claimId, { direction = "downstream", maxDepth = 3 } = {}) => http.request("GET", `/claims/${encodeURIComponent(claimId)}/graph`, { query: { direction, maxDepth } }),
    verifications: (claimId, params = {}) => http.request("GET", `/claims/${encodeURIComponent(claimId)}/verifications`, { query: params }),
    async *listAll(params = {}) {
      yield* http.paginate("/claims", { query: params });
    },
  });
}
