/**
 * Explore (Mobile-Explore mockup): the logo, then For you (greeting, Resume, Open late /
 * Under $10, trails) and Friends (what people you follow made or finished), switched
 * by the top tabs. Works signed out, like the website. The mockups' By day tab waits
 * for opening-hours data (we only know whether a place is open late), so no invented times.
 */
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Logo } from '@/components/Logo'
import { TopTabs } from '@/components/TopTabs'
import { ForYouFeed } from '@/features/explore/ForYouFeed'
import { FriendsFeed } from '@/features/explore/FriendsFeed'

const TABS = [
  { value: 'for-you', label: 'For you' },
  { value: 'friends', label: 'Friends' },
] as const

type Tab = (typeof TABS)[number]['value']

/** Matches the lists' side padding. */
const SIDE = 16

export default function ExploreScreen() {
  const [tab, setTab] = useState<Tab>('for-you')
  const header = (
    <View>
      <View style={styles.logo}>
        <Logo />
      </View>
      <TopTabs tabs={TABS} value={tab} onChange={setTab} bleed={SIDE} />
    </View>
  )
  return tab === 'for-you' ? <ForYouFeed header={header} /> : <FriendsFeed header={header} />
}

const styles = StyleSheet.create({
  logo: { paddingTop: 8, paddingBottom: 14 },
})
