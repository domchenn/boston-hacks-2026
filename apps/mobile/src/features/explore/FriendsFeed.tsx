/**
 * Explore → Friends: what the people you follow made or finished, newest first
 * (GET /v1/me/friends-activity), e.g. "@maya finished Harvard Square Bookstores · 2 d".
 * Tapping one opens the trail. Signed out it asks you to log in; following nobody,
 * it says so (finding people comes with the profile work, M21).
 */
import { useCallback, useState, type ReactElement } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { ActivityItem, FriendsActivity, TrailCreator } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { StateView } from '@/components/StateView'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { colors, fonts, text } from '@/theme/tokens'

type State =
  | { status: 'loading' }
  | { status: 'ready'; activity: FriendsActivity; following: number }
  | { status: 'error' }

/** "@maya_k", or their display name if they have no username yet. */
function handle(person: TrailCreator): string {
  return person.username ? `@${person.username}` : person.display_name || 'Someone'
}

/** "just now", "5 min", "3 h", "2 d", then "Nov 2" after a month (as on the website). */
function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function FriendsFeed({ header }: { header: ReactElement }) {
  const router = useRouter()
  const { session, loading } = useSession()
  const signedIn = Boolean(session)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!api || !signedIn) return
    try {
      const [activity, ids] = await Promise.all([api.getFriendsActivity(), api.getFollowingIds()])
      setState({ status: 'ready', activity, following: ids.length })
    } catch {
      setState({ status: 'error' })
    }
  }, [signedIn])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const titles = new Map(state.status === 'ready' ? state.activity.trails.map((t) => [t.id, t.title]) : [])
  // Only items whose trail you can still see (the API leaves hidden trails' cards out).
  const items = state.status === 'ready' ? state.activity.items.filter((item) => titles.has(item.trailId)) : []

  function empty() {
    if (loading) return <StateView kind="loading" />
    if (!signedIn) {
      return (
        <StateView
          kind="message"
          title="See what friends are up to"
          body="Log in to see the trails your friends make and finish."
          action={{ label: 'Log in', onPress: () => router.push('/sign-in') }}
        />
      )
    }
    if (state.status === 'loading') return <StateView kind="loading" />
    if (state.status === 'error') {
      return (
        <StateView
          kind="message"
          title="Couldn’t load your friends’ trails"
          body="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => void load() }}
        />
      )
    }
    return state.following === 0 ? (
      <StateView kind="message" title="Follow your friends" body="When you follow people, the trails they make and finish show up here." />
    ) : (
      <StateView kind="message" title="Nothing new yet" body="When your friends make or finish a trail, it shows up here." />
    )
  }

  const row = ({ item }: { item: ActivityItem }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/trail/${item.trailId}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <AppText style={styles.initial}>{handle(item.person).replace('@', '').charAt(0).toUpperCase()}</AppText>
      </View>
      <AppText style={styles.text}>
        <AppText style={styles.who}>{handle(item.person)}</AppText> {item.kind} {titles.get(item.trailId)}
        <AppText variant="meta"> · {timeAgo(item.at)}</AppText>
      </AppText>
    </Pressable>
  )

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(item) => `${item.kind}-${item.trailId}-${item.person.id}-${item.at}`}
      renderItem={row}
      ListHeaderComponent={<View style={styles.top}>{header}</View>}
      ListEmptyComponent={empty()}
      contentContainerStyle={styles.list}
      refreshControl={
        signedIn ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
            tintColor={colors.crumbStrong}
          />
        ) : undefined
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  top: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.sand },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.crumbTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.bold, color: colors.crumbStrong, fontSize: text.base },
  text: { flex: 1, fontSize: text.base, color: colors.ink, lineHeight: 21 },
  who: { fontFamily: fonts.semibold, color: colors.ink },
})
