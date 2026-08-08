'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

async function profileRequest(path, options = {}) {
  const { data, error } = await createBrowserSupabaseClient().auth.getSession();
  if (error || !data.session) throw new Error('Please sign in to edit your profile.');
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`, { ...options, headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Profile request failed.');
  return payload;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { profileRequest('/profile').then(setProfile).catch((error) => setMessage(error.message)); }, []);
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try { const saved = await profileRequest('/profile', { method: 'PATCH', body: JSON.stringify(profile) }); setProfile(saved); setMessage('Profile saved.'); } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  }
  const update = (key) => (event) => setProfile({ ...profile, [key]: event.target.value });
  return <PageContainer><PageHeader eyebrow="Account" title="Profile settings" description="How you appear to other researchers on the network." />
    <form className="mt-8 max-w-2xl space-y-5" onSubmit={save}>
      <div className="grid gap-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" onChange={update('displayName')} value={profile.displayName ?? ''} /></div>
      <div className="grid gap-2"><Label htmlFor="avatar-url">Avatar URL</Label><Input id="avatar-url" onChange={update('avatarUrl')} value={profile.avatarUrl ?? ''} /></div>
      <div className="grid gap-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" className="min-h-28" onChange={update('bio')} value={profile.bio ?? ''} /></div>
      <Button type="submit" loading={saving}>Save profile</Button>
      {message && <p role={message === 'Profile saved.' ? 'status' : 'alert'} aria-live="polite" className={`text-sm ${message === 'Profile saved.' ? 'text-success' : 'text-destructive'}`}>{message}</p>}
    </form>
  </PageContainer>;
}
