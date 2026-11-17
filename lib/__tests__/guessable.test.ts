import { describe, expect, it } from 'vitest'
import { forcedGivers } from '@/lib/guessable'

const people = ['ana', 'tomas', 'javi', 'luis', 'carmen']

describe('forcedGivers', () => {
  it('finds nothing to deduce without exclusions', () => {
    expect(forcedGivers(people, [])).toEqual([])
  })

  it('finds nothing with the usual couple exclusion', () => {
    expect(
      forcedGivers(people, [
        { giver: 'ana', receiver: 'tomas' },
        { giver: 'tomas', receiver: 'ana' },
      ])
    ).toEqual([])
  })

  it('flags a giver left with a single possible receiver', () => {
    const ex = ['tomas', 'javi', 'luis'].map((r) => ({ giver: 'ana', receiver: r }))
    expect(forcedGivers(people, ex)).toContain('ana')
  })

  it('flags pairs forced indirectly, not only by counting', () => {
    // Nobody but ana may give to carmen: ana's receiver is fixed although ana has 4 options.
    const ex = ['tomas', 'javi', 'luis'].map((g) => ({ giver: g, receiver: 'carmen' }))
    expect(forcedGivers(people, ex)).toContain('ana')
  })

  it('flags everyone when the exclusions leave a single draw', () => {
    const order = ['ana', 'tomas', 'javi', 'luis', 'carmen']
    const ex = order.flatMap((g, i) =>
      order
        .filter((r) => r !== g && r !== order[(i + 1) % order.length])
        .map((r) => ({ giver: g, receiver: r }))
    )
    expect(forcedGivers(order, ex).sort()).toEqual([...order].sort())
  })

  it('returns nothing when no draw is possible (the draw reports that)', () => {
    const ex = people.filter((r) => r !== 'ana').map((r) => ({ giver: 'ana', receiver: r }))
    expect(forcedGivers(people, ex)).toEqual([])
  })
})
