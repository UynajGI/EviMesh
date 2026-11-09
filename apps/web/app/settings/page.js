'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Alert, Empty } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { MarginSection } from '@/components/ui/doc';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { ORCID_PROVIDER, ORCID_PROVIDER_CONFIGURED, isOrcidProvider } from '@/lib/orcid-provider';

const SECTIONS = [
  { id: 's-profile', label: 'Profile' },
  { id: 's-identities', label: 'Connected identities' },
  { id: 's-tokens', label: 'Tokens' },
  { id: 's-security', label: 'Security' },
  { id: 's-notifications', label: 'Notifications' },
];

async function profileRequest(path, options = {}) {
  const { data, error } = await createBrowserSupabaseClient().auth.getSession();
  if (error || !data.session) throw new Error('Please sign in to edit your profile.');
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`, { ...options, headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Profile request failed.');
  return payload;
}

/*
 * Account settings (M13.8 06-personal-ui-spec.md §2): one private page, five
 * sections. Public identity lives on contributor pages; credentials live
 * behind one-time reveal only.
 */
export default function SettingsPage() {
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [identities, setIdentities] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  /* ORCID connect (design book 06 §2): offered only when the Supabase
   * project actually has the ORCID OAuth provider enabled; the button set
   * follows the backend, it never advertises what would fail. */
  const [orcidEnabled, setOrcidEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    profileRequest('/profile').then(setProfile).catch((error) => setMessage(error.message));
    createBrowserSupabaseClient().auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const user = data.session.user ?? {};
      const meta = user.user_metadata ?? {};
      const entries = [];
      if (user.email) entries.push({ kind: 'email', label: user.email, verified: user.email_confirmed_at ? true : false });
      const provider = user.app_metadata?.provider ?? meta.provider;
      if (provider && provider !== 'email') entries.push({ kind: provider, label: meta.user_name ?? meta.full_name ?? meta.name ?? provider, verified: true });
      setIdentities(entries);
    }).catch(() => setIdentities([]));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      fetch(`${url}/auth/v1/settings`, { headers: { apikey: key, authorization: `Bearer ${key}` } })
        .then((response) => (response.ok ? response.json() : null))
        .then((settings) => {
          const external = settings?.external ?? {};
          setOrcidEnabled(ORCID_PROVIDER_CONFIGURED || Object.keys(external).some((provider) => external[provider] === true && isOrcidProvider(provider)));
        })
        .catch(() => { setOrcidEnabled(false); });
    }
  }, []);

  /* Linking attaches the ORCID identity to the signed-in account; the
   * collision warning above is enforced by re-authenticating both sides. */
  async function connectOrcid() {
    setConnecting(true);
    try {
      const { error } = await createBrowserSupabaseClient().auth.linkIdentity({ provider: ORCID_PROVIDER, options: { redirectTo: `${window.location.origin}/settings` } });
      if (error) throw error;
    } catch (error) {
      setMessage(`ORCID connect failed: ${error.message}`);
    } finally {
      setConnecting(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try { const saved = await profileRequest('/profile', { method: 'PATCH', body: JSON.stringify(profile) }); setProfile(saved); setMessage('Profile saved.'); } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  }

  const update = (key) => (event) => setProfile({ ...profile, [key]: event.target.value });

  return (
    <PageContainer>
      <PageHeader title="Settings" />

      <div className="doc-grid mt-6">
        <div className="doc-main grid gap-8">
          <section aria-labelledby="s-profile-heading" id="s-profile">
            <SectionHeader id="s-profile-heading" title="Profile" />
            <form className="mt-4 max-w-2xl space-y-4" onSubmit={save}>
              <div className="grid gap-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" onChange={update('displayName')} value={profile.displayName ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="avatar-url">Avatar URL</Label><Input id="avatar-url" onChange={update('avatarUrl')} value={profile.avatarUrl ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" className="min-h-28" onChange={update('bio')} value={profile.bio ?? ''} /></div>
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" loading={saving}>Save profile</Button>
                {message && <p role={message === 'Profile saved.' ? 'status' : 'alert'} aria-live="polite" className={`text-sm ${message === 'Profile saved.' ? 'text-success' : 'text-destructive'}`}>{message}</p>}
              </div>
            </form>
          </section>

          <section aria-labelledby="s-identities-heading" id="s-identities">
            <SectionHeader id="s-identities-heading" title="Connected identities" />
            {/* Identity-collision warning: an iD bound to another account
                pauses linking rather than silently merging identities. */}
            <Alert
              className="mt-3 max-w-2xl"
              description="An iD bound to another account pauses linking; identities are never silently merged."
              title="One iD, one account"
              variant="warning"
            />
            <ul className="mt-3 max-w-2xl">
              {identities === null ? <li className="border-b border-border py-3 text-sm text-muted-foreground">Loading identities…</li> : identities.length === 0 ? (
                <li className="border-b border-border py-3 text-sm text-muted-foreground">No external identities</li>
              ) : identities.map((identity) => (
                <li className="grid items-baseline gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]" key={identity.kind}>
                  <span className="text-sm font-medium capitalize">{identity.kind}</span>
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{identity.label}</span>
                  <Badge variant={identity.verified ? 'status-success' : 'status-neutral'}>{identity.verified ? 'verified' : 'pending'}</Badge>
                </li>
              ))}
              <li className="grid items-center gap-x-4 gap-y-2 border-b border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
                <span className="text-sm font-medium">ORCID</span>
                <span className="text-sm text-muted-foreground">Not connected</span>
                {orcidEnabled ? (
                  <Button onClick={connectOrcid} size="sm" type="button" loading={connecting}>Connect ORCID (OAuth)</Button>
                ) : (
                  <span className="text-xs text-muted-foreground">ORCID sign-in is not available on this deployment yet.</span>
                )}
              </li>
            </ul>
          </section>

          <section aria-labelledby="s-tokens-heading" id="s-tokens">
            <SectionHeader id="s-tokens-heading" title="Tokens" />
            <Link className="mt-3 inline-block text-sm text-primary hover:underline" href="/settings/tokens">Manage API tokens</Link>
          </section>

          <section aria-labelledby="s-security-heading" id="s-security">
            <SectionHeader id="s-security-heading" title="Security" />
            <Link className="mt-3 inline-block text-sm text-primary hover:underline" href="/settings/keys">Manage signing keys</Link>
          </section>

          <section aria-labelledby="s-notifications-heading" id="s-notifications">
            <SectionHeader id="s-notifications-heading" title="Notifications" />
            <Empty className="max-w-2xl border-0 py-3" title="No notification preferences yet" />
          </section>
        </div>

        <aside aria-label="Settings sections and related pages" className="doc-margin">
          <MarginSection title="On this page">
            <nav aria-label="Settings sections">
              <ul className="grid gap-1 text-[13px]">
                {SECTIONS.map((section) => (
                  <li key={section.id}><a className="text-muted-foreground hover:text-foreground hover:underline" href={`#${section.id}`}>{section.label}</a></li>
                ))}
              </ul>
            </nav>
          </MarginSection>
          <MarginSection title="Account">
            <ul className="grid gap-1 text-[13px]">
              <li><Link className="text-primary hover:underline" href="/agents">My Agents</Link></li>
              <li><Link className="text-primary hover:underline" href="/settings/keys">Signing keys</Link></li>
              <li><Link className="text-primary hover:underline" href="/settings/tokens">API tokens</Link></li>
              <li><Link className="text-primary hover:underline" href="/projects/mine">My projects</Link></li>
            </ul>
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}
