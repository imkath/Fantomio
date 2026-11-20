'use client'

import { useState, useEffect, useRef } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/auth-shell'
import { Check, Copy, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { toast } from 'sonner'

interface WishlistEditorProps {
  groupId: string
  userId: string
  initialItems?: Array<{ description: string; url?: string }>
  // Earlier edition of this group: offers to bring over the list written there.
  previousGroupId?: string | null
  onSave?: () => void
}

interface LocalWishlistItem {
  id: string
  description: string
  url: string
}

// One example per row, so an empty list gives ideas without feeling like a form.
const PLACEHOLDERS = [
  'Unos audífonos inalámbricos',
  'Un libro que tengas ganas de leer',
  'Una polera negra, talla M',
  'Una planta que aguante poca luz',
  'Chocolate amargo, siempre funciona',
  'Entradas para un concierto',
  'Un juego de mesa para jugar en familia',
  'Algo para cuidarme: cremas, sales de baño',
  'Una taza grande para té',
  'Sorpréndeme',
]

const MAX_WISHLIST_ITEMS = 10
const DEFAULT_VISIBLE_ITEMS = 5

// What's being written is kept as a draft in this browser until it's saved, together with the
// saved list it started from: if that list changed since (saved from another device), the
// draft is old and is dropped. Without it, a list
// that wasn't saved yet was lost when the page reloaded (Edge puts background tabs to sleep and
// reloads them on return) or when the group's data was fetched again.
const draftKey = (groupId: string, userId: string) => `fantomio:lista:${groupId}:${userId}`

interface Draft {
  items: LocalWishlistItem[]
  base: string
}

const readDraft = (key: string): Draft | null => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Draft | null
    return parsed && Array.isArray(parsed.items) && typeof parsed.base === 'string' ? parsed : null
  } catch {
    return null
  }
}

const writeDraft = (key: string, draft: Draft) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Private mode or full storage: the list still works, it just isn't kept on reload.
  }
}

const clearDraft = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to clear.
  }
}

// Only what was written counts: empty rows and their order of creation don't.
const contentOf = (list: Array<{ description?: string; url?: string }>) =>
  JSON.stringify(
    list
      .filter((item) => (item.description ?? '').trim())
      .map((item) => [(item.description ?? '').trim(), (item.url ?? '').trim()])
  )

// Rows for the form: the given ones plus empty ones up to the default.
const toRows = (list: Array<{ description?: string; url?: string }>): LocalWishlistItem[] => {
  const rows = list.slice(0, MAX_WISHLIST_ITEMS).map((item, index) => ({
    id: `item-${index}`,
    description: item.description || '',
    url: item.url || '',
  }))
  while (rows.length < DEFAULT_VISIBLE_ITEMS)
    rows.push({ id: `new-${rows.length}`, description: '', url: '' })
  return rows
}

const visibleFor = (rows: LocalWishlistItem[]) =>
  Math.max(
    DEFAULT_VISIBLE_ITEMS,
    Math.min(rows.filter((item) => item.description.trim()).length, MAX_WISHLIST_ITEMS)
  )

export function WishlistEditor({
  groupId,
  userId,
  initialItems = [],
  previousGroupId = null,
  onSave,
}: WishlistEditorProps) {
  const [previousItems, setPreviousItems] = useState<Array<{ description: string; url?: string }>>(
    []
  )
  useEffect(() => {
    if (!previousGroupId || initialItems.length > 0) return
    let cancelled = false
    createClient()
      .from('wishlists')
      .select('items')
      .eq('group_id', previousGroupId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPreviousItems((data?.items ?? []) as typeof previousItems)
      })
    return () => {
      cancelled = true
    }
  }, [previousGroupId, userId, initialItems.length])

  // Fills the form with last time's list; nothing is saved until "Guardar".
  const copyPrevious = () => {
    const copied = previousItems.slice(0, MAX_WISHLIST_ITEMS).map((item, index) => ({
      id: `prev-${index}`,
      description: item.description || '',
      url: item.url || '',
    }))
    while (copied.length < DEFAULT_VISIBLE_ITEMS)
      copied.push({ id: `new-${copied.length}`, description: '', url: '' })
    setItems(copied)
    markDirty(true)
    setVisibleCount(Math.max(DEFAULT_VISIBLE_ITEMS, previousItems.length))
    setPreviousItems([])
    toast.success('Copiamos tu lista anterior. Revísala y guárdala.')
  }
  const [items, setItems] = useState<LocalWishlistItem[]>([])
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_ITEMS)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<LocalWishlistItem | null>(null)
  // Changes not saved yet. The ref is read by the effect below without re-running it.
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const markDirty = (value: boolean) => {
    dirtyRef.current = value
    setDirty(value)
  }
  const [restored, setRestored] = useState(false)
  const key = draftKey(groupId, userId)
  // The saved list the current edits started from.
  const baseRef = useRef(contentOf(initialItems))

  // Initialize items from the saved list, or from a draft this browser kept. Unsaved changes
  // are never replaced: the group's data is fetched again after many actions.
  useEffect(() => {
    if (dirtyRef.current) return
    const saved = contentOf(initialItems)
    baseRef.current = saved
    const draft = readDraft(key)
    if (draft && draft.base === saved && contentOf(draft.items) !== saved) {
      const rows = toRows(draft.items)
      setItems(rows)
      setVisibleCount(visibleFor(rows))
      markDirty(true)
      setRestored(true)
      return
    }
    if (draft) clearDraft(key)
    const rows = toRows(initialItems)
    setItems(rows)
    setVisibleCount(visibleFor(rows))
  }, [initialItems, key])

  useEffect(() => {
    if (dirty) writeDraft(key, { items, base: baseRef.current })
  }, [dirty, items, key])

  // Closing or reloading the tab with changes not saved asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Extract URL from text that might contain extra words
  const extractUrl = (text: string): string => {
    const urlPattern =
      /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}[^\s]*/gi
    const matches = text.match(urlPattern)
    if (matches && matches.length > 0) {
      let url = matches[0]
      // Remove trailing punctuation that's not part of URL
      url = url.replace(/[.,;:!?)>\]]+$/, '')
      return url
    }
    return text
  }

  const handleItemChange = (id: string, field: keyof LocalWishlistItem, value: string) => {
    // If changing URL field, extract the URL from text that might contain extra words
    const processedValue = field === 'url' ? extractUrl(value) : value
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: processedValue } : item)))
    markDirty(true)
  }

  const handleClearItem = (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, description: '', url: '' } : item)))
    markDirty(true)
  }

  const handleAddMoreItems = () => {
    const newVisibleCount = Math.min(visibleCount + 1, MAX_WISHLIST_ITEMS)
    setVisibleCount(newVisibleCount)

    // If we need more items in the array, add them
    if (items.length < newVisibleCount) {
      const newItems = [...items]
      while (newItems.length < newVisibleCount) {
        newItems.push({
          id: `new-${newItems.length}`,
          description: '',
          url: '',
        })
      }
      setItems(newItems)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')

    // Validate: at least check for empty descriptions on items with URLs
    const invalidItems = items.filter((item) => item.url && !item.description.trim())
    if (invalidItems.length > 0) {
      setError('Si pegas un link, escribe también qué es.')
      setIsSaving(false)
      return
    }

    try {
      const supabase = createClient()

      const wishlistData = items
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          url: item.url.trim() || undefined,
        }))

      // Lists live in their own table: only you and, after the draw, your giver can read them.
      const { error: updateError } = await supabase
        .from('wishlists')
        .upsert({ group_id: groupId, user_id: userId, items: wishlistData })

      if (updateError) {
        setError(getUserFriendlyError(updateError))
        return
      }

      setLastSaved(new Date())
      markDirty(false)
      setRestored(false)
      clearDraft(key)
      toast.success('Lista guardada')

      // Adjust visible count to match filled items (minimum 5)
      const filledCount = items.filter((item) => item.description.trim()).length
      const newVisibleCount = Math.max(DEFAULT_VISIBLE_ITEMS, filledCount)
      setVisibleCount(newVisibleCount)

      if (onSave) {
        onSave()
      }
    } catch {
      setError('No pudimos guardar. Revisa tu internet e intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const isValidUrl = (url?: string) => {
    if (!url || !url.trim()) return false
    try {
      // Add https:// if missing for validation
      const urlToCheck = url.startsWith('http') ? url : `https://${url}`
      new URL(urlToCheck)
      return true
    } catch {
      return false
    }
  }

  const normalizeUrl = (url: string) => {
    return url.startsWith('http') ? url : `https://${url}`
  }

  const filledItemsCount = items.filter((item) => item.description.trim()).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Tu lista</h2>
          <p className="text-graphite text-[15px]">
            Hasta 10 cosas que te gustaría recibir. Solo la ve quien te regala.
          </p>
        </div>
        <span className="text-graphite shrink-0 pt-1 text-[15px]">
          {filledItemsCount}/{MAX_WISHLIST_ITEMS}
        </span>
      </div>

      {error && <Notice>{error}</Notice>}

      {restored && dirty && (
        <div className="bg-slip rounded-[3px] px-4 py-3 text-[15px]" role="status">
          Recuperamos lo que habías escrito y todavía no guardabas. Revísalo y guarda la lista.
        </div>
      )}

      {previousItems.length > 0 && filledItemsCount === 0 && (
        <div className="bg-slip flex flex-col gap-3 rounded-[3px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px]">
            La vez anterior anotaste {previousItems.length}{' '}
            {previousItems.length === 1 ? 'cosa' : 'cosas'}. ¿Partes desde esa lista?
          </p>
          <Button type="button" variant="outline" size="sm" onClick={copyPrevious}>
            <Copy aria-hidden="true" />
            Copiar mi lista anterior
          </Button>
        </div>
      )}

      <ol className="space-y-4">
        {items.slice(0, visibleCount).map((item, index) => (
          <li key={item.id} className="grid grid-cols-[28px_1fr] gap-x-3 gap-y-2">
            <span className="text-graphite pt-2.5 text-[15px]" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="grid gap-2">
              <div className="flex gap-2">
                <Input
                  aria-label={`Deseo ${index + 1}`}
                  placeholder={PLACEHOLDERS[index]}
                  value={item.description}
                  maxLength={1000}
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  disabled={isSaving}
                />
                <span className="flex w-11 shrink-0 justify-end sm:w-20">
                  {(item.description || item.url) && (
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      onClick={() => setToDelete(item)}
                      aria-label={`Borrar deseo ${index + 1}`}
                      title="Borrar"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </span>
              </div>
              {(item.description || item.url) && (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Link del deseo ${index + 1} (opcional)`}
                    placeholder="Link, si tienes uno (opcional)"
                    value={item.url}
                    maxLength={2048}
                    onChange={(e) => handleItemChange(item.id, 'url', e.target.value)}
                    disabled={isSaving}
                    className="h-10 text-[15px]"
                  />
                  <span className="flex shrink-0 justify-end sm:w-20">
                    {isValidUrl(item.url) && (
                      <a
                        href={normalizeUrl(item.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink hover:text-hanko inline-flex items-center gap-1.5 text-[15px] underline underline-offset-[3px]"
                      >
                        Abrir
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    )}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {visibleCount < MAX_WISHLIST_ITEMS ? (
          <Button type="button" variant="outline" size="sm" onClick={handleAddMoreItems}>
            <Plus aria-hidden="true" />
            Agregar otra línea
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          {!isSaving && (dirty || lastSaved) && (
            <span className="text-graphite text-[15px]" role="status">
              {dirty ? 'Sin guardar' : 'Guardada'}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Check aria-hidden="true" />}
            {isSaving ? 'Guardando…' : 'Guardar lista'}
          </Button>
        </div>
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este deseo?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.description ? `"${toDelete.description}" se quitará de tu lista. ` : ''}
              Recuerda apretar "Guardar lista" para que quede así.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => toDelete && handleClearItem(toDelete.id)}
            >
              <Trash2 aria-hidden="true" />
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
