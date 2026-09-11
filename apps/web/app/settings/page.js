'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Alert, Empty } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
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
   * project actually has the ORCID OAuth provider enabled — the button set
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
    <PageContainer wide>
      <PageHeader eyebrow="Account" title="Settings" description="You, your identities, and your credentials. Everything here is private; the public contributor page is separate." />

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Settings sections" className="flex flex-wrap gap-1 lg:sticky lg:top-20 lg:flex-col">
          {SECTIONS.map((section) => (
            <a className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" href={`#${section.id}`} key={section.id}>{section.label}</a>
          ))}
        </nav>

        <div className="grid min-w-0 gap-10">
          <section aria-labelledby="s-profile-heading" id="s-profile">
            <h2 className="text-lg font-semibold" id="s-profile-heading">Profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">How you appear to other researchers on the network.</p>
            <form className="mt-5 max-w-2xl space-y-5" onSubmit={save}>
              <fieldset className="space-y-5" disabled={!userId || !profileLoaded || saving}>
              <div className="grid gap-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" onChange={update('displayName')} value={profile.displayName ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="avatar-url">Avatar URL</Label><Input id="avatar-url" onChange={update('avatarUrl')} value={profile.avatarUrl ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" className="min-h-28" onChange={update('bio')} value={profile.bio ?? ''} /></div>
              <Button type="submit" loading={saving}>Save profile</Button>
              </fieldset>
              {ready && !userId && <p className="text-sm text-muted-foreground"><Link href="/login" className="underline">Sign in</Link> to edit your profile.</p>}
              {userId && !profileLoaded && !message && <p role="status" className="text-sm text-muted-foreground">Loading profile…</p>}
              {message && <p role={message === 'Profile saved.' ? 'status' : 'alert'} aria-live="polite" className={`text-sm ${message === 'Profile saved.' ? 'text-success' : 'text-destructive'}`}>{message}</p>}
              {userId && !profileLoaded && message && <Button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry loading profile</Button>}
            </form>
          </section>

          <section aria-labelledby="s-identities-heading" id="s-identities">
            <h2 className="text-lg font-semibold" id="s-identities-heading">Connected identities</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign-in identities for this account. Unlinking always requires re-authentication and is written to the security audit.</p>
            {/* Mockup identity-collision warning: an iD bound to another account
                pauses linking rather than silently merging identities. */}
            <Alert
              className="mt-3 max-w-2xl"
              description="If an ORCID or GitHub iD is already bound to another account, linking pauses and asks you to resolve it explicitly. Identities are never silently merged or reassigned."
              title="One iD, one account"
              variant="warning"
            />
            <div className="mt-4 max-w-2xl divide-y divide-border rounded-lg border border-border bg-card">
              {identities === null ? <p className="px-5 py-4 text-sm text-muted-foreground">Loading identities…</p> : identities.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No external identities connected. Sign in and connect from the login page.</p>
              ) : identities.map((identity) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={identity.id}>
                  <span className="text-sm font-medium capitalize">{isOrcidProvider(identity.kind) ? 'ORCID' : identity.kind}</span>
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{identity.label}</span>
                  <span className="ml-auto"><Badge variant={identity.verified ? 'success' : 'default'}>{identity.verified ? 'verified' : 'pending'}</Badge></span>
                </div>
              ))}
              {identities !== null && !orcidConnected && <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="text-sm font-medium">ORCID</span>
                <span className="text-sm text-muted-foreground">Not connected</span>
                {orcidEnabled ? (
                  <Button className="ml-auto" onClick={connectOrcid} size="sm" type="button" loading={connecting} disabled={!userId}>Connect ORCID (OAuth)</Button>
                ) : (
                  <span className="ml-auto text-xs text-muted-foreground">OAuth only. Enable the ORCID provider to connect.</span>
                )}
              </div>}
            </div>
            {identityMessage && <p role="alert" className="mt-3 max-w-2xl text-sm text-destructive">{identityMessage}</p>}
          </section>

          <section aria-labelledby="s-tokens-heading" id="s-tokens">
            <h2 className="text-lg font-semibold" id="s-tokens-heading">Tokens</h2>
            <p className="mt-1 text-sm text-muted-foreground">The advanced path for automation. Device authorization comes first for CLI and MCP clients; tokens are named, expiring, least-privilege, and shown exactly once.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href="/settings/tokens">Manage API tokens →</Link>
              <span className="self-center text-xs text-muted-foreground">Full table: name, scopes, created, expires, last used, status, revoke</span>
            </div>
          </section>

          <section aria-labelledby="s-security-heading" id="s-security">
            <h2 className="text-lg font-semibold" id="s-security-heading">Security</h2>
            <p className="mt-1 text-sm text-muted-foreground">Signing keys rotate without breaking published history; rotation steps live in the runbook.</p>
            <Link className="mt-4 inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href="/settings/keys">Manage signing keys →</Link>
          </section>

          <section aria-labelledby="s-notifications-heading" id="s-notifications">
            <h2 className="text-lg font-semibold" id="s-notifications-heading">Notifications</h2>
            <Alert
              className="mt-3 max-w-2xl"
              description="Watchlists and digest preferences arrive with the notification system. Levels will always express attention priority, never a verdict, and quiet objects never ping."
              title="Subscription-driven, no algorithmic feed"
              variant="info"
            />
            <Empty className="mt-3 max-w-2xl" description="Follow research from any question or claim page; changes will land here once watchlists ship." title="No notification preferences yet" />
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
