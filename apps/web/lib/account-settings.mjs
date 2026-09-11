export function editableProfile(profile = {}) {
  return { displayName: profile.displayName ?? '', bio: profile.bio ?? '', avatarUrl: profile.avatarUrl ?? '' };
}

export async function requestOwnProfile({ auth, apiUrl, method = 'GET', profile, fetchImpl = fetch }) {
  async function request(path, options = {}) {
    const { data, error } = await auth.getSession();
    if (error || !data.session) throw new Error('Please sign in to edit your profile.');
    const response = await fetchImpl(`${apiUrl}${path}`, {
      ...options,
      headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.message ?? 'Profile request failed.'), { code: payload.code, status: response.status });
    return payload;
  }
  const attempt = () => request('/profile', {
    method, ...(profile === undefined ? {} : { body: JSON.stringify(editableProfile(profile)) }),
  });
  try {
    return await attempt();
  } catch (error) {
    // Accounts created by Auth may not have an EviMesh Actor yet. Provision
    // once through the authenticated endpoint, then repeat the same request.
    if (error.status !== 403 || error.code !== 'ACTOR_IDENTITY_NOT_FOUND') throw error;
    await request('/actors/self', { method: 'POST' });
    return attempt();
  }
}

export function connectedIdentities(user) {
  if (!user) return [];
  const entries = user.email ? [{ id: 'email', kind: 'email', label: user.email, verified: Boolean(user.email_confirmed_at) }] : [];
  // Trust the Auth identity list, not editable user metadata or only the
  // original sign-in provider: linking can add several OAuth identities.
  for (const identity of user.identities ?? []) {
    if (!identity.provider || identity.provider === 'email') continue;
    const data = identity.identity_data ?? {};
    entries.push({
      id: identity.identity_id ?? identity.id ?? identity.provider,
      kind: identity.provider,
      label: data.orcid ?? data.sub ?? data.user_name ?? data.full_name ?? data.name ?? identity.provider,
      verified: true,
    });
  }
  return entries;
}

export function orcidLinkError(error) {
  if (error.code === 'manual_linking_disabled' || /manual linking is disabled/i.test(error.message ?? '')) {
    return 'ORCID connection is unavailable because account linking is disabled. Please contact the site administrator.';
  }
  return `ORCID connect failed: ${error.message ?? 'Please try again.'}`;
}
