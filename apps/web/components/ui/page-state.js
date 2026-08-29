import { cn } from '@/lib/utils';
import { Skeleton } from './feedback';

/*
 * PageState (11-revision-decisions.md §3): same-shape loading skeletons for
 * the three page families, so a page never jumps from spinner to content.
 * Empty/error/denied keep using BlankShell (feedback.js) - this module only
 * owns the skeleton shapes.
 */
const SHAPES = {
  list: (
    <>
      <Skeleton className="h-32 w-full" />
      <div className="mt-6 flex flex-col divide-y divide-border rounded-lg border border-border">
        {[0, 1, 2, 3].map((row) => (
          <div className="flex items-center gap-4 px-5 py-4" key={row}>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </>
  ),
  detail: (
    <>
      <Skeleton className="h-32 w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </>
  ),
  workspace: (
    <>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="mt-6 h-11 w-full max-w-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </>
  ),
};

export function LoadingState({ shape = 'list', label = 'Loading content', className }) {
  return (
    <div aria-busy="true" aria-label={label} className={cn('min-w-0', className)}>
      {SHAPES[shape] ?? SHAPES.list}
    </div>
  );
}
