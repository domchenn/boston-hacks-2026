import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthPage } from '@/features/auth/AuthPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Central route table. Each feature team adds its routes as children of AppLayout,
 * e.g. { path: 'sidequests/:id', element: <SidequestDetailPage /> }.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'signup', element: <AuthPage mode="signup" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
