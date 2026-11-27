/**
 * Saved → "Your trails" (Mobile-Saved mockup): In progress (with "STOP 3/7" and Resume,
 * which reopens the active trail), Saved, and Done (finished trails). Lists come from
 * GET /v1/me/saved-trails and /v1/me/trails?status=completed and reload whenever the
 * tab comes back into view. Signed out, it asks you to log in.
 */
import { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { ProfileTrail, SavedTrail } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { StateView } from '@/components/StateView'
import { TopTabs } from '@/components/TopTabs'
import { TrailRow } from '@/components/TrailRow'
import { readSavedStop } from '@/features/trail/useActiveTrail'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { colors, fonts, text } from '@/theme/tokens'

const TABS = [
  { value: 'progress', label: 'In progress' },
  { value: 'saved', label: 'Saved' },
  { value: 'done', label: 'Done' },
] as const
type Tab = (typeof TABS)[number]['value']

const SIDE = 16

type Lists = { inProgress: (SavedTrail & { stop: number | null })[]; saved: SavedTrail[]; done: ProfileTrail[] }
type State = { status: 'loading' } | { status: 'ready'; lists: Lists } | { status: 'error' }

const EMPTY: Record<Tab, { title: string; body: string }> = {
  progress: { title: 'Nothing in progress', body: 'Trails you start show up here so you can pick them back up.' },
  saved: { title: 'Nothing saved yet', body: 'Tap Save on a trail and it shows up here.' },
  done: { title: 'No finished trails yet', body: 'Finish a trail and it shows up here.' },
}

/** "today", "yesterday", "3 days ago", then "Nov 2". */
function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SavedScreen() {
  const { session, loading } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('progress')
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const userId = session?.user.id ?? null

  const load = useCallback(async () => {
    if (!api || !userId) return
    try {
      const [savedTrails, done] = await Promise.all([api.getSavedTrails(), api.getMyTrails('completed')])
      const started = savedTrails.filter((t) => t.status === 'in_progress')
      const stops = await Promise.all(started.map((t) => readSavedStop(userId, t.id)))
      setState({
        status: 'ready',
        lists: {
          inProgress: started.map((t, i) => ({ ...t, stop: stops[i] ?? null })),
          saved: savedTrails.filter((t) => t.status === 'saved'),
          done,
        },
      })
    } catch {
      setState({ status: 'error' })
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const header = (
    <View style={styles.header}>
      <AppText style={styles.title} accessibilityRole="header">
        Your trails
      </AppText>
      <TopTabs tabs={TABS} value={tab} onChange={setTab} bleed={SIDE} />
    </View>
  )

  if (loading) return <StateView kind="loading" />
  if (!userId) {
    return (
      <View style={styles.signedOut}>
        <StateView
          kind="message"
          title="Your trails"
          body="Log in to save trails and pick up where you left off."
          action={{ label: 'Log in', onPress: () => router.push('/sign-in') }}
        />
      </View>
    )
  }

  const lists = state.status === 'ready' ? state.lists : null
  const empty =
    state.status === 'loading' ? (
      <View style={styles.loading}>
        <StateView kind="loading" />
      </View>
    ) : state.status === 'error' ? (
      <StateView kind="message" title="Couldn’t load your trails" body="Check your connection and try again." action={{ label: 'Try again', onPress: () => void load() }} />
    ) : (
      <View style={styles.empty}>
        <AppText style={styles.emptyText}>{EMPTY[tab].body}</AppText>
      </View>
    )

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true)
        await load()
        setRefreshing(false)
      }}
      tintColor={colors.crumbStrong}
    />
  )

  const common = {
    contentInsetAdjustmentBehavior: 'automatic' as const,
    ListHeaderComponent: header,
    ListEmptyComponent: empty,
    contentContainerStyle: styles.list,
    refreshControl,
  }

  if (tab === 'progress') {
    return (
      <FlatList
        {...common}
        data={lists?.inProgress ?? []}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Resume ${item.title}`}
            onPress={() => router.push(`/trail/${item.id}/go`)}
            style={({ pressed }) => [styles.progressRow, pressed && styles.pressed]}
          >
            <View style={styles.stopBadge}>
              <AppText style={styles.stopWord}>STOP</AppText>
              <AppText style={styles.stopCount}>
                {item.stop !== null && item.stopCount > 0 ? `${Math.min(item.stop + 1, item.stopCount)}/${item.stopCount}` : `–/${item.stopCount}`}
              </AppText>
            </View>
            <View style={styles.progressBody}>
              <AppText style={styles.progressTitle} numberOfLines={2}>
                {item.title}
              </AppText>
              <AppText style={styles.progressMeta}>Started {daysAgo(item.updatedAt)}</AppText>
            </View>
            <AppText style={styles.resume}>Resume</AppText>
          </Pressable>
        )}
      />
    )
  }

  if (tab === 'saved') {
    return (
      <FlatList
        {...common}
        data={lists?.saved ?? []}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />}
      />
    )
  }

  return (
    <FlatList
      {...common}
      data={lists?.done ?? []}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TrailRow
          trail={{ ...item, estimatedMinutes: item.durationMinutes, rating: { average: item.myRating, count: item.myRating ? 1 : 0 } }}
          eyebrow={item.completedAt ? `Finished ${daysAgo(item.completedAt)}` : 'Finished'}
          eyebrowColor={colors.green}
          onPress={() => router.push(`/trail/${item.id}`)}
        />
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: SIDE, paddingBottom: 32, flexGrow: 1 },
  header: { paddingTop: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.ink, letterSpacing: -1, marginBottom: 10 },
  signedOut: { flex: 1 },
  loading: { paddingTop: 40 },
  empty: { paddingTop: 28, paddingHorizontal: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: text.md, color: colors.muted, textAlign: 'center', lineHeight: 23 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  pressed: { opacity: 0.6 },
  stopBadge: { width: 52, alignItems: 'center' },
  stopWord: { fontFamily: fonts.bold, fontSize: text.xs, color: colors.crumbStrong, letterSpacing: 0.5 },
  stopCount: { fontFamily: fonts.extrabold, fontSize: text.xl, color: colors.ink },
  progressBody: { flex: 1, gap: 2 },
  progressTitle: { fontFamily: fonts.bold, fontSize: text.lg, color: colors.ink, lineHeight: 22 },
  progressMeta: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted },
  resume: { fontFamily: fonts.bold, fontSize: text.md, color: colors.crumbStrong },
})
