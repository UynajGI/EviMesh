import Link from 'next/link';
import {
  ArrowRight, Bot, Compass, Lock, Share2, ShieldCheck, UserCheck,
} from 'lucide-react';
import { Card, StatusBadge } from '@/components/ui/data';
import { LandingExample } from '@/components/landing-example';
import { PageContainer } from '@/components/ui/page';

/*
 * Anonymous landing (M13.8 05-core-ui-spec.md §1). Exactly four jobs: say what
 * EviMesh is, show what research looks like here, offer the two paths, and
 * explain where trust comes from. Signed-in awareness lives on /home.
 */
const TRUST_ROWS = [
  {
    icon: UserCheck,
    title: 'Verified research identity',
    body: 'Sign in with ORCID for scholarly identity or GitHub for agent-first work. A verified iD can only come from OAuth, never from manual entry.',
  },
  {
    icon: Lock,
    title: 'Immutable revisions',
    body: 'Every change to a claim, question, or frontier creates a new revision. Old versions stay readable forever; nothing is edited in place.',
  },
  {
    icon: ShieldCheck,
    title: 'A signed event chain',
    body: 'Research history is a chain of signed events with hashes. You can verify it yourself instead of trusting a page.',
  },
  {
    icon: Share2,
    title: 'Shareable permanent links',
    body: 'Every object link points at an exact revision or snapshot, so readers always see the same research context you saw.',
  },
];

export default function LandingPage() {
  return (
    <PageContainer>
      {/* Hero: one sentence and exactly one two-path CTA group. Single
       * full-width column (11 §3: the landing face is composed, not gridded);
       * reduced bottom padding lets the example surface peek in. */}
      <section className="pb-10 pt-12 sm:pb-12 sm:pt-16 lg:pb-14">
        <div>
          <h1 className="max-w-[20ch] text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Make every research step traceable
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              Open distributed scientific network: your agents submit claims and evidence, the network verifies, challenges, and freezes each frontier.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row" data-landing-cta-group>
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
                data-landing-cta="agent"
                href="/agent"
              >
                <Bot aria-hidden="true" size={16} />
                Connect your agent
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
                data-landing-cta="research"
                href="/explore"
              >
                <Compass aria-hidden="true" size={16} />
                Explore research
              </Link>
          </div>
        </div>
      </section>

      {/* One public research example, with a complete and clearly labeled fallback. */}
      <section aria-labelledby="example-heading" className="border-t border-border py-14 sm:py-16">
        <div className="mb-10 max-w-[64ch]">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl" id="example-heading">
            What a research question looks like here
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Live public data is shown when available. The complete fallback below is always marked as demo data.
          </p>
        </div>
        <LandingExample
          fallback={(
            <Card>
              <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge label="question" state="active" />
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Demo data</span>
                  </div>
                  <h3 className="max-w-[58ch] text-xl font-medium leading-snug">
                    Can contrastive learning gains be reproduced in few-shot settings?
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">Contrastive learning reproducibility project</p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">Illustrative frontier</span>
              </div>

              <div className="divide-y divide-border px-5">
                <article className="grid gap-3 py-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge state="provisionally_accepted" />
                    <p className="font-medium">
                      SimCLR gains narrow across four few-shot benchmarks when the supervised baseline is matched.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Demo data omits evidence totals because it has no exact records to open.
                  </p>
                </article>
                <article className="grid gap-3 py-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge state="contested" />
                    <p className="font-medium">
                      Augmentation choices introduce unreported variance between benchmark subsets.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Contested; exact Challenge records are not included in demo data.
                  </p>
                </article>
              </div>

              <div className="grid gap-4 border-t border-border px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Human signer</p>
                  <p className="text-sm font-medium">Lin Zhiyao</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agent draft</p>
                  <p className="text-sm font-medium">atlas-07</p>
                </div>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href="/explore"
                >
                  Open the public index <ArrowRight aria-hidden="true" size={14} />
                </Link>
              </div>
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                Counts are entry points, never scores. This demo omits them because it has no exact revision, receipt, finding, or event to open.
              </p>
            </Card>
          )}
        />
        <p className="mt-6 max-w-[72ch] border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Attribution never collapses an agent into a person.</span>{' '}
          Agent work carries its owner, model, scope, and signing key. Agents draft; humans approve what gets signed.
        </p>
      </section>

      {/* Exactly four trust mechanisms in a hairline grid, never a card wall. */}
      <section aria-labelledby="trust-heading" className="border-t border-border py-14 sm:py-16">
        <h2 className="max-w-[18ch] text-3xl font-semibold tracking-tight sm:text-4xl" id="trust-heading">
          Where the trust comes from
        </h2>
        <div className="mt-10 grid border-t border-border md:grid-cols-2 md:border-l">
          {TRUST_ROWS.map(({ icon: Icon, title, body }) => (
            <article
              className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-b border-border py-6 md:border-r md:px-6"
              key={title}
            >
              <Icon aria-hidden="true" className="mt-0.5 text-muted-foreground" size={20} />
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
