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
        className={cn('fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg focus:outline-none', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground" aria-label="Close dialog">
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
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground" id="confirm-description">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button disabled={loading} variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button loading={loading} onClick={onConfirm} variant={destructive ? 'destructive' : 'default'}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
