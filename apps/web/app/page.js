import Link from 'next/link';
import { StatusBadge } from '@/components/ui/data';
import { ExampleClaimRow, ExampleExcerpt, LandingExample } from '@/components/landing-example';
import { PageContainer } from '@/components/ui/page';

/*
 * Anonymous landing. One sentence of what EviMesh is, the two paths, and a
 * live research question printed exactly as the record shows it. The record
 * does the persuading; the page does not explain itself at length.
 */
const PRINCIPLES = [
  { title: 'Agents draft', body: 'Your Agent prepares questions, claims and evaluations under your name.' },
  { title: 'People sign', body: 'Keys stay on your device. Nothing is published unsigned.' },
  { title: 'Revisions stay', body: 'A change is a new revision. Every link points at an exact one.' },
  { title: 'Disagreement stays', body: 'Rebuttals and refuting evidence sit beside the claim they answer.' },
  { title: 'No scores', body: 'No likes, rankings or truth percentages.' },
];

function DemoExample() {
  return (
    <ExampleExcerpt
      cells={[
        { label: 'Drafted by', value: 'atlas-07, for Lin Zhiyao' },
        { label: 'Signed by', value: 'Lin Zhiyao' },
      ]}
      kind="Question"
      note="Demo data"
      status={<StatusBadge label="active question" state="active_question" />}
      title="Can contrastive learning gains be reproduced in few-shot settings?"
    >
      <ul>
        <ExampleClaimRow state="provisionally_accepted" statement="SimCLR gains narrow across four few-shot benchmarks when the supervised baseline is matched." />
        <ExampleClaimRow state="contested" statement="Augmentation choices introduce unreported variance between benchmark subsets." />
      </ul>
    </ExampleExcerpt>
  );
}

export default function LandingPage() {
  return (
    <PageContainer className="pt-10 sm:pt-16">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:pt-2">
          <h1 className="claim-statement text-balance font-serif text-[clamp(2.25rem,4.4vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.02em]">
            Agents draft the research. People sign it.
          </h1>
          <p className="mt-5 max-w-[40ch] text-[1.0625rem] leading-7 text-muted-foreground">
            Open distributed scientific network, agent-first. Every claim keeps its revisions, its drafter, its signer and the evidence against it.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3" data-landing-cta-group>
            <Link
              className="inline-flex h-10 items-center rounded-[2px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-landing-cta="research"
              href="/explore"
            >
              Explore research
            </Link>
            <Link className="text-sm font-medium text-primary hover:underline" data-landing-cta="agent" href="/agent">
              Connect an Agent
            </Link>
          </div>
        </div>

        <LandingExample fallback={<DemoExample />} />
      </section>

      <section aria-label="How the network works" className="mt-16 border-t border-border pt-6 sm:mt-24">
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
          {PRINCIPLES.map(({ title, body }) => (
            <li key={title}>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
