'use client'

// The group page's dialogs. The page loads this file with next/dynamic the first time one of
// them opens, so their code (and the edit form's) stays out of the group's first load.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Crown,
  Loader2,
  LogOut,
  MessageCircle,
  Repeat,
  RotateCcw,
  Shuffle,
  Trash2,
  UserMinus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Notice } from '@/components/auth-shell'
import { ModePicker, type GroupMode } from '@/components/group/mode-picker'
import {
  PlaceFields,
  placeError,
  placeToSave,
  type PlaceDraft,
} from '@/components/group/place-fields'
import { updateGroup } from '@/lib/actions/group'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { groupPath } from '@/lib/routes'
import { whatsappUrl } from '@/lib/invite'
import type { PlaceKind } from '@/lib/place'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ConfirmProps extends DialogProps {
  busy: boolean
  onConfirm: () => void
}

export function DrawConfirmDialog({
  open,
  onOpenChange,
  blind,
  repeatedNames,
  guessable,
  hasPrevious,
  avoidPrevious,
  onAvoidPreviousChange,
  onConfirm,
}: DialogProps & {
  blind: boolean
  repeatedNames: string[]
  guessable: string[]
  hasPrevious: boolean
  avoidPrevious: boolean
  onAvoidPreviousChange: (value: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Hacemos el sorteo?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>Cuando lo hagas:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>a cada persona le aparece a quién le regala</li>
                <li>ya no se puede sumar gente al grupo</li>
                <li>si algo sale mal, puedes reiniciarlo, pero todos pierden lo que vieron</li>
                <li>quien no haya respondido la invitación queda fuera de esta vuelta</li>
                {blind && (
                  <li>
                    es a ciegas: cada uno verá solo una lista, sin nombre, hasta que la reveles
                  </li>
                )}
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        {repeatedNames.length > 0 && (
          <Notice>
            Hay más de una persona llamada {repeatedNames.join(' y ')}. Revisa que no sea la misma
            persona con dos cuentas: debajo de cada nombre ves el inicio de su correo.
          </Notice>
        )}
        {guessable.length > 0 && (
          <Notice>
            Con estas restricciones, a{' '}
            {guessable.length === 1 ? guessable[0] : `${guessable.length} personas`} le puede tocar
            solo una persona, en cualquier sorteo. Quien conozca las restricciones podría adivinar{' '}
            {guessable.length === 1 ? 'esa pareja' : 'esas parejas'}. Si no quieres que pase, quita
            alguna restricción antes de sortear. Si te da lo mismo, sortea igual.
          </Notice>
        )}
        {hasPrevious && (
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              className="accent-ink mt-1 size-4 cursor-pointer"
              checked={avoidPrevious}
              onChange={(e) => onAvoidPreviousChange(e.target.checked)}
            />
            <span>
              Que a nadie le toque la misma persona que la vez anterior, cuando se pueda. Usamos el
              sorteo anterior sin mostrárselo a nadie.
            </span>
          </label>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Todavía no
          </Button>
          <Button onClick={onConfirm}>
            <Shuffle aria-hidden="true" />
            Sortear ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Blind draw blocked: say why and help fix it.
export function MissingListsDialog({
  open,
  onOpenChange,
  missing,
  groupId,
  groupName,
}: DialogProps & { missing: string[]; groupId: string; groupName: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Todavía falta que anoten su lista</DialogTitle>
          <DialogDescription>
            En el sorteo a ciegas, la lista es la única pista de quien regala, así que se puede
            sortear cuando todos hayan anotado al menos una cosa.
          </DialogDescription>
        </DialogHeader>
        <div>
          <p className="text-graphite mb-2 text-[15px]">
            {missing.length === 1 ? 'Falta 1 persona' : `Faltan ${missing.length} personas`}
          </p>
          <ul className="divide-rule divide-y">
            {missing.map((name) => (
              <li key={name} className="py-2.5">
                {name}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}${groupPath(groupId)}`
              const text = `Para el amigo secreto a ciegas de *${groupName}* falta que anotes tu lista de deseos. Sin ella no podemos sortear:\n${url}`
              window.open(whatsappUrl(text), '_blank', 'noopener')
            }}
          >
            <MessageCircle aria-hidden="true" />
            Avisarles por WhatsApp
          </Button>
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface EditableGroup {
  id: string
  name: string
  budget: number | null
  currency: string
  exchange_date: string | null
  status: 'PLANNING' | 'DRAWN'
  mode: GroupMode
  reveal_at: string | null
  revealed_at: string | null
  place_kind: PlaceKind | null
  place_name: string | null
  place_detail: string | null
}

// "2026-12-24T20:00" for <input type="datetime-local">, in the viewer's time zone.
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// The form starts from the group as it is when the dialog mounts; the page remounts it on
// every open, so it never shows what was typed and cancelled before.
export function EditGroupDialog({
  open,
  onOpenChange,
  group,
  onSaved,
  onDelete,
}: DialogProps & {
  group: EditableGroup
  onSaved: () => Promise<void> | void
  onDelete: () => void
}) {
  const [editName, setEditName] = useState(group.name)
  const [editBudget, setEditBudget] = useState(group.budget?.toString() || '')
  const [editCurrency, setEditCurrency] = useState(group.currency || 'CLP')
  const [editDate, setEditDate] = useState(group.exchange_date || '')
  const [editPlace, setEditPlace] = useState<PlaceDraft>({
    kind: group.place_kind,
    name: group.place_name ?? '',
    detail: group.place_detail ?? '',
  })
  const [editMode, setEditMode] = useState<GroupMode>(group.mode)
  const [editRevealAt, setEditRevealAt] = useState(
    group.reveal_at ? toLocalInput(group.reveal_at) : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveEdit = async () => {
    // Never a silent no: a bad call link says why right where it is typed.
    const badPlace = placeError(editPlace)
    if (badPlace) {
      toast.error(badPlace)
      document.getElementById('place-detail')?.focus()
      return
    }
    setIsSaving(true)

    const result = await updateGroup(group.id, {
      name: editName,
      budget: editBudget ? parseFloat(editBudget) : null,
      currency: editCurrency,
      exchange_date: editDate || null,
      ...placeToSave(editPlace),
      // The mode is locked once there is a draw (the database refuses it too).
      ...(group.status === 'PLANNING' ? { mode: editMode } : {}),
      ...(group.revealed_at
        ? {}
        : {
            reveal_at:
              editMode === 'blind' && editRevealAt ? new Date(editRevealAt).toISOString() : null,
          }),
    })

    if (result.success) {
      toast.success('Grupo actualizado')
      onOpenChange(false)
      await onSaved()
    } else {
      toast.error(result.error || 'Error al actualizar')
    }

    setIsSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid gap-1.5">
            <label htmlFor="edit-name" className="text-[15px] font-medium">
              Nombre del grupo
            </label>
            <Input
              id="edit-name"
              value={editName}
              maxLength={100}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="edit-budget" className="text-[15px] font-medium">
              Presupuesto por regalo
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Moneda"
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="border-input bg-paper text-ink focus-visible:border-ink h-11 rounded-[8px] border px-3 text-base outline-none"
              >
                <option value="CLP">CLP ($)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="MXN">MXN ($)</option>
                <option value="ARS">ARS ($)</option>
                <option value="COP">COP ($)</option>
                <option value="PEN">PEN (S/)</option>
                <option value="BRL">BRL (R$)</option>
                <option value="GBP">GBP (£)</option>
              </select>
              <Input
                id="edit-budget"
                type="number"
                inputMode="numeric"
                min="0"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="edit-date" className="text-[15px] font-medium">
              Día del intercambio
            </label>
            <Input
              id="edit-date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <PlaceFields value={editPlace} onChange={setEditPlace} />
          <ModePicker value={editMode} onChange={setEditMode} disabled={group.status === 'DRAWN'} />
          {editMode === 'blind' && !group.revealed_at && (
            <div className="grid gap-1.5">
              <label htmlFor="edit-reveal" className="text-[15px] font-medium">
                Hora de revelación (opcional)
              </label>
              <Input
                id="edit-reveal"
                type="datetime-local"
                value={editRevealAt}
                onChange={(e) => setEditRevealAt(e.target.value)}
              />
              <p className="text-graphite text-sm">
                Lo normal es que toques &quot;Revelar ahora&quot; cuando estén todos juntos. Si a
                esta hora nadie lo ha hecho, se revela solo.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="danger" className="sm:mr-auto" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Eliminar grupo
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveEdit} disabled={isSaving || !editName.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
  groupName,
}: ConfirmProps & { groupName: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar {groupName}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>Se borra para siempre, junto con:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>las personas del grupo y sus listas</li>
                <li>el historial</li>
                <li>el resultado del sorteo, si ya lo hicieron</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 aria-hidden="true" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LeaveGroupDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
  groupName,
}: ConfirmProps & { groupName: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Salir de {groupName}?</DialogTitle>
          <DialogDescription>
            Dejarás de ver el grupo. Para volver, necesitarás el link de nuevo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <LogOut aria-hidden="true" />}
            Salir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveMemberDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
  onCancel,
  name,
}: ConfirmProps & { onCancel: () => void; name: string | undefined }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Quitar a {name}?</DialogTitle>
          <DialogDescription>
            Sale del grupo y se borra su lista. Si quiere volver, tendrá que entrar con el link.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <UserMinus aria-hidden="true" />}
            Quitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hand the group over.
export function TransferDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
  name,
}: ConfirmProps & { name: string | undefined }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Pasarle la organización a {name}?</DialogTitle>
          <DialogDescription>
            Podrá editar el grupo, hacer o reiniciar el sorteo y quitar personas. Tú sigues en el
            grupo como participante, y para recuperar la organización tendría que devolvértela.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Crown aria-hidden="true" />}
            Pasar la organización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ResetDrawDialog({ open, onOpenChange, busy, onConfirm }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Reiniciar el sorteo?</DialogTitle>
          <DialogDescription>
            Se borra quién le regala a quién y habrá que sortear de nuevo. Lo que cada persona ya
            vio deja de valer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <RotateCcw aria-hidden="true" />}
            Reiniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface Activity {
  id: string
  type: string
  message: string
  created_at: string
  profiles: { full_name: string | null; avatar_url: string | null }
}

export function ActivityDialog({
  open,
  onOpenChange,
  loading,
  activities,
}: DialogProps & { loading: boolean; activities: Activity[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md">
        <DialogHeader>
          <DialogTitle>Lo que ha pasado</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 max-h-[50vh] overflow-y-auto px-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-faint h-6 w-6 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-graphite py-8 text-center">Todavía no hay nada.</p>
          ) : (
            <ol className="divide-rule divide-y">
              {activities.map((activity) => (
                <li key={activity.id} className="py-3">
                  <p>{activity.message}</p>
                  <p className="text-graphite text-[15px]">
                    {new Date(activity.created_at).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// The new edition's name: the next year if the name has one, otherwise the name plus the year.
function nextName(name: string) {
  const year = new Date().getFullYear()
  const match = name.match(/(19|20)\d{2}/)
  if (match) {
    const next = Math.max(Number(match[0]) + 1, year)
    return name.replace(match[0], String(next))
  }
  return `${name} ${year}`
}

export function RepeatGroupDialog({
  group,
  open,
  onOpenChange,
}: {
  group: { id: string; name: string; budget: number | null; currency: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState(() => nextName(group.name))
  const [date, setDate] = useState('')
  const [budget, setBudget] = useState(group.budget != null ? String(group.budget) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await createClient().rpc('repeat_group', {
      p_group_id: group.id,
      p_name: name.trim(),
      p_exchange_date: date || null,
      p_budget: budget ? Number(budget) : null,
    })
    setBusy(false)
    if (rpcError || !data) return setError(getUserFriendlyError(rpcError ?? { message: '' }))
    toast.success('Grupo creado. Les avisamos a todos.')
    onOpenChange(false)
    router.push(groupPath(data as string))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repetir con las mismas personas</DialogTitle>
          <DialogDescription>
            Creamos un grupo nuevo con el mismo presupuesto, moneda y exclusiones, e invitamos a
            todos los de este. Cada persona decide si participa. Este grupo queda como edición
            anterior.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-5">
          {error && <p className="text-destructive text-[15px]">{error}</p>}
          <div className="grid gap-1.5">
            <label htmlFor="repeat-name" className="text-[15px] font-medium">
              Nombre
            </label>
            <Input
              id="repeat-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="repeat-date" className="text-[15px] font-medium">
                Fecha del intercambio
              </label>
              <Input
                id="repeat-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="repeat-budget" className="text-[15px] font-medium">
                Presupuesto ({group.currency})
              </label>
              <Input
                id="repeat-budget"
                type="number"
                min={0}
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Repeat aria-hidden="true" />}
              Crear e invitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
