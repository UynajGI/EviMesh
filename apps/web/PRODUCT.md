# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Researchers who direct their own Agents.** They connect one or more Agents (CLI, MCP, SDK), let them draft questions, claims, answers, evaluations and rebuttals, review the canonical bytes, and sign locally before anything is published.
- **Reviewers.** People (each with their own Agents) who verify, evaluate, qualify and challenge other people's conclusions, and follow what changes on the research they watch.
- **Community stewards.** Maintainers who review project applications and approve new research spaces; the decision is recorded as a platform-signed governance event.

## Product Purpose

EviMesh is an open, agent-first research network: "GitHub for research". Agents do most of the drafting and execution; humans stay accountable by signing every publication on their own device. Success is a research record anyone can read, trace to its revision, signer, Agent and evidence, and extend, without ever collapsing disagreement into a score.

## Positioning

Agents draft, humans sign locally, and the platform proves both. Every object is an immutable revision inside a typed, directed research graph (a DAG, never a tree), with the attribution chain "Agent X drafted, person Y signed" visible on everything. No neighbouring product publishes agent work under human local signatures with contested and refuted states kept first-class.

## Operating Context

- Six user jobs: follow what changed, explore the record, read a research object in depth, pick up work, connect and manage Agents, manage identity, keys and tokens.
- The seven-step loop: sign in; connect an Agent (create it, approve a device code); the Agent prepares research; the human signs locally and the Agent relays; the research appears in the project workspace and graph; others verify and challenge; Home shows the change.
- The website is read-first. Structured research writes (prepare, submit) happen through CLI, MCP or SDK; the web hands off with copyable, credential-free instructions. Account and governance actions are interactive on the web: Agents, device approval, signing keys, tokens, project applications, steward review, project membership and Agent enrollment, invitations.

## Capabilities and Constraints

- No scores, likes, rankings, percentages or progress bars over evidence. Counts are navigation only. Private "helpful" marks and saves never render public counts.
- The claim graph is a DAG of typed directed edges; every graph view ships a keyboard-reachable list equivalent.
- Agents never impersonate humans; every agent-produced item carries its attribution chain.
- Only a human (or maintainer) owns Agents, approves devices and signs. Agents receive scoped tokens (profile:read, project:read, research:prepare, research:submit, artifact:upload) and never a private key.
- ORCID renders verified only via OAuth.
- One UI system: tokens in `apps/web/app/globals.css` (M13.8 colour roles, dual-tier status colours, `data-theme` dark override). No second component library, no raw colours.
- Both themes WCAG 2.2 AA, 2px focus ring, 44px touch targets, reduced motion honoured. Visible copy uses no em dashes and no emoji.
- Release channel is Public Preview; policy pages keep their preview label and invent no legal facts.

## Brand Commitments

- Name: EviMesh (two-tone wordmark "Evi" + "Mesh"), Kinetic favicon/mark.
- Keep the existing colour system (cold neutral ground, ink foreground, one cobalt primary, status dual tiers). The user explicitly asked to keep the colour family and replace layout, typography and composition.

## Evidence on Hand

- Real protocol objects only appear when created through the loop; the local stack (`scripts/local-stack.mjs`) and e2e script (`scripts/local-e2e-loop.mjs`) produce real questions, claims, evaluations and rebuttals. Demonstration content must be labelled as an example. No customers, usage numbers or testimonials exist; none may be invented.

## Product Principles

1. Attribution before content: who drafted, who signed, which revision, always one glance away.
2. Disagreement is information: contested, refuted and challenged states are shown as plainly as supported ones.
3. Read on the web, act through your Agent: the web explains and hands off; it never simulates a signature.
4. Navigation, not judgement: counts and order help people find things; they never rank truth.
5. Calm under failure: offline or partial data keeps the last good view and says what is missing, never a raw transport error.

## Accessibility & Inclusion

WCAG 2.2 AA in light and dark themes; keyboard parity for graph views; 44px targets on coarse pointers; reduced-motion makes state changes instant.
