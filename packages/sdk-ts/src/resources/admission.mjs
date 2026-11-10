function id(value) {
  return encodeURIComponent(value);
}

/** Human-session account and project-governance clients. Research writes are not exposed here. */
export function createAdmissionClients(http) {
  return Object.freeze({
    onboarding: Object.freeze({
      complete: (input) => http.request('POST', '/onboarding/complete', { body: input }),
    }),
    signingKeys: Object.freeze({
      list: () => http.request('GET', '/signing-keys'),
      register: (input) => http.request('POST', '/signing-keys', { body: input }),
      revoke: (keyId, reason) => http.request('DELETE', `/signing-keys/${id(keyId)}`, { body: { reason } }),
    }),
    projectApplications: Object.freeze({
      submit: (input) => http.request('POST', '/project-applications', { body: input }),
      withdraw: (applicationId) => http.request('POST', `/project-applications/${id(applicationId)}/withdraw`),
      decide: (applicationId, input) => http.request('POST', `/project-applications/${id(applicationId)}/decision`, { body: input }),
      list: ({ scope = 'mine' } = {}) => http.request('GET', '/project-applications', { query: { scope } }),
    }),
    managedAgents: Object.freeze({
      list: () => http.request('GET', '/actors/managed', { query: { actor_type: 'agent' } }),
      create: (input) => http.request('POST', '/actors/managed', { body: input }),
      retire: (agentActorId, reason) => http.request('DELETE', `/actors/managed/${id(agentActorId)}`, { body: { reason } }),
    }),
    projectAgents: Object.freeze({
      enroll: (projectId, agentActorId) => http.request('POST', `/projects/${id(projectId)}/agents`, { body: { agentActorId } }),
      remove: (projectId, agentActorId) => http.request('DELETE', `/projects/${id(projectId)}/agents/${id(agentActorId)}`),
    }),
    projectInvitations: Object.freeze({
      create: (projectId, input) => http.request('POST', `/projects/${id(projectId)}/invitations`, { body: input }),
      respond: (invitationId, response) => http.request('POST', `/project-invitations/${id(invitationId)}/respond`, { body: { response } }),
      revoke: (projectId, invitationId, reason) => http.request('POST', `/projects/${id(projectId)}/invitations/${id(invitationId)}/revoke`, { body: { reason } }),
    }),
    projectMemberships: Object.freeze({
      changeRole: (projectId, actorId, input) => http.request('PATCH', `/projects/${id(projectId)}/members/${id(actorId)}`, { body: input }),
      remove: (projectId, actorId, reason) => http.request('DELETE', `/projects/${id(projectId)}/members/${id(actorId)}`, { body: { reason } }),
    }),
  });
}
