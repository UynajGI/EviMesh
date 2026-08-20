'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Alert, Empty } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

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
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try { const saved = await profileRequest('/profile', { method: 'PATCH', body: JSON.stringify(profile) }); setProfile(saved); setMessage('Profile saved.'); } catch (error) { setMessage(error.message); } finally { setSaving(false); }
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
              <div className="grid gap-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" onChange={update('displayName')} value={profile.displayName ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="avatar-url">Avatar URL</Label><Input id="avatar-url" onChange={update('avatarUrl')} value={profile.avatarUrl ?? ''} /></div>
              <div className="grid gap-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" className="min-h-28" onChange={update('bio')} value={profile.bio ?? ''} /></div>
              <Button type="submit" loading={saving}>Save profile</Button>
              {message && <p role={message === 'Profile saved.' ? 'status' : 'alert'} aria-live="polite" className={`text-sm ${message === 'Profile saved.' ? 'text-success' : 'text-destructive'}`}>{message}</p>}
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
                <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={identity.kind}>
                  <span className="text-sm font-medium capitalize">{identity.kind}</span>
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{identity.label}</span>
                  <span className="ml-auto"><Badge variant={identity.verified ? 'success' : 'default'}>{identity.verified ? 'verified' : 'pending'}</Badge></span>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="text-sm font-medium">ORCID</span>
                <span className="text-sm text-muted-foreground">Not connected</span>
                <span className="ml-auto text-xs text-muted-foreground">OAuth only: a manually typed iD can never show as verified</span>
              </div>
            </div>
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
