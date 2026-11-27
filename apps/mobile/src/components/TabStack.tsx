/**
 * The stack inside one tab: its first screen gets an iOS large title (screens that
 * belong to the tab, like settings under You, can be added to it later). Each tab
 * folder's _layout.tsx renders one of these.
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
