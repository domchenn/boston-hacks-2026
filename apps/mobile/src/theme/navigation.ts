/**
 * Header styling shared by every stack in the app (the root stack and each tab's own
 * stack): paper background, ink titles in Inter Bold, orange back buttons, no shadow.
 */
import type { ComponentProps } from 'react'
import type { Stack } from 'expo-router'
import { colors, fonts } from './tokens'

export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.paper },
  headerTintColor: colors.crumbStrong,
  headerTitleStyle: { color: colors.ink, fontFamily: fonts.bold },
  headerLargeTitleStyle: { color: colors.ink, fontFamily: fonts.extrabold },
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  contentStyle: { backgroundColor: colors.paper },
} satisfies ComponentProps<typeof Stack>['screenOptions']
