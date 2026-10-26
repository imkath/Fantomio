'use client'

import { useRef, useState } from 'react'
import { ImageUp, Loader2, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Notice } from '@/components/auth-shell'
import { GhostAvatar } from '@/components/ghost-avatar'
import { AccountSection, Setting } from '@/components/account/section'
import { PROFILE_UPDATED } from '@/components/app-header'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { AvatarError, squareAvatar } from '@/lib/resize-image'

const BUCKET = 'avatars'

// Removes every file in the person's folder; used before uploading a new photo and when
// they go back to the ghost or to the Google photo, so old pictures don't linger.
export async function clearAvatarFiles(userId: string) {
  const storage = createClient().storage.from(BUCKET)
  const { data } = await storage.list(userId)
  if (data?.length) await storage.remove(data.map((f) => `${userId}/${f.name}`))
}

export function ProfileSection({
  userId,
  name,
  avatarUrl,
  googleAvatar,
  onChange,
}: {
  userId: string
  name: string
  avatarUrl: string | null
  googleAvatar: string | null
  onChange: () => void
}) {
  const [fullName, setFullName] = useState(name)
  const [savingName, setSavingName] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const updated = () => {
    window.dispatchEvent(new Event(PROFILE_UPDATED))
    onChange()
  }

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = fullName.trim().replace(/\s+/g, ' ')
    if (value.length < 2) return setError('Escribe tu nombre, al menos 2 letras.')
    setSavingName(true)
    setError('')
    const { error: dbError } = await createClient()
      .from('profiles')
      .update({ full_name: value })
      .eq('id', userId)
    setSavingName(false)
    if (dbError) return setError(getUserFriendlyError(dbError))
    toast.success('Nombre guardado')
    updated()
  }

  const setAvatar = async (url: string | null) => {
    const { error: dbError } = await createClient()
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId)
    if (dbError) throw dbError
  }

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setError('Elige una imagen (JPG, PNG o WebP).')
    if (file.size > 15 * 1024 * 1024) return setError('Esa imagen pesa demasiado. Prueba con otra.')
    setPhotoBusy(true)
    setError('')
    try {
      const blob = await squareAvatar(file)
      await clearAvatarFiles(userId)
      // A new name each time, so browsers and the CDN don't keep showing the old photo.
      const path = `${userId}/${Date.now()}.webp`
      const storage = createClient().storage.from(BUCKET)
      const { error: upError } = await storage.upload(path, blob, {
        contentType: 'image/webp',
        upsert: false,
      })
      if (upError) throw upError
      await setAvatar(storage.getPublicUrl(path).data.publicUrl)
      toast.success('Foto actualizada')
      updated()
    } catch (err) {
      setError(
        err instanceof AvatarError ? err.message : getUserFriendlyError(err as { message?: string })
      )
    } finally {
      setPhotoBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const choose = async (url: string | null, message: string) => {
    setPhotoBusy(true)
    setError('')
    try {
      await setAvatar(url)
      await clearAvatarFiles(userId)
      toast.success(message)
      updated()
    } catch (err) {
      setError(getUserFriendlyError(err as { message?: string }))
    } finally {
      setPhotoBusy(false)
    }
  }

  const usingGoogle = !!googleAvatar && avatarUrl === googleAvatar

  return (
    <AccountSection id="perfil" title="Perfil" lede="Así te ve tu grupo.">
      {error && <Notice>{error}</Notice>}

      <Setting title="Foto" hint="Si no pones una, te mostramos un fantasma con tu propio color.">
        <div className="flex flex-wrap items-center gap-5">
          <GhostAvatar seed={userId} src={avatarUrl ?? undefined} size={88} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Elegir una foto"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button
              variant="outline"
              disabled={photoBusy}
              onClick={() => fileInput.current?.click()}
            >
              {photoBusy ? <Loader2 className="animate-spin" /> : <ImageUp aria-hidden="true" />}
              Subir foto
            </Button>
            {googleAvatar && !usingGoogle && (
              <Button
                variant="outline"
                disabled={photoBusy}
                onClick={() => choose(googleAvatar, 'Ahora usas tu foto de Google')}
              >
                Usar la de Google
              </Button>
            )}
            {avatarUrl && (
              <Button
                variant="danger"
                disabled={photoBusy}
                onClick={() => choose(null, 'Foto quitada')}
              >
                <Trash2 aria-hidden="true" />
                Quitar foto
              </Button>
            )}
          </div>
        </div>
      </Setting>

      <Setting title="Nombre" hint="Como aparece en los grupos y en los correos de aviso.">
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field
              label="Tu nombre"
              autoComplete="name"
              maxLength={60}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={savingName || fullName.trim() === name.trim()}
          >
            {savingName ? <Loader2 className="animate-spin" /> : <Save aria-hidden="true" />}
            Guardar
          </Button>
        </form>
      </Setting>
    </AccountSection>
  )
}
