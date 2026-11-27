/**
 * The active trail (Mobile-Run mockup), full screen: progress bar, "stop N of M", the
 * stop's name and what to do, its crumbs to tick, then Directions (Apple Maps, with
 * the real route) and "I'm here, next stop →" / "Finish trail". Pause closes it; the
 * trail stays in progress. Your location is never read here. The map comes later.
 */
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, X } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import type { TrailCrumb, TrailDetail, TrailStop, TravelMode } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { StateView } from '@/components/StateView'
import { useActiveTrail } from '@/features/trail/useActiveTrail'
import { useSession } from '@/lib/session'
import { TRAVEL_LABELS } from '@/lib/trailFormat'
import { colors, fonts, radius, text } from '@/theme/tokens'

export default function ActiveTrailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session, loading } = useSession()
  const router = useRouter()

  if (loading) return <StateView kind="loading" />
  if (!session) {
    return (
      <Shell onClose={() => router.back()}>
        <StateView
          kind="message"
          title="Log in to start trails"
          body="Your progress is saved to your account."
          action={{ label: 'Log in', onPress: () => router.push('/sign-in') }}
        />
      </Shell>
    )
  }
  // Keyed so another trail or account starts from scratch.
  return <ActiveTrail key={`${session.user.id}:${id}`} trailId={id} userId={session.user.id} />
}

/** The screen with the Pause button in the top corner. */
function Shell({ onClose, children, label = 'Pause' }: { onClose: () => void; children: ReactNode; label?: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.pause, pressed && styles.pausePressed]}>
        <X size={18} strokeWidth={2.5} color={colors.ink} />
        <AppText style={styles.pauseLabel}>{label}</AppText>
      </Pressable>
      {children}
    </View>
  )
}

function ActiveTrail({ trailId, userId }: { trailId: string; userId: string }) {
  const router = useRouter()
  const active = useActiveTrail(trailId, userId)
  const [finished, setFinished] = useState(false)
  const close = () => router.back()

  if (active.load.status === 'loading') return <StateView kind="loading" />
  if (active.load.status === 'missing') {
    return (
      <Shell onClose={close} label="Close">
        <StateView kind="message" title="Trail not found" body="It may have been removed, or it isn’t shared with you." />
      </Shell>
    )
  }
  if (active.load.status === 'error') {
    return (
      <Shell onClose={close} label="Close">
        <StateView
          kind="message"
          title="Couldn’t open this trail"
          body="Check your connection and try again."
          action={{ label: 'Try again', onPress: active.retry }}
        />
      </Shell>
    )
  }

  const { trail, stopIndex } = active.load
  if (finished) {
    return (
      <Shell onClose={close} label="Close">
        <StateView
          kind="message"
          title="Trail finished!"
          body={`Nice work on ${trail.title}.`}
          action={{ label: 'Done', onPress: close }}
        />
      </Shell>
    )
  }
  if (trail.stops.length === 0) {
    return (
      <Shell onClose={close} label="Close">
        <StateView kind="message" title="No stops yet" body="This trail doesn’t have any stops to walk." />
      </Shell>
    )
  }

  return (
    <StopView
      trail={trail}
      index={stopIndex}
      ticked={active.ticked}
      error={active.error}
      finishing={active.finishing}
      onToggle={(crumbId) => void active.toggle(crumbId)}
      onStop={active.goToStop}
      onFinish={async () => {
        if (await active.finish()) setFinished(true)
      }}
      onClose={close}
    />
  )
}

/** Apple Maps directions to a stop, using the trail's way of getting there. */
function directionsUrl(stop: TrailStop): string | null {
  const flags: Record<TravelMode, string | null> = { walk: 'w', bus: 'r', train: 'r', bike: null }
  const destination =
    stop.latitude !== null && stop.longitude !== null ? `${stop.latitude},${stop.longitude}` : stop.address || null
  if (!destination) return null
  const flag = stop.travelModeToStop ? flags[stop.travelModeToStop] : null
  return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}${flag ? `&dirflg=${flag}` : ''}`
}

function StopView({
  trail,
  index,
  ticked,
  error,
  finishing,
  onToggle,
  onStop,
  onFinish,
  onClose,
}: {
  trail: TrailDetail
  index: number
  ticked: Set<string>
  error: string | null
  finishing: boolean
  onToggle: (crumbId: string) => void
  onStop: (index: number) => void
  onFinish: () => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const stop = trail.stops[index]!
  const last = index === trail.stops.length - 1
  const doneHere = stop.crumbs.filter((c) => ticked.has(c.id)).length
  const how = index > 0 && stop.travelModeToStop ? TRAVEL_LABELS[stop.travelModeToStop] : null
  const what = stop.plannedActivity || stop.description
  const directions = directionsUrl(stop)

  return (
    <Shell onClose={onClose}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.progress} accessibilityLabel={`Stop ${index + 1} of ${trail.stops.length}`}>
          {trail.stops.map((s, i) => (
            <View key={s.id} style={[styles.segment, i < index && styles.segmentDone, i === index && styles.segmentNow]} />
          ))}
        </View>

        <AppText variant="meta">
          {trail.title} · stop {index + 1} of {trail.stops.length}
        </AppText>
        <AppText variant="title">{stop.placeName}</AppText>
        {how || what ? <AppText variant="secondary">{[how, what].filter(Boolean).join(' · ')}</AppText> : null}
        {stop.address ? <AppText variant="meta">{stop.address}</AppText> : null}

        {stop.crumbs.length > 0 ? (
          <View style={styles.crumbs}>
            <AppText variant="label">
              Crumbs here · {doneHere} of {stop.crumbs.length}
            </AppText>
            {stop.crumbs.map((crumb) => (
              <CrumbRow key={crumb.id} crumb={crumb} done={ticked.has(crumb.id)} onPress={() => onToggle(crumb.id)} />
            ))}
          </View>
        ) : null}

        {last && trail.betweenStopCrumbs.length > 0 ? (
          <View style={styles.crumbs}>
            <AppText variant="label">Along the way</AppText>
            {trail.betweenStopCrumbs.map((crumb) => (
              <CrumbRow key={crumb.id} crumb={crumb} done={ticked.has(crumb.id)} onPress={() => onToggle(crumb.id)} />
            ))}
          </View>
        ) : null}

        {index > 0 ? <Button variant="ghost" label="← Previous stop" onPress={() => onStop(index - 1)} /> : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <View style={styles.buttons}>
          <Button
            variant="secondary"
            label="Directions"
            disabled={!directions}
            onPress={() => directions && void Linking.openURL(directions)}
          />
          <Button
            style={styles.next}
            label={last ? 'Finish trail' : 'I’m here, next stop →'}
            busy={finishing}
            onPress={() => (last ? onFinish() : onStop(index + 1))}
          />
        </View>
      </View>
    </Shell>
  )
}

function CrumbRow({ crumb, done, onPress }: { crumb: TrailCrumb; done: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={({ pressed }) => [styles.crumb, pressed && styles.crumbPressed]}
    >
      <View style={[styles.box, done && styles.boxDone]}>{done ? <Check size={16} strokeWidth={3} color={colors.white} /> : null}</View>
      <AppText style={[styles.crumbText, done && styles.crumbDone]}>
        {crumb.type === 'see' ? 'See: ' : 'Do: '}
        {crumb.label}
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  pause: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginLeft: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.sand,
  },
  pausePressed: { backgroundColor: colors.line },
  pauseLabel: { fontFamily: fonts.bold, fontSize: text.base, color: colors.ink },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  progress: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  segmentDone: { backgroundColor: colors.crumb },
  segmentNow: { backgroundColor: colors.crumbTint },
  crumbs: { marginTop: 12 },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  crumbPressed: { backgroundColor: colors.sand },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.small / 2 + 2,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.crumbStrong, borderColor: colors.crumbStrong },
  crumbText: { flex: 1, fontSize: text.md, color: colors.ink, lineHeight: 22 },
  crumbDone: { color: colors.muted, textDecorationLine: 'line-through' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  buttons: { flexDirection: 'row', gap: 12 },
  next: { flex: 1 },
  error: { color: colors.crumbDeep, fontSize: text.sm },
})
