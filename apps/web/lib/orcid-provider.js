/*
 * Supabase's public /auth/v1/settings payload lists built-in providers but
 * does not expose custom_oauth_providers. The production build therefore
 * receives the configured identifier explicitly and uses it consistently for
 * sign-in and identity linking.
 */
export const ORCID_PROVIDER = process.env.NEXT_PUBLIC_ORCID_PROVIDER?.trim() || 'custom:orcid';
export const ORCID_PROVIDER_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_ORCID_PROVIDER?.trim());

export function isOrcidProvider(provider) {
  const normalized = String(provider ?? '').toLowerCase();
  return normalized === 'orcid' || normalized.startsWith('custom:orcid');
}
