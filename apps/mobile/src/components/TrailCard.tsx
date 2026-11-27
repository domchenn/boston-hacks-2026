/**
 * One trail in a list, as in the style guide's trail card: the neighborhood as an
 * orange eyebrow, an optional status on the right (blue "In progress"), the title, then
 * stops, cost, time and rating, on a white card with the guide's border and radius.
 * Works for any API list item with these fields (feed, saved, profile lists); tapping
 * it calls onPress (lists open the trail page).
 */
import { Pressable, StyleSheet, View } from 'react-native'
import { formatCost, formatMinutes, stopCount } from '@/lib/trailFormat'
import { colors, fonts, radius } from '@/theme/tokens'
import { AppText } from './AppText'

export type CardTrail = {
  title: string
  neighborhood: string | null
  stopCount: number
  estimatedCost: number | null
  estimatedMinutes: number | null
  rating: { average: number | null; count: number }
}

function facts(trail: CardTrail): string {
  const parts = [stopCount(trail.stopCount)]
  if (trail.estimatedCost !== null) parts.push(formatCost(trail.estimatedCost))
  if (trail.estimatedMinutes !== null) parts.push(formatMinutes(trail.estimatedMinutes))
  if (trail.rating.average !== null) parts.push(`★ ${trail.rating.average.toFixed(1)}`)
  return parts.join('  ·  ')
}

export function TrailCard({ trail, badge, onPress }: { trail: CardTrail; badge?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        {trail.neighborhood ? <AppText variant="eyebrow">{trail.neighborhood}</AppText> : <View />}
        {badge ? <AppText variant="meta" style={styles.badge}>{badge}</AppText> : null}
      </View>
      <AppText variant="cardTitle">{trail.title}</AppText>
      <AppText variant="secondary">{facts(trail)}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    gap: 4,
  },
  pressed: { backgroundColor: colors.sand },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: colors.blue, fontFamily: fonts.semibold },
})
