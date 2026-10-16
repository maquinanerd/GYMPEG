'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

// Bottom sheet on Radix Dialog (focus trap, Esc, scroll lock, aria-modal).
// On a phone it rises from the bottom edge with a grab handle; from the sm
// breakpoint it is a centered card. Respects the bottom safe area.

const BottomSheet = DialogPrimitive.Root;
const BottomSheetTrigger = DialogPrimitive.Trigger;
const BottomSheetClose = DialogPrimitive.Close;

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col gap-4 overflow-y-auto rounded-t-lg border border-b-0 border-border bg-card px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-card-foreground shadow-lg duration-200 ease-out-quart focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom motion-reduce:animate-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border-b sm:pb-5',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-[2px] bg-input sm:hidden" />
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
BottomSheetContent.displayName = 'BottomSheetContent';

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-heading', className)} {...props} />
));
BottomSheetTitle.displayName = 'BottomSheetTitle';

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-caption text-muted-foreground', className)}
    {...props}
  />
));
BottomSheetDescription.displayName = 'BottomSheetDescription';

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetDescription,
};
