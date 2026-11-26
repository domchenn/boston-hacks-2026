/**
 * App entry point. Mounts <App /> into #root in index.html and loads global
 * styles (index.css). <Analytics /> is Vercel Web Analytics: anonymous page views
 * (no cookies), only sent on the deployed site once Analytics is enabled for the
 * project in the Vercel dashboard. You rarely need to touch this file.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
