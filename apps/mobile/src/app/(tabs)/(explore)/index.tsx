/**
 * Explore: For you (greeting, Resume, Open late / Under $10, the trail list) and
 * Friends (what people you follow made or finished), switched by the top tabs. Works
 * signed out, like the website. The mockups' By day tab waits for opening-hours data
 * (we only know whether a place is open late) so it never shows invented times.
 */
import { useState } from 'react'
import { TopTabs } from '@/components/TopTabs'
import { ForYouFeed } from '@/features/explore/ForYouFeed'
import { FriendsFeed } from '@/features/explore/FriendsFeed'

const TABS = [
  { value: 'for-you', label: 'For you' },
  { value: 'friends', label: 'Friends' },
] as const

type Tab = (typeof TABS)[number]['value']

export default function ExploreScreen() {
  const [tab, setTab] = useState<Tab>('for-you')
  const header = <TopTabs tabs={TABS} value={tab} onChange={setTab} />
  return tab === 'for-you' ? <ForYouFeed header={header} /> : <FriendsFeed header={header} />
}
