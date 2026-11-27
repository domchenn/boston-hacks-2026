/**
 * The four tabs (Explore, Map, Saved, You) with the style guide's tab bar (TabBar,
 * which also holds the + for Make a trail). Each tab has its own header in the app's
 * colours.
 */
import { Tabs } from 'expo-router'
import { TabBar } from '@/components/TabBar'
import { colors, fonts } from '@/theme/tokens'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTitleStyle: { color: colors.ink, fontFamily: fonts.bold },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="me" options={{ title: 'You' }} />
    </Tabs>
  )
}
