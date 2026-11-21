'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/auth-shell'
import { Check, Copy, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react'
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
// The list saves itself this long after the last change, and again when the connection returns.
const AUTOSAVE_MS = 1500
// After a failed save, wait longer each time (5 s, 15 s, 45 s, then every minute) until the
// next change starts over. A save that doesn't answer in time counts as failed.
const retryDelay = (failures: number) =>
  failures === 0 ? AUTOSAVE_MS : Math.min(5000 * 3 ** (failures - 1), 60000)
const SAVE_TIMEOUT_MS = 15000
const withTimeout = <T,>(promise: PromiseLike<T>, ms: number) =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms)
    ),
  ])

// A row with a link and no description isn't saved until it says what it is.
const isLoose = (item: { description: string; url: string }) =>
  !!item.url.trim() && !item.description.trim()

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
    toast.success('Copiamos tu lista anterior.')
  }
  const [items, setItems] = useState<LocalWishlistItem[]>([])
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_ITEMS)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')
  // Rows added here get ids that never repeat, so removing one doesn't mix up the others.
  const rowSeq = useRef(0)
  const newRow = (): LocalWishlistItem => ({
    id: `row-${++rowSeq.current}`,
    description: '',
    url: '',
  })
  // Changes not saved yet. The ref is read by the effect below without re-running it.
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const markDirty = (value: boolean) => {
    dirtyRef.current = value
    setDirty(value)
    // A new change starts the retries over.
    if (value) setFailures(0)
  }
  const [restored, setRestored] = useState(false)
  // Autosave reads the rows through refs: it runs from timers and from the 'online' event.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  const savingRef = useRef(false)
  const [retry, setRetry] = useState(0)
  const [offline, setOffline] = useState(false)
  const [failures, setFailures] = useState(0)
  // Every list this editor has saved: a refetch that answers late with one of these, once a
  // newer one was saved, is old and is ignored.
  const sentRef = useRef(new Set<string>())
  const key = draftKey(groupId, userId)
  // The saved list the current edits started from.
  const baseRef = useRef(contentOf(initialItems))

  // Initialize items from the saved list, or from a draft this browser kept. Unsaved changes
  // are never replaced: the group's data is fetched again after many actions.
  useEffect(() => {
    if (dirtyRef.current) return
    const saved = contentOf(initialItems)
    if (sentRef.current.has(saved) && saved !== baseRef.current) return
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
    // Same list as on screen (it was just saved): keep the rows, so nothing jumps while typing.
    if (itemsRef.current.length > 0 && contentOf(itemsRef.current) === saved) return
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

  // Removes the whole row. An empty one just goes; a written one can be brought back from the
  // toast, which is quicker than confirming first.
  const handleRemoveItem = (id: string) => {
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return
    const removed = items[index]
    const rest = items.filter((item) => item.id !== id)
    const nextVisible = Math.max(DEFAULT_VISIBLE_ITEMS, visibleCount - 1)
    while (rest.length < nextVisible) rest.push(newRow())
    setItems(rest)
    setVisibleCount(nextVisible)
    if (!removed.description.trim() && !removed.url.trim()) return
    markDirty(true)
    toast(`Borraste «${removed.description.trim() || removed.url.trim()}»`, {
      action: {
        label: 'Deshacer',
        onClick: () => {
          const back = [...itemsRef.current]
          back.splice(Math.min(index, back.length), 0, removed)
          // Keep within the limit by dropping an empty row, never a written one.
          if (back.length > MAX_WISHLIST_ITEMS) {
            const empty = back.findLastIndex((item) => !item.description.trim() && !item.url.trim())
            if (empty >= 0) back.splice(empty, 1)
          }
          setItems(back.slice(0, MAX_WISHLIST_ITEMS))
          setVisibleCount((n) => Math.min(n + 1, MAX_WISHLIST_ITEMS))
          markDirty(true)
        },
      },
    })
  }

  const handleAddMoreItems = () => {
    const newVisibleCount = Math.min(visibleCount + 1, MAX_WISHLIST_ITEMS)
    setVisibleCount(newVisibleCount)

    // If we need more items in the array, add them
    if (items.length < newVisibleCount) {
      const newItems = [...items]
      while (newItems.length < newVisibleCount) {
        newItems.push(newRow())
      }
      setItems(newItems)
    }
  }

  // Saves the rows on screen. Autosave stays quiet; the button shows errors and a toast.
  const save = async (manual: boolean) => {
    if (savingRef.current) return
    const snapshot = itemsRef.current
    const loose = snapshot.some(isLoose)
    if (manual && loose) {
      setError('Si pegas un link, escribe también qué es.')
      return
    }
    if (!manual && typeof navigator !== 'undefined' && !navigator.onLine) {
      setOffline(true)
      return
    }
    savingRef.current = true
    setIsSaving(true)
    if (manual) setError('')
    const sent = contentOf(snapshot)
    let saved = false

    try {
      const wishlistData = snapshot
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          url: item.url.trim() || undefined,
        }))

      // Lists live in their own table: only you and, after the draw, your giver can read them.
      const { error: updateError } = await withTimeout(
        createClient()
          .from('wishlists')
          .upsert({ group_id: groupId, user_id: userId, items: wishlistData }),
        SAVE_TIMEOUT_MS
      )

      if (updateError) {
        setFailures((n) => n + 1)
        if (manual) setError(getUserFriendlyError(updateError))
        return
      }

      saved = true
      setLastSaved(new Date())
      setOffline(false)
      setFailures(0)
      setError('')
      sentRef.current.add(sent)
      baseRef.current = sent
      // Only what was sent is saved: anything typed meanwhile, or a link still without its
      // description, stays pending.
      if (contentOf(itemsRef.current) === sent && !loose) {
        markDirty(false)
        setRestored(false)
        clearDraft(key)
      }
      if (manual) {
        toast.success('Lista guardada')
        setVisibleCount(visibleFor(snapshot))
      }
      onSave?.()
    } catch {
      setFailures((n) => n + 1)
      if (typeof navigator !== 'undefined' && !navigator.onLine) setOffline(true)
      if (manual) setError('No pudimos guardar. Revisa tu internet e intenta de nuevo.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
      // Changes typed during this save get their own. A failure waits for the retry timer.
      if (saved && contentOf(itemsRef.current) !== sent) setRetry((n) => n + 1)
    }
  }

  const handleSave = () => save(true)
  // Timers and the 'online' event call the latest save, not the one from when they started.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    if (!dirty) return
    // Nothing new to send: only the link without description is pending.
    if (failures === 0 && contentOf(items) === baseRef.current) return
    const timer = window.setTimeout(() => void saveRef.current(false), retryDelay(failures))
    return () => window.clearTimeout(timer)
  }, [items, dirty, retry, failures])

  useEffect(() => {
    const back = () => {
      setOffline(false)
      setFailures(0)
      if (dirtyRef.current) void saveRef.current(false)
    }
    window.addEventListener('online', back)
    return () => window.removeEventListener('online', back)
  }, [])

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
            Hasta 10 cosas que te gustaría recibir. Solo la ve quien te regala, y se guarda sola.
          </p>
        </div>
        <span className="text-graphite shrink-0 pt-1 text-[15px]">
          {filledItemsCount}/{MAX_WISHLIST_ITEMS}
        </span>
      </div>

      {error && <Notice>{error}</Notice>}

      {restored && dirty && (
        <div className="bg-slip rounded-[3px] px-4 py-3 text-[15px]" role="status">
          Recuperamos lo que habías escrito y no alcanzó a guardarse.
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
                />
                <span className="flex w-11 shrink-0 justify-end sm:w-20">
                  {item.description || item.url ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Borrar deseo ${index + 1}`}
                      title="Borrar"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  ) : (
                    index >= DEFAULT_VISIBLE_ITEMS && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label={`Quitar línea ${index + 1}`}
                        title="Quitar línea"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )
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
          {(isSaving || dirty || lastSaved) && (
            <span className="text-graphite text-[15px]" role="status">
              {isSaving
                ? 'Guardando…'
                : !dirty
                  ? 'Guardada'
                  : offline
                    ? 'Sin conexión: se guarda al volver'
                    : failures > 0
                      ? 'No pudimos guardar, lo reintentamos'
                      : items.some(isLoose)
                        ? 'Falta describir un link'
                        : 'Sin guardar'}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Check aria-hidden="true" />}
            {isSaving ? 'Guardando…' : 'Guardar lista'}
          </Button>
        </div>
      </div>
    </div>
  )
}
