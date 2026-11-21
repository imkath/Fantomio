'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { orReloadNotice } from '@/lib/lazy-component'
import { Button } from '@/components/ui/button'
import { UserX } from 'lucide-react'
import { useOpenedOnce } from '@/hooks/use-opened-once'
import type { ExclusionsDialogProps } from '@/components/exclusions-dialog'

const ExclusionsDialog = dynamic(
  orReloadNotice(() => import('@/components/exclusions-dialog').then((m) => m.ExclusionsDialog))
)

interface ExclusionsManagerProps {
  groupId: string
  members: ExclusionsDialogProps['members']
  isAdmin: boolean
  isDrawn: boolean
}

export function ExclusionsManager({ groupId, members, isAdmin, isDrawn }: ExclusionsManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const opened = useOpenedOnce(showDialog)

  // ponytail: exclusions only matter before the draw, so the entry point hides afterwards.
  if (isDrawn) return null

  return (
    <>
      <Button
        variant="outline"
        className="justify-start"
        onClick={() => setShowDialog(true)}
        disabled={!isAdmin}
      >
        <UserX aria-hidden="true" />
        Quién no le puede regalar a quién
      </Button>

      {opened && (
        <ExclusionsDialog
          groupId={groupId}
          members={members}
          isAdmin={isAdmin}
          open={showDialog}
          onOpenChange={setShowDialog}
        />
      )}
    </>
  )
}
