/**
 * One trail in a list, as in the style guide's trail card: the neighborhood as an
 * orange eyebrow, an optional status on the right (blue "In progress"), the title, then
 * stops, cost, time and rating, on a white card with the guide's border and radius.
 * Works for any API list item with these fields (feed, saved, profile lists).
 */
import { StyleSheet, View } from 'react-native'
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
  const parts = [`${trail.stopCount} ${trail.stopCount === 1 ? 'stop' : 'stops'}`]
  if (trail.estimatedCost !== null) parts.push(trail.estimatedCost === 0 ? 'Free' : `~$${Math.round(trail.estimatedCost)}`)
  if (trail.estimatedMinutes !== null) {
    const hours = trail.estimatedMinutes / 60
    parts.push(hours >= 1 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr` : `${trail.estimatedMinutes} min`)
  }
  if (trail.rating.average !== null) parts.push(`★ ${trail.rating.average.toFixed(1)}`)
  return parts.join('  ·  ')
}

export function TrailCard({ trail, badge }: { trail: CardTrail; badge?: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {trail.neighborhood ? <AppText variant="eyebrow">{trail.neighborhood}</AppText> : <View />}
        {badge ? <AppText variant="meta" style={styles.badge}>{badge}</AppText> : null}
      </View>
      <AppText variant="cardTitle">{trail.title}</AppText>
      <AppText variant="secondary">{facts(trail)}</AppText>
    </View>
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: colors.blue, fontFamily: fonts.semibold },
})
