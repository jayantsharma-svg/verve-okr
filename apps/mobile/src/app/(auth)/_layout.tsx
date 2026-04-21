import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,  // No swipe-back from login
        animation: 'fade',
      }}
    />
  )
}
