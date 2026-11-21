/**
 * Route table for the whole app (React Router). Maps each URL to a page and
 * wraps pages in the shared AppLayout. Each lane owns the pages its routes
 * point to; see docs/TASKS.md for who owns which route.
 */

import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
