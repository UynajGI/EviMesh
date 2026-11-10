'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ActorName, Identifier, MarginSection, formatDateTime } from '@/components/ui/doc';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export default function ArtifactDetailPage({ params }) {
  const [artifactId, setArtifactId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ artifactId: value }) => setArtifactId(value)); }, [params]);
  useEffect(() => {
    if (!artifactId) return;
    fetch(`${API}/artifacts/${artifactId}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Artifact is unavailable.');
      setData(payload);
    }).catch((reason) => setError(reason.message));
  }, [artifactId]);
  if (error) return <PageContainer><ErrorState message={error} /></PageContainer>;
  if (!data) return <PageContainer><div aria-busy="true"><span className="sr-only">Loading artifact…</span><Skeleton className="h-24 w-full" /><Skeleton className="mt-6 h-64 w-full" /></div></PageContainer>;
  const { artifact, currentRevision, locations = [] } = data;
  const createdBy = currentRevision.createdBy ?? artifact.createdBy ?? null;
  const createdAt = currentRevision.createdAt ?? artifact.createdAt ?? null;
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Explore', href: '/explore' }, { label: 'Evidence artifact' }]} />
      <PageHeader title={<span className="font-mono text-[0.75em] font-medium tracking-normal">{artifact.artifactId}</span>} />

      <div className="doc-grid mt-10">
        <div className="doc-main grid gap-12">
          <section aria-labelledby="integrity-heading">
            <div className="border-t border-foreground pt-3"><h2 className="text-lg font-semibold" id="integrity-heading">Integrity</h2></div>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Hash</dt><dd className="break-all font-mono text-xs">{currentRevision.rawHash ?? artifact.rawHash ?? 'Not verified'}</dd>
              <dt className="text-muted-foreground">License</dt><dd>{currentRevision.license ?? artifact.license ?? 'Not specified'}</dd>
              <dt className="text-muted-foreground">Size</dt><dd className="tabular-nums">{currentRevision.sizeBytes ?? artifact.sizeBytes ?? 'Unknown'} bytes</dd>
            </dl>
          </section>

          <section aria-labelledby="locations-heading">
            <div className="flex items-baseline justify-between gap-4 border-t border-foreground pt-3">
              <h2 className="text-lg font-semibold" id="locations-heading">Locations</h2>
              <span className="text-sm tabular-nums text-muted-foreground">{locations.length}</span>
            </div>
            {locations.length ? (
              <ul className="mt-2 border-t border-border">
                {locations.map((location, index) => (
                  <li className="ref-row" key={`${location.locationId ?? location.uri ?? index}`}>
                    <p className="text-sm text-muted-foreground">{location.visibility ?? 'visibility unspecified'}</p>
                    <p className="min-w-0 break-all font-mono text-sm">{location.uri ?? location.url ?? location.key ?? JSON.stringify(location)}</p>
                    <span />
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted-foreground">No storage locations are registered.</p>}
          </section>
        </div>

        <aside aria-label="Artifact record" className="doc-margin">
          <MarginSection title="Record">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Identifier</dt><dd className="mt-0.5"><Identifier revision={currentRevision.revision} value={artifact.artifactId} /></dd></div>
              {createdBy ? <div><dt className="text-xs text-muted-foreground">Uploaded by</dt><dd className="mt-0.5"><ActorName actorId={createdBy} /></dd></div> : null}
              {createdAt ? <div><dt className="text-xs text-muted-foreground">Recorded</dt><dd className="mt-0.5 tabular-nums">{formatDateTime(createdAt) ?? 'not stated'}</dd></div> : null}
            </dl>
          </MarginSection>
          <MarginSection title="Upload">
            <Link className="text-sm text-primary hover:underline" href="/artifacts/upload">Upload another artifact →</Link>
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}
