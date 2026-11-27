/**
 * You: your name and @username, Edit profile (the onboarding screen) and Log out.
 * Signed out, it offers Log in. The full profile (finished trails, badges, friends,
 * settings, delete account) comes with M21.
 */
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { StateView } from '@/components/StateView'
import { useSession } from '@/lib/session'

export default function YouScreen() {
  const { session, profile, loading, signOut } = useSession()
  const router = useRouter()

  if (loading) return <StateView kind="loading" />
  if (!session) {
    return (
      <StateView
        kind="message"
        title="Your Breadcrumb"
        body="Log in to see your trails, friends and badges."
        action={{ label: 'Log in', onPress: () => router.push('/sign-in') }}
      />
    )
  }

  const name = profile?.displayName || profile?.username || 'You'
  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <AppText variant="title">{name}</AppText>
        {profile?.username ? <AppText variant="secondary">@{profile.username}</AppText> : null}
        <AppText variant="meta">{session.user.email}</AppText>
      </View>
      <View style={styles.actions}>
        <Button label="Edit profile" variant="secondary" onPress={() => router.push('/onboarding')} />
        <Button label="Log out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 28 },
  head: { gap: 4 },
  actions: { gap: 10 },
})
