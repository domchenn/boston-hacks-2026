/**
 * Explore (first screen): published trails from the API (GET /v1/trails), newest
 * first, with pull-to-refresh. Shows a message instead when the API address isn't set
 * or the request fails. Signed out for now; sign-in comes in M18b.
 */
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import type { FeedTrail } from '@breadcrumb/contracts'
import { TrailCard } from '@/components/TrailCard'
import { api } from '@/lib/api'
import { colors, text } from '@/theme/tokens'

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

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.crumbStrong} />
      </View>
    )
  }

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{state.message}</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <FlatList
      data={state.trails}
      keyExtractor={(trail) => trail.id}
      renderItem={({ item }) => <TrailCard trail={item} />}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.crumbStrong} />}
      ListEmptyComponent={<Text style={styles.message}>No trails yet.</Text>}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  message: { color: colors.ink2, fontSize: text.base, textAlign: 'center' },
  button: { backgroundColor: colors.crumbStrong, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: colors.white, fontSize: text.md, fontWeight: '700' },
})
