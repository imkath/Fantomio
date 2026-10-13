import { DashboardSkeleton } from '@/components/skeletons'

// Shown right away under the shared header while the page and its data load.
export default function Loading() {
  return (
    <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8 md:py-14">
      <DashboardSkeleton />
    </main>
  )
}
