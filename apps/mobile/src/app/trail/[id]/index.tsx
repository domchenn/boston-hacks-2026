/**
 * A trail's page (Mobile-Detail mockup), full screen above the tabs: round back and
 * bookmark buttons, the category in orange, title, facts, description, then the
 * numbered stops with what to do, how you get there and their crumbs. A bottom bar has
 * Start trail (Continue once started; opens go.tsx), or Rate this trail once you've
 * finished it, and Save. The route map comes later.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bookmark, ChevronLeft } from 'lucide-react-native'
import type { TrailCrumb, TrailDetail, TrailStop } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { StateView } from '@/components/StateView'
import { useTrailActions } from '@/features/trail/useTrailActions'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { categoryLabel, formatCost, formatMinutes, stopCount, TRAVEL_LABELS } from '@/lib/trailFormat'
import { colors, fonts, text } from '@/theme/tokens'

type State =
  | { status: 'loading' }
  | { status: 'ready'; trail: TrailDetail }
  | { status: 'missing' }
  | { status: 'error' }

async function fetchTrail(id: string): Promise<State> {
  if (!api) return { status: 'error' }
  try {
    const trail = await api.getTrail(id)
    return trail ? { status: 'ready', trail } : { status: 'missing' }
  } catch {
    return { status: 'error' }
  }
}

export default function TrailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [state, setState] = useState<{ id: string; value: State } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTrail(id).then((value) => !cancelled && setState({ id, value }))
    return () => {
      cancelled = true
    }
  }, [id])

  const current = state?.id === id ? state.value : { status: 'loading' as const }
  if (current.status === 'ready') return <TrailPage trail={current.trail} />
  return (
    <TopBar>
      {current.status === 'loading' ? (
        <StateView kind="loading" />
      ) : current.status === 'missing' ? (
        <StateView kind="message" title="Trail not found" body="It may have been removed, or it isn’t shared with you." />
      ) : (
        <StateView
          kind="message"
          title="Couldn’t load this trail"
          body="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => void fetchTrail(id).then((value) => setState({ id, value })) }}
        />
      )}
    </TopBar>
  )
}

/** The page with round back (and optionally other) buttons floating at the top. */
function TopBar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  return (
    <View style={styles.screen}>
      {children}
      <View style={[styles.topBar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} />
        {right}
      </View>
    </View>
  )
}

function TrailPage({ trail }: { trail: TrailDetail }) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const userId = useSession().session?.user.id ?? null
  const actions = useTrailActions(trail.id)
  const saved = actions.status === 'saved'

  const eyebrow = categoryLabel(trail.category, trail.customCategory)
  const facts = [
    trail.neighborhood,
    trail.estimatedCost !== null ? formatCost(trail.estimatedCost) : null,
    trail.estimatedMinutes !== null ? formatMinutes(trail.estimatedMinutes) : null,
    stopCount(trail.stops.length),
  ].filter(Boolean)
  const busy = actions.statusLoading || actions.busy !== null

  return (
    <TopBar
      right={
        actions.canSave ? (
          <IconButton
            icon={Bookmark}
            label={saved ? 'Saved. Tap to unsave' : 'Save trail'}
            filled={saved}
            disabled={busy}
            onPress={() => void actions.toggleSave()}
          />
        ) : null
      }
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 68, paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.head}>
          {eyebrow ? <AppText style={styles.eyebrow}>{eyebrow}</AppText> : null}
          <AppText style={styles.title}>{trail.title}</AppText>
          <AppText style={styles.facts}>{facts.join(' · ')}</AppText>
          {trail.rating.average !== null ? (
            <AppText style={styles.facts}>
              ★ {trail.rating.average.toFixed(1)} · {trail.rating.count} {trail.rating.count === 1 ? 'rating' : 'ratings'}
            </AppText>
          ) : null}
        </View>

        {trail.description ? <AppText style={styles.description}>{trail.description}</AppText> : null}

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>{stopCount(trail.stops.length)}</AppText>
          {trail.stops.length === 0 ? <AppText variant="secondary">This trail doesn’t have any stops yet.</AppText> : null}
          {trail.stops.map((stop, i) => (
            <StopRow key={stop.id} stop={stop} number={i + 1} last={i === trail.stops.length - 1} />
          ))}
        </View>

        {trail.betweenStopCrumbs.length > 0 ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>On the way</AppText>
            {trail.betweenStopCrumbs.map((crumb) => (
              <CrumbLine key={crumb.id} crumb={crumb} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {actions.error ? <AppText style={styles.error}>{actions.error}</AppText> : null}
        <View style={styles.buttons}>
          {actions.canRate && trail.creator?.id !== userId ? (
            <Button style={styles.startButton} label="Rate this trail" onPress={() => router.push(`/trail/${trail.id}/rate`)} />
          ) : (
            <Button
              style={styles.startButton}
              label={actions.status === 'in_progress' ? 'Continue trail' : actions.status === 'completed' ? 'You finished this' : 'Start trail'}
              busy={actions.busy === 'start'}
              // A finished trail stays finished (the API can't restart it).
              disabled={busy || actions.status === 'completed'}
              onPress={() => void actions.start()}
            />
          )}
          {actions.canSave ? (
            <Button
              variant="secondary"
              label={saved ? 'Saved' : 'Save'}
              busy={actions.busy === 'save'}
              disabled={busy}
              onPress={() => void actions.toggleSave()}
            />
          ) : null}
        </View>
      </View>
    </TopBar>
  )
}

function StopRow({ stop, number, last }: { stop: TrailStop; number: number; last: boolean }) {
  const what = stop.plannedActivity || stop.description
  const how = number > 1 && stop.travelModeToStop ? TRAVEL_LABELS[stop.travelModeToStop] : null
  const subline = [what, how].filter(Boolean).join(' · ')
  return (
    <View style={[styles.stop, !last && styles.stopLine]}>
      <AppText style={styles.stopNumber}>{number}</AppText>
      <View style={styles.stopBody}>
        <AppText style={styles.stopName}>{stop.placeName}</AppText>
        {subline ? <AppText style={styles.stopSub}>{subline}</AppText> : null}
        {stop.crumbs.map((crumb) => (
          <CrumbLine key={crumb.id} crumb={crumb} />
        ))}
      </View>
    </View>
  )
}

function CrumbLine({ crumb }: { crumb: TrailCrumb }) {
  return (
    <AppText style={styles.crumb}>
      <AppText style={styles.crumbKind}>{crumb.type === 'see' ? 'See ' : 'Do '}</AppText>
      {crumb.label}
    </AppText>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  content: { paddingHorizontal: 16 },
  head: { gap: 6 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: text.base, color: colors.crumbStrong },
  title: { fontFamily: fonts.extrabold, fontSize: text.xxl, lineHeight: 33, color: colors.ink, letterSpacing: -0.8 },
  facts: { fontFamily: fonts.regular, fontSize: text.md, color: colors.muted },
  description: { fontFamily: fonts.regular, fontSize: text.md, lineHeight: 24, color: colors.ink, marginTop: 16 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineStrong, marginTop: 22, paddingTop: 22 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: text.xl, color: colors.ink, letterSpacing: -0.2, marginBottom: 4 },
  stop: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  stopLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineStrong },
  stopNumber: { fontFamily: fonts.bold, fontSize: text.lg, color: colors.crumbStrong, width: 36 },
  stopBody: { flex: 1, gap: 3 },
  stopName: { fontFamily: fonts.semibold, fontSize: text.lg, color: colors.ink },
  stopSub: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted, lineHeight: 20 },
  crumb: { fontFamily: fonts.regular, fontSize: text.sm, color: colors.ink2, lineHeight: 19, marginTop: 2 },
  crumbKind: { fontFamily: fonts.semibold, fontSize: text.sm, color: colors.crumbStrong },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  buttons: { flexDirection: 'row', gap: 12 },
  startButton: { flex: 1 },
  error: { color: colors.crumbDeep, fontSize: text.sm },
})
