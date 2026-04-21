/**
 * Singleton API client for the web app.
 * Token is read from localStorage (set after login/refresh).
 */
import { createApiClient } from '@okr-tool/core'

export const api = createApiClient({
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
  getToken: () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('okr_access_token')
  },
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('okr_access_token')
      window.location.href = '/login'
    }
  },
})
