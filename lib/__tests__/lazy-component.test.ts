import { describe, it, expect, vi } from 'vitest'
import { LAZY_LOAD_ERROR, orReloadNotice } from '@/lib/lazy-component'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

describe('orReloadNotice', () => {
  it('passes the component through when it loads', async () => {
    const Comp = () => null
    await expect(orReloadNotice(() => Promise.resolve(Comp))()).resolves.toBe(Comp)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('asks to reload and renders nothing when the chunk fails', async () => {
    const Loaded = await orReloadNotice(() => Promise.reject(new Error('ChunkLoadError')))()
    expect(toastError).toHaveBeenCalledWith(LAZY_LOAD_ERROR)
    expect(Loaded({})).toBeNull()
  })
})
