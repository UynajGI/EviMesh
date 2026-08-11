/**
 * Unified API client (M13.5-D10). Every fetch goes through apiFetch so that
 * timeouts, offline states, and HTTP errors surface as readable messages with
 * a traceable request ID — raw API errors never leak to the user.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** Convert an unknown error into a readable, user-facing message. */
export function readableError(reason, fallback = 'The request failed.') {
  if (reason instanceof ApiError) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason;
  if (reason instanceof DOMException && reason.name === 'AbortError') return 'The request timed out. Please try again.';
  return fallback;
}

export class ApiError extends Error {
  constructor({ message, status = null, code = null, requestId = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function messageForStatus(status, payload) {
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    // Keep the server's message for domain failures, never for 5xx.
    if (status >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
    return payload.message.trim();
  }
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
  return 'The request failed. Please try again.';
}

/**
 * Fetch with timeout, offline detection, and normalized errors.
 * Resolves with the parsed JSON body; throws ApiError on failure.
 */
export async function apiFetch(path, { timeout = DEFAULT_TIMEOUT_MS, headers, ...options } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError({ message: 'You appear to be offline. Check your connection and try again.', code: 'NETWORK_OFFLINE' });
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new ApiError({ message: 'The request timed out. Please try again.', code: 'TIMEOUT' });
    }
    throw new ApiError({ message: 'You appear to be offline. Check your connection and try again.', code: 'NETWORK_OFFLINE' });
  } finally {
    window.clearTimeout(timer);
  }
  let payload = null;
  try { payload = await response.json(); } catch { /* non-JSON body */ }
  if (!response.ok) {
    const requestId = payload?.request_id ?? payload?.requestId ?? null;
    throw new ApiError({
      message: messageForStatus(response.status, payload),
      status: response.status,
      code: payload?.code ?? null,
      requestId: typeof requestId === 'string' && requestId.trim() ? requestId.trim() : null,
    });
  }
  return payload;
}
