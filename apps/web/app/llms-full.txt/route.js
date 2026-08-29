import { loadDocsManifest } from '@/lib/docs-content.mjs';

/** Full docs content as plain Markdown: one flat, agent-readable document. */
export async function GET() {
  const { pages } = await loadDocsManifest();
  const parts = ['# EviMesh docs (full)', ''];
  for (const page of pages) {
    parts.push(`---`, '', `<!-- /docs/${page.slug} -->`, '', `# ${page.title}`, '');
    if (page.description) parts.push(page.description, '');
    parts.push(page.body ?? '', '');
  }
  return new Response(parts.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
