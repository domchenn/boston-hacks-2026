/**
 * "Your community" setting on your own You page: None / BU / BC pills, saved to
 * profiles.community_id as soon as you pick one, then the shared session profile
 * is refreshed so Explore and Make a trail see it. Part of task G6.
 */
import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useSession } from '@/lib/useSession'
import { setMyCommunity, shortName, useCommunities } from './api'

export function CommunitySetting({ onChanged }: { onChanged?: () => void }) {
  const { session, profile, refreshProfile } = useSession()
  const communities = useCommunities()
  const [saving, setSaving] = useState<string | 'none' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  if (!session || !communities || communities.length === 0) return null

  const current = profile?.community_id ?? null

  async function choose(id: string | null) {
    if (saving || id === current || !session) return
    setSaving(id ?? 'none')
    setMessage(null)
    const result = await setMyCommunity(session.user.id, id)
    if (result.ok) {
      await refreshProfile()
      const name = communities?.find((c) => c.id === id)?.name
      setMessage({ tone: 'ok', text: name ? `You’re in ${name}. You’ll see its members-only trails.` : 'You’re not in a community.' })
      onChanged?.()
    } else {
      setMessage({ tone: 'error', text: result.message })
    }
    setSaving(null)
  }

  const option = (id: string | null, label: string, title?: string) => {
    const key = id ?? 'none'
    return (
      <button
        key={key}
        type="button"
        className="tab inline-flex items-center gap-1.5"
        title={title}
        aria-pressed={current === id}
        aria-selected={current === id}
        disabled={saving !== null}
        onClick={() => choose(id)}
      >
        {saving === key ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
        {label}
      </button>
    )
  }

  return (
    <section
      id="community"
      aria-labelledby="community-title"
      className="mt-4 rounded-[var(--radius-card)] border border-line bg-white px-4 py-3.5"
    >
      <h2 id="community-title" className="m-0 text-base font-bold">
        Your community
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
        Join your school to see trails only its members can see, and to share yours with just them.
      </p>
      <div role="group" aria-label="Your community" className="flex flex-wrap gap-2">
        {option(null, 'None')}
        {communities.map((c) => option(c.id, shortName(c), c.name))}
      </div>
      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={message.tone === 'error' ? 'mt-2 mb-0 text-sm font-semibold text-crumb-deep' : 'mt-2 mb-0 text-sm text-done'}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  )
}
