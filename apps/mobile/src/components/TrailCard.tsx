/**
 * One trail in a list: neighborhood, title, then stops, cost, time and rating, on a
 * white card with the style guide's border and radius. Same facts as the website's
 * trail card; data comes from the API's FeedTrail.
 */
import { StyleSheet, Text, View } from 'react-native'
import type { FeedTrail } from '@breadcrumb/contracts'
import { colors, radius, text } from '@/theme/tokens'

function facts(trail: FeedTrail): string {
  const parts = [`${trail.stopCount} ${trail.stopCount === 1 ? 'stop' : 'stops'}`]
  if (trail.estimatedCost !== null) parts.push(trail.estimatedCost === 0 ? 'Free' : `~$${Math.round(trail.estimatedCost)}`)
  if (trail.estimatedMinutes !== null) {
    const hours = trail.estimatedMinutes / 60
    parts.push(hours >= 1 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr` : `${trail.estimatedMinutes} min`)
  }
  if (trail.rating.average !== null) parts.push(`★ ${trail.rating.average.toFixed(1)}`)
  return parts.join('  ·  ')
}

export function TrailCard({ trail }: { trail: FeedTrail }) {
  return (
    <View style={styles.card}>
      {trail.neighborhood ? <Text style={styles.eyebrow}>{trail.neighborhood}</Text> : null}
      <Text style={styles.title}>{trail.title}</Text>
      <Text style={styles.facts}>{facts(trail)}</Text>
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
  eyebrow: { color: colors.crumbStrong, fontSize: text.sm, fontWeight: '600' },
  title: { color: colors.ink, fontSize: text.xl, fontWeight: '700' },
  facts: { color: colors.ink2, fontSize: text.base },
})
