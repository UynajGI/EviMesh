const DEFAULT_TIMEOUT_MS = 15_000;

export class AdmissionError extends Error {
  constructor(message, { status = null, code = null, requestId = null } = {}) {
    super(message);
    this.name = 'AdmissionError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function errorMessage(status, payload) {
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return payload?.message || 'You do not have permission for this account action.';
  if (status === 404) return payload?.message || 'The requested account record was not found.';
  if (status >= 500) return 'The account service is temporarily unavailable. Try again shortly.';
  return payload?.message || 'The account request failed. Try again.';
}

function encoded(value) {
  return encodeURIComponent(String(value));
}

/**
 * Human-session client for account and project-governance operations only.
 * It intentionally exposes no research mutation route and never accepts
 * private signing material.
 */
export function createAdmissionClient(session, {
  apiUrl = process.env.NEXT_PUBLIC_EVIMESH_API_URL,
  fetchImpl = fetch,
  timeout = DEFAULT_TIMEOUT_MS,
} = {}) {
  const accessToken = session?.access_token;

  async function request(path, { method = 'GET', body } = {}) {
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new AdmissionError('Your session has expired. Sign in again.', {
        status: 401,
        code: 'SESSION_EXPIRED',
      });
    }
    if (typeof apiUrl !== 'string' || apiUrl.trim().length === 0) {
      throw new AdmissionError('The EviMesh account service is not configured.', {
        status: 503,
        code: 'ADMISSION_API_UNAVAILABLE',
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (reason) {
      const timedOut = reason?.name === 'AbortError';
      throw new AdmissionError(
        timedOut ? 'The account request timed out. Try again.' : 'The account service could not be reached. Check your connection.',
        { code: timedOut ? 'ADMISSION_TIMEOUT' : 'ADMISSION_NETWORK_ERROR' },
      );
    } finally {
      clearTimeout(timer);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AdmissionError(errorMessage(response.status, payload), {
        status: response.status,
        code: payload?.code ?? null,
        requestId: payload?.request_id ?? payload?.requestId ?? null,
      });
    }
    if (payload === null) {
      throw new AdmissionError('The account service returned an invalid response.', {
        status: 502,
        code: 'ADMISSION_RESPONSE_INVALID',
      });
    }
    return payload;
  }

  return Object.freeze({
    me: () => request('/auth/me'),
    onboarding: Object.freeze({
      complete: (input) => request('/onboarding/complete', { method: 'POST', body: input }),
    }),
    signingKeys: Object.freeze({
      list: () => request('/signing-keys'),
      register: (input) => request('/signing-keys', { method: 'POST', body: input }),
      revoke: (keyId, reason) => request(`/signing-keys/${encoded(keyId)}`, { method: 'DELETE', body: { reason } }),
    }),
    projectApplications: Object.freeze({
      submit: (input) => request('/project-applications', { method: 'POST', body: input }),
      withdraw: (applicationId) => request(`/project-applications/${encoded(applicationId)}/withdraw`, { method: 'POST' }),
      list: (scope = 'mine') => request(`/project-applications?scope=${encoded(scope)}`),
      decide: (applicationId, input) => request(`/project-applications/${encoded(applicationId)}/decision`, { method: 'POST', body: input }),
    }),
    managedAgents: Object.freeze({
      list: () => request('/actors/managed?actor_type=agent'),
      create: (input) => request('/actors/managed', { method: 'POST', body: input }),
      retire: (agentActorId, reason) => request(`/actors/managed/${encoded(agentActorId)}`, { method: 'DELETE', body: { reason } }),
    }),
    projectAgents: Object.freeze({
      enroll: (projectId, agentActorId) => request(`/projects/${encoded(projectId)}/agents`, { method: 'POST', body: { agentActorId } }),
      remove: (projectId, agentActorId) => request(`/projects/${encoded(projectId)}/agents/${encoded(agentActorId)}`, { method: 'DELETE' }),
    }),
    projectInvitations: Object.freeze({
      mine: () => request('/project-invitations'),
      forProject: (projectId) => request(`/project-invitations?projectId=${encoded(projectId)}`),
      create: (projectId, input) => request(`/projects/${encoded(projectId)}/invitations`, { method: 'POST', body: input }),
      respond: (invitationId, response) => request(`/project-invitations/${encoded(invitationId)}/respond`, { method: 'POST', body: { response } }),
      revoke: (projectId, invitationId, reason) => request(`/projects/${encoded(projectId)}/invitations/${encoded(invitationId)}/revoke`, { method: 'POST', body: { reason } }),
    }),
    projectMemberships: Object.freeze({
      changeRole: (projectId, actorId, input) => request(`/projects/${encoded(projectId)}/members/${encoded(actorId)}`, { method: 'PATCH', body: input }),
      remove: (projectId, actorId, reason) => request(`/projects/${encoded(projectId)}/members/${encoded(actorId)}`, { method: 'DELETE', body: { reason } }),
    }),
  });
}

/** Accept both the direct PostgreSQL RPC shape and a future camel-case adapter. */
export function admissionRecordId(payload, camelName, snakeName) {
  const value = payload?.[camelName] ?? payload?.[snakeName] ?? null;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
