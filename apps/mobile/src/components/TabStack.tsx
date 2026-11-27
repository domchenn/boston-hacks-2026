/**
 * The stack inside one tab: its first screen gets an iOS large title, and screens
 * pushed later (a trail's detail page, from M19) open inside the tab with the tab bar
 * still showing. Each tab folder's _layout.tsx renders one of these.
 */
import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/theme/navigation'

export function TabStack({ title }: { title: string }) {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title, headerLargeTitle: true }} />
    </Stack>
  )
}
