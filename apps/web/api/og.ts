/**
 * Link previews for shared trail links (task D8).
 *
 * The app renders in the browser, so link-preview bots (iMessage, Discord,
 * Slack, WhatsApp, X…) that fetch /trails/:id would only see an empty page.
 * vercel.json sends those bots here instead (matched by user agent); people
 * still get the normal app. This returns a tiny HTML page with Open Graph tags:
 * the trail's title, a one-line summary (stops · cost · time · neighborhood +
 * description) and a photo if the trail has one.
 *
 * Runs as a Vercel Edge Function. Reads only public data with the publishable
 * key (RLS: published trails only). Env: VITE_SUPABASE_URL,
 * VITE_SUPABASE_PUBLISHABLE_KEY (already set in Vercel for the app).
 *
 * The triple-slash reference below gives Vercel's separate type-check of this
 * function the Node types it needs for process.env.
 */
/// <reference types="node" />

export const config = { runtime: 'edge' }

const SITE = 'Breadcrumb'
const TAGLINE = "You've lived here. Have you explored it?"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Trail = {
  title: string
  description: string | null
  neighborhood: string | null
  estimated_cost: number | null
  estimated_duration_minutes: number | null
  cover_image_url: string | null
  sidequest_stops: { place_name: string; stop_order: number }[]
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c)

export function summary(trail: Trail): string {
  const stops = trail.sidequest_stops.length
  const cost = trail.estimated_cost === null ? null : Number(trail.estimated_cost)
  const bits = [
    `${stops} ${stops === 1 ? 'stop' : 'stops'}`,
    cost === null ? null : cost <= 0 ? 'Free' : `~$${Math.round(cost)}`,
    trail.estimated_duration_minutes ? `${Math.round(trail.estimated_duration_minutes / 30) / 2} hr` : null,
    trail.neighborhood,
  ].filter(Boolean)
  const description = trail.description ? ` ${trail.description}` : ''
  return `${bits.join(' · ')}.${description}`.slice(0, 280)
}

export function page({ title, description, url, image }: { title: string; description: string; url: string; image: string | null }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const u = escapeHtml(url)
  const img = image ? escapeHtml(image) : null
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
${img ? `<meta property="og:image" content="${img}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ''}
<link rel="canonical" href="${u}">
</head><body><p><a href="${u}">${t}</a></p><p>${d}</p></body></html>`
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const canonical = `${url.origin}/trails/${id}`
  const fallback = page({ title: SITE, description: TAGLINE, url: url.origin, image: null })
  const html = (body: string, maxAge: number) =>
    new Response(body, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': `public, max-age=0, s-maxage=${maxAge}` },
    })

  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!UUID.test(id) || !base || !key) return html(fallback, 60)

  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const select =
      'title,description,neighborhood,estimated_cost,estimated_duration_minutes,cover_image_url,sidequest_stops(place_name,stop_order)'
    const [trailRes, photoRes] = await Promise.all([
      fetch(`${base}/rest/v1/sidequests?id=eq.${id}&select=${encodeURIComponent(select)}`, { headers }),
      fetch(`${base}/rest/v1/quest_photos?sidequest_id=eq.${id}&select=photo_url&order=created_at.desc&limit=1`, { headers }),
    ])
    const [trail] = (await trailRes.json()) as Trail[]
    if (!trail) return html(fallback, 60)
    const photos = photoRes.ok ? ((await photoRes.json()) as { photo_url: string }[]) : []
    return html(
      page({
        title: `${trail.title} · ${SITE}`,
        description: summary(trail),
        url: canonical,
        image: trail.cover_image_url ?? photos[0]?.photo_url ?? null,
      }),
      600,
    )
  } catch {
    return html(fallback, 60)
  }
}
