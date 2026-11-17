// Can someone who knows the exclusions work out a pair? A giver's receiver is forced when every
// valid draw gives them the same person. With many exclusions that happens even in big groups,
// and whoever set them (the organizer) would then know that pair. This finds the forced givers
// exactly: one valid draw, then for each giver, whether another valid draw exists without their
// pair in it. It is bipartite matching (augmenting paths), fine for any real group size.

export interface Pair {
  giver: string
  receiver: string
}

function perfectMatching(
  people: string[],
  allowed: Map<string, Set<string>>
): Map<string, string> | null {
  const owner = new Map<string, string>() // receiver -> giver
  const tryGiver = (g: string, seen: Set<string>): boolean => {
    for (const r of allowed.get(g) ?? []) {
      if (seen.has(r)) continue
      seen.add(r)
      const current = owner.get(r)
      if (current === undefined || tryGiver(current, seen)) {
        owner.set(r, g)
        return true
      }
    }
    return false
  }
  for (const g of people) if (!tryGiver(g, new Set())) return null
  const byGiver = new Map<string, string>()
  owner.forEach((g, r) => byGiver.set(g, r))
  return byGiver
}

// Givers whose receiver is the same in every possible draw (empty when nothing can be deduced
// or when no draw is possible at all, which the draw itself reports).
export function forcedGivers(people: string[], excluded: Pair[]): string[] {
  const allowed = new Map<string, Set<string>>()
  for (const g of people) {
    allowed.set(g, new Set(people.filter((r) => r !== g)))
  }
  for (const { giver, receiver } of excluded) allowed.get(giver)?.delete(receiver)

  const draw = perfectMatching(people, allowed)
  if (!draw) return []

  return people.filter((g) => {
    const pair = draw.get(g)!
    const without = new Map(allowed)
    without.set(g, new Set([...allowed.get(g)!].filter((r) => r !== pair)))
    return perfectMatching(people, without) === null
  })
}
