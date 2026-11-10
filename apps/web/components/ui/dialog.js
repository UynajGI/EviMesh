'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/*
 * Overlay primitives (M13.5-B08). The Radix Dialog root provides focus
 * management (trap, Escape, aria) out of the box; surfaces are token-based.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn('evimesh-dialog-enter fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-border bg-card p-5 text-card-foreground shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--evimesh-foreground)_25%,transparent)] focus:outline-none', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-[2px] text-muted-foreground transition-colors hover:text-foreground" aria-label="Close dialog">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Confirmation overlay for destructive or consequential actions. */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  loading = false,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="confirm-description" role="alertdialog">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground" id="confirm-description">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button disabled={loading} size="sm" variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button loading={loading} onClick={onConfirm} size="sm" variant={destructive ? 'destructive' : 'default'}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
