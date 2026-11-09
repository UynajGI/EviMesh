---
name: EviMesh
description: An open research network where Agents draft, people sign locally, and every research object reads as a controlled document.
colors:
  cobalt: "oklch(0.511 0.1591 257.75)"
  cobalt-deep: "oklch(0.435 0.1398 257.88)"
  cobalt-wash: "oklch(0.964 0.0176 253.34)"
  cobalt-rule: "oklch(0.93 0.0323 258.37)"
  cobalt-night-focus: "oklch(0.721 0.1294 257.8)"
  paper: "oklch(0.985 0.0017 247.84)"
  sheet: "oklch(1 0 0)"
  ink: "oklch(0.207 0.0227 257.29)"
  ink-soft: "oklch(0.301 0.0297 254.69)"
  graphite: "oklch(0.386 0.0243 253.12)"
  muted-ink: "oklch(0.479 0.0224 255.63)"
  lineage-grey: "oklch(0.58 0.0181 253.98)"
  hairline: "oklch(0.905 0.0081 253.86)"
  secondary-fill: "oklch(0.948 0.0052 247.88)"
  muted-fill: "oklch(0.957 0.0046 258.32)"
  success-ink: "oklch(0.42 0.1003 151.93)"
  success-wash: "oklch(0.965 0.0305 152.89)"
  success-rule: "oklch(0.924 0.0491 151.6)"
  success-solid: "oklch(0.49 0.1204 151.92)"
  success-edge: "oklch(0.519 0.115 151.9)"
  warning-ink: "oklch(0.452 0.0982 69.46)"
  warning-wash: "oklch(0.96 0.0378 81.52)"
  warning-rule: "oklch(0.926 0.0632 76.96)"
  warning-solid: "oklch(0.531 0.1153 69.71)"
  warning-edge: "oklch(0.585 0.1248 72.89)"
  danger-ink: "oklch(0.451 0.1602 27.18)"
  danger-wash: "oklch(0.962 0.0187 25.6)"
  danger-rule: "oklch(0.933 0.0337 26.8)"
  danger-solid: "oklch(0.52 0.1902 27)"
  danger-edge: "oklch(0.579 0.2 26.89)"
  info-ink: "oklch(0.43 0.1002 241.04)"
  info-wash: "oklch(0.963 0.0217 230.54)"
  info-rule: "oklch(0.934 0.0374 234.48)"
  info-solid: "oklch(0.5 0.1098 239.95)"
  info-edge: "oklch(0.521 0.105 239.81)"
  night-paper: "oklch(0.161 0.0151 253.14)"
  night-sheet: "oklch(0.207 0.0227 257.29)"
  night-ink: "oklch(0.972 0.0034 247.86)"
  night-rule: "oklch(0.261 0.0261 255.75)"
  night-muted-ink: "oklch(0.72 0.0135 255.53)"
typography:
  display:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "clamp(1.625rem, 2.6vw, 2.375rem)"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3.2vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  reading:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  reference:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
  margin-heading:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
  identifier:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    fontFeature: "\"tnum\", \"zero\""
rounded:
  control: "1px"
  surface: "2px"
  overlay: "3px"
spacing:
  gutter-mobile: "1rem"
  gutter: "1.5rem"
  grid-gap: "2.5rem"
  grid-gap-wide: "3rem"
  clause-gap: "3rem"
  measure: "68ch"
  clause-rail: "11rem"
  margin: "18rem"
  page-max: "84rem"
  header: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  button-outline-hover:
    backgroundColor: "{colors.muted-fill}"
    textColor: "{colors.ink}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  button-ghost-hover:
    backgroundColor: "{colors.muted-fill}"
  button-destructive:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  input-text:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "8px 12px"
  badge-status-neutral:
    backgroundColor: "{colors.secondary-fill}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  badge-status-accent:
    backgroundColor: "{colors.cobalt-wash}"
    textColor: "{colors.cobalt-deep}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  badge-status-success:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  badge-status-warning:
    backgroundColor: "{colors.warning-wash}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  badge-status-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  badge-status-info:
    backgroundColor: "{colors.info-wash}"
    textColor: "{colors.info-ink}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  badge-emphasis-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.surface}"
    padding: "1px 6px"
  title-block-head:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    padding: "1.75rem 2rem 2rem"
  title-block-cell:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "0.7rem 1rem 0.8rem"
  clause-rail-link:
    textColor: "{colors.muted-ink}"
    padding: "0.3rem 0 0.3rem 0.85rem"
  clause-rail-link-active:
    textColor: "{colors.ink}"
  reference-row:
    textColor: "{colors.ink}"
    typography: "{typography.reference}"
    padding: "1rem 0"
  ledger-row:
    textColor: "{colors.ink}"
    padding: "0.65rem 0"
  nav-link:
    textColor: "{colors.muted-ink}"
    height: "3.5rem"
    padding: "0 12px"
  nav-link-active:
    textColor: "{colors.ink}"
---

# Design System: EviMesh

## Overview

**Creative North Star: "The Controlled Document"**

Every research object on EviMesh is presented the way a standards body prints a normative document. The page opens on a title block, a ruled identity grid that says what the object is, which revision you are reading, its protocol state, which Agent drafted it and which person signed it. Content follows as numbered, citable clauses in a reading column with a real measure, while a right margin carries the revision ledger, attribution and a single handoff action. The reader knows within one glance what they are looking at and whose it is; only then do they read.

The ground is cold paper, the structure is ink rules, and colour is spent sparingly. One cobalt accent marks links, selection, focus, the active revision and revised text. Protocol state speaks through a muted dual-tier status palette that always leads with words. Depth is drawn, never lifted: 1px ink rules divide sections, hairlines divide rows, and nothing floats on a shadow. Density is that of a reference document rather than a dashboard: generous vertical rhythm between clauses (3rem), tight rhythm inside them.

The system refuses the editorial magazine hero, tracked uppercase kicker labels above titles, and card grids. Disagreement is information, so contested, refuted and challenged states are set as plainly as supported ones, and nothing on the page converts evidence into a score.

**Key Characteristics:**
- Title block first: a 1px ink-ruled grid of sentence-case labelled cells (Kind, State, Identifier, Revision, Drafted by, Signed by, Recorded).
- Numbered clauses on ink rules, mirrored by a sticky clause rail of citable anchors.
- A 68ch reading column set in Source Serif 4 for the research's own words.
- A right margin ledger of revisions, with the current revision in cobalt.
- A 2px cobalt change bar beside text that changed since the previous revision.
- Normative-reference rows for responses, evidence and receipts, never cards.
- Flat throughout: rules and hairlines, no shadows, corners of 1 to 3px.
- Light and dark themes from one semantic token set, both WCAG 2.2 AA.

## Colors

A cold, near-colourless paper-and-ink palette with a single cobalt voice and a muted, text-led status vocabulary. All values are oklch literals in `app/globals.css`; components consume semantic `--evimesh-*` roles, never primitives.

### Primary
- **Standards Cobalt** (`cobalt`, `--evimesh-primary`): links on hover and in prose, the primary action, the 2px focus ring, text selection, the change bar, the nav underline, the current revision in the ledger, the second half of the "Evi**Mesh**" wordmark, and the selected path in the research graph. It stays the same hue in both themes.
- **Deep Cobalt** (`cobalt-deep`, `--evimesh-accent-foreground`): text on cobalt washes (accent badges, pressed graph mode buttons, selected Relationship Index rows).
- **Cobalt Wash** (`cobalt-wash`, `--evimesh-accent`) and **Cobalt Rule** (`cobalt-rule`): the background and border of the accent status tier (under verification, leased, investigating, resolution) and of pressed toggles.
- **Night Focus Cobalt** (`cobalt-night-focus`): the focus ring and `--evimesh-ring` in the dark theme, lifted so it reads on night paper.

### Neutral
- **Cold Paper** (`paper`, `--evimesh-background`): the page ground and the shell header.
- **Sheet** (`sheet`, `--evimesh-card`): the inside of the title block, inputs, the graph canvas and the identity cells. It sits barely above paper; the ink frame, not the tone, separates it.
- **Ink** (`ink`, `--evimesh-foreground`): all primary text and every structural rule: the title block frame, clause heads, margin-section heads, the header and footer rules.
- **Soft Ink** (`ink-soft`): text on the secondary fill.
- **Graphite** (`graphite`): neutral status text and the neutral emphasis solid.
- **Muted Ink** (`muted-ink`, `--evimesh-muted-foreground`): labels in identity cells, clause numbers, breadcrumbs, attribution prefixes, dates and help text.
- **Lineage Grey** (`lineage-grey`): lineage edges in the research graph.
- **Hairline** (`hairline`, `--evimesh-border`): row dividers inside clauses, ledger rows, reference rows, the gaps between title-block cells, and the inactive clause-rail line.
- **Secondary Fill** (`secondary-fill`) and **Muted Fill** (`muted-fill`): neutral badge ground, hover ground for ghost and outline controls, skeletons.
- **Night Paper, Night Sheet, Night Ink, Night Rule, Night Muted Ink**: the dark-theme values the same semantic roles resolve to under `[data-theme="dark"]`. The theme swaps the primitive ramp; semantic names never change.

### Status (dual tier)
- **Muted tier** (`*-wash` ground, `*-ink` text, `*-rule` border) for success, warning, danger, info, accent and neutral: the default for every protocol state badge (supported, contested, qualifies, candidate, blocked).
- **Emphasis tier** (`*-solid` ground, sheet text): solid fills reserved for the single most consequential state in a view: refuted, upheld, critical.
- **Edge tier** (`*-edge`): research-graph edge families: positive (success), negative (danger), qualify (warning), structural (info), lineage (lineage grey). Every edge family also carries a line style and a readable label.

### Named Rules
**The One Cobalt Rule.** Cobalt is the only accent. It marks links, selection, focus, the primary action, the current revision and revised text, and nothing else. No second brand colour, no decorative tint.

**The Text-Leads-State Rule.** A protocol state is always its words first, with a 12px icon, in a muted dual-tier badge. Colour is never the only carrier. The solid emphasis tier is spent on at most the one most consequential state in a view.

**The Token-Only Rule.** Every colour comes from a semantic `--evimesh-*` role in `app/globals.css` (exposed to Tailwind as `bg-primary`, `text-muted-foreground`, `border-status-warning-border`, and so on). No raw hex, rgb or oklch in components, and no second component library.

**The No-Score Rule.** Counts are navigation entry points only, set in muted tabular numerals beside the clause they open. Never render evidence as percentages, progress bars, truth or support scores, likes or rankings. Private "helpful" marks and saves never render a public count anywhere.

## Typography

**Display Font:** Source Serif 4 (with ui-serif, Georgia, serif)
**Body Font:** Inter Tight (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Consolas, monospace)

**Character:** Three voices with strict jobs. Source Serif 4 is the research speaking: statements, titles of research objects, scope and falsification prose. Inter Tight is the document's apparatus: headings, labels, controls, navigation. IBM Plex Mono is the registry: identifiers, hashes, revision tags and keys, always with tabular, slashed-zero numerals. All three are self-hosted variable or static WOFF2 files under `/fonts`.

### Hierarchy
- **Display** (Source Serif 4, 500, `clamp(1.625rem, 2.6vw, 2.375rem)`, 1.18): the statement or title inside a research object's title block, capped at 38ch. Nothing sits above it.
- **Headline** (Inter Tight, 600, `clamp(1.875rem, 3.2vw, 2.75rem)`, 1.08, -0.025em): the page head on list, workspace, account and governance pages, on an ink bottom rule.
- **Title** (Inter Tight, 600, 1.125rem, 1.3, -0.01em): clause headings and section headings on an ink top rule, with the clause number in muted tabular numerals.
- **Reading** (Source Serif 4, 400, 1.0625rem, 1.7): prose and ruled lists in the reading column, at a 68ch measure.
- **Reference** (Source Serif 4, 500, 1.0625rem, 1.4): the title of a normative-reference row (a response, evidence item, or linked object).
- **Body** (Inter Tight, 400, 1rem, 1.55, stylistic sets ss01 and cv11): interface text, descriptions and help. Secondary descriptions sit at 0.875rem.
- **Label** (Inter Tight, 500, 0.75rem, 1.2, sentence case): identity-cell labels, toolbar labels, badge text. Margin-section heads use the 0.8125rem, 600 margin-heading step.
- **Identifier** (IBM Plex Mono, 400, 0.8125rem, tabular and slashed zero): shortened ids with copy on click, revision tags such as `r3`, hashes and signing keys.

### Named Rules
**The Three Voices Rule.** Serif only for research words (statements, titles of research objects, research prose). Mono only for identifiers. Inter Tight for everything else. A label is never set in serif; a statement is never set in sans.

**The Sentence-Case Label Rule.** Labels and context lines are sentence case at normal tracking, set beside or below what they label. There are no tracked uppercase kickers or eyebrows above titles.

## Layout

One page column for every surface: `doc-page`, centred, 84rem maximum, with 1.5rem gutters (1rem below 768px). The sticky shell header is 3.5rem tall on an ink bottom rule and shares the same column.

A research object page follows a fixed order: breadcrumb, full-width title block, then a three-track document grid. On wide screens (80rem and up) the grid is clause rail (11rem, sticky at 5rem from the top), reading column (fluid, prose capped at 68ch), and margin (18rem). Between 64rem and 80rem the clause rail drops away and the grid becomes reading column plus margin. Below 64rem everything stacks into a single column with the margin after the main clauses. The graph spans the reading column and margin as a full-measure band, followed by the closing clauses (revision history, technical details) back in the reading column.

The title block's identity row is two cells per row on small screens and, from 48rem, fills a row of 3, 4 or 5 cells chosen so the last row is complete. Reference rows become three columns at 48rem (relation 7.5rem, title fluid, date and link right-aligned). Clause spacing is 3rem between clauses and 1rem from head to body; groups inside a clause are 1.75rem apart. Account and governance pages reuse the same column with a page head and the two-track grid (main plus margin).

### Named Rules
**The Title Block First Rule.** A research object opens on its title block, directly under the breadcrumb. No hero, no kicker, no illustration above it.

**The Measure Rule.** Reading prose never runs wider than 68ch; secondary descriptions sit at 60 to 64ch.

**The One Handoff Rule.** The margin carries at most one primary action, the handoff to an Agent ("Continue with an agent"), with quiet text actions beneath it. The web hands off; it never simulates a signature.

## Elevation & Depth

EviMesh is flat. There is no shadow vocabulary: depth and grouping are drawn with rules. A 1px ink rule (`--evimesh-foreground`) frames the title block and opens every clause, margin section, page head, header and footer; a 1px hairline (`--evimesh-border`) separates rows within them. The title block's identity cells are separated by 1px gaps that show the hairline beneath. Overlays (account menu, mobile drawer) are framed by an ink border on paper, with a 40% ink scrim behind the drawer.

Motion is short and directional: pages enter with a 200ms, 8px horizontal slide; the active nav link draws a 2px cobalt underline over 160ms; dialogs rise 4px over 160ms; hover states change colour over 120ms. All use the `cubic-bezier(0.16, 1, 0.3, 1)` enter curve, and `prefers-reduced-motion` collapses every effect to an instant state change.

### Named Rules
**The Ink Rule Rule.** Structure is drawn, never lifted. Use a 1px ink rule to open a section and a 1px hairline to divide rows. No `box-shadow` on any surface.

**The Rules-Not-Cards Rule.** Group content under a ruled head, not inside a bordered, rounded, filled box. Lists of research objects are rows on hairlines.

## Shapes

Corners are nearly square: 1px for small controls (`--evimesh-radius-control`), 2px for buttons, inputs, badges and surfaces (`--evimesh-radius-surface`), 3px for overlays (`--evimesh-radius-overlay`). The title block, clauses, reference rows and the ledger have no radius at all; they are ruled, not boxed. The only fully round forms are functional: the switch track and thumb, the loading dot, and scrollbar thumbs. Research-graph nodes encode their family by border form rather than colour: a 3px top border for structure, a 3px left border for reasoning, a clipped top-right corner for resources, 3px left and right borders for execution, and an inset outline for verification.

## Components

### Buttons
Quiet, rectangular and plainly worded.
- **Shape:** near-square (2px radius); heights of 36px, 40px and 44px for small, default and large.
- **Primary:** cobalt ground with sheet text, 0.875rem at weight 500, 16px horizontal padding. Hover darkens to 90% cobalt.
- **Outline:** transparent with a 25% ink border; on hover the border becomes full ink and the ground muted fill. Used for secondary decisions such as Decline and Retire.
- **Ghost:** text only, muted fill on hover. **Destructive:** solid danger ground for irreversible actions after a confirming step. **Link:** cobalt text, underline on hover.
- **Hover / Focus:** colour transitions only; focus is a 2px focus-colour ring offset 2px from the paper. Loading shows a pulsing dot and sets `aria-busy`; disabled drops to 50% opacity.
- **Shell actions** ("Sign in", "Sign out") are ink-outlined and invert to ink ground on hover.

### Chips (status badges)
- **Style:** 2px radius, 0.75rem weight 500, 1px by 6px padding, a 12px state icon then the state in words with underscores replaced by spaces.
- **State:** muted dual tier by default (wash ground, ink-of-hue text, rule-of-hue border). The solid emphasis tier marks only refuted, upheld and critical.

### Cards / Containers
The system does not use cards for content. Containers are ruled regions:
- **Corner Style:** none for document regions; 2px for inputs and alerts.
- **Background:** paper for the page, sheet inside the title block, inputs and graph canvas.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px ink to frame or open a region, 1px hairline between rows.
- **Internal Padding:** title-block head 1.25rem to 2rem; identity cells 0.7rem by 1rem; reference rows 1rem vertical; ledger rows 0.65rem vertical.
- **Feedback blocks** (empty, error, denied) are notes between a top and bottom rule with an 18px icon, a short title and the next action; errors keep their request id in mono.

### Inputs / Fields
- **Style:** sheet ground, 25% ink border, 2px radius, 40px tall, 8px by 12px padding, 0.875rem text; border strengthens to 50% ink on hover.
- **Focus:** border turns cobalt with a 2px focus ring at 30% opacity.
- **Error / Disabled:** `aria-invalid` turns the border danger and the field group shows a linked error message in words; disabled is 50% opacity with a not-allowed cursor. Selects are native and styled identically; checkboxes and radios are native with a cobalt accent colour.

### Navigation
- **Shell header:** wordmark ("Evi" in ink, "Mesh" in cobalt) with the Kinetic mark, then seven publication destinations in Inter Tight 13px weight 500, muted ink at rest and ink when hovered or current. A 2px cobalt underline scales in from the left on hover and stays under the current page. Search, theme toggle, notifications and the account menu sit on the right as 36px quiet controls.
- **Mobile:** below 768px a 44px menu button opens a left drawer (Radix Dialog) with 44px rows on hairlines; the current destination sits on muted fill.
- **Breadcrumb:** 0.875rem muted ink, slash separators in hairline colour, the current item in ink.
- **Keyboard:** a skip link, `g` chords for the seven destinations, and a command palette.

### Title Block (signature)
The identity of every research object. A 1px ink frame on sheet; the head holds only the object's own words (display serif, max 38ch) plus an optional notice and actions. Beneath, a ruled row of `dt`/`dd` cells: Kind and State first, then Identifier, Revision ("r2 of 3"), Drafted by, Signed by, Recorded, and any object-specific cell. Missing values read "not stated", never blank.

### Clause and Clause Rail (signature)
A clause is a numbered, anchorable section: an ink top rule, a title-weight heading with its number in muted tabular numerals, an optional muted count, and a "#" anchor that turns cobalt on hover. Empty clauses print a sentence starting "None recorded." in muted ink. The clause rail mirrors the clauses as a sticky contents list; each entry is a hairline left border that turns ink, with ink text, when its clause is in view.

### Reference Row and Ledger (signature)
A reference row sets one typed response as a reference entry: relation badge, serif reference title linking to the object, a muted line of attribution ("Drafted by" Agent, "signed by" person), and a right-aligned date and mono "open rN" link. The margin ledger lists revisions newest first: a mono `rN` link column and a date plus drafter column, on hairlines, with the current revision's tag in cobalt at weight 600.

### Change Bar (signature)
A 2px cobalt bar set 1rem into the left margin beside text that changed since the previous revision, used on the title-block statement and in the revision diff.

### Research Graph
A d3-dag Sugiyama layout in React Flow, set between an ink bottom rule and a hairline top rule, with a toolbar of native selects, a canvas on sheet, and a keyboard-reachable Relationship Index beside it (stacked below on small screens). Edges carry colour, line style and a readable label; the legend states each family in words.

## Do's and Don'ts

### Do:
- **Do** open every research object with the breadcrumb and then the title block, with Kind, State, Identifier, Revision, Drafted by, Signed by and Recorded in ruled, sentence-case cells.
- **Do** show the attribution chain on every agent-produced item: the Agent as "Drafted by" (with "for" its owning person) and the person as "Signed by". An Agent is never shown as the signer.
- **Do** ship a keyboard-reachable list view (the Relationship Index) beside every graph view. The claim graph is a DAG of typed directed edges, never a parent-child tree.
- **Do** set statements and research-object titles in Source Serif 4, identifiers in IBM Plex Mono, and everything else in Inter Tight.
- **Do** take every colour from the semantic `--evimesh-*` roles in `app/globals.css`, and check both `data-theme` light and dark.
- **Do** use the 2px cobalt change bar beside revised text and cobalt for the current revision in the ledger.
- **Do** keep a 2px focus ring, 44px targets on coarse pointers, and instant state changes under reduced motion.
- **Do** render an ORCID iD as verified only when it came through ORCID OAuth.

### Don't:
- **Don't** render evidence counts as percentages, progress bars, truth or support scores, likes or rankings; counts are navigation only.
- **Don't** put a tracked uppercase kicker or eyebrow above a title, or open a page on a magazine hero.
- **Don't** wrap content in cards, card grids or rounded filled boxes; use ruled heads and hairline rows.
- **Don't** add `box-shadow` to any surface.
- **Don't** introduce a raw colour, a second accent, or a second component library.
- **Don't** mark a manually typed ORCID iD as verified.
- **Don't** use em dashes or emoji in visible copy.
- **Don't** use colour alone to carry a protocol state or a graph relation.
