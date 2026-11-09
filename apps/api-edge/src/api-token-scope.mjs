import { DEVICE_AUTH_SCOPES } from './device-auth.mjs';

const API_TOKEN_SCOPE_SET = new Set(DEVICE_AUTH_SCOPES);
const TYPED_RESEARCH_COLLECTIONS = new Set([
  'answers',
  'rebuttals',
  'evaluations',
  'datasets',
  'tools',
]);
const RESEARCH_READ_ROOTS = new Set([
  'questions',
  'research-graph',
  'answers',
  'rebuttals',
  'evaluations',
  'datasets',
  'tools',
  'claims',
  'projects',
  'tasks',
  'artifacts',
  'evidence',
  'runs',
  'challenges',
  'attempts',
  'actors',
  'verifications',
  'events',
  'checkpoints',
  'merge-proposals',
  'provenance',
]);
const LEGACY_RESEARCH_MUTATION_ROOTS = new Set([
  'witness-receipts',
  'projects',
  'questions',
  'tasks',
  'claims',
  'attempts',
  'evidence',
  'runs',
  'artifacts',
  'verifications',
  'challenges',
]);

export const API_TOKEN_SCOPES = DEVICE_AUTH_SCOPES;

export class ApiTokenAuthorizationError extends Error {
  constructor(message, code = 'API_TOKEN_SCOPE_FORBIDDEN', status = 403) {
    super(message);
    this.name = 'ApiTokenAuthorizationError';
    this.code = code;
    this.status = status;
  }
}

function pathParts(pathname) {
  return String(pathname ?? '').split('/').filter(Boolean);
}

export function normalizeRegisteredApiTokenScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== 'string' || !scope.trim())) {
    throw new ApiTokenAuthorizationError('API token scopes are invalid', 'API_TOKEN_INVALID_SCOPES', 401);
  }
  const normalized = [...new Set(scopes.map((scope) => scope.trim()))];
  const unsupported = normalized.find((scope) => !API_TOKEN_SCOPE_SET.has(scope));
  if (unsupported) {
    throw new ApiTokenAuthorizationError(`API token contains an unsupported scope: ${unsupported}`, 'API_TOKEN_INVALID_SCOPES', 401);
  }
  return DEVICE_AUTH_SCOPES.filter((scope) => normalized.includes(scope));
}

export function assertApiTokenScope(claims, requiredScope) {
  if (!API_TOKEN_SCOPE_SET.has(requiredScope)) {
    throw new TypeError(`unregistered API token scope guard: ${requiredScope}`);
  }
  if (claims?.kind !== 'api_token') return true;
  const granted = normalizeRegisteredApiTokenScopes(claims.scopes ?? []);
  if (!granted.includes(requiredScope)) {
    throw new ApiTokenAuthorizationError(`API token requires ${requiredScope} scope`);
  }
  return true;
}

/**
 * API tokens are deny-by-default. Only public bootstrap surfaces and the
 * explicitly scoped Agent surfaces below are reachable with one.
 */
export function apiTokenRoutePolicy(method, pathname) {
  const normalizedMethod = String(method ?? 'GET').toUpperCase();
  const parts = pathParts(pathname);
  const root = parts[0] ?? '';

  if (normalizedMethod === 'OPTIONS') return Object.freeze({ allow: true });
  if (normalizedMethod === 'GET' && ['/health', '/health/dependencies', '/meta/capabilities', '/platform/keys'].includes(pathname)) {
    return Object.freeze({ allow: true });
  }
  if (normalizedMethod === 'POST' && ['/auth/device', '/auth/device/token'].includes(pathname)) {
    return Object.freeze({ allow: true });
  }
  if (normalizedMethod === 'GET' && pathname === '/auth/me') {
    return Object.freeze({ scope: 'profile:read' });
  }
  if (normalizedMethod === 'GET' && ['/profile', '/interactions/mine', '/recommendations'].includes(pathname)) {
    return Object.freeze({ scope: 'profile:read' });
  }

  if (pathname === '/api-tokens' || root === 'api-tokens') {
    return Object.freeze({ deny: true, code: 'API_TOKEN_SESSION_REQUIRED', message: 'API token management requires a human Supabase session' });
  }
  if (pathname.startsWith('/auth/device/') || pathname === '/actors/managed' || pathname.startsWith('/actors/managed/')) {
    return Object.freeze({ deny: true, code: 'API_TOKEN_SESSION_REQUIRED', message: 'Agent management requires a human Supabase session' });
  }

  if (normalizedMethod === 'POST' && pathname === '/artifacts/upload-plan') {
    return Object.freeze({ scope: 'artifact:upload' });
  }

  // Signed Question/Claim submission (migration 0090).
  if (normalizedMethod === 'POST' && root === 'research' && ['questions', 'claims'].includes(parts[1])) {
    if (parts.length === 3 && parts[2] === 'prepare') return Object.freeze({ scope: 'research:prepare' });
    if (parts.length === 2) return Object.freeze({ scope: 'research:submit' });
  }

  if (normalizedMethod === 'POST' && TYPED_RESEARCH_COLLECTIONS.has(root)) {
    if (parts.length === 2 && parts[1] === 'prepare') return Object.freeze({ scope: 'research:prepare' });
    if (parts.length === 1) return Object.freeze({ scope: 'research:submit' });
  }

  if (['GET', 'HEAD'].includes(normalizedMethod) && RESEARCH_READ_ROOTS.has(root)) {
    return Object.freeze({ scope: 'project:read' });
  }

  return Object.freeze({ deny: true, code: 'API_TOKEN_ROUTE_FORBIDDEN', message: 'API token is not allowed on this route' });
}

export function isTypedResearchPrepareRoute(method, pathname) {
  const parts = pathParts(pathname);
  if (String(method ?? '').toUpperCase() !== 'POST') return false;
  if (parts.length === 3 && parts[0] === 'research' && ['questions', 'claims'].includes(parts[1]) && parts[2] === 'prepare') return true;
  return parts.length === 2
    && TYPED_RESEARCH_COLLECTIONS.has(parts[0])
    && parts[1] === 'prepare';
}

export function isTypedResearchSubmitRoute(method, pathname) {
  const parts = pathParts(pathname);
  if (String(method ?? '').toUpperCase() !== 'POST') return false;
  if (parts.length === 2 && parts[0] === 'research' && ['questions', 'claims'].includes(parts[1])) return true;
  return parts.length === 1
    && TYPED_RESEARCH_COLLECTIONS.has(parts[0]);
}

// Project governance (membership, invitations, Agent enrollment) is account
// administration owned by the admission API, not a research mutation.
const PROJECT_GOVERNANCE_SEGMENTS = new Set(['agents', 'invitations', 'members']);

export function isLegacyResearchMutationRoute(method, pathname) {
  const normalizedMethod = String(method ?? '').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) return false;
  if (pathname === '/artifacts/upload-plan') return false;
  const parts = pathParts(pathname);
  if (parts[0] === 'projects' && parts.length >= 3 && PROJECT_GOVERNANCE_SEGMENTS.has(parts[2])) return false;
  return LEGACY_RESEARCH_MUTATION_ROOTS.has(parts[0]);
}
