'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader } from '@/components/ui/data';
import { PageContainer, PageHeader } from '@/components/ui/page';

const SCENES = ['Question', 'Claim', 'Change feed', 'Handoff'];

const FIXTURE_RESEARCH = {
  question: {
    id: 'Q-204',
    title: 'Does the reported interaction persist across independent replication conditions?',
    scope: 'Replication record R-18, protocol family P-7',
    stewardship: 'Open for verification',
  },
  claim: {
    id: 'CLM-88',
    text: 'The interaction remains observable when the protocol is repeated with the stated controls.',
    status: 'Under verification',
    statusNote: 'Mapped to evidence set E-042. The record has two open challenges.',
    revision: {
      id: 'rev-0017',
      recordedAt: '2026-08-08 14:20 UTC',
      author: 'Replication working group',
      note: 'Control wording clarified after source S-114 was attached.',
    },
    sources: [
      { id: 'S-114', title: 'Replication notebook, run 24', kind: 'Primary record', locator: 'Methods 3.2' },
      { id: 'S-091', title: 'Original study protocol', kind: 'Protocol', locator: 'Appendix B' },
      { id: 'S-127', title: 'Independent audit memo', kind: 'Verification note', locator: 'Finding 4' },
    ],
    relations: [
      {
        label: 'Supports the claim',
        detail: 'S-114 records the stated control sequence and the reported observation.',
      },
      {
        label: 'Constrains the claim',
        detail: 'S-091 limits the conclusion to the specified temperature and timing window.',
      },
      {
        label: 'Challenges the claim',
        detail: 'S-127 identifies an unresolved calibration record for one replicate.',
      },
    ],
    facts: [
      ['Verification', 'Independent audit assigned to method review.'],
      ['Finding', 'Two runs match the reported control sequence.'],
      ['Challenge', 'Calibration provenance is incomplete for one replicate.'],
    ],
    latestEvent: 'Evidence relation updated by the replication working group on 2026-08-09 09:40 UTC.',
  },
  changes: [
    {
      time: '09:40 UTC',
      title: 'Calibration challenge linked to CLM-88',
      priority: 'Review next',
      explanation: 'Attention is requested because the challenge changes which source record must be checked next.',
      provenance: 'Event EV-302, authored by the replication working group.',
    },
    {
      time: 'Yesterday',
      title: 'Revision rev-0017 recorded',
      priority: 'Read for context',
      explanation: 'This revision clarifies control wording. It does not replace the prior evidence record.',
      provenance: 'Revision record rev-0017, immutable after recording.',
    },
    {
      time: 'Yesterday',
      title: 'Source S-127 attached',
      priority: 'Reference',
      explanation: 'The audit memo is available for traceability and does not by itself settle the claim.',
      provenance: 'Source S-127, independent audit memo, Finding 4.',
    },
  ],
  handoff: {
    agent: 'Review the calibration provenance for replicate 3. Preserve the existing claim wording and report only sourced findings.',
    cli: 'evimesh evidence inspect CLM-88 --source S-127 --revision rev-0017',
    mcp: 'evidence.get_claim_context({ claimId: "CLM-88", revisionId: "rev-0017" })',
  },
};

function SceneTabs({ scene, onChange }) {
  function handleKeyDown(event) {
    const currentIndex = SCENES.indexOf(scene);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SCENES.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + SCENES.length) % SCENES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = SCENES.length - 1;

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      onChange(SCENES[nextIndex]);
      event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
    }
  }

  return (
    <div aria-label="Prototype scenes" className="mt-10 border-b border-border">
      <div role="tablist" aria-label="Evidence workspace scenes" className="flex gap-1 overflow-x-auto pb-px">
        {SCENES.map((item) => (
          <button
            aria-controls={`scene-${item.replaceAll(' ', '-').toLowerCase()}`}
            aria-selected={scene === item}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${scene === item ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            id={`tab-${item.replaceAll(' ', '-').toLowerCase()}`}
            key={item}
            onClick={() => onChange(item)}
            onKeyDown={handleKeyDown}
            role="tab"
            tabIndex={scene === item ? 0 : -1}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Panel({ scene, children }) {
  const slug = scene.replaceAll(' ', '-').toLowerCase();
  return <section aria-labelledby={`tab-${slug}`} className="mt-8" id={`scene-${slug}`} role="tabpanel">{children}</section>;
}

function QuestionScene() {
  const { question, claim } = FIXTURE_RESEARCH;
  return (
    <Panel scene="Question">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,0.8fr)]">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{question.id}</p>
          <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">{question.title}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{question.scope}</p>
        </div>
        <Card>
          <CardHeader title="Research frame" />
          <CardContent className="space-y-4">
            <Badge variant="info">{question.stewardship}</Badge>
            <p className="text-sm leading-6 text-muted-foreground">The linked claim is presented as a traceable research record, not a conclusion.</p>
            <p className="font-mono text-xs text-muted-foreground">Linked claim: {claim.id}</p>
          </CardContent>
        </Card>
      </div>
    </Panel>
  );
}

function ClaimScene() {
  const { claim } = FIXTURE_RESEARCH;
  return (
    <Panel scene="Claim">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">{claim.id}</span>
              <Badge variant="warning">{claim.status}</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">{claim.text}</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{claim.statusNote}</p>
          </div>

          <section aria-labelledby="relations-heading">
            <h3 className="text-base font-semibold" id="relations-heading">Evidence relations</h3>
            <div className="mt-4 grid gap-3">
              {claim.relations.map((relation) => (
                <article className="rounded-lg border border-border bg-card p-4" key={relation.label}>
                  <h4 className="text-sm font-medium">{relation.label}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{relation.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="facts-heading">
            <h3 className="text-base font-semibold" id="facts-heading">Verification record</h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {claim.facts.map(([label, detail]) => (
                <div className="rounded-lg border border-border p-4" key={label}>
                  <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-sm leading-6">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Immutable revision" description={claim.revision.id} />
            <CardContent className="space-y-3 text-sm">
              <p className="font-mono text-xs text-muted-foreground">Recorded {claim.revision.recordedAt}</p>
              <p>{claim.revision.note}</p>
              <p className="text-muted-foreground">Recorded by {claim.revision.author}. This revision remains available for inspection.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Source references" />
            <CardContent>
              <ol className="space-y-4">
                {claim.sources.map((source) => (
                  <li key={source.id}>
                    <p className="font-mono text-xs text-muted-foreground">{source.id} · {source.kind}</p>
                    <p className="mt-1 text-sm font-medium">{source.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{source.locator}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <div className="border-l-2 border-primary pl-4">
            <h3 className="text-sm font-medium">Latest event</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{claim.latestEvent}</p>
          </div>
        </aside>
      </div>
    </Panel>
  );
}

function ChangeFeedScene() {
  const { changes } = FIXTURE_RESEARCH;
  return (
    <Panel scene="Change feed">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold tracking-tight">Changes to inspect</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Attention priority directs the next reading action. It is based on record relationships and event provenance, not on a claim’s truth.</p>
        <ol className="mt-8 space-y-5">
          {changes.map((change) => (
            <li className="grid gap-3 border-l border-border pl-5 sm:grid-cols-[7rem_1fr]" key={change.title}>
              <time className="font-mono text-xs text-muted-foreground">{change.time}</time>
              <article>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold">{change.title}</h3>
                  <Badge variant="primary">{change.priority}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{change.explanation}</p>
                <p className="mt-3 font-mono text-xs leading-5 text-muted-foreground">Provenance: {change.provenance}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

function HandoffScene() {
  const { handoff } = FIXTURE_RESEARCH;
  return (
    <Panel scene="Handoff">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold tracking-tight">Context for a follow-up agent</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Explanatory preview only. These copyable context blocks show how a person could carry the current research record into an agent, CLI, or MCP workflow.</p>
        <div className="mt-8 grid gap-4">
          <Card>
            <CardHeader title="Agent context" description="Copyable preview" />
            <CardContent><code className="block whitespace-pre-wrap font-mono text-sm leading-6 text-foreground">{handoff.agent}</code></CardContent>
          </Card>
          <Card>
            <CardHeader title="CLI context" description="Copyable preview" />
            <CardContent><code className="block overflow-x-auto whitespace-nowrap font-mono text-sm leading-6 text-foreground">{handoff.cli}</code></CardContent>
          </Card>
          <Card>
            <CardHeader title="MCP context" description="Copyable preview" />
            <CardContent><code className="block overflow-x-auto whitespace-nowrap font-mono text-sm leading-6 text-foreground">{handoff.mcp}</code></CardContent>
          </Card>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">No integration runs from this prototype. The examples are local fixture text for discussion and review.</p>
      </div>
    </Panel>
  );
}

export default function M136AgentFirstPrototypePage() {
  const [scene, setScene] = useState('Question');

  return (
    <PageContainer wide className="min-h-[100dvh] py-10 sm:py-14">
      <PageHeader
        eyebrow="Illustrative prototype"
        title="Research record, ready for a careful handoff"
        description="A fixture-only reader for following a question through claim evidence, change provenance, and handoff context."
        action={<Button onClick={() => setScene('Handoff')} variant="outline">Preview handoff</Button>}
      />
      <SceneTabs scene={scene} onChange={setScene} />
      {scene === 'Question' ? <QuestionScene /> : null}
      {scene === 'Claim' ? <ClaimScene /> : null}
      {scene === 'Change feed' ? <ChangeFeedScene /> : null}
      {scene === 'Handoff' ? <HandoffScene /> : null}
    </PageContainer>
  );
}
