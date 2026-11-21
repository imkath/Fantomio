import type { ComponentType } from 'react'
import { toast } from 'sonner'

export const LAZY_LOAD_ERROR = 'No pudimos abrir esta ventana. Recarga la página para intentarlo.'

// For next/dynamic: if the code can't be downloaded (an old tab after a deploy, no
// connection), say so and render nothing instead of taking the whole page down.
export function orReloadNotice<P>(
  load: () => Promise<ComponentType<P>>
): () => Promise<ComponentType<P>> {
  return () =>
    load().catch(() => {
      toast.error(LAZY_LOAD_ERROR)
      const Nothing: ComponentType<P> = () => null
      return Nothing
    })
}
