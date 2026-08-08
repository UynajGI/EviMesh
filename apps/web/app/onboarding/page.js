'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Radio } from '@/components/ui/selection';
import { PageContainer, PageHeader } from '@/components/ui/page';

const ROLES = [
  { id: 'researcher', label: 'Researcher', description: 'Find tasks and questions to investigate', target: '/tasks' },
  { id: 'verifier', label: 'Verifier', description: 'Review claims and verification evidence', target: '/verification' },
  { id: 'maintainer', label: 'Maintainer', description: 'Open projects and steward research spaces', target: '/projects' },
  { id: 'agent-operator', label: 'Agent operator', description: 'Run reproducible research agents', target: '/tasks' },
];

const INTERESTS = {
  researcher: ['cpu-only', 'under-60-min'],
  verifier: ['under_verification', 'provisionally_accepted'],
  maintainer: ['draft', 'active'],
  'agent-operator': ['cpu-only', 'under-60-min'],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [interest, setInterest] = useState('');

  function finish() {
    try {
      window.localStorage.setItem('onboarding:role', role);
      window.localStorage.setItem('onboarding:interest', interest);
    } catch { /* storage may be unavailable */ }
    const roleEntry = ROLES.find((entry) => entry.id === role);
    const target = roleEntry?.target ?? '/tasks';
    const interestParam = interest ? `?status=${interest}` : '';
    router.push(`${target}${interestParam}`);
  }

  return <PageContainer><PageHeader eyebrow={`Getting started · Step ${step} of 3`} title={step === 1 ? 'Choose your role' : step === 2 ? 'Pick your focus' : 'You are ready'} description={step === 1 ? 'Select how you want to contribute to the network.' : step === 2 ? 'Choose the kind of work you want to see first.' : 'Your workspace is set. We will take you to your first task.'} />
    {step === 1 ? <div className="mt-8 grid gap-4 md:grid-cols-2">{ROLES.map((entry) => <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-5 transition hover:border-primary" key={entry.id}><Radio name="onboarding-role" checked={role === entry.id} onChange={() => setRole(entry.id)} /><span><span className="block text-sm font-medium">{entry.label}</span><span className="mt-1 block text-sm text-muted-foreground">{entry.description}</span></span></label>)}</div> : step === 2 ? <div className="mt-8 grid gap-4 md:grid-cols-2">{(INTERESTS[role] ?? []).map((value) => <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-5 transition hover:border-primary" key={value}><Radio name="onboarding-interest" checked={interest === value} onChange={() => setInterest(value)} /><span><span className="block text-sm font-medium">{value.replaceAll('_', ' ')}</span><span className="mt-1 block text-sm text-muted-foreground">{value === 'cpu-only' ? 'Tasks that run on any laptop' : value === 'under-60-min' ? 'Tasks sized to finish in under an hour' : value === 'under_verification' ? 'Claims currently under verification' : value === 'provisionally_accepted' ? 'Claims provisionally accepted' : value === 'draft' ? 'Projects being drafted' : 'Active projects'}</span></span></label>)}</div> : <div className="mt-8 max-w-md rounded-lg border border-border bg-card p-6"><p className="text-sm text-muted-foreground">Role: <span className="font-medium text-foreground">{role}</span>{interest ? ` · Focus: ${interest.replaceAll('_', ' ')}` : ''}</p><p className="mt-3 text-sm text-muted-foreground">You can change this anytime from your account settings.</p></div>}
    <div className="mt-8 flex items-center justify-between gap-4">
      <Button type="button" variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Back</Button>
      {step < 3 ? <Button type="button" onClick={() => setStep(step + 1)} disabled={step === 1 ? !role : !interest}>Continue</Button> : <Button type="button" onClick={finish}>Take me to my workspace</Button>}
    </div>
  </PageContainer>;
}
