/**
 * Make a trail (opened by the + in the tab bar): a placeholder until the trail editor
 * comes to the app (M21). Signed out, it asks you to log in first.
 */
import { useRouter } from 'expo-router'
import { StateView } from '@/components/StateView'
import { useSession } from '@/lib/session'

export default function MakeScreen() {
  const { session } = useSession()
  const router = useRouter()
  if (!session) {
    return (
      <StateView
        kind="message"
        title="Make a trail"
        body="Log in to make your own trails."
        action={{ label: 'Log in', onPress: () => router.replace('/sign-in') }}
      />
    )
  }
  return <StateView kind="message" title="Making trails is coming" body="For now, make trails on breadcrumb.boston." />
}
