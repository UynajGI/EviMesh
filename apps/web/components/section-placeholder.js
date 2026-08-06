export function SectionPlaceholder({ eyebrow, title, description }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20 text-foreground">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
    </main>
  );
}
