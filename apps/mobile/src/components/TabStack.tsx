/**
 * The stack inside one tab: its first screen gets an iOS large title (screens that
 * belong to the tab, like settings under You, can be added to it later). Each tab
 * folder's _layout.tsx renders one of these.
 */
import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/theme/navigation'

/** `header={false}` for tabs that draw their own header (Explore's logo row, Saved's "Your trails"). */
export function TabStack({ title, header = true }: { title: string; header?: boolean }) {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title, headerLargeTitle: true, headerShown: header }} />
    </Stack>
  )
}
