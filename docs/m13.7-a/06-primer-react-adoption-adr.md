# M13.7-A06 ADR: Primer React adoption boundary

**Status:** accepted for M13.7 implementation planning.
**Decision:** Primer React is the single component-system foundation for the product shell. Application code consumes it only through EviMesh adapters and EviMesh semantic components.

## Boundary

- One root `ThemeProvider`/base style configuration owns Primer tokens, color mode, focus behavior and reset.
- `apps/web/components/evimesh/*` (introduced by follow-on work) is the only import boundary for Primer primitives. It supplies EviMesh semantic components such as `AppShell`, `ResearchStatus`, `ProvenanceSummary`, `AccountNav`, and `ConnectionStep`.
- EviMesh brand tokens map to documented Primer token slots; semantic state tokens may extend them but may not hard-code one-off colors in features.
- A feature may compose an adapter but may not import a second UI library, copy a Primer component, or create parallel button/form/modal/navigation primitives.

## Consequences and migration

Replace the current local UI primitives incrementally at shell, navigation, feedback, form, data and page-layout seams. Each migrated screen removes its superseded primitive use rather than rendering mixed systems. Preserve semantic HTML, keyboard paths, focus management and URL semantics throughout.

## Prohibitions

No simultaneous Primer + Material/Ant/other component-library surface; no raw CSS imitation of a competing system; no per-component theme overrides; no GitHub logo, repository vocabulary, or implied GitHub affiliation. Primer supplies interaction foundations, not EviMesh product identity.

## Evidence

[Primer navigation](https://primer.style/product/ui-patterns/navigation/) requires clear orientation and contextual navigation. [Primer React's documented root pattern](https://github.com/primer/react/tree/main/examples/nextjs) uses one root ThemeProvider/BaseStyles; that is the adoption boundary, not a license to theme individual features independently.
