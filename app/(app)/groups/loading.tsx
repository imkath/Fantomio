import { GroupPageSkeleton } from '@/components/skeletons'

// Shown right away under the shared header while the group loads.
export default function Loading() {
  return (
    <main className="mx-auto max-w-[1040px] px-4 pt-8 pb-10 md:px-8">
      <GroupPageSkeleton />
    </main>
  )
}
