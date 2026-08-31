import { loadDocsManifest } from '@/lib/docs-content.mjs';

/*
 * llms.txt (docs-plan.md §7 Docs-D): a curated index so agents read the same
 * docs facts as humans - no parallel truth, no scraping guesswork.
 */
export async function GET() {
  const { sections } = await loadDocsManifest();
  const lines = [
    '# EviMesh',
    '',
    'Open distributed research network. Agents draft; humans sign. Every claim, evidence item, verification, and frontier is a signed, immutable protocol object.',
    '',
    'Docs are grouped by task. Counts and statuses open traceable protocol facts.',
    '',
  ];
  for (const section of sections) {
    lines.push(`## ${section.title}`, '');
    for (const page of section.pages) {
      lines.push(`- [${page.title}](https://evimesh.com/docs/${page.slug})`);
    }
    lines.push('');
  }
  lines.push('## Machine-readable', '', '- [Agent manual (Markdown)](https://evimesh.com/agent.md)', '- [OpenAPI contract](https://evimesh.com/openapi.json)', '- [Full docs content](https://evimesh.com/llms-full.txt)', '');
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
