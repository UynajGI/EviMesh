'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '' }); const [message, setMessage] = useState(null);
  useEffect(() => { profileRequest('/profile').then(setProfile).catch((error) => setMessage(error.message)); }, []);
  async function save(event) { event.preventDefault(); try { const saved = await profileRequest('/profile', { method: 'PATCH', body: JSON.stringify(profile) }); setProfile(saved); setMessage('Profile saved.'); } catch (error) { setMessage(error.message); } }
  return <main className="mx-auto max-w-2xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Account</p><h1 className="mt-3 text-4xl font-semibold">Profile settings</h1><form className="mt-8 space-y-5" onSubmit={save}><label className="block text-sm font-medium">Display name<Input className="mt-2" onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} value={profile.displayName ?? ''} /></label><label className="block text-sm font-medium">Avatar URL<Input className="mt-2" onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} value={profile.avatarUrl ?? ''} /></label><label className="block text-sm font-medium">Bio<textarea className="mt-2 min-h-28 w-full rounded-md border border-border bg-background p-3" onChange={(event) => setProfile({ ...profile, bio: event.target.value })} value={profile.bio ?? ''} /></label><Button type="submit">Save profile</Button>{message && <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>}</form></main>;
}
