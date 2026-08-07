export function createQuestionClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/questions", { query: params }),
    get: (questionId) => http.request("GET", `/questions/${encodeURIComponent(questionId)}`),
    create: (input) => http.request("POST", "/questions", { body: input }),
    transition: (questionId, toState) => http.request("POST", `/questions/${encodeURIComponent(questionId)}/transitions`, { body: { toState } }),
    async *listAll(params = {}) {
      yield* http.paginate("/questions", { query: params });
    },
  });
}
