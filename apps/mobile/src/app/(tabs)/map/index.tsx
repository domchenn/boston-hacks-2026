/**
 * Map tab (Mobile-Map mockup): every trail as a price pin ("~$8", "Free") at its first
 * stop with coordinates, over Boston on Apple Maps, with your blue dot (read on the
 * phone only, never stored). Tapping a pin highlights it and shows the trail in a card
 * at the bottom with View. Pins mark where trails start; no routes are drawn here.
 */
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import type { FeedTrail } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { StateView } from '@/components/StateView'
import { TrailRow } from '@/components/TrailRow'
import { api } from '@/lib/api'
import { tapLight } from '@/lib/haptics'
import { formatCost } from '@/lib/trailFormat'
import { colors, floatShadow, fonts, radius, text } from '@/theme/tokens'

/** Boston, between Back Bay, Cambridge and downtown. */
const BOSTON = { latitude: 42.355, longitude: -71.075, latitudeDelta: 0.09, longitudeDelta: 0.09 }

type State = { status: 'loading' } | { status: 'ready'; trails: FeedTrail[] } | { status: 'error' }

type Pin = { trail: FeedTrail; latitude: number; longitude: number }

export default function MapScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // Clears the floating tab bar (about 62 pt above the home indicator).
  const sheetBottom = { paddingBottom: insets.bottom + 70 }
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selected, setSelected] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!api) return
    let cancelled = false
    api.getTrails().then(
      (trails) => !cancelled && setState({ status: 'ready', trails }),
      () => !cancelled && setState({ status: 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const pins = useMemo<Pin[]>(() => {
    if (state.status !== 'ready') return []
    return state.trails.flatMap((trail) => {
      const start = trail.places.find((p) => p.latitude !== null && p.longitude !== null)
      return start ? [{ trail, latitude: start.latitude!, longitude: start.longitude! }] : []
    })
  }, [state])

  const chosen = pins.find((p) => p.trail.id === selected)?.trail ?? null

  return (
    <View style={styles.screen}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={BOSTON}
        showsUserLocation
        showsPointsOfInterests={false}
        showsCompass={false}
        userInterfaceStyle="light"
        onPress={(e) => {
          // Tapping the map (not a pin) clears the selection.
          if (e.nativeEvent.action !== 'marker-press') setSelected(null)
        }}
      >
        {pins.map(({ trail, latitude, longitude }) => {
          const on = trail.id === selected
          return (
            <Marker
              key={`${trail.id}-${on}`}
              coordinate={{ latitude, longitude }}
              tracksViewChanges={false}
              onPress={() => {
                tapLight()
                setSelected(trail.id)
              }}
              accessibilityLabel={trail.title}
              zIndex={on ? 2 : 1}
            >
              <View style={[styles.pin, on && styles.pinOn]}>
                <AppText style={[styles.price, on && styles.priceOn]}>
                  {trail.estimatedCost !== null ? formatCost(trail.estimatedCost) : '•'}
                </AppText>
              </View>
            </Marker>
          )
        })}
      </MapView>

      {state.status === 'error' ? (
        <View style={[styles.sheet, sheetBottom]}>
          <StateView kind="message" title="Couldn’t load trails" body="Check your connection and try again." action={{ label: 'Try again', onPress: () => setAttempt((n) => n + 1) }} />
        </View>
      ) : state.status === 'ready' ? (
        <View style={[styles.sheet, sheetBottom]}>
          <View style={styles.handle} />
          {chosen ? (
            <TrailRow trail={chosen} action="View" onPress={() => router.push(`/trail/${chosen.id}`)} />
          ) : (
            <AppText style={styles.hint}>
              {pins.length === 0 ? 'No trails with a location yet.' : `${pins.length} ${pins.length === 1 ? 'trail' : 'trails'} here · tap a price to preview`}
            </AppText>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pin: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    ...floatShadow,
  },
  pinOn: { backgroundColor: colors.crumbStrong },
  price: { fontFamily: fonts.bold, fontSize: text.base, color: colors.ink },
  priceOn: { color: colors.white },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 16,
    paddingTop: 8,
    ...floatShadow,
  },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 10 },
  hint: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted, paddingVertical: 8 },
})
