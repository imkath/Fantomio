import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WishlistEditor } from '@/components/wishlist-editor'

const upsert = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      upsert,
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      }),
    }),
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const props = { groupId: 'g1', userId: 'u1' }
const firstRow = () => screen.getAllByRole('textbox')[0] as HTMLInputElement

describe('WishlistEditor', () => {
  beforeEach(() => {
    window.localStorage.clear()
    upsert.mockClear()
  })
  afterEach(cleanup)

  it('keeps what was typed when the group data is fetched again', () => {
    const { rerender } = render(<WishlistEditor {...props} initialItems={[]} />)
    fireEvent.change(firstRow(), { target: { value: 'Unos audífonos' } })

    // A refetch hands the editor a new, equal, empty list.
    rerender(<WishlistEditor {...props} initialItems={[]} />)

    expect(firstRow().value).toBe('Unos audífonos')
    expect(screen.getByText('Sin guardar')).toBeTruthy()
    // Kept because it wasn't replaced, not because it was restored from the draft.
    expect(screen.queryByText(/Recuperamos/)).toBeNull()
  })

  it('drops a draft written over a list that was saved again elsewhere', () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    fireEvent.change(firstRow(), { target: { value: 'Borrador viejo' } })
    cleanup()

    // Meanwhile another device saved a different list.
    render(<WishlistEditor {...props} initialItems={[{ description: 'Lista nueva' }]} />)

    expect(firstRow().value).toBe('Lista nueva')
    expect(screen.queryByText(/Recuperamos/)).toBeNull()
    expect(window.localStorage.getItem('fantomio:lista:g1:u1')).toBeNull()
  })

  it('brings back an unsaved list after the page reloads', () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    fireEvent.change(firstRow(), { target: { value: 'Un libro' } })
    cleanup()

    // Same browser, page loaded again (Edge waking a sleeping tab).
    render(<WishlistEditor {...props} initialItems={[]} />)

    expect(firstRow().value).toBe('Un libro')
    expect(screen.getByText(/Recuperamos lo que habías escrito/)).toBeTruthy()
  })

  it('forgets the draft once the list is saved', async () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    fireEvent.change(firstRow(), { target: { value: 'Chocolate amargo' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar lista/ }))
    await screen.findByText('Guardada')

    expect(upsert).toHaveBeenCalledOnce()
    expect(window.localStorage.getItem('fantomio:lista:g1:u1')).toBeNull()
  })

  it('shows the saved list when there is no draft', () => {
    render(<WishlistEditor {...props} initialItems={[{ description: 'Una planta' }]} />)
    expect(firstRow().value).toBe('Una planta')
    expect(screen.queryByText(/Recuperamos/)).toBeNull()
  })
})
