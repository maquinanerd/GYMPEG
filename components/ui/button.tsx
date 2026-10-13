import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Pill buttons (design round 1). Lime is only ever a fill with #111 on top
// ("primary"); "link" text uses the readable brand green. Sizes: 56px by
// default, 64px in the running workout ("session"), 44px minimum elsewhere.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card text-foreground hover:bg-pill",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-pill",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-btn px-6 text-subtitle",
        sm: "h-11 px-4 text-caption [&_svg]:size-4",
        lg: "h-btn px-8 text-subtitle",
        session: "h-btn-session px-6 text-subtitle",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Round icon button: card fill with a 1px border, 48px (64px in the workout).
const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: "size-12 [&_svg]:size-5",
        sm: "size-11 [&_svg]:size-5",
        session: "size-16 [&_svg]:size-6",
      },
      tone: {
        card: "",
        pill: "border-transparent bg-pill hover:bg-secondary",
      },
    },
    defaultVariants: { size: "default", tone: "card" },
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

export { Button, buttonVariants, IconButton, iconButtonVariants }
