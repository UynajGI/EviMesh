import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { POLICY_EFFECTIVE_DATE, PUBLIC_POLICIES } from './policy-content';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function sectionId(title) {
  return `policy-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function PolicyLink({ href, label, note }) {
  const className = `group block min-h-11 border-b border-border py-2.5 text-left ${FOCUS_RING}`;
  const content = (
    <>
      <span className="block text-sm text-primary group-hover:underline">{label}</span>
      {note ? <span className="mt-0.5 block max-w-[64ch] text-[13px] leading-5 text-muted-foreground">{note}</span> : null}
    </>
  );

  return href.startsWith('/')
    ? <Link className={className} href={href}>{content}</Link>
    : <a className={className} href={href}>{content}</a>;
}

export function PolicyPage({ policyKey }) {
  const policy = PUBLIC_POLICIES[policyKey];
  if (!policy) throw new Error(`Unknown public policy: ${policyKey}`);

  return (
    <PageContainer wide>
      <PageHeader title={policy.title} />

      <dl aria-label="Publication status" className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <div><dt className="sr-only">Effective date</dt><dd className="tabular-nums text-foreground">Effective <time dateTime={POLICY_EFFECTIVE_DATE}>{POLICY_EFFECTIVE_DATE}</time></dd></div>
        <div><dt className="sr-only">Release state</dt><dd><span aria-hidden="true">· </span>Public Preview</dd></div>
        <div><dt className="sr-only">Review gate</dt><dd><span aria-hidden="true">· </span>{policy.review}</dd></div>
      </dl>

      <div className="grid min-w-0 grid-cols-12 gap-y-8 pt-8 md:gap-x-6 lg:gap-x-10">
        <aside className="col-span-12 min-w-0 md:col-span-3 lg:col-span-2" aria-label={`${policy.title} sections`}>
          <nav className="md:sticky md:top-24">
            <p className="pb-1.5 text-xs font-semibold text-muted-foreground">On this page</p>
            <ol className="m-0 list-none p-0">
              {policy.sections.map((section) => (
                <li key={section.title}>
                  <a className={`flex min-h-11 items-center py-1 text-[13px] leading-5 text-muted-foreground hover:text-foreground md:min-h-0 md:py-1 ${FOCUS_RING}`} href={`#${sectionId(section.title)}`}>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="col-span-12 min-w-0 md:col-span-9 lg:col-span-7 lg:col-start-4">
          <p className="max-w-[64ch] text-base leading-7 text-foreground">{policy.summary}</p>

          <div className="mt-6">
            {policy.sections.map((section) => {
              const id = sectionId(section.title);
              return (
                <section aria-labelledby={`${id}-heading`} className="scroll-mt-24 pt-6" id={id} key={section.title}>
                  <h2 className="border-b border-border pb-1.5 text-[0.9375rem] font-semibold" id={`${id}-heading`}>{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => <p className="mt-3 max-w-[70ch] text-[15px] leading-7" key={paragraph}>{paragraph}</p>)}
                  {section.items ? (
                    <ul className="mt-3 max-w-[72ch] list-disc pl-5">
                      {section.items.map((item) => <li className="py-1 text-[15px] leading-7" key={item}>{item}</li>)}
                    </ul>
                  ) : null}
                  {section.links ? <div className="mt-3">{section.links.map((link) => <PolicyLink {...link} key={link.href} />)}</div> : null}
                </section>
              );
            })}
          </div>
        </article>
      </div>

      <nav aria-label="Related policies" className="mt-10">
        <h2 className="border-b border-border pb-1.5 text-[0.9375rem] font-semibold">Related</h2>
        <div className="grid min-w-0 gap-x-6 sm:grid-cols-3">
          {policy.related.map((link) => <PolicyLink {...link} key={link.href} />)}
        </div>
      </nav>
    </PageContainer>
  );
}
