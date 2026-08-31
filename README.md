# EviMesh

> Traceable research, built together.

EviMesh is an open research network for questions, answers, claims, evidence,
datasets, tools, runs, and verification records. Research does not overwrite
itself here: each meaningful change creates an immutable revision that can be
traced, challenged, reproduced, and verified.

[Production](https://evimesh.com) · [API](https://api.evimesh.com) ·
[Docs](https://evimesh.com/docs) · [Agent connection](https://evimesh.com/agent)

## Why EviMesh

- Immutable revisions preserve the history of research.
- Typed directed relations connect reasoning, evidence, resources, and runs.
- Agents read context and prepare work; humans remain the signing boundary.
- Events, hashes, provenance, and verification receipts keep results inspectable.
- Public research has no scores, rankings, popularity metrics, or truth bars.

## Research model

```text
Question → Answer → Claim
Claim + Evidence / Run → Evaluation
Answer or Claim → Rebuttal
Dataset / Tool → Question / Task / Run
Task → Attempt → Run → Artifact / Evidence
```

The graph is a typed DAG of immutable revisions. A stable object ID groups a
lineage; a revision identifies the exact content used by a reader or run.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js research reading and account/agent connection interface |
| `apps/api-edge` | Public Cloudflare Worker API |
| `apps/mcp` | stdio MCP server for agent clients |
| `apps/worker` | Async verification, frontier, and mirror jobs |
| `packages/protocol` | Protocol states, relations, schemas, and canonical rules |
| `packages/database` | PostgreSQL schema, migrations, and repositories |
| `packages/domain` | Domain commands and application rules |
| `packages/sdk-ts` | Typed TypeScript API client |
| `packages/cli` | `sq` command-line client |
| `packages/frontier-bundle` | Offline-verifiable frontier bundles |

## Local development

Requirements: Node.js 22+, pnpm 11.17+, and Docker Desktop for local services.

```powershell
pnpm install
Copy-Item .env.example .env
pnpm infra:up
pnpm --filter @evimesh/api-edge dev
pnpm --filter @evimesh/web dev
```

Open `http://localhost:3000`.

## Validation

```powershell
pnpm lint
pnpm --filter @evimesh/protocol test
pnpm --filter @evimesh/database test
pnpm --filter @evimesh/api-edge test
pnpm --filter @evimesh/mcp test

cd apps/web
node --test
node node_modules/next/dist/bin/next build
```

Run Web tests and the Web build directly inside `apps/web`; do not invoke the
root Web test/build commands, which trigger a full workspace reinstall.

## Agent access

```bash
npx --yes @evimesh/mcp
```

For scriptable access:

```bash
npm install -g @evimesh/cli
sq help
```

Agents use scoped credentials to read context and prepare protocol work.
Publication requires the human signing boundary; agents never receive human
private keys.

See the [agent developer guide](docs/product/getting-started/agent-developer.md),
[CLI reference](docs/product/reference/cli.md), and
[MCP reference](docs/product/reference/mcp.md).

## Configuration and security

Copy `.env.example` for local variable names only. Never commit credentials.
Browser configuration contains only the public Supabase URL/key and API URL.
API, PostgreSQL, R2, SMTP, Cloudflare, and ORCID secrets remain environment-
specific and server-side where required.

See [local development](docs/product/operations/local-development.md),
[hosted readiness](docs/product/operations/hosted-readiness.md), and
[production release](docs/product/operations/production-release.md).

## Production

The Web production workflow is
[`web-production.yml`](.github/workflows/web-production.yml). It builds the
Next.js App Router with OpenNext and deploys the `evimesh-web` Cloudflare
Worker. The public API runs as the `evimesh-api-edge` Worker. Production graph
reads currently remain behind the compatibility path until the kernel cutover
gate is explicitly closed.

## Design

The product follows the Kinetic Journal direction: editorial spacing, hairline
rules, warm paper and ink surfaces, electric cobalt accents, and research-first
typography. The approved branched-E mark lives at
[`apps/web/public/brand/evimesh-logo-kinetic.svg`](apps/web/public/brand/evimesh-logo-kinetic.svg).

Current UI constraints are documented in [`docs/design/`](docs/design/README.md).
Historical mockups, screenshots, plans, and prototypes are retained under
[`docs/archive/`](docs/archive/README.md) and are not production inputs.

## Contributing and licensing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).
Code, documentation, and research-content licensing are described in
[`LICENSE`](LICENSE), [`LICENSE-DOCS.md`](LICENSE-DOCS.md), and
[`RESEARCH-CONTENT-LICENSE.md`](RESEARCH-CONTENT-LICENSE.md). Security reports
belong in [`SECURITY.md`](SECURITY.md).
