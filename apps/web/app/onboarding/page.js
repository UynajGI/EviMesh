'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { POLICY_EFFECTIVE_DATE } from '@/app/privacy/policy-content';
import { AdmissionFault, AdmissionSessionBoundary } from '@/components/admission-session';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { createAdmissionClient } from '@/lib/admission-client.mjs';

function OnboardingForm({ session }) {
  const router = useRouter();
  const metadata = session?.user?.user_metadata ?? {};
  const [profile, setProfile] = useState({
    displayName: metadata.full_name ?? metadata.name ?? metadata.user_name ?? '',
    bio: '',
    avatarUrl: metadata.avatar_url ?? '',
  });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (event) => setProfile((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createAdmissionClient(session).onboarding.complete({
        termsVersion: POLICY_EFFECTIVE_DATE,
        displayName: profile.displayName.trim(),
        bio: profile.bio.trim() || null,
        avatarUrl: profile.avatarUrl.trim() || null,
      });
      router.push('/settings');
    } catch (reason) {
      setError(reason);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="doc-grid mt-6">
    <form aria-labelledby="onboarding-profile-heading" className="doc-main grid max-w-2xl gap-4" onSubmit={submit}>
      <SectionHeader id="onboarding-profile-heading" title="Public profile" />
      <FieldGroup htmlFor="onboarding-display-name" label="Display name">
        <Input autoComplete="name" id="onboarding-display-name" maxLength={200} onChange={update('displayName')} required value={profile.displayName} />
      </FieldGroup>
      <FieldGroup htmlFor="onboarding-bio" label="Research profile (optional)">
        <Textarea className="min-h-28" id="onboarding-bio" maxLength={5000} onChange={update('bio')} value={profile.bio} />
      </FieldGroup>
      <FieldGroup htmlFor="onboarding-avatar" label="Avatar URL (optional)" help="Public HTTPS image URL.">
        <Input id="onboarding-avatar" inputMode="url" maxLength={2000} onChange={update('avatarUrl')} type="url" value={profile.avatarUrl} />
      </FieldGroup>
      <SectionHeader className="mt-4" title="Terms" />
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
        <input checked={accepted} className="mt-1 size-4 accent-primary" onChange={(event) => setAccepted(event.target.checked)} required type="checkbox" />
        <span>I accept the <Link className="text-primary hover:underline" href="/terms">Terms</Link> effective {POLICY_EFFECTIVE_DATE} and acknowledge the <Link className="text-primary hover:underline" href="/privacy">Privacy Notice</Link>.</span>
      </label>
      <div><Button disabled={!accepted || !profile.displayName.trim()} loading={submitting} type="submit">Complete account setup</Button></div>
      <AdmissionFault error={error} />
    </form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <PageContainer>
      <PageHeader title="Finish your account" />
      <AdmissionSessionBoundary returnTo="/onboarding">
        {(session) => <OnboardingForm session={session} />}
      </AdmissionSessionBoundary>
    </PageContainer>
  );
}
