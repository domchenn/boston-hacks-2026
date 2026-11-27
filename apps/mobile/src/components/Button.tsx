/**
 * The app's button, as in the mobile mockups: a rounded rectangle 52 pt tall; "primary"
 * is the brand orange with white text, "secondary" white with a light outline, "ghost"
 * plain text. One primary per screen. Shows a spinner and ignores taps while `busy`.
 */
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { AppText } from './AppText'

type Props = Omit<PressableProps, 'children'> & {
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  busy?: boolean
}

export function Button({ label, variant = 'primary', busy = false, disabled, style, ...props }: Props) {
  const inactive = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && styles[`${variant}Pressed`],
        inactive && styles.inactive,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.crumbStrong} />
      ) : (
        <AppText style={[styles.label, variant === 'primary' ? styles.labelOnAccent : styles.labelInk]}>{label}</AppText>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  primary: { backgroundColor: colors.crumbStrong },
  primaryPressed: { backgroundColor: colors.crumbDeep },
  secondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lineStrong },
  secondaryPressed: { backgroundColor: colors.sand },
  ghost: { backgroundColor: 'transparent' },
  ghostPressed: { backgroundColor: colors.sand },
  inactive: { opacity: 0.55 },
  label: { fontFamily: fonts.bold, fontSize: text.md },
  labelOnAccent: { color: colors.white },
  labelInk: { color: colors.ink },
})
