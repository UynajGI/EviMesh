'use client';

import { useMemo, useState } from 'react';
import { AdmissionFault } from '@/components/admission-session';
import { useBrowserSession } from '@/components/session-shell-control';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/data';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FieldGroup, Input } from '@/components/ui/form';
import { Select } from '@/components/ui/selection';
import { SectionHeader } from '@/components/ui/page';
import { ActorName, formatDate, useActorCard } from '@/components/ui/doc';
import { createAdmissionClient } from '@/lib/admission-client.mjs';
import { useAdmissionAction, useResource } from '@/lib/use-admission';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const ROLE_ORDER = { owner: 0, maintainer: 1, contributor: 2, viewer: 3 };
const INVITABLE_ROLES = ['contributor', 'maintainer', 'viewer'];

async function readMembers(projectId) {
  const response = await fetch(`${API}/projects/${encodeURIComponent(projectId)}/members`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(payload?.message ?? 'Members are unavailable.'), { status: response.status });
  return payload?.items ?? [];
}

function RoleLabel({ role }) {
  const variant = role === 'owner' ? 'status-accent' : role === 'maintainer' ? 'status-info' : 'status-neutral';
  return <Badge variant={variant}>{role}</Badge>;
}

/* Public membership: people and the Agents they enrolled, Agents always
 * listed under their owner so attribution reads as one chain. */
function MemberList({ members, viewerActorId, canManage, onRemoveAgent, removing }) {
  const people = members.filter((member) => member.actorType !== 'agent').sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
  const agentsByOwner = new Map();
  for (const member of members.filter((entry) => entry.actorType === 'agent')) {
    const rows = agentsByOwner.get(member.ownerActorId) ?? [];
    rows.push(member);
    agentsByOwner.set(member.ownerActorId, rows);
  }
  const orphanAgents = [...agentsByOwner.entries()].filter(([owner]) => !people.some((person) => person.actorId === owner)).flatMap(([, rows]) => rows);

  const agentRow = (agent) => (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 pl-6 text-sm" key={agent.actorId}>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <ActorName actorId={agent.actorId} showOwner={false} />
        <span className="text-xs text-muted-foreground">Agent, drafts as {agent.role}</span>
      </span>
      {(agent.ownerActorId === viewerActorId || canManage) && onRemoveAgent ? (
        <Button loading={removing === agent.actorId} onClick={() => onRemoveAgent(agent.actorId)} size="sm" variant="ghost">Remove</Button>
      ) : <span className="text-xs tabular-nums text-muted-foreground">{formatDate(agent.joinedAt)}</span>}
    </li>
  );

  return (
    <ul>
      {people.map((person) => (
        <li className="border-b border-border py-3" key={person.actorId}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <ActorName actorId={person.actorId} showOwner={false} />
              <RoleLabel role={person.role} />
              {person.actorId === viewerActorId ? <span className="text-xs text-muted-foreground">you</span> : null}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">Joined {formatDate(person.joinedAt)}</span>
          </div>
          {agentsByOwner.get(person.actorId)?.length ? <ul className="mt-1 border-l border-border">{agentsByOwner.get(person.actorId).map(agentRow)}</ul> : null}
        </li>
      ))}
      {orphanAgents.length > 0 ? <li className="border-b border-border py-3"><ul>{orphanAgents.map(agentRow)}</ul></li> : null}
    </ul>
  );
}

function EnrollAgent({ client, projectId, enrolledIds, onEnrolled }) {
  const agents = useResource(() => client.managedAgents.list().then((body) => body.items ?? []), [client], Boolean(client));
  const available = (agents.data ?? []).filter((agent) => !enrolledIds.has(agent.actorId));
  const [selected, setSelected] = useState('');
  const { pending, error, run } = useAdmissionAction();

  if (agents.status === 'loading') return <Skeleton className="h-10 w-full max-w-md" />;
  if (agents.status === 'error') return <AdmissionFault className="mt-0" error={agents.error} onRetry={agents.reload} />;
  if ((agents.data ?? []).length === 0) {
    return <p className="text-sm text-muted-foreground">You have no Agents yet. <a className="text-primary hover:underline" href="/agents">Create one</a>, then enroll it here.</p>;
  }
  if (available.length === 0) return <p className="text-sm text-muted-foreground">All your Agents already draft for this project.</p>;

  const choice = selected || available[0].actorId;
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await run('enroll', () => client.projectAgents.enroll(projectId, choice));
        if (result) { setSelected(''); onEnrolled(); }
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <FieldGroup className="min-w-56 flex-1" htmlFor="enroll-agent" label="Your Agent">
          <Select id="enroll-agent" onChange={(event) => setSelected(event.target.value)} value={choice}>
            {available.map((agent) => <AgentOption agent={agent} key={agent.actorId} />)}
          </Select>
        </FieldGroup>
        <Button loading={pending === 'enroll'} type="submit">Enroll Agent</Button>
      </div>
      {error ? <AdmissionFault className="mt-0" error={error.error} /> : null}
    </form>
  );
}

function AgentOption({ agent }) {
  const card = useActorCard(agent.actorId);
  return <option value={agent.actorId}>{card?.displayName ?? agent.modelName ?? agent.actorId}</option>;
}

function InviteForm({ client, projectId, onInvited }) {
  const [invitedActorId, setInvitedActorId] = useState('');
  const [role, setRole] = useState('contributor');
  const [days, setDays] = useState('14');
  const [fieldError, setFieldError] = useState(null);
  const { pending, error, run } = useAdmissionAction();

  async function submit(event) {
    event.preventDefault();
    const target = invitedActorId.trim();
    if (!/^actor_[0-9a-f-]{36}$/i.test(target)) {
      setFieldError('Paste the person\u2019s actor id from their public profile, for example actor_3f2c\u2026');
      return;
    }
    setFieldError(null);
    const expiresAt = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
    const result = await run('invite', () => client.projectInvitations.create(projectId, { invitedActorId: target, role, expiresAt }));
    if (result) { setInvitedActorId(''); onInvited(); }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <FieldGroup error={fieldError} help="Invite people only. Agents join when their owner enrolls them." htmlFor="invite-actor" label={'Person’s actor id'}>
        <Input autoComplete="off" className="font-mono" id="invite-actor" onChange={(event) => setInvitedActorId(event.target.value)} placeholder="actor_…" value={invitedActorId} />
      </FieldGroup>
      <div className="flex flex-wrap items-end gap-3">
        <FieldGroup className="w-44" htmlFor="invite-role" label="Role">
          <Select id="invite-role" onChange={(event) => setRole(event.target.value)} value={role}>
            {INVITABLE_ROLES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup className="w-36" htmlFor="invite-days" label="Expires after">
          <Select id="invite-days" onChange={(event) => setDays(event.target.value)} value={days}>
            {['7', '14', '30'].map((value) => <option key={value} value={value}>{value} days</option>)}
          </Select>
        </FieldGroup>
        <Button loading={pending === 'invite'} type="submit">Send invitation</Button>
      </div>
      {error ? <AdmissionFault className="mt-0" error={error.error} /> : null}
    </form>
  );
}

function PendingInvitations({ client, projectId, refreshKey }) {
  const invitations = useResource(() => client.projectInvitations.forProject(projectId).then((body) => body.items ?? []), [client, projectId, refreshKey], Boolean(client));
  const { pending, error, run } = useAdmissionAction();
  const open = (invitations.data ?? []).filter((item) => item.status === 'pending');
  if (invitations.status === 'loading') return <Skeleton className="h-12 w-full" />;
  if (invitations.status === 'error') return <AdmissionFault className="mt-0" error={invitations.error} onRetry={invitations.reload} />;
  if (open.length === 0) return <p className="text-sm text-muted-foreground">No open invitations</p>;
  return (
    <>
      <ul>
        {open.map((item) => (
          <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 text-sm" key={item.invitationId}>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <ActorName actorId={item.invitedActorId} showOwner={false} />
              <span className="text-muted-foreground">as {item.role}, expires {formatDate(item.expiresAt)}</span>
            </span>
            <Button
              loading={pending === item.invitationId}
              onClick={() => run(item.invitationId, () => client.projectInvitations.revoke(projectId, item.invitationId, 'revoked by project maintainer')).then((result) => { if (result) invitations.reload(); })}
              size="sm"
              variant="ghost"
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      {error ? <AdmissionFault error={error.error} /> : null}
    </>
  );
}

/**
 * Project Members section: the public roster, plus, for a signed-in member,
 * enrolling one of their Agents and, for owners and maintainers, invitations.
 * Every write is authorized again by the API.
 */
export function ProjectMembers({ projectId }) {
  const auth = useBrowserSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const members = useResource(() => readMembers(projectId), [projectId, refreshKey], Boolean(projectId));
  const token = auth.session?.access_token ?? null;
  const client = useMemo(() => (token ? createAdmissionClient({ access_token: token }) : null), [token]);
  const me = useResource(() => client.me(), [client], Boolean(client));
  const removal = useAdmissionAction();

  const list = members.data ?? [];
  const viewerActorId = me.data?.actorId ?? null;
  const viewerRole = list.find((member) => member.actorId === viewerActorId)?.role ?? null;
  const canManage = viewerRole === 'owner' || viewerRole === 'maintainer';
  const enrolledIds = new Set(list.map((member) => member.actorId));
  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="roster-heading">
        <SectionHeader action={members.status === 'ready' ? <span className="tabular-nums text-muted-foreground">{list.length}</span> : null} id="roster-heading" title="Members" />
        <div>
          {members.status === 'loading' ? <Skeleton className="h-32 w-full" /> : null}
          {members.status === 'error' ? <AdmissionFault error={members.error} onRetry={members.reload} /> : null}
          {members.status === 'ready' && list.length === 0 ? <Empty className="border-t-0" title="No members recorded" /> : null}
          {list.length > 0 ? (
            <MemberList
              canManage={canManage}
              members={list}
              onRemoveAgent={client ? (agentActorId) => removal.run(agentActorId, () => client.projectAgents.remove(projectId, agentActorId)).then((result) => { if (result) refresh(); }) : null}
              removing={removal.pending}
              viewerActorId={viewerActorId}
            />
          ) : null}
          {removal.error ? <AdmissionFault error={removal.error.error} /> : null}
        </div>
      </section>

      {auth.status === 'authenticated' && viewerRole ? (
        <section aria-labelledby="enroll-heading">
          <SectionHeader id="enroll-heading" title="Enroll one of your Agents" />
          <div className="mt-3 max-w-xl"><EnrollAgent client={client} enrolledIds={enrolledIds} onEnrolled={refresh} projectId={projectId} /></div>
        </section>
      ) : null}

      {auth.status === 'authenticated' && canManage ? (
        <section aria-labelledby="invite-heading">
          <SectionHeader id="invite-heading" title="Invitations" />
          <div className="mt-3 grid max-w-2xl gap-6">
            <PendingInvitations client={client} projectId={projectId} refreshKey={refreshKey} />
            <InviteForm client={client} onInvited={refresh} projectId={projectId} />
          </div>
        </section>
      ) : null}

      {auth.status !== 'authenticated' ? (
        <p className="text-sm"><a className="text-primary hover:underline" href="/login">Sign in</a> to enroll an Agent</p>
      ) : null}
      {auth.status === 'authenticated' && me.status === 'ready' && !viewerRole ? (
        <p className="text-sm text-muted-foreground">Not a member. <a className="text-primary hover:underline" href="/projects/mine">My projects</a></p>
      ) : null}
    </div>
  );
}
