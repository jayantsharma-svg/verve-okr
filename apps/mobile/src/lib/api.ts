import { createApiClient } from '@okr-tool/core'
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'okr_access_token'
let _tokenCache: string | null = null

export async function loadToken(): Promise<void> {
  _tokenCache = await SecureStore.getItemAsync(TOKEN_KEY)
}

export async function saveToken(token: string): Promise<void> {
  _tokenCache = token
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void> {
  _tokenCache = null
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export function getToken(): string | null {
  return _tokenCache
}

export const api = createApiClient({
  baseUrl: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001',
  getToken: () => _tokenCache,
  onUnauthorized: () => {
    _tokenCache = null
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
    // Navigation is handled reactively by the root layout watching token state
  },
})
