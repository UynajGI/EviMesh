export function SectionPlaceholder({ title, description }) {
  return (
    <main className="mx-auto w-full max-w-[84rem] px-[var(--evimesh-container-px)] pt-8 text-foreground sm:pt-10">
      <header className="border-b border-foreground pb-6">
        <h1 className="text-[clamp(1.875rem,3.2vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.025em]">{title}</h1>
      </header>
      {description ? <p className="mt-4 max-w-[64ch] text-base leading-7 text-muted-foreground">{description}</p> : null}
    </main>
  );
}
