'use client'

import { useState } from 'react'

// True from the first time `open` is true. A lazily loaded dialog mounts then (which is when
// its code downloads) and stays mounted, so it can play its closing animation.
export function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened || open
}
