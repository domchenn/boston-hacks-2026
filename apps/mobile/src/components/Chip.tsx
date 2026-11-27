/**
 * A filter chip from the mockups ("Open late", "Under $10"): white with a border, or
 * orange tint with orange text when on. Tapping toggles it; the screen keeps the state.
 */
import { Pressable, StyleSheet } from 'react-native'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { AppText } from './AppText'

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.on, pressed && !on && styles.pressed]}
    >
      <AppText style={[styles.label, on && styles.labelOn]}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    borderRadius: radius.small,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  on: { backgroundColor: colors.crumbTint, borderColor: colors.crumbTint },
  pressed: { backgroundColor: colors.sand },
  label: { fontFamily: fonts.semibold, fontSize: text.base, color: colors.ink },
  labelOn: { color: colors.crumbDeep },
})
