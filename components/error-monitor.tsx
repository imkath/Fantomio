'use client'

import { useEffect } from 'react'
import { startErrorMonitoring } from '@/lib/monitoring'

export function ErrorMonitor() {
  useEffect(startErrorMonitoring, [])
  return null
}
