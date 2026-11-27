/**
 * Root layout: loads Inter (the splash screen stays up until it's ready), provides the
 * signed-in session to every screen, and stacks the tabs with the screens that open
 * over them: a trail's page, the active trail, Log in, Choose a username (onboarding) and Make a trail. New accounts
 * without a username are sent to onboarding, as on the website.
 */
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter'
import { SessionProvider, useSession } from '@/lib/session'
import { stackScreenOptions } from '@/theme/navigation'

void SplashScreen.preventAutoHideAsync()

/** Sends a signed-in person without a username to onboarding (once their profile has loaded). */
function OnboardingGate() {
  const { session, profile } = useSession()
  const segments = useSegments()
  const router = useRouter()
  const needsUsername = Boolean(session && profile && !profile.username)
  const onOnboarding = segments[0] === 'onboarding'
  useEffect(() => {
    if (needsUsername && !onOnboarding) router.push('/onboarding')
  }, [needsUsername, onOnboarding, router])
  return null
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold })

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <OnboardingGate />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]/go" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="trail/[id]/rate" options={{ presentation: 'modal', title: 'Rate trail' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: 'Log in' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal', title: 'Your profile', gestureEnabled: false }} />
        <Stack.Screen name="make" options={{ presentation: 'modal', title: 'Make a trail' }} />
      </Stack>
    </SessionProvider>
  )
}
