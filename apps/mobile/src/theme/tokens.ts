/**
 * Breadcrumb design tokens for React Native, copied from docs/styles/tokens.css (the
 * source of truth; React Native can't read CSS variables). `npm run lint` runs
 * scripts/check-tokens.mjs, which fails if a colour here drifts from tokens.css.
 * Sizes are in points (1rem = 16).
 */
export const colors = {
  paper: '#F7F6F2',
  white: '#FFFFFF',
  sand: '#EFEDE6',
  ink: '#1B1916',
  ink2: '#57534C',
  muted: '#736E66',
  line: '#E7E4DD',
  lineStrong: '#D6D2C8',
  crumb: '#E8552D',
  crumbStrong: '#C2410C',
  crumbDeep: '#9A3412',
  crumbTint: '#FDEDE6',
  blue: '#1D4ED8',
  green: '#15803D',
} as const

/** CSS variable name in tokens.css for each colour above (used by the drift check). */
export const cssNames: Record<keyof typeof colors, string> = {
  paper: '--color-paper',
  white: '--color-white',
  sand: '--color-sand',
  ink: '--color-ink',
  ink2: '--color-ink-2',
  muted: '--color-muted',
  line: '--color-line',
  lineStrong: '--color-line-strong',
  crumb: '--color-crumb',
  crumbStrong: '--color-crumb-strong',
  crumbDeep: '--color-crumb-deep',
  crumbTint: '--color-crumb-tint',
  blue: '--color-blue',
  green: '--color-green',
}

/** --text-* in tokens.css, in points. */
export const text = { xxs: 11, xs: 12, sm: 13, base: 15, md: 16, lg: 17, xl: 21, xxl: 28, xxxl: 32 } as const

/** --radius-sm / -md / -card / -sheet in tokens.css. */
export const radius = { small: 10, md: 14, card: 20, sheet: 24 } as const

/** --shadow-float in tokens.css: round buttons floating over content. */
export const floatShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.14,
  shadowRadius: 7,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const

/** Inter, the style guide's typeface (--font-sans), loaded in src/app/_layout.tsx. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const
