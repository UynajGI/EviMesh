import { redirect } from 'next/navigation';

/*
 * M13.8 IA keeps Docs as a first-class destination. A dedicated docs surface
 * does not exist yet, so it currently forwards to the agent manual (the
 * closest reading surface) instead of dead-ending.
 */
export default function DocsPage() {
  redirect('/agent');
}
