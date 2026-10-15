import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Buttons (design v2): radius 12, never a pill. Lime is only ever a fill with
// #111 on top ("primary"); "ink" is the dark button (#111, white text) that
// sits on the lime block; "outline" is a hairline of the input color.
// Heights: 56px by default, 64px in the running workout and the rest screen
// ("session"), 40px for the small header actions ("sm", radius 8).
// States: hover darkens 4%, press sinks 1px, focus shows a 2px ring, disabled
// fades to 40%, loading keeps the label and adds a 16px spinner.
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[filter,transform,background-color] duration-[120ms] ease-out-quart hover:brightness-[.96] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 aria-busy:pointer-events-none motion-reduce:transition-none motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        primary: "bg-primary text-primary-foreground",
        ink: "bg-ink text-ink-foreground",
        outline: "border border-input bg-transparent text-foreground hover:bg-muted hover:brightness-100",
        // A white surface button (rest screen controls on the lime fill).
        secondary: "bg-card text-card-foreground",
        ghost: "text-foreground hover:bg-muted hover:brightness-100",
        destructive: "bg-destructive text-destructive-foreground",
        link: "h-auto px-0 text-foreground underline underline-offset-4 hover:brightness-100 hover:decoration-2",
      },
      size: {
        default: "h-btn px-5 text-subtitle",
        lg: "h-btn px-6 text-subtitle",
        sm: "h-10 rounded-sm px-3.5 text-caption font-semibold [&_svg]:size-4",
        session: "h-touch-session px-5 text-subtitle",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
    >
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.5" />
      <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  // Keeps the label, adds a spinner and blocks repeated taps.
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner />}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

// Icon-only button. "plain": no fill (header actions, 48px); "outline": the
// input hairline at radius 12 (the workout footer's previous / next, 64px);
// "card": a white surface at radius 8 (controls laid over a picture).
const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center text-foreground transition-[filter,transform,background-color] duration-[120ms] ease-out-quart active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: "size-12 [&_svg]:size-[22px]",
        sm: "size-11 [&_svg]:size-5",
        session: "size-16 [&_svg]:size-[22px]",
      },
      tone: {
        plain: "rounded-sm hover:bg-muted",
        outline: "rounded-md border border-input hover:bg-muted",
        card: "rounded-sm bg-card text-card-foreground hover:brightness-[.96]",
      },
    },
    defaultVariants: { size: "default", tone: "plain" },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean
  // Icon-only: the accessible name is required.
  "aria-label": string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size, tone, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(iconButtonVariants({ size, tone, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { Button, buttonVariants, IconButton, iconButtonVariants, Spinner }
