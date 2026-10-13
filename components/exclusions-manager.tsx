'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addExclusion, removeExclusion, getExclusions } from '@/lib/actions/exclusions'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, UserX } from 'lucide-react'

interface Member {
  id: string
  user_id: string
  profile: {
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface Exclusion {
  id: string
  group_id: string
  giver_id: string
  excluded_receiver_id: string
  created_at: string
}

interface ExclusionsManagerProps {
  groupId: string
  members: Member[]
  isAdmin: boolean
  isDrawn: boolean
}

export function ExclusionsManager({ groupId, members, isAdmin, isDrawn }: ExclusionsManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [selectedGiver, setSelectedGiver] = useState('')
  const [selectedExcluded, setSelectedExcluded] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Se memoiza con groupId como dependencia: sin esto el efecto de abajo
  // conservaría una versión antigua de la función si el grupo cambiara.
  const loadExclusions = useCallback(async () => {
    setIsLoading(true)
    const result = await getExclusions(groupId)
    if (result.success && result.exclusions) {
      setExclusions(result.exclusions)
    } else {
      toast.error(result.error || 'Error al cargar restricciones')
    }
    setIsLoading(false)
  }, [groupId])

  useEffect(() => {
    if (showDialog) {
      loadExclusions()
    }
  }, [showDialog, loadExclusions])

  const handleAddExclusion = async () => {
    if (!selectedGiver || !selectedExcluded) {
      toast.error('Elige a las dos personas.')
      return
    }

    if (selectedGiver === selectedExcluded) {
      toast.error('Elige dos personas distintas.')
      return
    }

    setIsAdding(true)
    const result = await addExclusion(groupId, selectedGiver, selectedExcluded)

    if (result.success) {
      toast.success('Listo, quedó anotado')
      setSelectedGiver('')
      setSelectedExcluded('')
      await loadExclusions()
    } else {
      toast.error(result.error || 'Error al agregar restricción')
    }
    setIsAdding(false)
  }

  const handleRemoveExclusion = async (exclusionId: string) => {
    const result = await removeExclusion(exclusionId)

    if (result.success) {
      toast.success('Quitado')
      await loadExclusions()
    } else {
      toast.error(result.error || 'Error al eliminar restricción')
    }
  }

  const getMemberById = (userId: string) => {
    return members.find((m) => m.user_id === userId)
  }

  const nameOf = (m: Member) => m.profile.full_name || m.profile.email

  const getAvailableReceivers = () => {
    if (!selectedGiver) return members

    // Filter out the giver themselves and already excluded members
    const alreadyExcluded = exclusions
      .filter((e) => e.giver_id === selectedGiver)
      .map((e) => e.excluded_receiver_id)

    return members.filter(
      (m) => m.user_id !== selectedGiver && !alreadyExcluded.includes(m.user_id)
    )
  }

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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quién no le puede regalar a quién</DialogTitle>
            <DialogDescription>
              Por ejemplo, para que una pareja no se toque entre sí. El sorteo lo respeta.
            </DialogDescription>
          </DialogHeader>

          {isAdmin && (
            <div className="bg-slip border-rule space-y-4 rounded-[4px] border p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <span className="text-[15px] font-medium" id="ex-giver">
                    Esta persona
                  </span>
                  <Select value={selectedGiver} onValueChange={setSelectedGiver}>
                    <SelectTrigger aria-labelledby="ex-giver" className="bg-paper w-full">
                      <SelectValue placeholder="Elegir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {nameOf(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-[15px] font-medium" id="ex-receiver">
                    no le regala a
                  </span>
                  <Select
                    value={selectedExcluded}
                    onValueChange={setSelectedExcluded}
                    disabled={!selectedGiver}
                  >
                    <SelectTrigger aria-labelledby="ex-receiver" className="bg-paper w-full">
                      <SelectValue placeholder="Elegir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableReceivers().map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {nameOf(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleAddExclusion}
                disabled={!selectedGiver || !selectedExcluded || isAdding}
                className="w-full"
              >
                {isAdding ? <Loader2 className="animate-spin" /> : <Plus aria-hidden="true" />}
                Agregar
              </Button>
            </div>
          )}

          <div>
            <p className="text-graphite mb-2 text-[15px] font-medium">
              Anotadas: {exclusions.length}
            </p>
            {isLoading ? (
              <p className="text-graphite py-6 text-center text-[15px]">Cargando…</p>
            ) : exclusions.length === 0 ? (
              <p className="text-graphite py-4">
                Ninguna. Cualquiera le puede regalar a cualquiera.
              </p>
            ) : (
              <ul className="divide-rule divide-y">
                {exclusions.map((exclusion) => {
                  const giver = getMemberById(exclusion.giver_id)
                  const excluded = getMemberById(exclusion.excluded_receiver_id)
                  if (!giver || !excluded) return null
                  return (
                    <li key={exclusion.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <b className="font-bold">{nameOf(giver)}</b>
                        <span className="text-graphite"> no le regala a </span>
                        <b className="font-bold">{nameOf(excluded)}</b>
                      </span>
                      {isAdmin && (
                        <Button
                          variant="danger"
                          size="icon-sm"
                          onClick={() => handleRemoveExclusion(exclusion.id)}
                          aria-label={`Quitar: ${nameOf(giver)} no le regala a ${nameOf(excluded)}`}
                          title="Quitar"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
