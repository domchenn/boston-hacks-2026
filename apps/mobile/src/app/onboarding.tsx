/**
 * Your profile: pick a username (required) and a display name, through the API
 * (GET / PUT /v1/me/profile), with the same rules and messages as the website's
 * onboarding (3–30 lowercase letters, numbers or underscores; a taken username is
 * refused). New accounts land here automatically; it doubles as Edit profile.
 */
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { StateView } from '@/components/StateView'
import { TextField } from '@/components/TextField'
import { api, statusOf } from '@/lib/api'
import { useSession } from '@/lib/session'

const USERNAME = /^[a-z0-9_]{3,30}$/

export default function OnboardingScreen() {
  const { session, profile, profileLoading } = useSession()
  if (!session || !api) return <StateView kind="message" title="Log in first" body="Log in to set up your profile." />
  if (profileLoading) return <StateView kind="loading" />
  // Keyed by account so the fields start from that account's saved values.
  return <ProfileForm key={session.user.id} initialUsername={profile?.username ?? ''} initialName={profile?.displayName ?? ''} />
}

function ProfileForm({ initialUsername, initialName }: { initialUsername: string; initialName: string }) {
  const { refreshProfile } = useSession()
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername)
  const [displayName, setDisplayName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const editing = Boolean(initialUsername)

  async function save() {
    const name = username.trim().toLowerCase()
    if (!USERNAME.test(name)) return setUsernameError('Use 3–30 lowercase letters, numbers or underscores.')
    if (displayName.trim().length > 80) return setFormError('Use a display name of 80 characters or fewer.')
    setBusy(true)
    setUsernameError(null)
    setFormError(null)
    try {
      await api!.updateMyProfile({ username: name, displayName })
      await refreshProfile()
      if (router.canGoBack()) router.back()
    } catch (error) {
      const status = statusOf(error)
      if (status === 409) setUsernameError('That username is taken. Try another one.')
      else if (status === 400 || status === 422) setFormError('Some of those details aren’t allowed. Check each field and try again.')
      else setFormError(status ? 'Something went wrong on our end. Please try again.' : 'We couldn’t reach Breadcrumb. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <AppText variant="title">{editing ? 'Edit profile' : 'Pick a username'}</AppText>
        <AppText variant="secondary">It’s how friends find you, and it shows on the trails you make.</AppText>
        <TextField
          label="Username"
          value={username}
          onChangeText={(value) => setUsername(value.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={30}
          placeholder="maya_c"
          hint="3–30 lowercase letters, numbers or underscores."
          error={usernameError}
        />
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          maxLength={80}
          placeholder="Maya Chen"
          hint="Optional."
          error={formError}
        />
        <Button label={editing ? 'Save changes' : 'Continue'} busy={busy} onPress={() => void save()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { padding: 20, gap: 16 },
})
