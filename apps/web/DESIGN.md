---
name: EviMesh
description: An open research network where Agents draft, people sign, and every research object reads as a dense, quiet research record.
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
    fontSize: "clamp(2.25rem, 4.4vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.4vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  reading:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  reference:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  section:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"ss01\", \"cv11\""
  control:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  meta:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  identifier:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: "\"tnum\", \"zero\""
rounded:
  control: "1px"
  surface: "2px"
  overlay: "3px"
spacing:
  gutter-mobile: "1rem"
  gutter: "1.5rem"
  grid-gap-mobile: "2rem"
  grid-gap: "3.5rem"
  section-gap: "2.25rem"
  group-gap: "1.25rem"
  measure: "70ch"
  margin: "17rem"
  ref-state-column: "7rem"
  page-max: "76rem"
  header: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.sheet}"
    typography: "{typography.control}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  button-outline-hover:
    backgroundColor: "{colors.muted-fill}"
    textColor: "{colors.ink}"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  button-ghost-hover:
    backgroundColor: "{colors.muted-fill}"
  button-destructive:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.sheet}"
    typography: "{typography.control}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "0 16px"
  input-text:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.surface}"
    height: "40px"
    padding: "8px 12px"
  badge-status-neutral:
    backgroundColor: "{colors.secondary-fill}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  badge-status-accent:
    backgroundColor: "{colors.cobalt-wash}"
    textColor: "{colors.cobalt-deep}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  badge-status-success:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  badge-status-warning:
    backgroundColor: "{colors.warning-wash}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  badge-status-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  badge-status-info:
    backgroundColor: "{colors.info-wash}"
    textColor: "{colors.info-ink}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  badge-emphasis-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.surface}"
    padding: "0 6px"
  page-title:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "0 0 1rem"
  record-title:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
  record-byline:
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    padding: "1rem 0 0"
  section-index-link:
    textColor: "{colors.muted-ink}"
    typography: "{typography.meta}"
    padding: "0.6rem 0"
  section-index-link-active:
    textColor: "{colors.ink}"
  section-head:
    textColor: "{colors.ink}"
    typography: "{typography.section}"
    padding: "0 0 0.4rem"
  record-row:
    textColor: "{colors.ink}"
    typography: "{typography.reference}"
    padding: "0.75rem 0"
  ledger-row:
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    padding: "0.3rem 0"
  margin-label:
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
  identifier:
    textColor: "{colors.muted-ink}"
    typography: "{typography.identifier}"
  nav-link:
    textColor: "{colors.muted-ink}"
    typography: "{typography.meta}"
    height: "3rem"
    padding: "0 8px"
  nav-link-active:
    textColor: "{colors.ink}"
---

# Design System: EviMesh

## Overview

**Creative North Star: "The Research Record"**

A research object on EviMesh reads like a record that sits between a journal page and a GitHub repository: dense, quiet, and scannable. The research's own words lead. A claim opens on its statement in Source Serif 4, followed by one byline that names kind, state, revision, drafter, signer, date and a short identifier, an inline index of its sections, and then the sections themselves, each a plain heading on a hairline. A narrow margin beside the reading column holds links and data (revisions, the one handoff action, frontier membership, the event audit), never prose.

The chrome recedes. The shell is a 48px header on a hairline and a one-line footer; navigation, labels, bylines and margins are Inter Tight at 13 to 15px in muted ink; identifiers are IBM Plex Mono, shown short with the full value on hover and copy. Page titles are plain nouns at 1.5rem. There are no subtitles explaining the page, no eyebrows above titles, no decorative icons, and no cards. Colour is spent on links, the current revision, revised text, focus, and protocol state, which always reads as words first.

Density is closer to a repository listing than a dashboard: 0.75rem record rows on hairlines, 2.25rem between sections, a 70ch reading measure. Disagreement is information, so rebuttals, refuting evidence and contested states sit beside what they answer and are set as plainly as supported ones. Nothing converts evidence into a score.

**Key Characteristics:**
- Research words in Source Serif 4; interface in Inter Tight at 13 to 15px; identifiers in IBM Plex Mono, shortened.
- Record head: the object's words, then one inline byline of bare cells, then an inline section index.
- Sections are 15px semibold headings on a hairline, with a hover-revealed "#" anchor.
- Record rows on hairlines: state column, serif title with one metadata line, date.
- A 17rem sticky margin of links and data beside a 70ch reading column.
- Flat throughout: hairline rules, no shadows, no cards, corners of 1 to 3px.
- Light and dark themes from one semantic token set, both WCAG 2.2 AA.

## Colors

A cold, near-colourless paper-and-ink palette with one cobalt voice and a muted, text-led status vocabulary. All values are oklch literals in `app/globals.css`; components consume semantic `--evimesh-*` roles, never primitives.

### Primary
- **Link Cobalt** (`cobalt`, `--evimesh-primary`): links in margins and actions, the primary button, the 2px focus ring, text selection, caret and native control accent, the change bar, the current revision tag in the ledger, the 2px nav underline, the "Mesh" half of the wordmark, and the selected path in the research graph. Same hue in both themes.
- **Deep Cobalt** (`cobalt-deep`, `--evimesh-accent-foreground`): text on cobalt washes (accent badges, pressed graph mode buttons, selected Relationship Index rows).
- **Cobalt Wash** (`cobalt-wash`) and **Cobalt Rule** (`cobalt-rule`): ground and border of the accent status tier (under verification, leased, investigating, resolution) and of pressed graph toggles.
- **Night Focus Cobalt** (`cobalt-night-focus`): the focus ring in the dark theme, lifted to read on night paper.

### Neutral
- **Cold Paper** (`paper`, `--evimesh-background`): the page ground and the shell header (at 95%).
- **Sheet** (`sheet`, `--evimesh-card`): inputs, the search field, the graph canvas. It sits barely above paper.
- **Ink** (`ink`, `--evimesh-foreground`): primary text, the record title, section headings, and the 2px underline under the active Explore facet.
- **Soft Ink** (`ink-soft`): text on the secondary fill.
- **Graphite** (`graphite`): neutral status text and the neutral emphasis solid.
- **Muted Ink** (`muted-ink`, `--evimesh-muted-foreground`): byline labels, margin labels, the section index at rest, breadcrumbs, dates, identifiers, counts, help text and nav links at rest.
- **Lineage Grey** (`lineage-grey`): lineage edges in the research graph.
- **Hairline** (`hairline`, `--evimesh-border`): every structural rule: the header and footer, the page title rule, the byline and section index rules, section heads, record rows, the graph toolbar.
- **Secondary Fill** (`secondary-fill`) and **Muted Fill** (`muted-fill`): neutral badge ground, hover ground for ghost and outline controls, skeletons.
- **Night Paper, Night Sheet, Night Ink, Night Rule, Night Muted Ink**: the values the same semantic roles resolve to under `[data-theme="dark"]`. The theme swaps the primitive ramp; semantic names never change.

### Status (dual tier)
- **Muted tier** (`*-wash` ground, `*-ink` text, `*-rule` border) for success, warning, danger, info, accent and neutral: the default for every protocol state badge.
- **Emphasis tier** (`*-solid` ground, sheet text): reserved for refuted, upheld and critical, the most consequential state in a view.
- **Edge tier** (`*-edge`): research-graph edge families: positive, negative, qualify, structural, lineage. Every edge family also carries a line style and a readable label.

### Named Rules
**The One Cobalt Rule.** Cobalt is the only accent. It marks links, focus, selection, the primary action, the current revision and revised text, and nothing else.

**The Words-Carry-State Rule.** A protocol state is its words in a muted badge, with no icon. Colour is never the only carrier, and the solid tier is spent only on refuted, upheld and critical.

**The Token-Only Rule.** Every colour comes from a semantic `--evimesh-*` role in `app/globals.css` (exposed to Tailwind as `bg-primary`, `text-muted-foreground`, `border-border` and so on). No raw hex, rgb or oklch in components, and no second component library.

**The No-Score Rule.** Counts are navigation entry points only, set in muted tabular numerals beside the section or facet they open. Never render evidence as percentages, progress bars, truth or support scores, likes or rankings. Private "helpful" marks and saves never render a public count.

## Typography

**Display Font:** Source Serif 4 (with ui-serif, Georgia, serif)
**Body Font:** Inter Tight (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Consolas, monospace)

**Character:** Three voices with strict jobs. Source Serif 4 is the research speaking: statements, titles of research objects, research prose and lists. Inter Tight is the quiet apparatus around it, mostly at 13 to 15px. IBM Plex Mono is the registry, used only for identifiers, revision tags, hashes and keys, with tabular slashed-zero numerals. All three are self-hosted WOFF2 under `/fonts`.

### Hierarchy
- **Display** (Source Serif 4, 500, `clamp(2.25rem, 4.4vw, 3.25rem)`, 1.08, -0.02em): the landing headline only.
- **Headline** (Source Serif 4, 500, `clamp(1.5rem, 2.4vw, 2rem)`, 1.22, -0.01em): the record title, the object's own statement or title, capped at 40ch.
- **Title** (Inter Tight, 600, 1.5rem, 1.25, -0.01em): the page title on list, workspace and account pages, a plain noun on a hairline. A non-serif record head uses the same step. The landing's live example title uses this size in serif.
- **Reading** (Source Serif 4, 400, 1.0625rem, 1.65): prose and bulleted lists in the reading column at a 70ch measure. The landing lede uses the same size in Inter Tight.
- **Reference** (Source Serif 4, 500, 1rem, 1.4): the title of a record row and the selected object in the Relationship Index.
- **Section** (Inter Tight, 600, 0.9375rem, 1.3): section headings on a hairline, and the name in a list row.
- **Body** (Inter Tight, 400, 0.9375rem, 1.55, ss01 and cv11): the base size for interface text.
- **Control** (Inter Tight, 500, 0.875rem): buttons, inputs, field labels, secondary descriptions and empty-state lines.
- **Meta** (Inter Tight, 400, 0.8125rem, 1.4): the byline, section index, breadcrumb, nav links, footer, margin content and ledger rows.
- **Label** (Inter Tight, 600, 0.75rem, 1.3, sentence case): margin section labels in muted ink. Status badges and row metadata use the same 0.75rem at weight 500.
- **Identifier** (IBM Plex Mono, 400, 0.75rem, tabular and slashed zero): shortened ids such as `claim_43b1e5…141b`, `@r1` revision suffixes, hashes in the record details.

### Named Rules
**The Three Voices Rule.** Serif only for research words. Mono only for identifiers. Inter Tight for everything else. A label is never set in serif; a statement is never set in sans.

**The Short Identifier Rule.** Identifiers render shortened (prefix, six characters, ellipsis, last four) in muted mono, with the full value in the title attribute and on copy. Full ids appear only in the record details section.

**The Plain Label Rule.** Labels are sentence case at normal tracking, beside or below what they label. No tracked uppercase kickers or eyebrows above titles.

## Layout

One page column for every surface: centred, 76rem maximum, with 1.5rem gutters (1rem below 768px). The shell header (48px) and the one-line footer share the column.

A research record follows a fixed order: breadcrumb, record head (title, then the byline on a hairline), inline section index on a hairline, then a two-track grid. From 64rem the grid is the reading column (fluid, prose capped at 70ch) and a 17rem margin that sticks 4.5rem from the top, 3.5rem apart. Below 64rem it stacks with 2rem gaps and the margin follows the main sections. The research graph spans both tracks as a full-width band, and the closing sections (revision history, record details) return to the reading column.

Sections sit 2.25rem apart, with 0.75rem from heading to body and 1.25rem between groups inside a section. Record rows carry 0.75rem of vertical padding and become a three-column grid at 48rem: a 7rem state column, the title column, and an auto date column. On small screens the breadcrumb collapses to the parent link only and the byline wraps.

List and account pages reuse the column: a page title on a hairline, then content, with the same two-track grid when a margin is needed. The landing page sets a 26rem headline column beside a live record example from 64rem, then five one-line principles in a row on a hairline.

### Named Rules
**The Words-First Rule.** A research record opens on its own words directly under the breadcrumb. Nothing sits above the title: no kicker, no hero, no illustration.

**The Margin-Holds-Data Rule.** The margin carries links and data only: revisions, frontier membership, the event audit, related links, short numbered steps. No explanatory paragraphs.

**The One Primary Action Rule.** A form or margin carries at most one primary action. On records it is "Continue with an agent"; the rest are quiet text actions. The web hands off; it never simulates a signature.

## Elevation & Depth

EviMesh is flat and uses no shadow vocabulary. Grouping is drawn with 1px hairlines (`--evimesh-border`) under the header, the page title, the byline, the section index and every section head and row; the footer sits on a hairline above. Ink is reserved for text, not for rules. The shell header is paper at 95% with a light backdrop blur so content scrolling beneath it stays legible. The mobile drawer sits over a 40% ink scrim.

Motion is short. Routes fade from 60% to full opacity over 160ms; the nav underline scales in from the left over 160ms; dialogs rise 4px over 160ms; hovers change colour over 120ms. All use the `cubic-bezier(0.16, 1, 0.3, 1)` enter curve, and `prefers-reduced-motion` collapses every effect to an instant state change.

### Named Rules
**The Hairline Rule.** Structure is a 1px hairline, never an ink rule and never a lift. No `box-shadow` on any surface.

**The No-Cards Rule.** Group content under a heading on a hairline, not inside a bordered, rounded, filled box. Lists of research objects are rows on hairlines.

## Shapes

Corners are nearly square: 1px for small controls (`--evimesh-radius-control`, graph toolbar and mode switch), 2px for buttons, inputs, badges, alerts and skeletons (`--evimesh-radius-surface`), 3px for overlays (`--evimesh-radius-overlay`). The record head, sections, rows and ledger have no radius; they are ruled, not boxed. The only round forms are functional: the loading dot and scrollbar thumbs. Research-graph nodes encode family by border form rather than colour: a 3px top border for structure, a 3px left border for reasoning, a clipped top-right corner for resources, 3px left and right borders for execution, and an inset outline for verification.

## Components

### Buttons
Quiet, rectangular and plainly worded.
- **Shape:** near-square (2px radius); 36px, 40px and 44px tall for small, default and large.
- **Primary:** cobalt ground, sheet text, 0.875rem weight 500, 16px horizontal padding; hover drops to 90% cobalt. One per form.
- **Outline:** transparent with a 25% ink border; hover turns the border full ink on muted fill. Used for the record handoff and secondary decisions such as Retire.
- **Ghost:** text only, muted fill on hover. **Destructive:** solid danger ground, only after a confirming step. **Link:** cobalt text, underline on hover.
- **Hover / Focus:** colour transitions only; focus is a 2px focus-colour ring offset 2px. Loading shows a pulsing dot and sets `aria-busy`; disabled drops to 50% opacity.

### Chips (status badges)
- **Style:** 2px radius, 0.75rem weight 500, 6px horizontal padding, 20px line; the state in words with underscores replaced by spaces. No icon.
- **State:** muted dual tier by default; the solid emphasis tier only for refuted, upheld and critical.

### Cards / Containers
The system does not use cards for content. Containers are ruled regions:
- **Corner Style:** none for record regions; 2px for inputs and alerts.
- **Background:** paper for the page; sheet only inside inputs and the graph canvas.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline under a heading or between rows.
- **Feedback:** empty, error and denied states are one line between a top and bottom hairline, with the next action beneath; no icons, no paragraph for an empty list. Errors keep their request id in mono, denied states their missing scope. Alerts are the one filled box: a 2px-radius dual-tier banner with a title and one line.

### Inputs / Fields
- **Style:** sheet ground, 25% ink border, 2px radius, 40px tall, 8px by 12px padding, 0.875rem text; border strengthens to 50% ink on hover.
- **Focus:** border turns cobalt with a 2px focus ring at 30% opacity.
- **Error / Disabled:** `aria-invalid` turns the border danger and the field group shows a linked message in words; disabled is 50% opacity. Help sits below in 0.75rem muted ink. Selects, checkboxes and radios are native with the cobalt accent colour.

### Navigation
- **Shell header:** 48px, on a hairline. The mark and wordmark ("Evi" in ink, "Mesh" in cobalt), then seven destinations in 13px muted ink, ink when hovered or current, with a 2px cobalt underline that scales in from the left. Search field, theme toggle, notifications and the account menu sit right as quiet controls.
- **Footer:** one line on a hairline: the wordmark left, six 13px links right.
- **Mobile:** below 768px a 44px menu button opens a left drawer with 44px rows on hairlines; the current destination sits on muted fill.
- **Breadcrumb:** 13px muted ink, slash separators in hairline colour, the current item in ink. Below 640px only the parent link shows.
- **Facets:** list filters are a row of 44px-tall text tabs with muted tabular counts; the current facet is ink with a 2px ink underline.

### Record Head and Byline (signature)
The object's own words in the headline serif, max 40ch, then one inline byline at 13px on a hairline. Kind, state, revision, date and identifier are bare cells (their labels are screen-reader only); "Drafted by" and "Signed by" keep visible muted labels. An Agent shows a 13px robot glyph in muted ink and its owner: "Drafted by atlas for Lin". People show no glyph. A missing actor reads "not stated", never blank. A revised title carries the change bar.

### Section and Section Index (signature)
A section is an anchorable heading at 0.9375rem semibold on a hairline, with an optional muted aside and a "#" anchor revealed on hover or focus. An empty section prints "None yet." in muted ink. The section index is one wrapping row of 13px muted links under the byline, with muted counts; the section in view turns ink.

### Record Row and Ledger (signature)
A record row is a 7rem state column (kind in muted text over a status badge), a serif title linking to the object with one muted metadata line (drafter and signer, or short identifiers), and a right-aligned date with a mono revision link. The margin ledger lists revisions as a mono `rN` column and a date, with the current tag in cobalt at weight 600 and a small cobalt "current".

### Change Bar (signature)
A 2px cobalt bar 0.85rem into the left margin beside text that changed since the previous revision: the record title and the revision diff.

### Research Graph
A d3-dag Sugiyama layout in React Flow under a muted 12px heading, with a hairline toolbar of native selects and 1px-radius actions, a canvas on sheet, and the keyboard-reachable Relationship Index beside it (stacked below at 40rem). Edges carry colour, line style and a readable label; the legend names each family in words.

## Do's and Don'ts

### Do:
- **Do** open every research record with the breadcrumb, then its own words, then the byline and the inline section index, each on a hairline.
- **Do** show the attribution chain on every agent-produced item: "Drafted by <agent> for <owner>" and "Signed by <person>". An Agent is never shown as the signer.
- **Do** keep copy to what a researcher needs to act or read. Page titles are plain nouns ("Explore", "My Agents"); empty states are one line.
- **Do** set research words in Source Serif 4, identifiers in IBM Plex Mono shown short, and everything else in Inter Tight at 13 to 15px.
- **Do** ship the keyboard-reachable Relationship Index beside every graph view. The claim graph is a DAG of typed directed edges, never a parent-child tree.
- **Do** put links and data in the margin, with at most one primary action.
- **Do** take every colour from the semantic `--evimesh-*` roles in `app/globals.css`, and check both `data-theme` light and dark.
- **Do** keep a 2px focus ring, 44px targets on coarse pointers, and instant state changes under reduced motion.
- **Do** render an ORCID iD as verified only when it came through ORCID OAuth.

### Don't:
- **Don't** render evidence counts as percentages, progress bars, truth or support scores, likes or rankings; counts are navigation only.
- **Don't** add subtitles or helper paragraphs that explain the page to itself.
- **Don't** put an eyebrow or kicker above a title, or open a page on a hero.
- **Don't** wrap content in cards or rounded filled boxes; use headings on hairlines and rows on hairlines.
- **Don't** use ink rules or `box-shadow` for structure.
- **Don't** add decorative icons; the only glyphs are functional controls and the Agent marker.
- **Don't** introduce a raw colour, a second accent, or a second component library.
- **Don't** mark a manually typed ORCID iD as verified.
- **Don't** use em dashes or emoji in visible copy.
- **Don't** use colour alone to carry a protocol state or a graph relation.
