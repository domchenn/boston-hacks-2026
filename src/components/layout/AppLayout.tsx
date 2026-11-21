/**
 * App shell shared by every page: the top header (Breadcrumb logo on the left,
 * Log in / account + Log out on the right) and an <Outlet /> where the current
 * route's page renders. Login state comes from useSession().
 */

import { Compass, LogIn, LogOut } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/useSession'

/** Right side of the header: who's logged in, with a log-out button, or a log-in link. */
function AccountMenu() {
  const { session, profile, loading, signOut } = useSession()
  const navigate = useNavigate()

  if (loading) return null

  if (!session) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">
          <LogIn aria-hidden />
          Log in
        </Link>
      </Button>
    )
  }

  const name = profile?.display_name || profile?.username || session.user.email || 'Account'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex items-center gap-3">
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="size-8 rounded-full border object-cover"
        />
      ) : null}
      <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{name}</span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        <LogOut aria-hidden />
        Log out
      </Button>
    </div>
  )
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Compass className="size-5 text-primary" aria-hidden />
            Breadcrumb
          </Link>
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
