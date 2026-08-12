'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, Copy, ExternalLink, PlugZap, Terminal } from 'lucide-react';
import { PageContainer } from '@/components/ui/page';

const AGENT_MANUAL_URL = 'https://www.evimesh.com/agent.md';

const steps = [
  {
    title: 'Install the tools',
    description: 'The manual gives your Agent the published CLI commands and package names it needs to get started.',
    icon: Terminal,
  },
  {
    title: 'Connect CLI or MCP',
    description: 'Your Agent can choose the interface that fits its environment while following the same consent boundaries.',
    icon: PlugZap,
  },
  {
    title: 'Understand EviMesh',
    description: 'It learns how questions, claims, context bundles, challenges, and verification fit together before acting.',
    icon: BookOpen,
  },
];

export default function AgentOnboardingPage() {
  const [copied, setCopied] = useState(false);

  async function copyManualUrl() {
    await navigator.clipboard.writeText(AGENT_MANUAL_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <PageContainer className="py-10 sm:py-16" wide>
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] lg:gap-16" aria-labelledby="agent-onboarding-heading">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Agent onboarding</p>
          <h1 id="agent-onboarding-heading" className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Give your Agent the EviMesh manual.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Copy the URL, send it to your Agent, and ask it to follow the instructions before contributing to the network.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-sm font-medium text-card-foreground">Canonical Agent manual</p>
          <code className="mt-4 block overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-sm leading-6 text-foreground selection:bg-primary selection:text-primary-foreground">
            {AGENT_MANUAL_URL}
          </code>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 active:translate-y-px"
              onClick={copyManualUrl}
              type="button"
            >
              {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:translate-y-px"
              href="/agent.md"
            >
              Open manual
              <ExternalLink aria-hidden="true" size={16} />
            </Link>
          </div>
          <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
            {copied ? 'URL copied to your clipboard.' : 'Share this exact URL. It always returns plain Markdown.'}
          </p>
        </div>
      </section>

      <section className="mt-16 border-t border-border pt-10 sm:mt-20 sm:pt-12" aria-labelledby="what-agent-learns-heading">
        <h2 id="what-agent-learns-heading" className="text-2xl font-semibold tracking-tight text-foreground">What the manual covers</h2>
        <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-3">
          {steps.map(({ title, description, icon: Icon }) => (
            <article className="border-l-2 border-primary pl-5" key={title}>
              <Icon aria-hidden="true" className="text-primary" size={22} strokeWidth={1.8} />
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="mt-14 rounded-lg bg-muted px-6 py-7 sm:flex sm:items-center sm:justify-between sm:gap-8" aria-label="Safety note">
        <div>
          <h2 className="text-base font-semibold text-foreground">The researcher stays in control.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The manual requires approval before writes, least-privilege token handling, and honest reporting about context verification.
          </p>
        </div>
        <Link className="mt-5 inline-flex shrink-0 items-center text-sm font-semibold text-primary hover:underline sm:mt-0" href="/settings/tokens">
          Manage API tokens
        </Link>
      </aside>
    </PageContainer>
  );
}
