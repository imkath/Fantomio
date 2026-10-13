'use client'

import { useState, useEffect } from 'react'
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
import { Check, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

interface WishlistEditorProps {
  groupId: string
  memberId: string
  initialItems?: Array<{ description: string; url?: string }>
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

export function WishlistEditor({ memberId, initialItems = [], onSave }: WishlistEditorProps) {
  const [items, setItems] = useState<LocalWishlistItem[]>([])
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_ITEMS)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<LocalWishlistItem | null>(null)

  // Initialize items from props or create empty slots
  useEffect(() => {
    if (initialItems.length > 0) {
      const mappedItems = initialItems.map((item, index) => ({
        id: `item-${index}`,
        description: item.description || '',
        url: item.url || '',
      }))
      // Pad to default visible items
      while (mappedItems.length < DEFAULT_VISIBLE_ITEMS) {
        mappedItems.push({
          id: `new-${mappedItems.length}`,
          description: '',
          url: '',
        })
      }
      setItems(mappedItems.slice(0, MAX_WISHLIST_ITEMS))
      // Set visible count based on how many items have content
      const filledCount = mappedItems.filter((item) => item.description.trim()).length
      setVisibleCount(Math.max(DEFAULT_VISIBLE_ITEMS, Math.min(filledCount, MAX_WISHLIST_ITEMS)))
    } else {
      // Create default visible items
      const defaultItems = Array.from({ length: DEFAULT_VISIBLE_ITEMS }, (_, i) => ({
        id: `new-${i}`,
        description: '',
        url: '',
      }))
      setItems(defaultItems)
    }
  }, [initialItems])

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
  }

  const handleClearItem = (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, description: '', url: '' } : item)))
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

      const { error: updateError } = await supabase
        .from('members')
        .update({ wishlist: wishlistData })
        .eq('id', memberId)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setLastSaved(new Date())
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
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
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
          {lastSaved && !isSaving && (
            <span className="text-graphite text-[15px]" role="status">
              Guardada
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
