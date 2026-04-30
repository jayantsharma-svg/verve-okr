'use client'

import { useEffect, useState } from 'react'

/**
 * Reads the access token from localStorage on mount.
 * - If missing  → hard-redirects to /login (no flash of protected UI)
 * - If present  → returns true so the layout can render
 */
export function useAuthGuard(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('okr_access_token')) {
      setReady(true)
    } else {
      window.location.replace('/login')
    }
  }, [])

  return ready
}
