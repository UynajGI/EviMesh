export function PageSkeleton({ lines = 3 }) {
  return (
    <main aria-busy="true" aria-label="Loading content" className="mx-auto max-w-6xl px-6 py-20">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-12 max-w-lg animate-pulse rounded bg-muted" />
      <div className="mt-7 space-y-3">
        {Array.from({ length: lines }, (_, index) => <div className="h-5 max-w-2xl animate-pulse rounded bg-muted" key={index} />)}
      </div>
    </main>
  );
}
