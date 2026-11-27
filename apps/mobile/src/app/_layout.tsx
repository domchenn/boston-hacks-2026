/**
 * Root layout: one stack of screens with Breadcrumb's colours (paper background, ink
 * text, the brand orange for back buttons) and a dark status bar.
 */
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { colors } from '@/theme/tokens'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.crumbStrong,
          headerTitleStyle: { color: colors.ink, fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Explore' }} />
      </Stack>
    </>
  )
}
