/**
 * Saved: the trails you saved or started (GET /v1/me/saved-trails), with pull-to-refresh
 * and a blue "In progress" on started ones. Signed out, it asks you to log in. Reloads
 * whenever the tab comes back into view, so saves made elsewhere show up.
 */
import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { SavedTrail } from '@breadcrumb/contracts'
import { StateView } from '@/components/StateView'
import { TrailCard } from '@/components/TrailCard'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { colors } from '@/theme/tokens'

type State = { status: 'loading' } | { status: 'ready'; trails: SavedTrail[] } | { status: 'error' }

export default function SavedScreen() {
  const { session, loading } = useSession()
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const signedIn = Boolean(session)

  const load = useCallback(async () => {
    if (!api || !signedIn) return
    try {
      setState({ status: 'ready', trails: await api.getSavedTrails() })
    } catch {
      setState({ status: 'error' })
    }
  }, [signedIn])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (loading) return <StateView kind="loading" />
  if (!signedIn) {
    return (
      <StateView
        kind="message"
        title="Your saved trails"
        body="Log in to save trails and pick up where you left off."
        action={{ label: 'Log in', onPress: () => router.push('/sign-in') }}
      />
    )
  }
  if (state.status === 'loading') return <StateView kind="loading" />
  if (state.status === 'error') {
    return <StateView kind="message" title="Couldn’t load your trails" body="Check your connection and try again." action={{ label: 'Try again', onPress: () => void load() }} />
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={state.trails}
      keyExtractor={(trail) => trail.id}
      renderItem={({ item }) => <TrailCard
          trail={item}
          badge={item.status === 'in_progress' ? 'In progress' : undefined}
          onPress={() => router.push(`/trail/${item.id}`)}
        />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
          tintColor={colors.crumbStrong}
        />
      }
      ListEmptyComponent={<StateView kind="message" title="Nothing saved yet" body="Save a trail from Explore and it shows up here." />}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, flexGrow: 1 },
})
