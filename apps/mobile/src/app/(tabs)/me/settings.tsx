/**
 * Settings, opened from the gear on You: Edit profile (the onboarding screen) and Log
 * out. Privacy, close friends and Delete account come with the profile work (M21).
 */
import { StyleSheet, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { useSession } from '@/lib/session'
import { colors, fonts, text } from '@/theme/tokens'

export default function SettingsScreen() {
  const { session, signOut } = useSession()
  const router = useRouter()

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Settings', headerBackTitle: 'You' }} />
      {session?.user.email ? (
        <View style={styles.group}>
          <AppText style={styles.label}>Logged in as</AppText>
          <AppText style={styles.value}>{session.user.email}</AppText>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button label="Edit profile" variant="secondary" onPress={() => router.push('/onboarding')} />
        <Button
          label="Log out"
          variant="ghost"
          onPress={async () => {
            await signOut()
            router.back()
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 28 },
  group: { gap: 2 },
  label: { fontFamily: fonts.medium, fontSize: text.sm, color: colors.muted },
  value: { fontFamily: fonts.regular, fontSize: text.md, color: colors.ink },
  actions: { gap: 10 },
})
