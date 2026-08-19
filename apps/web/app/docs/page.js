import { redirect } from 'next/navigation';

/*
 * M13.8 IA keeps Docs as a first-class destination. A dedicated docs surface
 * does not exist yet, so it forwards to the canonical Markdown agent manual (/agent.md)
 * instead of the connection wizard.
 */
export default function DocsPage() {
  redirect('/agent.md');
}
