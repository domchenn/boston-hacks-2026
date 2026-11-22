/**
 * Settings on your own profile, opened by the gear: Edit profile (name, photo,
 * bio: the onboarding form), Friends & privacy (private account switch and close
 * friends list, PrivacySettings) and Log out. A native <dialog> like the
 * followers popup: Esc, the X or the backdrop closes it; centered on desktop,
 * a bottom sheet on phones. Used by ProfilePage (/me).
 */

import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { LogOut, Pencil, X } from 'lucide-react'
import { PrivacySettings } from '@/features/friends/PrivacySettings'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'

type Props = { open: boolean; onClose: () => void; viewerId: string; isPrivate: boolean }

export function ProfileSettingsDialog({ open, onClose, viewerId, isPrivate }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { signOut } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function logOut() {
    onClose()
    await signOut()
    navigate('/login')
  }

  const rowClass =
    'flex h-12 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 text-left text-base font-semibold text-ink hover:bg-paper focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        'm-auto w-[min(100%-2rem,480px)] overflow-hidden rounded-card border border-line bg-white p-0 text-ink shadow-[var(--shadow-float)]',
        'backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        'open:animate-in open:fade-in open:zoom-in-95 max-sm:open:slide-in-from-bottom-8 open:duration-200 motion-reduce:open:animate-none',
      )}
    >
      {open ? (
        <div className="flex max-h-[min(85dvh,720px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="settings-title" className="m-0 text-base font-bold">
              Settings
            </h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <X aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-3">
            <Link to="/onboarding?next=%2Fme" onClick={onClose} className={rowClass}>
              <Pencil aria-hidden className="size-5 text-ink-2" />
              Edit profile
            </Link>
            <div className="my-3 border-t border-line pt-4">
              <PrivacySettings viewerId={viewerId} isPrivate={isPrivate} embedded />
            </div>
            <div className="border-t border-line pt-2">
              <button type="button" onClick={logOut} className={rowClass}>
                <LogOut aria-hidden className="size-5 text-ink-2" />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
