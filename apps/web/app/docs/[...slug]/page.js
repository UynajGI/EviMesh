import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDocsManifest, loadDocsPage } from '@/lib/docs-content.mjs';
import { DocsBlocks } from '@/components/docs/docs-blocks';
import { DocsNav, DocsToc } from '@/components/docs/docs-nav';
import { PageContainer } from '@/components/ui/page';

/*
 * Docs article (docs-plan.md §4.2): left section nav, article capped at
 * 72ch, right TOC + provenance, prev/next in IA order. Statically rendered
 * from the repo's docs/product Markdown at build time.
 */
export async function generateStaticParams() {
  const { pages } = await loadDocsManifest();
  return pages.map((page) => ({ slug: page.slug.split('/') }));
}

export async function generateMetadata({ params }) {
  const { slug: segments = [] } = await params;
  const page = await loadDocsPage(segments.join('/'));
  if (!page) return { title: 'Docs · EviMesh' };
  return {
    title: `${page.title} · EviMesh Docs`,
    description: page.description ?? undefined,
  };
}

export default async function DocsArticlePage({ params }) {
  const { slug: segments = [] } = await params;
  const slug = segments.join('/');
  const page = await loadDocsPage(slug);
  if (!page) notFound();
  const { sections } = await loadDocsManifest();

  return (
    <PageContainer wide>
      <nav aria-label="Breadcrumb" className="mb-4 text-[0.8125rem] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5 list-none">
          <li><Link className="hover:text-foreground hover:underline" href="/docs">Docs</Link></li>
          <li aria-hidden="true" className="text-border">/</li>
          <li aria-current="page">{page.title}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:[grid-template-columns:13rem_minmax(0,1fr)_16rem] lg:items-start lg:grid">
        <div className="min-w-0 overflow-x-auto lg:sticky lg:top-20 lg:self-start">
          <DocsNav activeSlug={page.slug} sections={sections} />
        </div>

        <article className="min-w-0">
          {page.status === 'draft' ? (
            <p className="mb-3 text-xs text-status-warning-fg">Draft</p>
          ) : null}
          <h1 className="border-b border-border pb-3 text-[1.5rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">{page.title}</h1>
          {page.description ? <p className="mt-3 max-w-[72ch] text-base leading-7">{page.description}</p> : null}
          <div className="mt-6">
            <DocsBlocks blocks={page.blocks} />
          </div>
          <nav aria-label="Docs pagination" className="mt-10 grid gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-2">
            {page.prev ? (
              <Link className="group block text-sm" href={`/docs/${page.prev.slug}`}>
                <span className="block text-xs text-muted-foreground">Previous</span>
                <span className="mt-0.5 block font-medium text-foreground group-hover:text-primary group-hover:underline">{page.prev.title}</span>
              </Link>
            ) : <span />}
            {page.next ? (
              <Link className="group block text-right text-sm" href={`/docs/${page.next.slug}`}>
                <span className="block text-xs text-muted-foreground">Next</span>
                <span className="mt-0.5 block font-medium text-foreground group-hover:text-primary group-hover:underline">{page.next.title}</span>
              </Link>
            ) : <span />}
          </nav>
        </article>

        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <DocsToc sourceOfTruth={page.sourceOfTruth} toc={page.toc} updatedAt={page.updatedAt} />
        </div>
      </div>
    </PageContainer>
  );
}
