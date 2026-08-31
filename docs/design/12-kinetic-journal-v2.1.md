# Kinetic Journal v2.1

Kinetic Journal is the v2.1 full-site visual system. It treats EviMesh as an international research publication: cold paper, ink, one electric-cobalt accent, asymmetric twelve-column composition, near-right corners and hairline rules. It explicitly avoids dashboard tiles, metric theatre, gradients, heavy shadows and decorative looping motion.

## Page system

- The global navigation is `Home / Explore / Work / Tools / Contributions / Agent / Docs` on desktop and mobile.
- Page headers reserve asymmetric editorial space for a title, abstract and at most one contextual action.
- Research detail pages use an eight-column typed-content body with four-column provenance marginalia.
- A local neighborhood always presents the interactive graph and Relationship Index simultaneously at a 7:5 desktop ratio; mobile stacks them without widening the document.
- The website reads research. CLI and MCP prepare and submit it; a human reviews and signs on the local device.

## Graph contract

The UI consumes `research-neighborhood.v1` through a compatibility normalizer. Node identity is `kind:id@revision`; the stable ID remains separately visible. All 23 protocol kinds retain their family, canonical URL, state and revision. Edge direction is never reversed. Direction and distance are calculated from the resolved root, and topology is complete only when the server response is neither truncated nor permission-partial and no local filter hides a connection.

Graph nodes distinguish the five node families by shape, a Lucide icon and a written type. Selection is shared with the Relationship Index. Upstream and downstream sections group rows by node type and relation; every row states type, title, relation, distance, state and `ID@revision`. Root and Leaf labels appear only for complete topology; every bounded view says Unknown.

## Type and motion

- Inter Tight: navigation, titles and interface labels.
- Source Serif 4: research statements and long-form reading.
- IBM Plex Mono: IDs, revisions and metadata.
- Page entry: 8px horizontal displacement plus opacity over 180 to 220ms.
- Navigation underline: 160ms. Selected graph path: 160ms. Graph relayout: 220 to 300ms.
- Hover may move two pixels horizontally or expose a leading rule. It never lifts or scales.
- `prefers-reduced-motion` makes these state changes effectively instant.

All fonts are locally hosted OFL assets. Exact upstream URLs, pinned Google Fonts metadata commit and copied license texts are recorded in `apps/web/public/fonts/README.md`.

## Acceptance

- At 390px, `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on every representative page.
- Graph controls and Relationship Index buttons have a 44px minimum touch target under coarse pointer input.
- The graph remains pannable, zoomable, keyboard reachable, draggable locally and full-screen capable.
- No research route contains a browser POST, create/edit form, signature simulation or state-transition control. Account settings, tokens, keys and Agent connection management remain interactive.
- The accepted implementation is the production Web app in `../../apps/web`. The standalone prototype is retained for historical review at `../archive/prototypes/v2.1-kinetic-journal/` and is not a runtime dependency.
