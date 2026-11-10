'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdmissionFault, AdmissionSessionBoundary } from '@/components/admission-session';
import { Button } from '@/components/ui/button';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FieldGroup, Textarea } from '@/components/ui/form';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { ActorName, Identifier, MarginSection, formatDateTime } from '@/components/ui/doc';
import { useAdmissionAction, useAdmissionResource } from '@/lib/use-admission';

/* One application under review. A decision always carries a written reason,
 * which the applicant reads and the audit log keeps. */
function ReviewRow({ item, client, onDecided }) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const { pending, error, run } = useAdmissionAction();
  const fieldId = `reason-${item.applicationId}`;

  async function decide(decision) {
    if (reason.trim().length < 10) {
      setFieldError('At least 10 characters.');
      return;
    }
    setFieldError(null);
    const result = await run(decision, () => client.projectApplications.decide(item.applicationId, { decision, reason: reason.trim() }));
    if (result) onDecided();
  }

  return (
    <li className="border-b border-border py-4">
      <article aria-labelledby={`${fieldId}-title`} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold" id={`${fieldId}-title`}>{item.name}</h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-muted-foreground">
            <ActorName actorId={item.applicantActorId} showOwner={false} />
            <span aria-hidden="true">·</span>
            <span>{item.license}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatDateTime(item.submittedAt)}</span>
            <span aria-hidden="true">·</span>
            <Identifier value={item.proposedProjectId} />
          </p>
          <p className="mt-2 max-w-[64ch] whitespace-pre-line font-serif text-base leading-7">{item.summary}</p>
        </div>
        <form className="grid content-start gap-3" noValidate onSubmit={(event) => { event.preventDefault(); decide('approved'); }}>
          <FieldGroup error={fieldError} help="At least 10 characters. Public." htmlFor={fieldId} label="Reason">
            <Textarea id={fieldId} maxLength={1000} onChange={(event) => setReason(event.target.value)} rows={4} value={reason} />
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending === 'approved'} type="submit">Approve project</Button>
            <Button loading={pending === 'rejected'} onClick={() => decide('rejected')} variant="outline">Decline</Button>
          </div>
          {error ? <AdmissionFault className="mt-0" error={error.error} /> : null}
        </form>
      </article>
    </li>
  );
}

function StewardQueue({ session }) {
  const queue = useAdmissionResource(session, (client) => client.projectApplications.list('pending'));
  const items = queue.data?.items ?? [];

  if (queue.status === 'loading') return <div className="mt-6 grid gap-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (queue.status === 'error') return <AdmissionFault error={queue.error} onRetry={queue.reload} />;

  return (
    <div className="doc-grid mt-6">
      <section aria-labelledby="queue-heading" className="min-w-0">
        <SectionHeader action={<span className="tabular-nums text-muted-foreground">{items.length}</span>} id="queue-heading" title="Awaiting review" />
        {items.length === 0 ? (
          <Empty className="border-0 py-3" title="Queue is clear" />
        ) : (
          <ul>{items.map((item) => <ReviewRow client={queue.client} item={item} key={item.applicationId} onDecided={queue.reload} />)}</ul>
        )}
      </section>
      <aside aria-label="Review guidance" className="doc-margin">
        <MarginSection title="What to check">
          <ul className="grid list-disc gap-1 pl-4 text-[13px] leading-5">
            <li>Scope answerable by evidence</li>
            <li>License permits reuse</li>
            <li>Not a duplicate</li>
          </ul>
        </MarginSection>
        <MarginSection title="Record">
          <Link className="text-[13px] text-primary hover:underline" href="/events">Event audit</Link>
        </MarginSection>
      </aside>
    </div>
  );
}

export default function StewardPage() {
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Account', href: '/settings' }, { label: 'Steward review' }]} />
      <PageHeader title="Steward review" />
      <AdmissionSessionBoundary returnTo="/steward">
        {(session) => <StewardQueue session={session} />}
      </AdmissionSessionBoundary>
    </PageContainer>
  );
}
