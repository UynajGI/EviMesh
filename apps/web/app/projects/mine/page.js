'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdmissionFault, AdmissionSessionBoundary } from '@/components/admission-session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/data';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FieldGroup, Input, Textarea } from '@/components/ui/form';
import { Select } from '@/components/ui/selection';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { ActorName, MarginSection, formatDate } from '@/components/ui/doc';
import { canonicalId, useAdmissionAction, useAdmissionResource } from '@/lib/use-admission';

const LICENSES = ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'MIT', 'Apache-2.0'];

const APPLICATION_STATUS = {
  pending: { variant: 'status-accent', label: 'In review' },
  approved: { variant: 'status-success', label: 'Approved' },
  rejected: { variant: 'status-danger', label: 'Not approved' },
  withdrawn: { variant: 'status-neutral', label: 'Withdrawn' },
};

const INVITATION_STATUS = {
  pending: { variant: 'status-accent', label: 'Pending' },
  accepted: { variant: 'status-success', label: 'Accepted' },
  declined: { variant: 'status-neutral', label: 'Declined' },
  revoked: { variant: 'status-neutral', label: 'Revoked' },
  expired: { variant: 'status-neutral', label: 'Expired' },
};

function StatusLabel({ map, status }) {
  const entry = map[status] ?? { variant: 'status-neutral', label: String(status ?? 'unknown').replaceAll('_', ' ') };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function ApplyForm({ client, onSubmitted }) {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [license, setLicense] = useState('CC-BY-4.0');
  const [fieldErrors, setFieldErrors] = useState({});
  const { pending, error, run } = useAdmissionAction();

  async function submit(event) {
    event.preventDefault();
    const errors = {};
    if (name.trim().length < 3) errors.name = 'At least 3 characters.';
    if (summary.trim().length < 20) errors.summary = 'At least 20 characters.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const result = await run('apply', () => client.projectApplications.submit({
      proposedProjectId: canonicalId('project'),
      name: name.trim(),
      summary: summary.trim(),
      license,
    }));
    if (result) {
      setName('');
      setSummary('');
      onSubmitted();
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <FieldGroup error={fieldErrors.name} htmlFor="project-name" label="Project name">
        <Input id="project-name" maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Blind reproductions of contrastive few-shot gains" value={name} />
      </FieldGroup>
      <FieldGroup error={fieldErrors.summary} help="At least 20 characters." htmlFor="project-summary" label="Research scope">
        <Textarea id="project-summary" maxLength={2000} onChange={(event) => setSummary(event.target.value)} rows={5} value={summary} />
      </FieldGroup>
      <FieldGroup htmlFor="project-license" label="License">
        <Select className="sm:max-w-xs" id="project-license" onChange={(event) => setLicense(event.target.value)} value={license}>
          {LICENSES.map((value) => <option key={value} value={value}>{value}</option>)}
        </Select>
      </FieldGroup>
      <div>
        <Button loading={pending === 'apply'} type="submit">Submit for review</Button>
      </div>
      {error ? <AdmissionFault className="mt-0" error={error.error} /> : null}
    </form>
  );
}

function Applications({ resource, action }) {
  const items = resource.data ?? [];
  if (resource.status === 'loading') return <div className="mt-4 grid gap-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  if (resource.status === 'error') return <AdmissionFault error={resource.error} onRetry={resource.reload} />;
  if (items.length === 0) return <Empty className="border-0 py-3" title="No applications yet" />;
  return (
    <ul>
      {items.map((item) => (
        <li className="grid gap-2 border-b border-border py-3 md:grid-cols-[minmax(0,1fr)_auto]" key={item.applicationId}>
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold">
              {item.approvedProjectId ? <Link className="hover:underline" href={`/projects/${item.approvedProjectId}`}>{item.name}</Link> : item.name}
            </p>
            <p className="mt-0.5 max-w-[64ch] font-serif text-sm leading-6">{item.summary}</p>
            {item.decisionReason ? (
              <p className="mt-1 max-w-[64ch] text-sm leading-6"><span className="text-muted-foreground">Reason, {formatDate(item.decidedAt)}: </span>{item.decisionReason}</p>
            ) : null}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-muted-foreground">
              <StatusLabel map={APPLICATION_STATUS} status={item.status} />
              <span>submitted {formatDate(item.submittedAt)}</span>
              <span aria-hidden="true">·</span>
              <span>{item.license}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {item.status === 'pending' ? (
              <Button loading={action.pending === item.applicationId} onClick={() => action.run(item.applicationId, () => resource.client.projectApplications.withdraw(item.applicationId)).then((result) => { if (result) resource.reload(); })} size="sm" variant="outline">Withdraw</Button>
            ) : null}
            {item.approvedProjectId ? <Link className="text-sm text-primary hover:underline" href={`/projects/${item.approvedProjectId}`}>Open project</Link> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Invitations({ resource, action }) {
  const items = (resource.data ?? []).filter((item) => item.status === 'pending' || item.status === 'accepted' || item.status === 'declined');
  if (resource.status === 'loading') return <div className="mt-4"><Skeleton className="h-20 w-full" /></div>;
  if (resource.status === 'error') return <AdmissionFault error={resource.error} onRetry={resource.reload} />;
  if (items.length === 0) return <Empty className="border-0 py-3" title="No invitations" />;
  const respond = (invitationId, response) => action.run(`${invitationId}:${response}`, () => resource.client.projectInvitations.respond(invitationId, response)).then((result) => { if (result) resource.reload(); });
  return (
    <ul>
      {items.map((item) => (
        <li className="grid gap-2 border-b border-border py-3 md:grid-cols-[minmax(0,1fr)_auto]" key={item.invitationId}>
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold"><Link className="hover:underline" href={`/projects/${item.projectId}`}>{item.projectName ?? 'Project'}</Link></p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
              <StatusLabel map={INVITATION_STATUS} status={item.status} />
              <span>{item.role}, invited by</span> <ActorName actorId={item.invitedByActorId} showOwner={false} />
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">expires {formatDate(item.expiresAt)}</span>
            </p>
          </div>
          {item.status === 'pending' ? (
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button loading={action.pending === `${item.invitationId}:accepted`} onClick={() => respond(item.invitationId, 'accepted')} size="sm">Accept</Button>
              <Button loading={action.pending === `${item.invitationId}:declined`} onClick={() => respond(item.invitationId, 'declined')} size="sm" variant="outline">Decline</Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function MyProjectsWorkspace({ session }) {
  const applications = useAdmissionResource(session, (client) => client.projectApplications.list('mine').then((body) => body.items ?? []));
  const invitations = useAdmissionResource(session, (client) => client.projectInvitations.mine().then((body) => body.items ?? []));
  const applicationAction = useAdmissionAction();
  const invitationAction = useAdmissionAction();
  const pendingInvitations = (invitations.data ?? []).filter((item) => item.status === 'pending').length;
  /* The registry allows one pending application per person at a time. */
  const pendingApplication = (applications.data ?? []).find((item) => item.status === 'pending') ?? null;

  return (
    <div className="doc-grid mt-6">
      <div className="min-w-0">
        <section aria-labelledby="invitations-heading">
          <SectionHeader action={pendingInvitations > 0 ? <span className="tabular-nums text-muted-foreground">{pendingInvitations} pending</span> : null} id="invitations-heading" title="Invitations" />
          <Invitations action={invitationAction} resource={invitations} />
          {invitationAction.error ? <AdmissionFault error={invitationAction.error.error} /> : null}
        </section>

        <section aria-labelledby="applications-heading" className="mt-8">
          <SectionHeader id="applications-heading" title="Applications" />
          <Applications action={applicationAction} resource={applications} />
          {applicationAction.error ? <AdmissionFault error={applicationAction.error.error} /> : null}
        </section>

        <section aria-labelledby="apply-heading" className="mt-8">
          <SectionHeader id="apply-heading" title="Propose a project" />
          <div className="mt-4 max-w-2xl">
            {pendingApplication ? (
              <p className="text-sm leading-6">
                <span className="font-medium">{pendingApplication.name}</span> is in review. One application at a time.
              </p>
            ) : applications.client && applications.status !== 'loading' ? <ApplyForm client={applications.client} onSubmitted={applications.reload} /> : null}
          </div>
        </section>
      </div>

      <aside aria-label="How projects work" className="doc-margin">
        <MarginSection title="Related">
          <ul className="grid gap-1 text-[13px]">
            <li><Link className="text-primary hover:underline" href="/projects">All projects</Link></li>
            <li><Link className="text-primary hover:underline" href="/agents">My Agents</Link></li>
          </ul>
        </MarginSection>
      </aside>
    </div>
  );
}

export default function MyProjectsPage() {
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Account', href: '/settings' }, { label: 'My projects' }]} />
      <PageHeader title="My projects" />
      <AdmissionSessionBoundary returnTo="/projects/mine">
        {(session) => <MyProjectsWorkspace session={session} />}
      </AdmissionSessionBoundary>
    </PageContainer>
  );
}
