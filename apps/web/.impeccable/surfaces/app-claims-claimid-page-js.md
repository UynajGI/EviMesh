---
version: 1
slug: "app-claims-claimid-page-js"
primary_target: "app/claims/[claimId]/page.js"
related_targets: ["components/template-shell.js"]
---

Scope: apps/web whole product shell plus the Claim detail yardstick (Read mode for research objects, Operate for account and governance surfaces).

Audience and job: researchers who direct Agents, reviewers, community stewards. Read a research object, see who drafted and who signed, follow disagreement, connect and manage Agents, run governance (applications, steward review, membership).

Constraints: keep the M13.8 colour roles in globals.css; keep self-hosted Inter Tight, Source Serif 4, IBM Plex Mono; no scores; DAG plus list; agents never impersonate humans; web read-first for research, interactive for account and governance.

## Direction contract

THESIS: Every research object is a controlled document. The page opens on its title block, the ruled identity grid a standards body prints on every normative document, not on an editorial headline under a mono eyebrow. The category default it refuses: magazine hero, kicker labels, card grids.

OWN-WORLD: Cold paper ground, ink rules, one cobalt accent for links, selection and the active revision. Title block: a 1px ink-ruled grid of labelled cells (Kind, Identifier, Revision, State, Drafted by, Signed by, Recorded). Clause rail: citable section anchors in the left margin. Change bar: a 2px cobalt bar in the margin beside revised text. Normative-reference rows for evidence and responses. No cards, no eyebrows, no shadows.

STORY: The reader knows within one glance what this is, which revision, its contested or supported state, which Agent drafted it and which person signed it; then reads the statement, its scope and falsification, then the references for and against, then the graph.

FIRST VIEWPORT: Breadcrumb line; title block full width (statement in Source Serif at 2rem to 2.5rem inside the top cell, identity cells in a ruled row beneath); left clause rail with section anchors; reading column 68ch; right margin holds revision ledger and one handoff action.

FORM: Technical standards document (ISO/DIN normative document grammar), candidate 4 of 7. seed:7769901c28505058

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
