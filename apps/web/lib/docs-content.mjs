/*
 * Docs content loader (docs-plan.md §3.2, §7 Docs-A). Reads the whitelisted
 * Markdown under docs/product at build time - routes using this module render
 * statically, so no filesystem access reaches the deployed worker.
 *
 * Frontmatter is a fixed whitelist: title, description, audience, status,
 * sourceOfTruth, updatedAt. Unknown keys fail loudly in tests, not silently.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdown, tableOfContents } from './docs-markdown.mjs';

const FRONTMATTER_KEYS = ['title', 'description', 'audience', 'status', 'sourceOfTruth', 'updatedAt'];
const AUDIENCES = ['researcher', 'agent-developer', 'verifier', 'operator'];
const STATUSES = ['current', 'draft'];

/** Repo-root docs/product directory, resolved from this module location. */
export function productRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'product');
}

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

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, base));
    else if (entry.name.endsWith('.md')) files.push(path.relative(base, full));
  }
  return files.sort();
}

function slugFor(relative) {
  return relative.replace(/\.md$/, '').replaceAll('\\', '/');
}

async function loadTree() {
  const root = productRoot();
  const files = await walk(root);
  const pages = [];
  for (const relative of files) {
    const source = await readFile(path.join(root, relative), 'utf8');
    const { meta, body } = parseFrontmatter(source, relative);
    const blocks = parseMarkdown(body);
    pages.push({
      slug: slugFor(relative),
      file: relative,
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
    });
  }
  return pages;
}

/** Every docs page, grouped into navigation sections. Section order is fixed
 *  here (not derived from the fs) so the IA is a decision, not an accident. */
export async function loadDocsManifest() {
  const pages = await loadTree();
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

/** One page by slug; 404s stay the caller's decision. */
export async function loadDocsPage(slug) {
  const pages = await loadTree();
  const page = pages.find((entry) => entry.slug === slug);
  if (!page) return null;
  const index = pages.findIndex((entry) => entry.slug === slug);
  return {
    ...page,
    prev: pages[index - 1] ? { slug: pages[index - 1].slug, title: pages[index - 1].title } : null,
    next: pages[index + 1] ? { slug: pages[index + 1].slug, title: pages[index + 1].title } : null,
  };
}
