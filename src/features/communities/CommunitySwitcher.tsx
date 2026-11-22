/**
 * Explore's community switcher: All / BU / BC pills (style guide .tab). "All" is
 * every trail you can see; a community shows only trails limited to it. Those are
 * hidden by the database unless you're a member, so non-members get a short note
 * pointing to the You page. Part of task G6.
 */
import { Link } from 'react-router'
import { useSession } from '@/lib/useSession'
import { shortName, useCommunities } from './api'

export function CommunitySwitcher({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  const communities = useCommunities()
  const { profile } = useSession()
  if (!communities || communities.length === 0) return null

  const selected = communities.find((c) => c.slug === value) ?? null
  const member = selected !== null && profile?.community_id === selected.id

  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Community" className="flex flex-wrap gap-2">
        <button type="button" className="tab" aria-pressed={!selected} aria-selected={!selected} onClick={() => onChange('')}>
          All
        </button>
        {communities.map((c) => (
          <button
            key={c.id}
            type="button"
            className="tab"
            title={c.name}
            aria-label={`${c.name} only`}
            aria-pressed={selected?.id === c.id}
            aria-selected={selected?.id === c.id}
            onClick={() => onChange(c.slug)}
          >
            {shortName(c)}
          </button>
        ))}
      </div>
      {selected && !member ? (
        <p className="m-0 text-sm text-muted-foreground">
          {shortName(selected)}-only trails show to {selected.name} members.{' '}
          <Link to="/me#community" className="font-semibold text-crumb-strong hover:text-crumb-deep">
            {profile ? 'Join on your You page' : 'Log in to join'}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
