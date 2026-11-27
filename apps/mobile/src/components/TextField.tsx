/**
 * A labelled text input in the style guide's look (white, strong line border, 10 pt
 * corners, 16 pt text), with an optional hint or error under it. The error is announced
 * to screen readers.
 */
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { AppText } from './AppText'

type Props = TextInputProps & { label: string; hint?: string; error?: string | null }

export function TextField({ label, hint, error, style, ...props }: Props) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? (
        <AppText variant="meta" style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="meta">{hint}</AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: 50,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: text.md,
    color: colors.ink,
  },
  inputError: { borderColor: colors.crumbDeep },
  error: { color: colors.crumbDeep },
})
