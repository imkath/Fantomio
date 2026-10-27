'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, LogOut, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Notice } from '@/components/auth-shell'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AccountSection, Setting } from '@/components/account/section'
import { clearAvatarFiles } from '@/components/account/profile-section'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'

export function DataSection({
  userId,
  email,
  drawnGroups,
}: {
  userId: string
  email: string
  drawnGroups: string[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'everywhere' | 'export' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const signOutEverywhere = async () => {
    setBusy('everywhere')
    await createClient().auth.signOut({ scope: 'global' })
    router.push('/login')
  }

  const download = async () => {
    setBusy('export')
    setError('')
    const { data, error: rpcError } = await createClient().rpc('export_my_data')
    setBusy(null)
    if (rpcError) return setError(getUserFriendlyError(rpcError))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `fantomio-mis-datos-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const deleteAccount = async () => {
    setBusy('delete')
    setDeleteError('')
    const supabase = createClient()
    // Photos live in storage, outside the database: remove them first.
    await clearAvatarFiles(userId).catch(() => {})
    const { error: rpcError } = await supabase.rpc('delete_my_account')
    if (rpcError) {
      setDeleteError(getUserFriendlyError(rpcError))
      setBusy(null)
      return
    }
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/login?cuenta=eliminada')
  }

  return (
    <AccountSection id="datos" title="Seguridad y datos">
      {error && <Notice>{error}</Notice>}

      <Setting
        title="Sesiones"
        hint="Si entraste desde un computador que no es tuyo, cierra la sesión en todas partes."
      >
        <Button variant="outline" disabled={!!busy} onClick={signOutEverywhere}>
          {busy === 'everywhere' ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          Cerrar en todas partes
        </Button>
      </Setting>

      <Setting
        title="Tus datos"
        hint="Un archivo con tu cuenta, tus grupos, tus listas, a quién le regalas y los mensajes que enviaste."
      >
        <Button variant="outline" disabled={!!busy} onClick={download}>
          {busy === 'export' ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Download aria-hidden="true" />
          )}
          Descargar mis datos
        </Button>
      </Setting>

      <Setting
        title="Eliminar mi cuenta"
        hint="Se borran tu perfil, tus listas, tus mensajes y tu lugar en cada grupo. No se puede deshacer."
      >
        <Button variant="danger" disabled={!!busy} onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden="true" />
          Eliminar mi cuenta
        </Button>
      </Setting>

      <Dialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open)
          if (!open) {
            setConfirmEmail('')
            setDeleteError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
            <DialogDescription>
              Se borra todo lo tuyo en Fantomio y no se puede recuperar. Si organizas grupos con más
              personas, primero pásale la organización a alguien o elimina esos grupos.
            </DialogDescription>
          </DialogHeader>
          {drawnGroups.length > 0 && (
            <Notice>
              Ya hay sorteo en {drawnGroups.join(', ')}. Si te vas, quien te regala se queda sin a
              quién regalarle y quien organiza tendrá que reiniciar el sorteo.
            </Notice>
          )}
          {deleteError && <Notice>{deleteError}</Notice>}
          <Field
            label={`Para confirmar, escribe tu correo (${email})`}
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={
                busy === 'delete' || confirmEmail.trim().toLowerCase() !== email.toLowerCase()
              }
              onClick={deleteAccount}
            >
              {busy === 'delete' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Eliminar para siempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountSection>
  )
}
