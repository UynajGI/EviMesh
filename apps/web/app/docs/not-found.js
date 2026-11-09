import Link from 'next/link';
import { loadDocsManifest } from '@/lib/docs-content.mjs';
import { Breadcrumb, PageContainer, PageHeader } from '@/components/ui/page';

export default async function DocsNotFound() {
  const { sections } = await loadDocsManifest();
  const pages = sections.flatMap((section) => section.pages);
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Documentation', href: '/docs' }, { label: 'Page not found' }]} />
      <PageHeader title="That page does not exist" />
      <p className="mt-4 max-w-[52ch] text-base leading-7 text-muted-foreground">
        The documentation page you asked for was moved or never existed. All
        current pages are listed below.
      </p>
      <section aria-labelledby="docs-pages-heading" className="mt-10">
        <div className="border-t border-foreground pt-3"><h2 className="text-lg font-semibold" id="docs-pages-heading">Current pages</h2></div>
        <ul className="mt-2 grid list-none border-t border-border">
          {pages.map((page) => (
            <li className="border-b border-border" key={page.slug}>
              <Link className="flex min-h-11 items-center text-sm text-primary hover:underline" href={`/docs/${page.slug}`}>{page.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
