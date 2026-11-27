/**
 * Explore → For you: the greeting, a Resume banner that reopens the trail you're in
 * the middle of (signed in), the Open late / Under $10 chips (the API's lateNight and maxCost
 * filters) and the trail list, with pull-to-refresh. `header` (the top tabs) scrolls
 * with the list.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { FeedTrail, SavedTrail, TrailListFilters } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { Chip } from '@/components/Chip'
import { StateView } from '@/components/StateView'
import { TrailCard } from '@/components/TrailCard'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { exploreGreeting } from './greeting'

type Filters = { late: boolean; cheap: boolean }
type State = { status: 'loading' } | { status: 'ready'; trails: FeedTrail[] } | { status: 'error' }

/** The "Under $10" chip. */
const CHEAP_MAX = 10

function toApiFilters({ late, cheap }: Filters): TrailListFilters {
  return { lateNight: late || undefined, maxCost: cheap ? CHEAP_MAX : undefined }
}

async function fetchTrails(filters: Filters): Promise<State> {
  if (!api) return { status: 'error' }
  try {
    return { status: 'ready', trails: await api.getTrails(toApiFilters(filters)) }
  } catch {
    return { status: 'error' }
  }
}

/** The most recently touched trail you've started, for the Resume banner. Null when none (or signed out). */
function useResumeTrail(signedIn: boolean): SavedTrail | null {
  const [trail, setTrail] = useState<SavedTrail | null>(null)
  useFocusEffect(
    useCallback(() => {
      if (!api || !signedIn) return
      let cancelled = false
      api.getSavedTrails().then(
        (trails) => !cancelled && setTrail(trails.find((t) => t.status === 'in_progress') ?? null),
        () => undefined,
      )
      return () => {
        cancelled = true
      }
    }, [signedIn]),
  )
  return signedIn ? trail : null
}

export function ForYouFeed({ header }: { header: ReactElement }) {
  const router = useRouter()
  const { session, profile } = useSession()
  const [filters, setFilters] = useState<Filters>({ late: false, cheap: false })
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const resume = useResumeTrail(Boolean(session))
  const name = profile?.displayName?.split(' ')[0] || profile?.username || null

  useEffect(() => {
    let cancelled = false
    fetchTrails(filters).then((next) => !cancelled && setState(next))
    return () => {
      cancelled = true
    }
  }, [filters])

  async function refresh() {
    setRefreshing(true)
    setState(await fetchTrails(filters))
    setRefreshing(false)
  }

  const open = (id: string) => router.push(`/trail/${id}`)
  const toggle = (key: keyof Filters) => {
    setState({ status: 'loading' })
    setFilters((f) => ({ ...f, [key]: !f[key] }))
  }

  const top = (
    <View style={styles.top}>
      {header}
      <AppText style={styles.greeting}>{exploreGreeting(new Date(), name)}</AppText>
      {resume ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Resume ${resume.title}`}
          onPress={() => router.push(`/trail/${resume.id}/go`)}
          style={({ pressed }) => [styles.resume, pressed && styles.resumePressed]}
        >
          <AppText style={styles.resumeText} numberOfLines={1}>
            <AppText style={styles.resumeStrong}>In progress</AppText> · {resume.title}
          </AppText>
          <AppText style={styles.resumeStrong}>Resume →</AppText>
        </Pressable>
      ) : null}
      <View style={styles.chips}>
        <Chip label="Open late" on={filters.late} onPress={() => toggle('late')} />
        <Chip label={`Under $${CHEAP_MAX}`} on={filters.cheap} onPress={() => toggle('cheap')} />
      </View>
    </View>
  )

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={state.status === 'ready' ? state.trails : []}
      keyExtractor={(trail) => trail.id}
      renderItem={({ item }) => <TrailCard trail={item} onPress={() => open(item.id)} />}
      ListHeaderComponent={top}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.crumbStrong} />}
      ListEmptyComponent={
        state.status === 'loading' ? (
          <StateView kind="loading" />
        ) : state.status === 'error' ? (
          <StateView
            kind="message"
            title="Couldn’t load trails"
            body="Check your connection and try again."
            action={{ label: 'Try again', onPress: () => void refresh() }}
          />
        ) : filters.late || filters.cheap ? (
          <StateView kind="message" title="No trails match" body="Try turning a filter off." />
        ) : (
          <StateView kind="message" title="No trails yet" body="New trails will show up here." />
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  top: { gap: 16, marginBottom: 4 },
  greeting: { fontFamily: fonts.extrabold, fontSize: text.xxl, lineHeight: 33, color: colors.ink, letterSpacing: -0.4 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.crumbTint,
    borderRadius: radius.small,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  resumePressed: { opacity: 0.8 },
  resumeText: { flex: 1, color: colors.ink, fontSize: text.base },
  resumeStrong: { fontFamily: fonts.bold, color: colors.crumbStrong, fontSize: text.base },
  chips: { flexDirection: 'row', gap: 8 },
})
