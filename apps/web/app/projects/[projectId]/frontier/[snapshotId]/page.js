'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Identifier, MarginSection, formatDateTime, shortId } from '@/components/ui/doc';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

function memberMap(snapshot) {
  return new Map((snapshot?.members ?? []).map((member) => [member.claimId, member]));
}

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

export default function FrontierDetailPage({ params }) {
  const [route, setRoute] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(setRoute); }, [params]);
  useEffect(() => {
    if (!route?.projectId) return;
    fetch(`${API}/projects/${route.projectId}/frontier/history?limit=100`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Frontier history is unavailable.');
      setHistory(payload.items ?? []);
    }).catch((reason) => setError(reason.message));
  }, [route]);
  if (error) return <PageContainer><ErrorState message={error} /></PageContainer>;
  if (!route || !history.length) return <PageContainer><div aria-busy="true"><span className="sr-only">Loading Frontier…</span><Skeleton className="h-24 w-full" /><Skeleton className="mt-6 h-64 w-full" /></div></PageContainer>;
  const snapshot = history.find((item) => item.snapshotId === route.snapshotId);
  if (!snapshot) return <PageContainer><ErrorState message="Frontier snapshot not found." title="Snapshot not found" /></PageContainer>;
  const previous = history.filter((item) => item.sequence < snapshot.sequence).sort((left, right) => right.sequence - left.sequence)[0];
  const current = memberMap(snapshot); const prior = memberMap(previous);
  const added = [...current.keys()].filter((claimId) => !prior.has(claimId));
  const removed = [...prior.keys()].filter((claimId) => !current.has(claimId));
  const changed = [...current.keys()].filter((claimId) => prior.has(claimId) && JSON.stringify(current.get(claimId)) !== JSON.stringify(prior.get(claimId)));
  const addedSet = new Set(added); const changedSet = new Set(changed);
  const members = snapshot.members ?? [];
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Projects', href: '/projects' }, { label: shortId(route.projectId), href: `/projects/${route.projectId}` }, { label: `Frontier snapshot #${snapshot.sequence}` }]} />
      <PageHeader title={<span className="tabular-nums">Snapshot #{snapshot.sequence}</span>} />

      <div className="doc-grid mt-8">
        <div className="doc-main grid gap-8">
          <section aria-labelledby="diff-heading">
            <SectionHeader action={<span className="text-muted-foreground">{previous ? `vs #${previous.sequence}` : 'first snapshot'}</span>} id="diff-heading" title="Member diff" />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <li className="flex items-baseline gap-2"><Badge variant="status-success">Added</Badge><span className="tabular-nums">{added.length}</span></li>
              <li className="flex items-baseline gap-2"><Badge variant="status-danger">Removed</Badge><span className="tabular-nums">{removed.length}</span></li>
              <li className="flex items-baseline gap-2"><Badge variant="status-warning">Changed</Badge><span className="tabular-nums">{changed.length}</span></li>
            </ul>
            {removed.length ? (
              <p className="mt-3 text-xs text-muted-foreground">Removed: {removed.map((claimId, index) => <span key={claimId}>{index > 0 ? ', ' : ''}<Link className="font-mono hover:text-primary hover:underline" href={`/claims/${claimId}`} title={claimId}>{shortId(claimId)}</Link></span>)}</p>
            ) : null}
          </section>

          <section aria-labelledby="members-heading">
            <SectionHeader action={<span className="tabular-nums text-muted-foreground">{members.length}</span>} id="members-heading" title="Members" />
            {members.length ? (
              <ul>
                {members.map((member) => (
                  <li className="ref-row" key={`${member.claimId}@${member.claimRevision}`}>
                    <p className="text-sm text-muted-foreground">{readable(member.membershipType ?? member.status ?? 'member')}</p>
                    <div className="min-w-0">
                      <Link className="font-mono text-sm hover:text-primary hover:underline" href={`/claims/${member.claimId}?rev=${member.claimRevision}`} title={`${member.claimId}@${member.claimRevision}`}>{shortId(member.claimId)}@{member.claimRevision}</Link>
                    </div>
                    <div className="md:text-right">
                      {addedSet.has(member.claimId) ? <Badge variant="status-success">added</Badge> : changedSet.has(member.claimId) ? <Badge variant="status-warning">changed</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="py-3 text-sm text-muted-foreground">No members</p>}
          </section>
        </div>

        <aside aria-label="Snapshot record" className="doc-margin">
          <MarginSection title="Record">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Snapshot</dt><dd className="mt-0.5"><Identifier value={snapshot.snapshotId} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Sequence</dt><dd className="mt-0.5 tabular-nums">{snapshot.sequence}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Policy</dt><dd className="mt-0.5">{snapshot.policy ?? snapshot.policyId ?? 'Not specified'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Checkpoint</dt><dd className="mt-0.5 break-all font-mono text-xs">{snapshot.checkpointId ?? snapshot.checkpoint?.checkpointId ?? 'Not attached'}</dd></div>
              {snapshot.createdAt ? <div><dt className="text-xs text-muted-foreground">Recorded</dt><dd className="mt-0.5 tabular-nums">{formatDateTime(snapshot.createdAt)}</dd></div> : null}
            </dl>
          </MarginSection>
          <MarginSection title="Project">
            <Link className="text-sm text-primary hover:underline" href={`/projects/${route.projectId}`}>Back to project</Link>
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}
