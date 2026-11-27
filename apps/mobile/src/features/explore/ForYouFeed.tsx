/**
 * Explore → For you (Mobile-Explore mockup): the greeting as a big question with a
 * line under it, a Resume banner ("Stop 3 of 7 · …") that reopens the trail you're in
 * the middle of, the Open late / Under $10 chips (the API's lateNight and maxCost
 * filters) and the trails as rows, with pull-to-refresh. `header` scrolls with the list.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { FeedTrail, SavedTrail, TrailListFilters } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { Chip } from '@/components/Chip'
import { StateView } from '@/components/StateView'
import { TrailRow } from '@/components/TrailRow'
import { readSavedStop } from '@/features/trail/useActiveTrail'
import { api } from '@/lib/api'
import { tapLight } from '@/lib/haptics'
import { useSession } from '@/lib/session'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { exploreGreeting } from './greeting'

type Filters = { late: boolean; cheap: boolean }
type State = { status: 'loading' } | { status: 'ready'; trails: FeedTrail[] } | { status: 'error' }
type Resume = { trail: SavedTrail; stop: number | null }

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

/** "Still out, Dom? Some trails go late." → ["Still out, Dom?", "Some trails go late."] */
function splitGreeting(line: string): [string, string | null] {
  const end = line.search(/[.!?](\s|$)/)
  if (end < 0 || end === line.length - 1) return [line, null]
  return [line.slice(0, end + 1), line.slice(end + 2) || null]
}

/** The most recent trail you've started, and the stop you were on (this phone only). */
function useResume(userId: string | null): Resume | null {
  const [resume, setResume] = useState<{ userId: string; value: Resume | null } | null>(null)
  useFocusEffect(
    useCallback(() => {
      if (!api || !userId) return
      let cancelled = false
      api
        .getSavedTrails()
        .then(async (trails) => {
          const trail = trails.find((t) => t.status === 'in_progress')
          const stop = trail ? await readSavedStop(userId, trail.id) : null
          if (!cancelled) setResume({ userId, value: trail ? { trail, stop } : null })
        })
        .catch(() => undefined)
      return () => {
        cancelled = true
      }
    }, [userId]),
  )
  return userId && resume?.userId === userId ? resume.value : null
}

export function ForYouFeed({ header }: { header: ReactElement }) {
  const router = useRouter()
  const { session, profile } = useSession()
  const [filters, setFilters] = useState<Filters>({ late: false, cheap: false })
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const resume = useResume(session?.user.id ?? null)
  const name = profile?.displayName?.split(' ')[0] || profile?.username || null
  const [question, line] = splitGreeting(exploreGreeting(new Date(), name))

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

  const toggle = (key: keyof Filters) => {
    tapLight()
    setState({ status: 'loading' })
    setFilters((f) => ({ ...f, [key]: !f[key] }))
  }

  const stopText =
    resume && resume.stop !== null && resume.trail.stopCount > 0
      ? `Stop ${Math.min(resume.stop + 1, resume.trail.stopCount)} of ${resume.trail.stopCount}`
      : 'In progress'

  const top = (
    <View>
      {header}
      <View style={styles.intro}>
        <AppText style={styles.question}>{question}</AppText>
        {line ? <AppText style={styles.line}>{line}</AppText> : null}
      </View>
      {resume ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Resume ${resume.trail.title}, ${stopText}`}
          onPress={() => router.push(`/trail/${resume.trail.id}/go`)}
          style={({ pressed }) => [styles.resume, pressed && styles.resumePressed]}
        >
          <AppText style={styles.resumeText} numberOfLines={1}>
            <AppText style={styles.resumeStrong}>{stopText}</AppText> · {resume.trail.title}
          </AppText>
          <AppText style={styles.resumeStrong}>Resume →</AppText>
        </Pressable>
      ) : null}
      <View style={styles.chips}>
        <Chip label="Open late" on={filters.late} onPress={() => toggle('late')} />
        <Chip label={`Under $${CHEAP_MAX}`} on={filters.cheap} onPress={() => toggle('cheap')} />
      </View>
      <AppText style={styles.section}>{filters.late || filters.cheap ? 'Matching trails' : 'Trails'}</AppText>
    </View>
  )

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={state.status === 'ready' ? state.trails : []}
      keyExtractor={(trail) => trail.id}
      renderItem={({ item }) => (
        <TrailRow
          trail={item}
          eyebrow={item.places.some((p) => p.openLate) ? 'Open late' : undefined}
          onPress={() => router.push(`/trail/${item.id}`)}
        />
      )}
      ListHeaderComponent={top}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.crumbStrong} />}
      ListEmptyComponent={
        state.status === 'loading' ? (
          <View style={styles.loading}>
            <StateView kind="loading" />
          </View>
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
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  intro: { marginTop: 22, gap: 4 },
  question: { fontFamily: fonts.extrabold, fontSize: text.xxl, lineHeight: 33, color: colors.ink, letterSpacing: -0.6 },
  line: { fontFamily: fonts.regular, fontSize: text.md, color: colors.muted, lineHeight: 22 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    backgroundColor: colors.crumbTint,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  resumePressed: { opacity: 0.75 },
  resumeText: { flex: 1, color: colors.ink, fontSize: text.base },
  resumeStrong: { fontFamily: fonts.bold, color: colors.crumbStrong, fontSize: text.base },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  section: { fontFamily: fonts.bold, fontSize: text.xl, color: colors.ink, marginTop: 28, marginBottom: 2, letterSpacing: -0.2 },
  loading: { paddingTop: 40 },
})
