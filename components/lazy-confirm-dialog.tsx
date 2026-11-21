'use client'

import dynamic from 'next/dynamic'
import { orReloadNotice } from '@/lib/lazy-component'
import type { ConfirmDialogProps } from '@/components/confirm-dialog'
import { useOpenedOnce } from '@/hooks/use-opened-once'

const ConfirmDialog = dynamic(
  orReloadNotice(() => import('@/components/confirm-dialog').then((m) => m.ConfirmDialog))
)

// ConfirmDialog, downloaded the first time it opens instead of with the page.
export function LazyConfirmDialog(props: ConfirmDialogProps) {
  const opened = useOpenedOnce(props.open)
  return opened ? <ConfirmDialog {...props} /> : null
}
