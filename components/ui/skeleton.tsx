import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-slip animate-pulse rounded-[2px]', className)}
      {...props}
    />
  )
}

export { Skeleton }
