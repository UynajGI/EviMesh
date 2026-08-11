# M13.7-A03 Researcher jobs-to-be-done map

This map translates the production UX audit and the M13.6 Agent-first Web model into researcher-facing jobs. The routes are task destinations in the M13.7 information architecture; database objects remain search, filter, or research-workspace context rather than first-level navigation.

These are product intentions, not usability results. The M13.7-A01 audit observed anonymous production states only and does not establish that any job is currently easy to complete.

## Shared language and route rules

- **Home** is the signed-in watchlist and change briefing: watched research, recent visits, Agent activity, and attention items.
- **Explore** is the public and signed-in discovery surface for Questions, Projects, Topics, and People, with search and filters.
- **Work** is the personal action queue for Tasks, verification, challenges, drafts, and contributions.
- **Agent** is the connection centre for MCP, CLI, SDK, authorization, first read, handoff, and security.
- **Account** means Account Settings: Profile, Connected identities, Tokens, Security, and Notifications. **Docs** provides human quickstart, protocol concepts, API/MCP/CLI reference, and safety guidance.
- A research workspace uses the M13.7 context routes **Summary**, **Current frontier**, **Argument**, **Evidence**, **Verification & challenges**, and **Activity**. These are views of one research context, not database-table destinations.

The four M13.6 perspectives remain distinct throughout the jobs: **Argument** explains the claims and relationships; **Evidence** distinguishes support, refutation, qualification, and reproduction; **Verification** explains receipts, findings, independence, and policy; **Frontier** identifies the current usable set of claim revisions. A view may lead with one perspective, but it must preserve links to the other three and must not collapse them into a support score or a parent-child tree.

## Job 1 — Discovery

- **User question:** “What research is worth looking at, and where can I find a question, project, topic, or researcher relevant to me?”
- **Desired outcome:** Find a public research context, understand why it may be relevant, and open it without first learning EviMesh’s internal object taxonomy.
- **Primary route:** **Explore** — unified search and filters for Questions, Projects, Topics, People, status, recency, and participation.
- **Supporting routes:** Anonymous Landing → Explore research; Home → recently visited or watched research; Docs → research quickstart; global search/command surface.
- **Protocol concepts surfaced in natural language:** Results state the research question, current stage, recent change, and participation entry. A result can open the **Argument** (“what is being claimed”), **Evidence** (“what supports, refutes, qualifies, or reproduces it”), **Verification** (“what checks and findings exist”), and **Frontier** (“which claim revisions are currently usable”). Stable IDs and revisions remain available in technical details.
- **Anti-goals:** Do not make Projects, Questions, Claims, Tasks, Verification, or Events first-level navigation. Do not rank research with popularity, an unexplained quality score, or evidence-count-as-truth. Do not imply that being discoverable means being verified or settled.

## Job 2 — Understanding

- **User question:** “What does this research currently say, how was it established, and what remains uncertain?”
- **Desired outcome:** Form an accurate, source-traceable account of scope, current frontier, disagreement, verification state, and next actions.
- **Primary route:** **Explore result → research workspace**, opening at **Summary** and progressing through Current frontier, Argument, Evidence, Verification & challenges, and Activity.
- **Supporting routes:** Immutable share link with the selected revision or snapshot; Docs → Agent/read; global search; Agent handoff from a research action.
- **Protocol concepts surfaced in natural language:** The workspace explains the **Argument** and its claim relationships; groups **Evidence** by support, refute, qualify, and reproduce; shows **Verification** outcomes, independence, Findings, Challenges, and the applicable policy; and labels the **Frontier** as the current set of available claim revisions at a point in time. It exposes provenance, revision history, signatures, and source context without requiring protocol vocabulary up front.
- **Anti-goals:** Do not present a claim as settled truth because it has more evidence. Do not hide contested, refuted, retracted, or dependency-tainted states. Do not flatten a claim graph into a single parent-child tree, hide revision or policy context, or expose raw database tables as the explanation.

## Job 3 — Following change

- **User question:** “What changed in the research I care about, and why should I pay attention now?”
- **Desired outcome:** Monitor watched research through a prioritized change briefing that names what changed, why it matters, and the exact revision or event to inspect.
- **Primary route:** **Home** — Watchlist changes since the last visit, recent visits, Agent activity, and attention items.
- **Supporting routes:** Explore → follow/unfollow and watchlist management; research workspace → Activity and the relevant Argument, Evidence, Verification, or Frontier view; immutable share links; Notifications in Account.
- **Protocol concepts surfaced in natural language:** A change can be new supporting, refuting, qualifying, or reproducing **Evidence**; a changed **Verification** outcome or independence finding; a new **Challenge**; a changed claim state; or a **Frontier** addition, removal, or replacement. The change links to its source and revision. “Critical,” “attention,” and “update” describe attention priority, not truth.
- **Anti-goals:** Do not turn Home into an unfiltered content feed. Do not use color, activity volume, recency, or alert level as a truth score. Do not report a change without source, revision, or reason, and do not require the user to inspect event tables to understand it.

## Job 4 — Handling work

- **User question:** “What can I do now, what is waiting on me, and how can I continue or hand off the work?”
- **Desired outcome:** See owned and available work with its next action, context, permission, and state; complete it manually or hand it to an Agent without losing research context.
- **Primary route:** **Work** — Tasks, verification queue, Challenges, drafts, and contribution record organized by next action and ownership.
- **Supporting routes:** Home → attention items; research workspace → contextual actions; Agent → generated handoff and continuation; Docs → manual submission and protocol guidance.
- **Protocol concepts surfaced in natural language:** A task explains which **Argument** or claim revision it concerns, what **Evidence** is needed or being assessed, which **Verification** contract or finding blocks progress, and how the work affects the **Frontier**. “Add evidence,” “raise a challenge,” “start verification,” and “continue research” produce a handoff containing intent, stable ID/revision, source link, suggested CLI/MCP action, required scope, and continuation URL—not credentials.
- **Anti-goals:** Do not turn Work into a database-table browser or a forced complex form. Do not claim that task completion proves a claim. Do not hide manual, accessible, or no-Agent fallback paths. Do not let a handoff contain tokens, cookies, private data, or sensitive payloads.

## Job 5 — Connecting an Agent

- **User question:** “How do I let my CLI, MCP client, SDK, or Agent read this research safely and continue the right task?”
- **Desired outcome:** Choose a client, authorize least privilege, configure it, complete a verifiable first read, understand the returned research context, and revoke or disconnect access later.
- **Primary route:** **Agent** connection centre — Overview → client choice → authorization → configuration → test connection → Read with an agent → Security.
- **Supporting routes:** Account → Tokens and Security; research workspace → Agent handoff; Docs → MCP/CLI/SDK reference and Agent/read guide; Sign in → identity and session recovery.
- **Protocol concepts surfaced in natural language:** The first read names the Project, Question, ResearchContract, Task, Attempt, claim revision, **Evidence**, VerificationReceipt, Finding, Challenge, FrontierSnapshot, and ResearchEvent only as needed. It explains the four perspectives: **Argument** for reasoning, **Evidence** for source relationships, **Verification** for checks and findings, and **Frontier** for the current usable snapshot. It also explains stable IDs, immutable revisions, source/signatures, read versus write tools, scope, and Web handoff continuity.
- **Anti-goals:** Do not make a long-lived token the first-run sign-in or connection path when device/browser authorization is available. Do not display or store secrets in URLs, logs, handoffs, analytics, or browser persistence. Do not pretend a browser can launch arbitrary MCP clients; provide copyable natural-language tasks, CLI commands, structured handoff, or explicit adapters. Do not build a platform-owned general chat Agent.

## Job 6 — Managing account and identity

- **User question:** “How do I control who I am, what others see, which identities are linked, and which credentials or notifications are active?”
- **Desired outcome:** Manage public researcher presentation separately from authenticated identity, security, credentials, and notifications, with safe linking, unlinking, visibility control, and recovery.
- **Primary route:** **Account Settings** — Profile, Connected identities, Tokens, Security, and Notifications.
- **Supporting routes:** Global header → Sign in/account menu; public researcher profile → permitted public contributions and links; Agent → connection security and token management; Docs → privacy and credential guidance.
- **Protocol concepts surfaced in natural language:** Profile fields describe the public researcher; ORCID is a verified scholarly identity obtained through OAuth/OIDC rather than typed in; GitHub is a linked identity with an explicit purpose; credentials have human-readable scope, resource limits, expiry, last use, status, and revocation; public contributions link to their immutable research revisions and sources. Account actions explain how identity, visibility, authorization, and research provenance differ.
- **Anti-goals:** Do not treat a manually entered ORCID iD as verified. Do not mix OAuth identities, public links, profile text, and credentials in one undifferentiated profile. Do not expose raw scopes without purpose or make tokens permanent by default. Do not infer a researcher’s expertise, affiliation, or claim truth from a linked identity, and do not expose private account state through public research pages.

## Contract boundary

This map defines researcher-facing jobs and route intent for M13.7-A. It does not claim that the current production site meets these outcomes, and it does not change the EviMesh protocol, stable identifiers, immutable revisions, signatures, or existing Web write fallback. Any implementation should preserve deep links and surface protocol detail progressively from natural language to technical detail.
