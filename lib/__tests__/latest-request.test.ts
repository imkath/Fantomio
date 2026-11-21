import { describe, it, expect } from 'vitest'
import { createLatestRequest } from '@/lib/latest-request'

describe('createLatestRequest', () => {
  it('drops the answer for a group left behind', () => {
    const requests = createLatestRequest()
    const groupA = requests.start()
    const groupB = requests.start()
    expect(requests.isLatest(groupA)).toBe(false)
    expect(requests.isLatest(groupB)).toBe(true)
  })

  it('drops an earlier load of the same group once a newer one starts', () => {
    const requests = createLatestRequest()
    const first = requests.start()
    expect(requests.isLatest(first)).toBe(true)
    const second = requests.start()
    expect(requests.isLatest(first)).toBe(false)
    expect(requests.isLatest(second)).toBe(true)
  })
})
