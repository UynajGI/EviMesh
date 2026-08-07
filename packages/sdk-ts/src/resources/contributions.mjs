export function createContributionClient(http) {
  return Object.freeze({
    forActor: (actorId) => http.request("GET", `/actors/${encodeURIComponent(actorId)}`),
    provenance: (objectType, objectId, revision) => http.request("GET", `/provenance/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, { query: { revision } }),
    mergeProposal: (proposalId) => http.request("GET", `/merge-proposals/${encodeURIComponent(proposalId)}`),
  });
}
