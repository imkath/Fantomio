import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Zen Kaku sits its letters low in the line box, so icons get nudged 0.08em down to match.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-base font-medium tracking-[0.02em] transition-[color,transform] cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 [&_svg]:translate-y-[0.08em] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Paper slips (see .btn-paper in globals.css): the filled ones tilt one way, the
        // outlined ones the other, so a row of buttons doesn't look stamped out.
        default:
          'btn-paper [--face:var(--ink)] [--edge:var(--ink)] text-paper hover:[--face:var(--paper)] hover:text-ink',
        destructive:
          'btn-paper [--face:var(--destructive)] [--edge:var(--destructive)] text-destructive-foreground hover:[--face:var(--paper)] hover:text-destructive',
        // Red outline for actions that remove or leave something.
        danger:
          'btn-paper [--face:var(--paper)] [--edge:var(--destructive)] [--slip-x:-3px] [--slip-dir:-1] text-destructive hover:[--face:var(--destructive)] hover:text-destructive-foreground',
        outline:
          'btn-paper [--face:var(--paper)] [--edge:var(--ink)] [--slip-x:-3px] [--slip-dir:-1] text-ink hover:[--face:var(--ink)] hover:text-paper',
        secondary: 'bg-slip text-ink hover:bg-rule',
        ghost: 'text-ink hover:bg-slip',
        link: 'text-ink underline underline-offset-4 hover:text-hanko',
      },
      size: {
        default: 'h-11 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-10 gap-2 px-3.5 text-[15px] has-[>svg]:px-3',
        lg: 'h-[52px] px-7 text-[17px] has-[>svg]:px-6',
        icon: 'size-11',
        'icon-sm': 'size-10',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
