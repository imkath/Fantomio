'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  cancelLabel: string
  confirmLabel: string
  icon: ReactNode
  busy: boolean
  onConfirm: () => void
}

// A yes/no question before something that can't be taken back. Load it through
// LazyConfirmDialog so the dialog library only downloads when one opens.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  icon,
  busy,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : icon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
