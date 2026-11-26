/**
 * "Invite friends" on Trail detail: opens the phone's share sheet
 * (navigator.share) with the trail's link. Where that isn't available it copies
 * the link instead, and if copying is blocked too it shows the link to copy by
 * hand. Part of task G5 (join flow).
 */
import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'copied' | 'manual'

export function InviteButton({ trailId, title, compact = false }: { trailId: string; title: string; compact?: boolean }) {
  const [status, setStatus] = useState<Status>('idle')
  const url = `${window.location.origin}/trails/${trailId}`

  async function invite() {
    const shareData = { title, text: `Come on “${title}” with me on Breadcrumb`, url }
    if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData)
        return
      } catch (error) {
        // Closing the share sheet isn't an error worth showing.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
      window.setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('manual')
    }
  }

  return (
    <span className={cn('inline-flex flex-col', compact && 'shrink-0')}>
      <button
        type="button"
        className={cn('btn btn--secondary', compact ? 'btn--lg w-14 px-0' : 'px-5.5')}
        onClick={invite}
        aria-label={compact ? 'Invite friends' : undefined}
      >
        {status === 'copied' ? <Check aria-hidden /> : <Share2 aria-hidden />}
        {compact ? null : status === 'copied' ? 'Link copied' : 'Invite friends'}
      </button>
      <span role="status" className="sr-only">
        {status === 'copied' ? 'Link copied' : ''}
      </span>
      {status === 'manual' ? (
        <label className="mt-2 block text-sm text-ink-2">
          Copy this link:
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 block w-full min-w-64 rounded-[10px] border border-line-strong bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
      ) : null}
    </span>
  )
}
