/**
 * Text in the style guide's type scale (docs/STYLE_GUIDE.md): Inter, ink by default.
 * Use a variant instead of styling Text directly, so restyling the app later means
 * changing this file, not every screen.
 */
import { StyleSheet, Text, type TextProps } from 'react-native'
import { colors, fonts, text } from '@/theme/tokens'

export type TextVariant = 'title' | 'heading' | 'cardTitle' | 'body' | 'secondary' | 'meta' | 'eyebrow' | 'label'

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: TextVariant }) {
  return <Text {...props} style={[styles[variant], style]} />
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: text.xxxl, color: colors.ink, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.bold, fontSize: text.xl, color: colors.ink },
  cardTitle: { fontFamily: fonts.bold, fontSize: text.xl, color: colors.ink, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: text.base, color: colors.ink, lineHeight: 21 },
  secondary: { fontFamily: fonts.regular, fontSize: text.base, color: colors.ink2, lineHeight: 21 },
  meta: { fontFamily: fonts.medium, fontSize: text.sm, color: colors.muted },
  eyebrow: { fontFamily: fonts.semibold, fontSize: text.sm, color: colors.crumbStrong },
  label: { fontFamily: fonts.semibold, fontSize: text.sm, color: colors.ink2 },
})
