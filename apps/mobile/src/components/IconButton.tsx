/**
 * The style guide's round icon button (.icon-btn): 44 pt, white, with a float shadow,
 * e.g. the trail page's back and bookmark buttons. `label` is read by VoiceOver.
 */
import { Pressable, StyleSheet } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colors, floatShadow } from '@/theme/tokens'

export function IconButton({
  icon: Icon,
  label,
  onPress,
  filled = false,
  disabled = false,
}: {
  icon: LucideIcon
  label: string
  onPress: () => void
  /** Fill the icon (a saved bookmark). */
  filled?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: filled, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Icon size={20} strokeWidth={2} color={colors.ink} fill={filled ? colors.ink : 'none'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...floatShadow,
  },
  pressed: { backgroundColor: colors.sand },
  disabled: { opacity: 0.5 },
})
