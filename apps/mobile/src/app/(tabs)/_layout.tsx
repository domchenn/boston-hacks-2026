/**
 * The tab bar: Apple's own (UITabBarController through expo-router/native-tabs, Liquid
 * Glass on iOS 26), with Explore · Map · + · Saved · You and SF Symbols icons. The + is
 * a blocked tab whose press opens Make a trail as a modal. Each tab has its own stack.
 */
import { useRouter } from 'expo-router'
import { NativeTabs } from 'expo-router/native-tabs'
import { colors, fonts } from '@/theme/tokens'

export default function TabsLayout() {
  const router = useRouter()

  return (
    <NativeTabs
      tintColor={colors.crumbStrong}
      labelStyle={{ fontFamily: fonts.medium }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="(explore)">
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="new"
        disabled
        accessibilityLabel="Make a trail"
        listeners={{ tabPress: () => router.push('/make') }}
      >
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
        <NativeTabs.Trigger.Label hidden>Make a trail</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} md="bookmark" />
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
