/**
 * A trail's page (Mobile-Detail mockup), full screen above the tabs: category, title,
 * facts, description, then the numbered stops with what to do and their crumbs, and a
 * bottom bar with Start trail and Save. The route map and the step-by-step active
 * trail come later (M20); "In progress" shows once you've started.
 */
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { TrailCrumb, TrailDetail, TrailStop } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { StateView } from '@/components/StateView'
import { api } from '@/lib/api'
import { categoryLabel, formatCost, formatMinutes, stopCount, TRAVEL_LABELS } from '@/lib/trailFormat'
import { useTrailActions } from '@/lib/useTrailActions'
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
  if (current.status === 'loading') return <StateView kind="loading" />
  if (current.status === 'missing') {
    return <StateView kind="message" title="Trail not found" body="It may have been removed, or it isn’t shared with you." />
  }
  if (current.status === 'error') {
    return (
      <StateView
        kind="message"
        title="Couldn’t load this trail"
        body="Check your connection and try again."
        action={{ label: 'Try again', onPress: () => void fetchTrail(id).then((value) => setState({ id, value })) }}
      />
    )
  }
  return <TrailPage trail={current.trail} />
}

function TrailPage({ trail }: { trail: TrailDetail }) {
  const insets = useSafeAreaInsets()
  const actions = useTrailActions(trail.id)

  const eyebrow = categoryLabel(trail.category, trail.customCategory)
  const facts = [
    trail.neighborhood,
    trail.estimatedCost !== null ? formatCost(trail.estimatedCost) : null,
    trail.estimatedMinutes !== null ? formatMinutes(trail.estimatedMinutes) : null,
    stopCount(trail.stops.length),
  ].filter(Boolean)

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.head}>
          {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
          <AppText variant="title">{trail.title}</AppText>
          <AppText variant="secondary">{facts.join(' · ')}</AppText>
          {trail.rating.average !== null ? (
            <AppText variant="meta">
              ★ {trail.rating.average.toFixed(1)} · {trail.rating.count} {trail.rating.count === 1 ? 'rating' : 'ratings'}
            </AppText>
          ) : null}
        </View>

        {trail.description ? <AppText style={styles.description}>{trail.description}</AppText> : null}

        <View style={styles.section}>
          <AppText variant="heading">{stopCount(trail.stops.length)}</AppText>
          {trail.stops.length === 0 ? <AppText variant="secondary">This trail doesn’t have any stops yet.</AppText> : null}
          {trail.stops.map((stop, i) => (
            <StopRow key={stop.id} stop={stop} number={i + 1} last={i === trail.stops.length - 1} />
          ))}
        </View>

        {trail.betweenStopCrumbs.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="heading">On the way</AppText>
            {trail.betweenStopCrumbs.map((crumb) => (
              <CrumbLine key={crumb.id} crumb={crumb} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {actions.error ? <AppText style={styles.error}>{actions.error}</AppText> : null}
        <View style={styles.buttons}>
          <Button
            style={styles.startButton}
            label={actions.status === 'in_progress' ? 'In progress' : actions.status === 'completed' ? 'Do it again' : 'Start trail'}
            busy={actions.busy === 'start'}
            disabled={actions.statusLoading || actions.busy !== null || actions.status === 'in_progress'}
            onPress={() => void actions.start()}
          />
          {actions.canSave ? (
            <Button
              variant="secondary"
              label={actions.status === 'saved' ? 'Saved' : 'Save'}
              busy={actions.busy === 'save'}
              disabled={actions.statusLoading || actions.busy !== null}
              onPress={() => void actions.toggleSave()}
            />
          ) : null}
        </View>
      </View>
    </View>
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
        {subline ? <AppText variant="secondary">{subline}</AppText> : null}
        {stop.crumbs.map((crumb) => (
          <CrumbLine key={crumb.id} crumb={crumb} />
        ))}
      </View>
    </View>
  )
}

function CrumbLine({ crumb }: { crumb: TrailCrumb }) {
  return (
    <AppText variant="secondary" style={styles.crumb}>
      <AppText variant="label">{crumb.type === 'see' ? 'See: ' : 'Do: '}</AppText>
      {crumb.label}
    </AppText>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  head: { gap: 6 },
  description: { lineHeight: 23 },
  section: { gap: 4, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 20 },
  stop: { flexDirection: 'row', gap: 16, paddingVertical: 12 },
  stopLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  stopNumber: { fontFamily: fonts.bold, fontSize: text.lg, color: colors.crumbStrong, width: 20 },
  stopBody: { flex: 1, gap: 3 },
  stopName: { fontFamily: fonts.semibold, fontSize: text.lg, color: colors.ink },
  crumb: { fontSize: text.sm, lineHeight: 19 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  buttons: { flexDirection: 'row', gap: 12 },
  startButton: { flex: 1 },
  error: { color: colors.crumbDeep, fontSize: text.sm },
})
