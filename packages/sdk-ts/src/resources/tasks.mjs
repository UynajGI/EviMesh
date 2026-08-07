export function createTaskClient(http) {
  return Object.freeze({
    list: (params = {}) => http.request("GET", "/tasks", { query: params }),
    get: (taskId) => http.request("GET", `/tasks/${encodeURIComponent(taskId)}`),
    create: (input) => http.request("POST", "/tasks", { body: input }),
    context: (taskId, mode) => http.request("GET", `/tasks/${encodeURIComponent(taskId)}/context`, { query: { mode } }),
    acquireLease: (taskId, input = {}) => http.request("POST", `/tasks/${encodeURIComponent(taskId)}/lease`, { body: input }),
    releaseLease: (taskId) => http.request("DELETE", `/tasks/${encodeURIComponent(taskId)}/lease`),
    async *listAll(params = {}) {
      yield* http.paginate("/tasks", { query: params });
    },
  });
}

export function createAttemptClient(http) {
  return Object.freeze({
    start: (taskId, input) => http.request("POST", `/tasks/${encodeURIComponent(taskId)}/attempts`, { body: input }),
    get: (attemptId) => http.request("GET", `/attempts/${encodeURIComponent(attemptId)}`),
    transition: (attemptId, toState) => http.request("POST", `/attempts/${encodeURIComponent(attemptId)}/transitions`, { body: { toState } }),
    recordTrace: (attemptId, input) => http.request("POST", `/attempts/${encodeURIComponent(attemptId)}/trace`, { body: input }),
  });
}
