const USER_CODE_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export class DeviceAuthorizationError extends Error {
  constructor({ message, status = null, code = null, requestId = null } = {}) {
    super(message ?? 'The device authorization request failed.');
    this.name = 'DeviceAuthorizationError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/** Format pasted or typed RFC 8628-style codes without accepting lookalikes. */
export function formatUserCode(value) {
  const compact = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

export function isCompleteUserCode(value) {
  return USER_CODE_PATTERN.test(String(value ?? ''));
}

function apiBase(apiUrl) {
  if (typeof apiUrl !== 'string' || apiUrl.trim().length === 0) {
    throw new DeviceAuthorizationError({
      message: 'The EviMesh API is not configured for device authorization.',
      status: 503,
      code: 'DEVICE_AUTH_API_UNAVAILABLE',
    });
  }
  return apiUrl.replace(/\/$/, '');
}

async function request(path, {
  accessToken,
  apiUrl = process.env.NEXT_PUBLIC_EVIMESH_API_URL,
  body,
  fetchImpl = fetch,
  method = 'GET',
} = {}) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new DeviceAuthorizationError({
      message: 'Sign in before reviewing this connection.',
      status: 401,
      code: 'DEVICE_AUTH_SESSION_REQUIRED',
    });
  }

  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response;
  try {
    response = await fetchImpl(`${apiBase(apiUrl)}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new DeviceAuthorizationError({
      message: 'The authorization service could not be reached. Check your connection and try again.',
      code: 'DEVICE_AUTH_NETWORK_ERROR',
    });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new DeviceAuthorizationError({
      message: payload.error_description ?? payload.message ?? 'The device authorization request failed.',
      status: response.status,
      code: payload.error ?? payload.code ?? null,
      requestId: payload.request_id ?? payload.requestId ?? null,
    });
  }
  return payload;
}

function normalizeGrant(value) {
  const requestedScopes = value?.requested_scopes;
  const expiresAt = value?.expires_at;
  if (
    value?.status !== 'pending'
    || typeof value.client_id !== 'string'
    || value.client_id.length === 0
    || !Array.isArray(requestedScopes)
    || requestedScopes.some((scope) => typeof scope !== 'string' || scope.length === 0)
    || typeof expiresAt !== 'string'
    || Number.isNaN(Date.parse(expiresAt))
  ) {
    throw new DeviceAuthorizationError({
      message: 'The authorization service returned an invalid connection preview.',
      status: 502,
      code: 'DEVICE_AUTH_PREVIEW_INVALID',
    });
  }
  return {
    status: 'pending',
    clientId: value.client_id,
    requestedScopes: [...requestedScopes],
    expiresAt,
  };
}

function normalizeManagedAgents(value) {
  if (!Array.isArray(value?.items)) {
    throw new DeviceAuthorizationError({
      message: 'The authorization service returned an invalid Agent list.',
      status: 502,
      code: 'DEVICE_AUTH_AGENTS_INVALID',
    });
  }
  return value.items
    .filter((actor) => actor && actor.actorType === 'agent' && typeof actor.actorId === 'string' && actor.actorId.length > 0)
    .map((actor) => ({
      actorId: actor.actorId,
      actorType: 'agent',
      modelName: typeof actor.modelName === 'string' && actor.modelName.length > 0 ? actor.modelName : null,
      runtime: typeof actor.runtime === 'string' && actor.runtime.length > 0 ? actor.runtime : null,
      scope: typeof actor.scope === 'string' && actor.scope.length > 0 ? actor.scope : null,
      publicKeyFingerprint: typeof actor.publicKeyFingerprint === 'string' && actor.publicKeyFingerprint.length > 0
        ? actor.publicKeyFingerprint
        : null,
    }));
}

export async function fetchDeviceGrant(userCode, options = {}) {
  const code = formatUserCode(userCode);
  if (!isCompleteUserCode(code)) {
    throw new DeviceAuthorizationError({
      message: 'Enter the complete eight-character code shown by your Agent client.',
      status: 400,
      code: 'DEVICE_AUTH_USER_CODE_INVALID',
    });
  }
  return normalizeGrant(await request(`/auth/device/grants/${encodeURIComponent(code)}`, options));
}

export async function fetchManagedAgentActors(options = {}) {
  return normalizeManagedAgents(await request('/actors/managed?actor_type=agent', options));
}

export async function approveDeviceGrant({ userCode, agentActorId }, options = {}) {
  const code = formatUserCode(userCode);
  if (!isCompleteUserCode(code)) {
    throw new DeviceAuthorizationError({ message: 'The user code is invalid.', status: 400, code: 'DEVICE_AUTH_USER_CODE_INVALID' });
  }
  if (typeof agentActorId !== 'string' || agentActorId.length === 0) {
    throw new DeviceAuthorizationError({ message: 'Choose the Agent actor that will receive this connection.', status: 400, code: 'DEVICE_AUTH_AGENT_REQUIRED' });
  }
  return request('/auth/device/approve', {
    ...options,
    method: 'POST',
    body: { user_code: code, agent_actor_id: agentActorId },
  });
}

export async function denyDeviceGrant(userCode, options = {}) {
  const code = formatUserCode(userCode);
  if (!isCompleteUserCode(code)) {
    throw new DeviceAuthorizationError({ message: 'The user code is invalid.', status: 400, code: 'DEVICE_AUTH_USER_CODE_INVALID' });
  }
  return request('/auth/device/deny', {
    ...options,
    method: 'POST',
    body: { user_code: code },
  });
}

/** Map protocol failures to the terminal or recoverable state shown by /device. */
export function deviceGrantOutcome(error) {
  const code = String(error?.code ?? '').toLowerCase();
  const message = String(error?.message ?? '').toLowerCase();
  if (code === 'expired_token' || code.includes('expired')) return 'expired';
  if (code.includes('used') || code === 'invalid_grant' || message.includes('already consumed') || message.includes('already used')) return 'used';
  if (code === 'access_denied' || code.includes('denied')) return 'denied';
  if (error?.status === 401) return 'session';
  if (error?.status === 403) return 'permission';
  return 'error';
}
