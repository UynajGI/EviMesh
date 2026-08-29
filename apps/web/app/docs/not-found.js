import Link from 'next/link';
import { loadDocsManifest } from '@/lib/docs-content.mjs';
import { PageContainer } from '@/components/ui/page';

export default async function DocsNotFound() {
  const { sections } = await loadDocsManifest();
  const pages = sections.flatMap((section) => section.pages);
  return (
    <PageContainer>
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-secondary-foreground">Docs</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">That page does not exist</h1>
      <p className="mt-3 max-w-[52ch] text-base leading-7 text-muted-foreground">
        The documentation page you asked for was moved or never existed. All
        current pages are listed below.
      </p>
      <ul className="mt-6 grid list-none gap-1">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link className="text-sm text-primary hover:underline" href={`/docs/${page.slug}`}>{page.title}</Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
