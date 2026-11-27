/**
 * The bottom tab bar from the style guide (.tabbar): Explore · Map · + · Saved · You on
 * white with a line on top; the active tab is ink and bold, the others muted. The + in
 * the middle is a 54 pt orange circle raised 20 pt that opens Make a trail (not a tab).
 * Same icons as the website's phone tab bar (lucide).
 */
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter, type Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bookmark, Compass, MapIcon, Plus, User, type LucideIcon } from 'lucide-react-native'
import type { ComponentProps } from 'react'
import { colors, fonts, text } from '@/theme/tokens'
import { AppText } from './AppText'

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Explore', icon: Compass },
  map: { label: 'Map', icon: MapIcon },
  saved: { label: 'Saved', icon: Bookmark },
  me: { label: 'You', icon: User },
}

export function TabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const item = (routeName: string, index: number) => {
    const tab = TABS[routeName]
    if (!tab) return null
    const active = state.index === index
    const Icon = tab.icon
    return (
      <Pressable
        key={routeName}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.label}
        onPress={() => {
          if (!active) navigateToTab(state.routes[index]!.key)
        }}
        style={styles.item}
      >
        <Icon size={22} strokeWidth={2} color={active ? colors.ink : colors.muted} />
        <AppText style={[styles.label, active && styles.labelActive]}>{tab.label}</AppText>
      </Pressable>
    )
  }

  const names = state.routes.map((route) => route.name)
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {names.slice(0, 2).map((name, i) => item(name, i))}
      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Make a trail"
          onPress={() => router.push('/make')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Plus size={26} strokeWidth={2.5} color={colors.white} />
        </Pressable>
      </View>
      {names.slice(2).map((name, i) => item(name, i + 2))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  label: { fontFamily: fonts.medium, fontSize: text.xxs, color: colors.muted },
  labelActive: { fontFamily: fonts.bold, color: colors.ink },
  fabSlot: { flex: 1, alignItems: 'center' },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -28,
    backgroundColor: colors.crumbStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { backgroundColor: colors.crumbDeep },
})
