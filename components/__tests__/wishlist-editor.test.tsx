import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WishlistEditor } from '@/components/wishlist-editor'

const upsert = vi.fn()
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
const DRAFT = 'fantomio:lista:g1:u1'
const row = (i = 0) => screen.getAllByRole('textbox')[i] as HTMLInputElement
const type = (value: string, i = 0) => fireEvent.change(row(i), { target: { value } })
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('WishlistEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    upsert.mockReset()
    upsert.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps what was typed when the group data is fetched again', () => {
    const { rerender } = render(<WishlistEditor {...props} initialItems={[]} />)
    type('Unos audífonos')

    // A refetch hands the editor a new, equal, empty list.
    rerender(<WishlistEditor {...props} initialItems={[]} />)

    expect(row().value).toBe('Unos audífonos')
    expect(screen.getByText('Sin guardar')).toBeTruthy()
    // Kept because it wasn't replaced, not because it was restored from the draft.
    expect(screen.queryByText(/Recuperamos/)).toBeNull()
  })

  it('brings back an unsaved list after the page reloads', () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Un libro')
    cleanup()

    // Same browser, page loaded again (Edge waking a sleeping tab).
    render(<WishlistEditor {...props} initialItems={[]} />)

    expect(row().value).toBe('Un libro')
    expect(screen.getByText(/Recuperamos lo que habías escrito/)).toBeTruthy()
  })

  it('drops a draft written over a list that was saved again elsewhere', () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Borrador viejo')
    cleanup()

    // Meanwhile another device saved a different list.
    render(<WishlistEditor {...props} initialItems={[{ description: 'Lista nueva' }]} />)

    expect(row().value).toBe('Lista nueva')
    expect(screen.queryByText(/Recuperamos/)).toBeNull()
    expect(window.localStorage.getItem(DRAFT)).toBeNull()
  })

  it('saves with the button right away', async () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Chocolate amargo')
    fireEvent.click(screen.getByRole('button', { name: /Guardar lista/ }))
    await wait(0)

    expect(upsert).toHaveBeenCalledOnce()
    expect(screen.getByText('Guardada')).toBeTruthy()
    expect(window.localStorage.getItem(DRAFT)).toBeNull()
  })

  it('saves by itself 1.5 s after the last change, not before', async () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Una taza')
    await wait(1000)
    type('Una taza grande')
    await wait(1000)
    expect(upsert).not.toHaveBeenCalled()

    await wait(600)
    expect(upsert).toHaveBeenCalledOnce()
    expect(upsert.mock.calls[0][0].items).toEqual([{ description: 'Una taza grande' }])
    expect(screen.getByText('Guardada')).toBeTruthy()
  })

  it('saves again what was typed while a save was on its way', async () => {
    let answer: (v: { error: null }) => void = () => {}
    upsert.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Uno')
    await wait(1600)
    expect(upsert).toHaveBeenCalledTimes(1)

    type('Uno y dos')
    await act(async () => answer({ error: null }))

    // The first answer doesn't mark the newer text as saved, nor drop its draft.
    expect(screen.queryByText('Guardada')).toBeNull()
    expect(window.localStorage.getItem(DRAFT)).not.toBeNull()

    await wait(1600)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[1][0].items).toEqual([{ description: 'Uno y dos' }])
    expect(screen.getByText('Guardada')).toBeTruthy()
  })

  it('backs off after a failed save instead of retrying every 1.5 s', async () => {
    upsert.mockResolvedValue({ error: { message: 'denied' } })
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Una planta')
    await wait(1600)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/No pudimos guardar/)).toBeTruthy()

    await wait(4000)
    expect(upsert).toHaveBeenCalledTimes(1)
    await wait(1100)
    expect(upsert).toHaveBeenCalledTimes(2)

    // A minute later there have been a handful of tries, not forty.
    await wait(60000)
    expect(upsert.mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('saves the other rows and says a link is missing its description', async () => {
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Un libro', 0)
    // The link field shows once the row has text: write, paste the link, then clear the text.
    fireEvent.change(screen.getByLabelText('Deseo 2'), { target: { value: 'Algo' } })
    fireEvent.change(screen.getByLabelText('Link del deseo 2 (opcional)'), {
      target: { value: 'https://ejemplo.cl/algo' },
    })
    fireEvent.change(screen.getByLabelText('Deseo 2'), { target: { value: '' } })
    await wait(1600)

    expect(upsert).toHaveBeenCalledOnce()
    expect(upsert.mock.calls[0][0].items).toEqual([{ description: 'Un libro' }])
    expect(screen.getByText('Falta describir un link')).toBeTruthy()
    expect(window.localStorage.getItem(DRAFT)).not.toBeNull()

    // Nothing new: it doesn't keep saving the same list.
    await wait(10000)
    expect(upsert).toHaveBeenCalledOnce()
  })

  it('waits for the connection and saves when it comes back', async () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    render(<WishlistEditor {...props} initialItems={[]} />)
    type('Un libro')
    await wait(1600)

    expect(screen.getByText(/Sin conexión/)).toBeTruthy()
    expect(upsert).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(DRAFT)).not.toBeNull()

    onLine.mockReturnValue(true)
    fireEvent(window, new Event('online'))
    await wait(0)

    expect(upsert).toHaveBeenCalledOnce()
    expect(screen.getByText('Guardada')).toBeTruthy()
  })

  it('ignores a late refetch with a list it already replaced', async () => {
    const { rerender } = render(<WishlistEditor {...props} initialItems={[]} />)
    type('Versión 1')
    await wait(1600)
    type('Versión 2')
    await wait(1600)
    expect(upsert).toHaveBeenCalledTimes(2)

    // The refetch started after the first save answers now.
    rerender(<WishlistEditor {...props} initialItems={[{ description: 'Versión 1' }]} />)
    expect(row().value).toBe('Versión 2')
  })

  it('shows the saved list when there is no draft', () => {
    render(<WishlistEditor {...props} initialItems={[{ description: 'Una planta' }]} />)
    expect(row().value).toBe('Una planta')
    expect(screen.queryByText(/Recuperamos/)).toBeNull()
  })
})
