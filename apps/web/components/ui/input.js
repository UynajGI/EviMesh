import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }) {
  return <input className={cn('flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:opacity-50', className)} type={type} {...props} />;
}
