/**
 * Map of one trail (Apple Maps through react-native-maps): numbered stop pins like
 * the mockups (ink squares; the current stop orange; stops still ahead outlined) zoomed
 * to fit. No lines between stops: we only draw real routes, never straight lines
 * (PRD §5.5), and real routes need a directions service (later). `showsUser` shows your
 * blue dot, read on the phone only and never stored. Renders nothing without coordinates.
 */
import { useMemo, useRef } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import MapView, { Marker, type LatLng } from 'react-native-maps'
import type { TrailStop } from '@breadcrumb/contracts'
import { colors, fonts, text } from '@/theme/tokens'
import { AppText } from './AppText'

type Pin = { id: string; number: number; coordinate: LatLng }

/** Stops with coordinates, numbered by their place in the trail. */
export function mappableStops(stops: TrailStop[]): Pin[] {
  return stops.flatMap((stop, i) =>
    stop.latitude !== null && stop.longitude !== null
      ? [{ id: stop.id, number: i + 1, coordinate: { latitude: stop.latitude, longitude: stop.longitude } }]
      : [],
  )
}

const EDGE = { top: 90, right: 50, bottom: 50, left: 50 }

export function TrailMap({
  stops,
  current,
  showsUser = false,
  style,
  edgePadding = EDGE,
}: {
  stops: TrailStop[]
  /** 0-based stop in focus (active trail): earlier stops are done, later ones outlined. */
  current?: number
  showsUser?: boolean
  style?: StyleProp<ViewStyle>
  edgePadding?: typeof EDGE
}) {
  const ref = useRef<MapView>(null)
  const pins = useMemo(() => mappableStops(stops), [stops])
  if (pins.length === 0) return null

  const first = pins[0]!.coordinate
  const fit = () => {
    if (pins.length > 1) ref.current?.fitToCoordinates(pins.map((p) => p.coordinate), { edgePadding, animated: false })
  }

  return (
    <MapView
      ref={ref}
      style={style}
      initialRegion={{ ...first, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      onMapReady={fit}
      showsUserLocation={showsUser}
      showsPointsOfInterests={false}
      showsCompass={false}
      toolbarEnabled={false}
      userInterfaceStyle="light"
      accessibilityLabel="Map of the trail's stops"
    >
      {pins.map((pin) => {
        const index = pin.number - 1
        const state = current === undefined || index < current ? 'done' : index === current ? 'now' : 'ahead'
        return (
          <Marker key={`${pin.id}-${state}`} coordinate={pin.coordinate} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.pin, state === 'now' && styles.pinNow, state === 'ahead' && styles.pinAhead]}>
              <AppText style={[styles.number, state === 'ahead' && styles.numberAhead]}>{pin.number}</AppText>
            </View>
          </Marker>
        )
      })}
    </MapView>
  )
}

const styles = StyleSheet.create({
  pin: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinNow: { backgroundColor: colors.crumbStrong },
  pinAhead: { backgroundColor: colors.white, borderColor: colors.crumbStrong },
  number: { fontFamily: fonts.bold, fontSize: text.sm, color: colors.white },
  numberAhead: { color: colors.crumbStrong },
})
