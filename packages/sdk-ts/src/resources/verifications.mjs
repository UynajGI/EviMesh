export function createVerificationClient(http) {
  return Object.freeze({
    prepare: (input) => http.request("POST", "/verifications/prepare", { body: input }),
    submit: (input) => http.request("POST", "/verifications", { body: input }),
    receipt: (receiptId) => http.request("GET", `/verifications/${encodeURIComponent(receiptId)}`),
    forClaim: (claimId, params = {}) => http.request("GET", `/claims/${encodeURIComponent(claimId)}/verifications`, { query: params }),
  });
}
