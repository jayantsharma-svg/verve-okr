import { useEffect, useState, useRef } from 'react'
import { Linking } from 'react-native'
import { Stack, Redirect, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryProvider } from '@/lib/query'
import { loadToken, getToken } from '@/lib/api'
import { handleGoogleCallbackUrl } from '@/lib/useGoogleSignIn'

SplashScreen.preventAutoHideAsync()

const GOOGLE_CALLBACK_PATH = 'auth/google-callback'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const router = useRouter()
  const tokenRef = useRef(token)
  tokenRef.current = token

  useEffect(() => {
    loadToken().then(() => {
      setToken(getToken())
      setReady(true)
      SplashScreen.hideAsync()
    })
  }, [])

  // Handle Google OAuth deep-link callback: okrtool://auth/google-callback?token=...
  useEffect(() => {
    function handleUrl(event: { url: string }) {
      const url = event.url
      if (!url.includes(GOOGLE_CALLBACK_PATH)) return

      handleGoogleCallbackUrl(url, {
        onSuccess: () => {
          setToken(getToken())
          router.replace('/(tabs)')
        },
        onError: (msg) => {
          // Navigate to login and show the error via URL param
          router.replace(`/(auth)/login?google_error=${encodeURIComponent(msg)}`)
        },
      })
    }

    // Handle the case where the app was opened from a cold start via the deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    const sub = Linking.addEventListener('url', handleUrl)
    return () => sub.remove()
  }, [router])

  if (!ready) return null

  return (
    <QueryProvider>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {!token && <Redirect href="/(auth)/login" />}
    </QueryProvider>
  )
}
