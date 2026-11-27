/**
 * Settings on your own profile, opened by the gear: Edit profile (name, photo,
 * bio: the onboarding form), Friends & privacy (private account switch and close
 * friends list, PrivacySettings), Log out and Delete account (with an inline
 * confirmation; only where the website talks to the API). A native <dialog> like the
 * followers popup: Esc, the X or the backdrop closes it; centered on desktop,
 * a bottom sheet on phones. Used by ProfilePage (/me).
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoaderCircle, LogOut, Pencil, Trash2, X } from 'lucide-react'
import { canDeleteAccount, deleteMyAccount } from '@/features/account/api'
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

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function deleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteMyAccount()
    if (!result.ok) {
      setDeleting(false)
      setDeleteError(result.message)
      return
    }
    onClose()
    // The account is gone; signing out clears the session this browser still holds.
    await signOut().catch(() => undefined)
    navigate('/', { replace: true })
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
            {canDeleteAccount() ? (
              <div className="mt-2 border-t border-line pt-2 pb-1">
                {confirmDelete ? (
                  <div role="group" aria-labelledby="delete-account-title" className="rounded-[12px] border border-line bg-paper p-3">
                    <p id="delete-account-title" className="m-0 font-bold text-ink">
                      Delete your account?
                    </p>
                    <p className="mt-1 mb-3 text-sm text-ink-2">
                      This removes it for good: your profile, the trails you made (with everyone’s progress, ratings and photos on
                      them), your ratings, photos, progress and follows. It can’t be undone.
                    </p>
                    {deleteError ? (
                      <p role="alert" className="mt-0 mb-3 text-sm text-crumb-deep">
                        {deleteError}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <button type="button" className="btn btn--sm btn--ink flex-1" onClick={deleteAccount} disabled={deleting}>
                        {deleting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                        Delete my account
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary flex-1"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                        autoFocus
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className={cn(rowClass, 'text-ink-2')}>
                    <Trash2 aria-hidden className="size-5 text-ink-2" />
                    Delete account
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
