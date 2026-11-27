/**
 * Rate (or re-rate) a trail you finished, opened from "Rate this trail" on its page.
 * Loads the trail and your ticked crumbs for the summary, then shows RateTrail; posting
 * or skipping goes back. The database only accepts ratings of finished, not-your-own trails.
 */
import { useEffect, useState } from 'react'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import type { TrailDetail } from '@breadcrumb/contracts'
import { StateView } from '@/components/StateView'
import { RateTrail } from '@/features/trail/RateTrail'
import { api } from '@/lib/api'

type State = { status: 'loading' } | { status: 'ready'; trail: TrailDetail; crumbsDone: number | null } | { status: 'error' }

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [state, setState] = useState<{ id: string; value: State } | null>(null)

  useEffect(() => {
    if (!api) return
    const client = api
    let cancelled = false
    Promise.all([client.getTrail(id), client.getTickedCrumbs(id).catch(() => null)]).then(
      ([trail, crumbs]) =>
        !cancelled &&
        setState({ id, value: trail ? { status: 'ready', trail, crumbsDone: crumbs ? crumbs.length : null } : { status: 'error' } }),
      () => !cancelled && setState({ id, value: { status: 'error' } }),
    )
    return () => {
      cancelled = true
    }
  }, [id])

  const current = state?.id === id ? state.value : { status: 'loading' as const }
  return (
    <>
      <Stack.Screen options={{ title: 'Rate trail' }} />
      {current.status === 'loading' ? (
        <StateView kind="loading" />
      ) : current.status === 'error' ? (
        <StateView kind="message" title="Couldn’t load this trail" body="Check your connection and try again." />
      ) : (
        <RateTrail trail={current.trail} crumbsDone={current.crumbsDone} onDone={() => router.back()} />
      )}
    </>
  )
}
