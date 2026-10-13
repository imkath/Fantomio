'use client'

import { useEffect, useState } from 'react'

const EMPTY = new URLSearchParams()

// The URL's query, read after mount. Unlike useSearchParams it needs no Suspense boundary,
// so a static page ships its real content in the HTML instead of a fallback spinner.
export function useQuery() {
  const [query, setQuery] = useState(EMPTY)
  useEffect(() => setQuery(new URLSearchParams(window.location.search)), [])
  return query
}
