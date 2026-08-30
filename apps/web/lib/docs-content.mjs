/*
 * Docs content loader (docs-plan.md §3.2). Content comes from
 * docs-content.generated.mjs - a build-time compilation of docs/product
 * (scripts/build-docs-content.mjs, run by the web prebuild hook). The
 * deployed worker has no filesystem, so this module never touches fs.
 */
import { DOCS_RAW } from './docs-content.generated.mjs';
import { parseMarkdown, tableOfContents } from './docs-markdown.mjs';

const FRONTMATTER_KEYS = ['title', 'description', 'audience', 'status', 'sourceOfTruth', 'updatedAt'];
const AUDIENCES = ['researcher', 'agent-developer', 'verifier', 'operator'];
const STATUSES = ['current', 'draft'];

function parseFrontmatter(source, file) {
  if (!source.startsWith('---')) return { meta: {}, body: source };
  const close = source.indexOf('\n---', 3);
  if (close < 0) throw new Error(`${file}: frontmatter opened but never closed`);
  const raw = source.slice(3, close).trim();
  const meta = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!match || !FRONTMATTER_KEYS.includes(match[1])) {
      throw new Error(`${file}: unknown or malformed frontmatter line "${line}"`);
    }
    meta[match[1]] = match[2].trim();
  }
  for (const key of ['title', 'audience', 'status']) {
    if (!meta[key]) throw new Error(`${file}: frontmatter is missing ${key}`);
  }
  if (!AUDIENCES.includes(meta.audience)) throw new Error(`${file}: unknown audience ${meta.audience}`);
  if (!STATUSES.includes(meta.status)) throw new Error(`${file}: unknown status ${meta.status}`);
  return { meta, body: source.slice(close + 4).replace(/^\n/, '') };
}

function parsePage(entry) {
  const { meta, body } = parseFrontmatter(entry.body, entry.slug);
  const blocks = parseMarkdown(body);
  return {
    slug: entry.slug,
    meta,
    title: meta.title,
    description: meta.description ?? null,
    audience: meta.audience,
    status: meta.status,
    sourceOfTruth: meta.sourceOfTruth ?? null,
    updatedAt: meta.updatedAt ?? null,
    toc: tableOfContents(blocks),
    body,
    blocks,
  };
}

/** Every docs page, grouped into navigation sections. Section order is fixed
 *  here (not derived from the fs) so the IA is a decision, not an accident. */
export function loadDocsManifest() {
  const pages = DOCS_RAW.map(parsePage);
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const sections = [
    { id: 'getting-started', title: 'Getting started', slugs: pages.filter((p) => p.slug.startsWith('getting-started/')).map((p) => p.slug) },
    { id: 'concepts', title: 'Core concepts', slugs: pages.filter((p) => p.slug.startsWith('concepts/')).map((p) => p.slug) },
    { id: 'guides', title: 'Guides', slugs: pages.filter((p) => p.slug.startsWith('guides/')).map((p) => p.slug) },
    { id: 'reference', title: 'Reference', slugs: pages.filter((p) => p.slug.startsWith('reference/')).map((p) => p.slug) },
    { id: 'operations', title: 'Operations', slugs: pages.filter((p) => p.slug.startsWith('operations/')).map((p) => p.slug) },
  ].map((section) => ({
    ...section,
    pages: section.slugs.map((slug) => {
      const page = bySlug.get(slug);
      if (!page) throw new Error(`docs manifest references missing page ${slug}`);
      return { slug: page.slug, title: page.title, audience: page.audience, status: page.status };
    }),
  })).filter((section) => section.pages.length > 0);
  return { sections, pages };
}

/** One page by slug; 404s stay the caller's decision. Prev/next follow the
 *  declared IA order (the manifest), never filesystem sort order. */
export function loadDocsPage(slug) {
  const { sections } = loadDocsManifest();
  const ordered = sections.flatMap((section) => section.slugs);
  const index = ordered.indexOf(slug);
  if (index < 0) return null;
  const pages = DOCS_RAW.map(parsePage);
  const page = pages.find((entry) => entry.slug === slug);
  if (!page) return null;
  const prevSlug = ordered[index - 1] ?? null;
  const nextSlug = ordered[index + 1] ?? null;
  return {
    ...page,
    prev: prevSlug ? (() => { const p = pages.find((entry) => entry.slug === prevSlug); return p ? { slug: p.slug, title: p.title } : null; })() : null,
    next: nextSlug ? (() => { const p = pages.find((entry) => entry.slug === nextSlug); return p ? { slug: p.slug, title: p.title } : null; })() : null,
  };
}
