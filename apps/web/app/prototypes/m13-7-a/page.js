'use client';

import { useState } from 'react';
import { Badge, Card, CardContent, CardHeader } from '@/components/ui/data';
import { PageContainer, PageHeader } from '@/components/ui/page';

const SCENES = [
  { name: 'Landing', path: '/ (anonymous)' },
  { name: 'Sign in', path: '/sign-in' },
  { name: 'Home', path: '/ (signed in)' },
  { name: 'Research workspace', path: '/questions/Q-204' },
  { name: 'Account Settings', path: '/account/profile' },
  { name: 'Agent Connect', path: '/agent' },
];

const FIXTURE_PRODUCT = {
  research: {
    id: 'Q-204',
    title: 'Does the reported interaction persist across independent replication conditions?',
    revision: 'CLM-88 · rev-0017',
    source: 'S-127 · Independent audit memo · Finding 4',
  },
  change: 'A calibration challenge was linked to CLM-88. Inspect source S-127 and revision rev-0017.',
};

function SceneTabs({ scene, onChange }) {
  function handleKeyDown(event) {
    const currentIndex = SCENES.findIndex((item) => item.name === scene);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SCENES.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + SCENES.length) % SCENES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = SCENES.length - 1;
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      onChange(SCENES[nextIndex].name);
      event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
    }
  }

  return (
    <nav aria-label="Illustrative product paths" className="mt-10 border-b border-border">
      <div role="tablist" aria-label="Prototype scenes" className="flex gap-1 overflow-x-auto pb-px">
        {SCENES.map((item) => {
          const slug = item.name.replaceAll(' ', '-').toLowerCase();
          return (
            <button aria-controls={`scene-${slug}`} aria-selected={scene === item.name} className={`shrink-0 border-b-2 px-3 py-2.5 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${scene === item.name ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} id={`tab-${slug}`} key={item.name} onClick={() => onChange(item.name)} onKeyDown={handleKeyDown} role="tab" tabIndex={scene === item.name ? 0 : -1} type="button">
              <span className="block">{item.name}</span>
              <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">{item.path}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Panel({ scene, hidden, children }) {
  const slug = scene.replaceAll(' ', '-').toLowerCase();
  return <section aria-labelledby={`tab-${slug}`} className="mt-8" hidden={hidden} id={`scene-${slug}`} role="tabpanel">{children}</section>;
}

function LandingScene({ hidden, onChange }) {
  return <Panel hidden={hidden} scene="Landing"><div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]"><div><Badge variant="info">Anonymous landing</Badge><h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Follow research through sources, checks, and open questions.</h2><p className="mt-4 max-w-2xl leading-7 text-muted-foreground">EviMesh helps researchers understand an Argument, its Evidence relationships, Verification findings, and the current Frontier without presenting any of them as settled truth.</p><div className="mt-6 flex flex-wrap gap-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onChange('Research workspace')} type="button">Explore an illustrative research record</button><button className="rounded-md border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onChange('Agent Connect')} type="button">See Agent connection guidance</button></div></div><Card><CardHeader title="Start with a question" /><CardContent><p className="text-sm leading-6 text-muted-foreground">Read a research question in plain language, then open its sources and verification context as needed.</p><p className="mt-4 font-mono text-xs text-muted-foreground">Fixture record: Q-204</p></CardContent></Card></div></Panel>;
}

function SignInScene({ hidden, onChange }) {
  return <Panel hidden={hidden} scene="Sign in"><div className="max-w-3xl"><Badge variant="info">Sign-in hub preview</Badge><h2 className="mt-4 text-2xl font-semibold tracking-tight">Choose how to continue.</h2><p className="mt-3 leading-7 text-muted-foreground">A future sign-in hub can explain the purpose and privacy boundary of ORCID, GitHub, and email. This prototype does not authenticate, collect details, or verify an identity.</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{['ORCID for scholarly identity', 'GitHub for linked identity', 'Email for account recovery'].map((label) => <button className="rounded-lg border border-border p-4 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" key={label} onClick={() => onChange('Home')} type="button">{label}<span className="mt-2 block text-xs font-normal text-muted-foreground">Illustrative continuation only</span></button>)}</div><p className="mt-5 text-sm text-muted-foreground">A typed identifier is not a verified identity. No credentials are requested or stored here.</p></div></Panel>;
}

function HomeScene({ hidden, onChange }) {
  const { research, change } = FIXTURE_PRODUCT;
  return <Panel hidden={hidden} scene="Home"><div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]"><div><Badge variant="info">Signed-in Home preview</Badge><h2 className="mt-4 text-2xl font-semibold tracking-tight">Changes worth inspecting</h2><article className="mt-6 rounded-lg border border-border p-5"><p className="font-mono text-xs text-muted-foreground">{research.revision}</p><h3 className="mt-2 text-lg font-semibold">{research.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{change}</p><p className="mt-3 font-mono text-xs text-muted-foreground">Source and revision: {research.source}</p><button className="mt-4 rounded-md border border-border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onChange('Research workspace')} type="button">Inspect the research context</button></article></div><Card><CardHeader title="What this means" /><CardContent><p className="text-sm leading-6 text-muted-foreground">Attention identifies a next reading action with provenance. It does not determine research validity.</p></CardContent></Card></div></Panel>;
}

function ResearchWorkspaceScene({ hidden, onChange }) {
  const { research } = FIXTURE_PRODUCT;
  return <Panel hidden={hidden} scene="Research workspace"><div className="grid gap-8 lg:grid-cols-[1.5fr_0.8fr]"><div><p className="font-mono text-xs text-muted-foreground">{research.id} · {research.revision}</p><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{research.title}</h2><p className="mt-4 leading-7 text-muted-foreground">This illustrative workspace keeps four complementary perspectives visible. Read the record as a source-traceable research context, not a conclusion.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{[['Argument', 'What is being claimed and which revision is in view.'], ['Evidence', 'What supports, refutes, qualifies, or reproduces the claim.'], ['Verification', 'Which checks, findings, independence notes, and challenges exist.'], ['Frontier', 'Which claim revisions are currently usable in this snapshot.']].map(([title, detail]) => <article className="rounded-lg border border-border p-4" key={title}><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></article>)}</div></div><aside className="space-y-4"><Card><CardHeader title="Provenance to inspect" /><CardContent><p className="font-mono text-xs leading-5 text-muted-foreground">{research.source}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">The calibration discrepancy remains an open challenge; this fixture does not resolve it.</p></CardContent></Card><button className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onChange('Agent Connect')} type="button">Prepare an Agent reading handoff</button></aside></div></Panel>;
}

function AccountScene({ hidden }) {
  return <Panel hidden={hidden} scene="Account Settings"><div className="max-w-4xl"><Badge variant="info">Account Settings preview</Badge><h2 className="mt-4 text-2xl font-semibold tracking-tight">Keep identity, public profile, and access separate.</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['Profile', 'Public researcher presentation and field-level visibility.'], ['Connected identities', 'Provider ownership and verified-link state, never typed as proof.'], ['Tokens', 'Named, expiring access with purpose and revocation; no value is shown.'], ['Security', 'Recent authentication, recovery, and sensitive-action history.'], ['Notifications', 'Personal change and consent preferences.']].map(([title, detail]) => <article className="rounded-lg border border-border p-4" key={title}><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></article>)}</div><p className="mt-6 text-sm text-muted-foreground">Illustrative fixture copy only: no account data, identity link, or credential lifecycle is active.</p></div></Panel>;
}

function AgentScene({ hidden, onChange }) {
  return <Panel hidden={hidden} scene="Agent Connect"><div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]"><div><Badge variant="info">Agent connection centre preview</Badge><h2 className="mt-4 text-2xl font-semibold tracking-tight">Give a client the research context it needs—without secrets.</h2><ol className="mt-6 space-y-3 text-sm leading-6"><li><strong>1. Choose a client.</strong> MCP, CLI, and SDK are described by their research task.</li><li><strong>2. Authorize least privilege.</strong> Device or browser authorization is preferred for an interactive connection.</li><li><strong>3. Verify a first read.</strong> Confirm the returned question, claim revision, source, verification context, and Frontier snapshot.</li><li><strong>4. Continue safely.</strong> A handoff carries intent, stable IDs, source context, and a continuation URL—not credentials.</li></ol><button className="mt-6 rounded-md border border-border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onChange('Account Settings')} type="button">Review connection security in Account Settings</button></div><Card><CardHeader title="Illustrative reading handoff" /><CardContent><code className="block whitespace-pre-wrap font-mono text-xs leading-6 text-muted-foreground">Read Q-204 and CLM-88 rev-0017. Inspect S-127, the open calibration challenge, the applicable verification context, and the current Frontier snapshot. Report only sourced findings.</code><p className="mt-4 text-sm leading-6 text-muted-foreground">No client is launched, configured, or authorized by this prototype.</p></CardContent></Card></div></Panel>;
}

export default function M137MatureProductContractPrototypePage() {
  const [scene, setScene] = useState('Landing');
  return <PageContainer wide className="min-h-[100dvh] py-10 sm:py-14"><PageHeader eyebrow="Illustrative prototype · fixture copy only" title="A research product shaped around careful reading" description="Six clickable concept scenes for discussion. Nothing on this page signs in, saves data, connects an Agent, or changes the production product." /><SceneTabs scene={scene} onChange={setScene} /><LandingScene hidden={scene !== 'Landing'} onChange={setScene} /><SignInScene hidden={scene !== 'Sign in'} onChange={setScene} /><HomeScene hidden={scene !== 'Home'} onChange={setScene} /><ResearchWorkspaceScene hidden={scene !== 'Research workspace'} onChange={setScene} /><AccountScene hidden={scene !== 'Account Settings'} /><AgentScene hidden={scene !== 'Agent Connect'} onChange={setScene} /></PageContainer>;
}
