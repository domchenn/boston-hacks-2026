import { Compass } from 'lucide-react'
import { Link, Outlet } from 'react-router'

/** Shared app shell. Feature owners add nav links here as their routes land. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Compass className="size-5 text-primary" aria-hidden />
            Sidequests
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
