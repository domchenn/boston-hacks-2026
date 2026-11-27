/**
 * Log in / Create account (opens over the tabs): email and password, one screen with a
 * switch between the two, the same messages as the website. After creating an account
 * that needs email confirmation, it says so; otherwise it closes, and a new account
 * without a username goes on to onboarding (see the root layout).
 */
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useSession } from '@/lib/session'

type Mode = 'sign-in' | 'sign-up'

export default function SignInScreen() {
  const { signIn, signUp } = useSession()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  async function submit() {
    if (!email.includes('@')) return setError('Enter your email address.')
    if (password.length < (mode === 'sign-up' ? 8 : 1)) {
      return setError(mode === 'sign-up' ? 'Use a password of at least 8 characters.' : 'Enter your password.')
    }
    setBusy(true)
    setError(null)
    const result = mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (!result.ok) return setError(result.message)
    if (result.needsConfirmation) return setCheckEmail(true)
    if (router.canGoBack()) router.back()
  }

  if (checkEmail) {
    return (
      <View style={styles.screen}>
        <AppText variant="title">Check your email</AppText>
        <AppText variant="secondary">
          We sent a link to {email.trim()}. Open it to confirm your account, then log in here.
        </AppText>
        <Button
          label="Log in"
          onPress={() => {
            setCheckEmail(false)
            setMode('sign-in')
          }}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <AppText variant="title">{mode === 'sign-in' ? 'Welcome back' : 'Join Breadcrumb'}</AppText>
        <AppText variant="secondary">
          {mode === 'sign-in' ? 'Log in to save trails, run them and see your friends.' : 'Make an account to save and run trails around Boston.'}
        </AppText>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
          hint={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
          error={error}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <Button label={mode === 'sign-in' ? 'Log in' : 'Create account'} busy={busy} onPress={() => void submit()} />
        <Button
          label={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Log in'}
          variant="ghost"
          onPress={() => {
            setError(null)
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { padding: 20, gap: 16 },
})
