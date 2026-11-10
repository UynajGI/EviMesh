export class PublicOnboardingError extends Error {
  constructor(message, code = 'ONBOARDING_INVALID', status = 400) {
    super(message);
    this.name = 'PublicOnboardingError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field, maxLength = 5000) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new PublicOnboardingError(`${field} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value.trim();
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field, maxLength);
}

function instant(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new PublicOnboardingError(`${field} must be a valid timestamp`);
  return date.toISOString();
}

/**
 * Persist the current terms acceptance and public profile in one server-side
 * operation. `emailVerified` must be derived from Supabase auth claims; the
 * database independently checks auth.users and never stores a copied flag.
 */
export async function completePublicOnboarding({
  repository,
  actorId,
  authSubject,
  emailVerified,
  termsVersion,
  acceptedAt = new Date(),
  displayName,
  bio = null,
  avatarUrl = null,
} = {}) {
  if (!repository || typeof repository.completeOnboarding !== 'function') {
    throw new PublicOnboardingError('repository completeOnboarding is required');
  }
  if (emailVerified !== true) {
    throw new PublicOnboardingError('a verified Supabase email is required', 'EMAIL_NOT_VERIFIED', 403);
  }

  return repository.completeOnboarding({
    actorId: requiredText(actorId, 'actor id', 200),
    authSubject: requiredText(authSubject, 'auth subject', 200),
    termsVersion: requiredText(termsVersion, 'terms version', 100),
    acceptedAt: instant(acceptedAt, 'accepted at'),
    displayName: requiredText(displayName, 'display name', 200),
    bio: optionalText(bio, 'bio', 5000),
    avatarUrl: optionalText(avatarUrl, 'avatar URL', 2000),
  });
}
