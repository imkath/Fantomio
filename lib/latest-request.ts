// Tells whether an async load is still the latest one. Starting a new load (another group, or
// the same group again) makes every earlier one old, so a slow answer never lands on top of
// what is on screen now.
export function createLatestRequest() {
  let seq = 0
  return {
    start: () => ++seq,
    isLatest: (token: number) => token === seq,
  }
}
