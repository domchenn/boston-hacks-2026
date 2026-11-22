/**
 * "Who can see this" for Make a trail / Edit trail: Everyone, or only your
 * community. Saved as community_id through save_trail() (migration
 * add_community_to_save_trail). Without a community there's just "Everyone" and
 * a pointer to the You page. When editing a trail limited to a community you've
 * since left, that community stays as an option so saving doesn't change it.
 * Part of task G6.
 */
import { Link } from 'react-router'
import { useSession } from '@/lib/useSession'
import { useCommunities } from './api'

type Props = {
  value: string | null
  onChange: (communityId: string | null) => void
  labelClass: string
}

export function VisibilityField({ value, onChange, labelClass }: Props) {
  const { profile } = useSession()
  const communities = useCommunities() ?? []
  const mine = communities.find((c) => c.id === profile?.community_id) ?? null
  // A trail already limited to another community (you switched since): keep it selectable.
  const other = value && value !== mine?.id ? (communities.find((c) => c.id === value) ?? null) : null
  const options = [
    { id: null as string | null, label: 'Everyone' },
    ...(mine ? [{ id: mine.id, label: `${mine.name} only` }] : []),
    ...(other ? [{ id: other.id, label: `${other.name} only (not your community now)` }] : []),
  ]

  return (
    <fieldset>
      <legend className={labelClass}>Who can see this</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id ?? 'everyone'}
            type="button"
            className="tab"
            aria-pressed={value === o.id}
            aria-selected={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {value
          ? 'Only members of this community will see it in the feed.'
          : mine
            ? 'Anyone on Breadcrumb can find it.'
            : (
                <>
                  Anyone on Breadcrumb can find it.{' '}
                  <Link to="/me#community" className="font-semibold text-crumb-strong hover:text-crumb-deep">
                    Join your school’s community
                  </Link>{' '}
                  to share with just them.
                </>
              )}
      </p>
    </fieldset>
  )
}
