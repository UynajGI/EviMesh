'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AdmissionFault, AdmissionSessionBoundary } from '@/components/admission-session';
import { Button, buttonLinkVariants } from '@/components/ui/button';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FieldGroup, Input } from '@/components/ui/form';
import { Select } from '@/components/ui/selection';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Identifier, MarginSection, useActorCard } from '@/components/ui/doc';
import { useAdmissionAction, useAdmissionResource } from '@/lib/use-admission';
import { cn } from '@/lib/utils';

const RUNTIMES = [
  { value: 'mcp', label: 'MCP client (Claude, Codex, Cursor)' },
  { value: 'sq-cli', label: 'sq command-line client' },
  { value: 'sdk', label: 'SDK pipeline' },
];

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

function CreateAgentForm({ client, onCreated }) {
  const [displayName, setDisplayName] = useState('');
  const [modelName, setModelName] = useState('');
  const [runtime, setRuntime] = useState('mcp');
  const [fieldError, setFieldError] = useState(null);
  const { pending, error, run } = useAdmissionAction();

  async function submit(event) {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length < 2 || name.length > 60) {
      setFieldError('Between 2 and 60 characters.');
      return;
    }
    setFieldError(null);
    const created = await run('create', () => client.managedAgents.create({ displayName: name, modelName: modelName.trim() || null, runtime }));
    if (created) {
      setDisplayName('');
      setModelName('');
      onCreated(created);
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <FieldGroup error={fieldError} help="2 to 60 characters." htmlFor="agent-name" label="Agent name">
        <Input autoComplete="off" id="agent-name" maxLength={60} onChange={(event) => setDisplayName(event.target.value)} placeholder="atlas" value={displayName} />
      </FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldGroup htmlFor="agent-model" label="Model (optional)">
          <Input autoComplete="off" id="agent-model" maxLength={80} onChange={(event) => setModelName(event.target.value)} placeholder="claude-sonnet" value={modelName} />
        </FieldGroup>
        <FieldGroup htmlFor="agent-runtime" label="Connects through">
          <Select id="agent-runtime" onChange={(event) => setRuntime(event.target.value)} value={runtime}>
            {RUNTIMES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </FieldGroup>
      </div>
      <div>
        <Button loading={pending === 'create'} type="submit">Create Agent</Button>
      </div>
      {error ? <AdmissionFault className="mt-0" error={error.error} /> : null}
    </form>
  );
}

function AgentRow({ agent, onRetire, retiring }) {
  const card = useActorCard(agent.actorId);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <li className="grid gap-2 border-b border-border py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link className="text-[0.9375rem] font-semibold hover:underline" href={`/agents/${encodeURIComponent(agent.actorId)}`}>{card?.displayName ?? 'Unnamed Agent'}</Link>
          <Identifier value={agent.actorId} />
        </p>
        <p className="mt-1 flex flex-wrap gap-x-2 text-[13px] text-muted-foreground">
          <span>{agent.modelName ?? card?.modelName ?? 'model not stated'}</span>
          <span aria-hidden="true">·</span>
          <span>{readable(agent.runtime ?? card?.runtime ?? 'runtime not stated')}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">created {card?.createdAt ? new Date(card.createdAt).toISOString().slice(0, 10) : 'not stated'}</span>
          <span aria-hidden="true">·</span>
          <span>no signing key</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {!confirming ? (
          <Button onClick={() => setConfirming(true)} size="sm" variant="outline">Retire</Button>
        ) : (
          <form
            className="grid w-full gap-2 md:w-80"
            onSubmit={(event) => { event.preventDefault(); if (reason.trim()) onRetire(agent.actorId, reason.trim()); }}
          >
            <FieldGroup help="Revokes its tokens and project memberships. Its history stays." htmlFor={`retire-${agent.actorId}`} label="Reason for retiring">
              <Input autoFocus id={`retire-${agent.actorId}`} maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} />
            </FieldGroup>
            <div className="flex gap-2">
              <Button disabled={!reason.trim()} loading={retiring} size="sm" type="submit" variant="destructive">Retire Agent</Button>
              <Button onClick={() => { setConfirming(false); setReason(''); }} size="sm" variant="ghost">Keep</Button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
}

function AgentsWorkspace({ session }) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const agents = useAdmissionResource(session, (client) => client.managedAgents.list().then((body) => body.items ?? []));
  const [created, setCreated] = useState(null);
  const { pending, error, run } = useAdmissionAction();

  async function retire(agentActorId, reason) {
    const result = await run(agentActorId, () => agents.client.managedAgents.retire(agentActorId, reason));
    if (result) agents.reload();
  }

  const list = agents.data ?? [];
  const safeReturn = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;

  return (
    <div className="doc-grid mt-6">
      <div className="min-w-0">
        {created && safeReturn ? (
          <div className="mb-6 border-y border-border py-3">
            <p className="text-sm"><span className="font-semibold">{created.displayName}</span> is ready.</p>
            <Link className={cn(buttonLinkVariants({ size: 'sm' }), 'mt-3')} href={safeReturn}>Return to the connection request</Link>
          </div>
        ) : null}

        <section aria-labelledby="agents-heading">
          <SectionHeader action={<span className="tabular-nums text-muted-foreground">{agents.status === 'ready' ? list.length : ''}</span>} id="agents-heading" title="Your Agents" />
          {agents.status === 'loading' ? <div className="mt-4 grid gap-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : null}
          {agents.status === 'error' ? <AdmissionFault error={agents.error} onRetry={agents.reload} /> : null}
          {agents.status !== 'loading' && agents.status !== 'error' && list.length === 0 ? (
            <Empty className="border-0 py-3" title="No Agents yet" />
          ) : null}
          {list.length > 0 ? (
            <ul className="mt-1">
              {list.map((agent) => <AgentRow agent={agent} key={agent.actorId} onRetire={retire} retiring={pending === agent.actorId} />)}
            </ul>
          ) : null}
          {error ? <AdmissionFault error={error.error} /> : null}
        </section>

        <section aria-labelledby="create-heading" className="mt-8">
          <SectionHeader id="create-heading" title="Create an Agent" />
          <div className="mt-4 max-w-2xl">
            {agents.client ? <CreateAgentForm client={agents.client} onCreated={(agent) => { setCreated(agent); agents.reload(); }} /> : null}
          </div>
        </section>
      </div>

      <aside aria-label="How Agents connect" className="doc-margin">
        <MarginSection title="Connect an Agent">
          <ol className="grid list-decimal gap-1 pl-4 text-[13px] leading-5">
            <li><code className="font-mono text-xs">sq auth login</code> or add the MCP server</li>
            <li>Enter the code on <Link className="text-primary hover:underline" href="/device">/device</Link></li>
            <li>Pick the Agent to receive the token</li>
          </ol>
        </MarginSection>
        <MarginSection title="Related">
          <ul className="grid gap-1 text-[13px]">
            <li><Link className="text-primary hover:underline" href="/settings/keys">Signing keys</Link></li>
            <li><Link className="text-primary hover:underline" href="/projects/mine">My projects</Link></li>
          </ul>
        </MarginSection>
      </aside>
    </div>
  );
}

function AgentsPageContent() {
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Account', href: '/settings' }, { label: 'My Agents' }]} />
      <PageHeader title="My Agents" />
      <AdmissionSessionBoundary returnTo="/agents">
        {(session) => <AgentsWorkspace session={session} />}
      </AdmissionSessionBoundary>
    </PageContainer>
  );
}

export default function AgentsPage() {
  return <Suspense fallback={<PageContainer><Skeleton className="h-40 w-full" /></PageContainer>}><AgentsPageContent /></Suspense>;
}
