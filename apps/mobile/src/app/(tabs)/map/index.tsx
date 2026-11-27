/**
 * Map tab (Mobile-Map mockup, browsing like Resy's map): every trail as a price pin
 * ("~$8", "Free") at its first stop over Boston on Apple Maps, with your blue dot (read
 * on the phone only, never stored). A sheet at the bottom has two positions: down, a row
 * of trail cards (swiping glides the map to that trail's pin; tapping a pin scrolls to
 * its card); up (drag the handle or tap List), every trail as a list. Tapping a card or
 * row opens the trail. Pins mark where trails start; no routes are drawn here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import type { FeedTrail } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { StateView } from '@/components/StateView'
import { TrailRow, trailFacts } from '@/components/TrailRow'
import { api } from '@/lib/api'
import { tapLight } from '@/lib/haptics'
import { categoryLabel, formatCost } from '@/lib/trailFormat'
import { colors, floatShadow, fonts, radius, text } from '@/theme/tokens'

/** Boston, between Back Bay, Cambridge and downtown. */
const BOSTON = { latitude: 42.355, longitude: -71.075, latitudeDelta: 0.09, longitudeDelta: 0.09 }
/** How close the map zooms when it glides to a trail. */
const NEAR = { latitudeDelta: 0.025, longitudeDelta: 0.025 }
const GAP = 10

type State = { status: 'loading' } | { status: 'ready'; trails: FeedTrail[] } | { status: 'error' }
type Pin = { trail: FeedTrail; latitude: number; longitude: number }

export default function MapScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const map = useRef<MapView>(null)
  const list = useRef<FlatList<Pin>>(null)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selected, setSelected] = useState(0)
  const [attempt, setAttempt] = useState(0)
  // Cards are almost full width, so the next one peeks in from the side.
  const cardWidth = width - 48
  const side = (width - cardWidth) / 2
  const step = cardWidth + GAP

  // The sheet: `open` = pulled up to the list. Its top sits `collapsedTop` above the
  // bottom when down (cards showing) and near the top of the screen when up.
  const { height } = useWindowDimensions()
  const sheetHeight = height - insets.top - 12
  const collapsedHeight = 186 + insets.bottom + 66
  const downAt = sheetHeight - collapsedHeight
  const [offset] = useState(() => new Animated.Value(downAt))
  const [open, setOpen] = useState(false)

  const snap = useCallback(
    (up: boolean) => {
      setOpen(up)
      tapLight()
      Animated.spring(offset, { toValue: up ? 0 : downAt, useNativeDriver: false, bounciness: 2, speed: 14 }).start()
    },
    [offset, downAt],
  )

  const pan = useMemo(() => {
    // Where the sheet was when this drag began.
    let start = downAt
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        offset.stopAnimation((value) => {
          start = value
        })
      },
      onPanResponderMove: (_, g) => offset.setValue(Math.min(downAt, Math.max(0, start + g.dy))),
      onPanResponderRelease: (_, g) => {
        // A flick decides; otherwise whichever position is closer.
        snap(g.vy < -0.4 ? true : g.vy > 0.4 ? false : start + g.dy < downAt / 2)
      },
    })
  }, [offset, downAt, snap])

  // Cards fade out and the list fades in as the sheet rises; its background goes from clear to white.
  const cardsOpacity = offset.interpolate({ inputRange: [downAt * 0.6, downAt], outputRange: [0, 1], extrapolate: 'clamp' })
  const listOpacity = offset.interpolate({ inputRange: [0, downAt * 0.6], outputRange: [1, 0], extrapolate: 'clamp' })
  const sheetBackground = offset.interpolate({
    inputRange: [0, downAt * 0.7, downAt],
    outputRange: [colors.white, colors.white, 'transparent'],
    extrapolate: 'clamp',
  })

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

  /** Highlights trail `index` and glides the map to it. */
  const focus = useCallback(
    (index: number) => {
      const pin = pins[index]
      if (!pin) return
      setSelected(index)
      map.current?.animateToRegion({ latitude: pin.latitude, longitude: pin.longitude, ...NEAR }, 350)
    },
    [pins],
  )

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={BOSTON}
        showsUserLocation
        showsPointsOfInterests={false}
        showsCompass={false}
        userInterfaceStyle="light"
        // Keeps the focused pin in the clear area above the cards.
        mapPadding={{ top: insets.top, right: 0, bottom: 190 + insets.bottom, left: 0 }}
      >
        {pins.map(({ trail, latitude, longitude }, index) => {
          const on = index === selected
          return (
            <Marker
              key={`${trail.id}-${on}`}
              coordinate={{ latitude, longitude }}
              tracksViewChanges={false}
              onPress={() => {
                tapLight()
                focus(index)
                list.current?.scrollToOffset({ offset: index * step, animated: true })
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

      <Animated.View
        style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: offset }], backgroundColor: sheetBackground }]}
        pointerEvents="box-none"
      >
        <View {...pan.panHandlers} style={styles.grab}>
          <View style={styles.handle} />
          {state.status === 'ready' && pins.length > 0 ? (
            <View style={styles.grabRow}>
              <AppText style={styles.countText}>
                {open ? `${pins.length} ${pins.length === 1 ? 'trail' : 'trails'}` : `${selected + 1} of ${pins.length} · swipe to explore`}
              </AppText>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={() => snap(!open)}>
                <AppText style={styles.toggle}>{open ? 'Map' : 'List'}</AppText>
              </Pressable>
            </View>
          ) : null}
        </View>

        {state.status === 'error' ? (
          <View style={[styles.card, styles.message, { marginHorizontal: side }]}>
            <StateView
              kind="message"
              title="Couldn’t load trails"
              body="Check your connection and try again."
              action={{ label: 'Try again', onPress: () => setAttempt((n) => n + 1) }}
            />
          </View>
        ) : state.status === 'ready' && pins.length === 0 ? (
          <View style={[styles.card, styles.message, { marginHorizontal: side }]}>
            <AppText style={styles.facts}>No trails with a location yet.</AppText>
          </View>
        ) : state.status === 'ready' ? (
          <View style={styles.flex}>
            <Animated.View style={{ opacity: cardsOpacity }} pointerEvents={open ? 'none' : 'box-none'}>
              <FlatList
                ref={list}
                data={pins}
                horizontal
                keyExtractor={(pin) => pin.trail.id}
                showsHorizontalScrollIndicator={false}
                snapToInterval={step}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: side, gap: GAP }}
                getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
                // A swipe settles on a card: move the map there.
                onMomentumScrollEnd={(e) => {
                  const index = Math.min(pins.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step)))
                  if (index !== selected) {
                    tapLight()
                    focus(index)
                  }
                }}
                renderItem={({ item, index }) => (
                  <TrailSlide trail={item.trail} width={cardWidth} on={index === selected} onPress={() => router.push(`/trail/${item.trail.id}`)} />
                )}
              />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: listOpacity }]} pointerEvents={open ? 'auto' : 'none'}>
              <FlatList
                data={pins}
                keyExtractor={(pin) => pin.trail.id}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
                renderItem={({ item }) => <TrailRow trail={item.trail} onPress={() => router.push(`/trail/${item.trail.id}`)} />}
              />
            </Animated.View>
          </View>
        ) : null}
      </Animated.View>
    </View>
  )
}

function TrailSlide({ trail, width, on, onPress }: { trail: FeedTrail; width: number; on: boolean; onPress: () => void }) {
  const eyebrow = categoryLabel(trail.category, trail.customCategory)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trail.title}. Open trail`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, on && styles.cardOn, pressed && styles.pressed]}
    >
      <View style={styles.cardBody}>
        {eyebrow ? <AppText style={styles.eyebrow}>{eyebrow}</AppText> : null}
        <AppText style={styles.title} numberOfLines={2}>
          {trail.title}
        </AppText>
        <AppText style={styles.facts} numberOfLines={1}>
          {trailFacts(trail)}
        </AppText>
      </View>
      <AppText style={styles.view}>View</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pin: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white, ...floatShadow },
  pinOn: { backgroundColor: colors.crumbStrong, transform: [{ scale: 1.12 }] },
  price: { fontFamily: fonts.bold, fontSize: text.base, color: colors.ink },
  priceOn: { color: colors.white },
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  grab: { paddingTop: 8, paddingBottom: 10, paddingHorizontal: 16 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: 8 },
  grabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    ...floatShadow,
  },
  toggle: { fontFamily: fonts.bold, fontSize: text.sm, color: colors.crumbStrong },
  list: { paddingHorizontal: 16 },
  countText: { fontFamily: fonts.semibold, fontSize: text.sm, color: colors.ink2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 104,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.white,
    ...floatShadow,
  },
  cardOn: { borderColor: colors.crumb },
  message: { justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  cardBody: { flex: 1, gap: 3 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: text.sm, color: colors.crumbStrong },
  title: { fontFamily: fonts.bold, fontSize: text.lg, color: colors.ink, lineHeight: 22 },
  facts: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted },
  view: { fontFamily: fonts.bold, fontSize: text.md, color: colors.crumbStrong },
})
