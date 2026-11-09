'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Alert, Empty } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { MarginSection } from '@/components/ui/doc';
import { useAuth } from '@/components/auth-provider';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { ORCID_PROVIDER, ORCID_PROVIDER_CONFIGURED, isOrcidProvider } from '@/lib/orcid-provider';
import { connectedIdentities, editableProfile, orcidLinkError, requestOwnProfile } from '@/lib/account-settings.mjs';

const SECTIONS = [
  { id: 's-profile', label: 'Profile' },
  { id: 's-identities', label: 'Connected identities' },
  { id: 's-tokens', label: 'Tokens' },
  { id: 's-security', label: 'Security' },
  { id: 's-notifications', label: 'Notifications' },
];

function profileRequest(options = {}) {
  return requestOwnProfile({ auth: createBrowserSupabaseClient().auth, apiUrl: process.env.NEXT_PUBLIC_EVIMESH_API_URL, ...options });
}

/*
 * Account settings (M13.8 06-personal-ui-spec.md §2): one private page, five
 * sections. Public identity lives on contributor pages; credentials live
 * behind one-time reveal only.
 */
export default function SettingsPage() {
  const { session, ready } = useAuth();
  const userId = session?.user?.id;
  const [profile, setProfile] = useState(editableProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const identities = ready ? connectedIdentities(session?.user) : null;
  const orcidConnected = identities?.some((identity) => isOrcidProvider(identity.kind));
  const [message, setMessage] = useState(null);
  const [identityMessage, setIdentityMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  /* ORCID connect (design book 06 §2): offered only when the Supabase
   * project actually has the ORCID OAuth provider enabled; the button set
   * follows the backend, it never advertises what would fail. */
  const [orcidEnabled, setOrcidEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(editableProfile());
    setProfileLoaded(false);
    setMessage(null);
    setIdentityMessage(null);
    if (!ready || !userId) return;
    profileRequest().then((saved) => {
      if (!active) return;
      setProfile(editableProfile(saved));
      setProfileLoaded(true);
    }).catch((error) => {
      if (!active) return;
      if (error.status === 404 && error.code === 'ACTOR_PROFILE_NOT_FOUND') setProfileLoaded(true);
      else setMessage(error.message);
    });
    return () => { active = false; };
  }, [ready, userId, loadAttempt]);

  useEffect(() => {
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

  /* OAuth linking also requires "Allow manual linking" in Supabase Auth.
   * The public settings endpoint does not expose that server-side switch. */
  async function connectOrcid() {
    setConnecting(true);
    setIdentityMessage(null);
    try {
      const { error } = await createBrowserSupabaseClient().auth.linkIdentity({ provider: ORCID_PROVIDER, options: { redirectTo: `${window.location.origin}/settings` } });
      if (error) throw error;
    } catch (error) {
      setIdentityMessage(orcidLinkError(error));
    } finally {
      setConnecting(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try { const saved = await profileRequest({ method: 'PATCH', profile }); setProfile(editableProfile(saved)); setMessage('Profile saved.'); } catch (error) { setMessage(error.message); } finally { setSaving(false); }
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
              <fieldset className="space-y-4" disabled={!userId || !profileLoaded || saving}>
              <div className="grid gap-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" onChange={update('displayName')} value={profile.displayName ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="avatar-url">Avatar URL</Label><Input id="avatar-url" onChange={update('avatarUrl')} value={profile.avatarUrl ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" className="min-h-28" onChange={update('bio')} value={profile.bio ?? ''} /></div>
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" loading={saving}>Save profile</Button>
                {message && <p role={message === 'Profile saved.' ? 'status' : 'alert'} aria-live="polite" className={`text-sm ${message === 'Profile saved.' ? 'text-success' : 'text-destructive'}`}>{message}</p>}
              </div>
              </fieldset>
              {ready && !userId && <p className="text-sm text-muted-foreground"><Link href="/login" className="underline">Sign in</Link> to edit your profile.</p>}
              {userId && !profileLoaded && !message && <p role="status" className="text-sm text-muted-foreground">Loading profile…</p>}
              {userId && !profileLoaded && message && <Button type="button" variant="outline" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry loading profile</Button>}
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
                <li className="grid items-baseline gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]" key={identity.id ?? identity.kind}>
                  <span className="text-sm font-medium capitalize">{isOrcidProvider(identity.kind) ? 'ORCID' : identity.kind}</span>
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{identity.label}</span>
                  <Badge variant={identity.verified ? 'status-success' : 'status-neutral'}>{identity.verified ? 'verified' : 'pending'}</Badge>
                </li>
              ))}
              {identities !== null && !orcidConnected && <li className="grid items-center gap-x-4 gap-y-2 border-b border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
                <span className="text-sm font-medium">ORCID</span>
                <span className="text-sm text-muted-foreground">Not connected</span>
                {orcidEnabled ? (
                  <Button onClick={connectOrcid} size="sm" type="button" loading={connecting} disabled={!userId}>Connect ORCID (OAuth)</Button>
                ) : (
                  <span className="text-xs text-muted-foreground">ORCID sign-in is not available on this deployment yet.</span>
                )}
              </li>}
            </ul>
            {identityMessage && <p role="alert" className="mt-3 max-w-2xl text-sm text-destructive">{identityMessage}</p>}
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
