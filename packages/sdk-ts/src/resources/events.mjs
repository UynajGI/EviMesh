export function createEventClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/events", { query: params }),
    exportRange: (params = {}) => http.request("GET", "/events/export", { query: params }),
    proof: (eventId) => http.request("GET", `/events/${encodeURIComponent(eventId)}/proof`),
    checkpoint: (checkpointId) => http.request("GET", `/checkpoints/${encodeURIComponent(checkpointId)}`),
    async *listAll(params = {}) {
      yield* http.paginate("/events", { query: params });
    },
  });
}

export function createEventProofClient(http) {
  return Object.freeze({
    inclusionProof: (eventId) => http.request("GET", `/events/${encodeURIComponent(eventId)}/proof`),
    checkpoint: (checkpointId) => http.request("GET", `/checkpoints/${encodeURIComponent(checkpointId)}`),
  });
}
