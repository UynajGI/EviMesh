import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'bg-indigo-600 text-white hover:bg-indigo-500',
      outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
      ghost: 'text-slate-700 hover:bg-slate-100',
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-9 rounded-md px-3', lg: 'h-11 rounded-md px-8' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({ className, variant, size, type = 'button', ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} type={type} {...props} />;
}

export { buttonVariants };
