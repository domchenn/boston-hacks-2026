/**
 * One trail in a list, as in the mobile mockups: a square tile with the trail's
 * category icon (the route thumbnail comes with the map), an optional coloured line
 * above the title ("In progress"), the title, then neighborhood · cost · time · rating,
 * and an optional action on the right ("Resume"). Rows are split by hairlines.
 */
import { Pressable, StyleSheet, View } from 'react-native'
import {
  Landmark,
  MapPin,
  Palette,
  PiggyBank,
  ShoppingBag,
  Trees,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native'
import type { Category } from '@breadcrumb/contracts'
import { formatCost, formatMinutes } from '@/lib/trailFormat'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { AppText } from './AppText'

export type RowTrail = {
  title: string
  category: Category | null
  neighborhood: string | null
  estimatedCost: number | null
  estimatedMinutes: number | null
  rating: { average: number | null; count: number }
}

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  food_drink: Utensils,
  outdoors: Trees,
  arts_culture: Palette,
  shopping: ShoppingBag,
  attractions: Landmark,
  affordable: PiggyBank,
  other: MapPin,
}

/** "Back Bay · ~$8 · 4 hr · ★ 4.5". */
export function trailFacts(trail: RowTrail): string {
  const parts: string[] = []
  if (trail.neighborhood) parts.push(trail.neighborhood)
  if (trail.estimatedCost !== null) parts.push(formatCost(trail.estimatedCost))
  if (trail.estimatedMinutes !== null) parts.push(formatMinutes(trail.estimatedMinutes))
  if (trail.rating.average !== null) parts.push(`★ ${trail.rating.average.toFixed(1)}`)
  return parts.join(' · ')
}

export function TrailRow({
  trail,
  onPress,
  eyebrow,
  eyebrowColor = colors.crumbStrong,
  action,
}: {
  trail: RowTrail
  onPress: () => void
  /** A short line above the title, e.g. "In progress". */
  eyebrow?: string
  eyebrowColor?: string
  /** Orange text on the right, e.g. "Resume". */
  action?: string
}) {
  const Icon = CATEGORY_ICONS[trail.category ?? 'other']
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.tile}>
        <Icon size={26} strokeWidth={1.75} color={colors.crumbStrong} />
      </View>
      <View style={styles.body}>
        {eyebrow ? <AppText style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow}</AppText> : null}
        <AppText style={styles.title} numberOfLines={2}>
          {trail.title}
        </AppText>
        <AppText style={styles.facts} numberOfLines={1}>
          {trailFacts(trail)}
        </AppText>
      </View>
      {action ? <AppText style={styles.action}>{action}</AppText> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  pressed: { opacity: 0.6 },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radius.small,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: text.sm },
  title: { fontFamily: fonts.bold, fontSize: text.lg, color: colors.ink, lineHeight: 22 },
  facts: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted },
  action: { fontFamily: fonts.bold, fontSize: text.md, color: colors.crumbStrong },
})
