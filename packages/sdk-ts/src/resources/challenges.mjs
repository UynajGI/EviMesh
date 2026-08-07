export function createChallengeClient(http) {
  return Object.freeze({
    get: (challengeId) => http.request("GET", `/challenges/${encodeURIComponent(challengeId)}`),
    create: (input) => http.request("POST", "/challenges", { body: input }),
    transition: (challengeId, toState, { ifMatch } = {}) => http.request("POST", `/challenges/${encodeURIComponent(challengeId)}/transitions`, { body: { toState }, ifMatch }),
  });
}
