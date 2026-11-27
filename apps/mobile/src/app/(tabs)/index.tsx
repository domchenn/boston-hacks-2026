/**
 * Explore: published trails from the API (GET /v1/trails), newest first, with
 * pull-to-refresh. Works signed out, like the website. Filters (For you · Nearby ·
 * Friends) and opening a trail come with M19.
 */
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import type { FeedTrail } from '@breadcrumb/contracts'
import { StateView } from '@/components/StateView'
import { TrailCard } from '@/components/TrailCard'
import { api } from '@/lib/api'
import { colors } from '@/theme/tokens'

type State = { status: 'loading' } | { status: 'ready'; trails: FeedTrail[] } | { status: 'error'; message: string }

const NOT_SET_UP: State = { status: 'error', message: 'The app isn’t set up yet: add EXPO_PUBLIC_API_URL to apps/mobile/.env.' }

/** Loads the trail list; never throws. */
async function fetchTrails(): Promise<State> {
  if (!api) return NOT_SET_UP
  try {
    return { status: 'ready', trails: await api.getTrails() }
  } catch {
    return { status: 'error', message: 'We couldn’t reach Breadcrumb. Check your connection and try again.' }
  }
}

export default function ExploreScreen() {
  const [state, setState] = useState<State>(api ? { status: 'loading' } : NOT_SET_UP)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => setState(await fetchTrails()), [])

  useEffect(() => {
    let cancelled = false
    fetchTrails().then((next) => !cancelled && setState(next))
    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (state.status === 'loading') return <StateView kind="loading" />
  if (state.status === 'error') {
    return <StateView kind="message" title="Couldn’t load trails" body={state.message} action={{ label: 'Try again', onPress: () => void refresh() }} />
  }

  return (
    <FlatList
      data={state.trails}
      keyExtractor={(trail) => trail.id}
      renderItem={({ item }) => <TrailCard trail={item} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.crumbStrong} />}
      ListEmptyComponent={<StateView kind="message" title="No trails yet" body="New trails will show up here." />}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
})
