/**
 * Link-preview image for shared links: GET /api/og-image?id=<trail id> draws a
 * 1200×630 card of a public trail (title, its first stops on the dotted trail,
 * stops · cost · time · rating, neighborhood); without a valid, visible trail it
 * draws the branded default card. api/og.ts points og:image here, so iMessage,
 * Slack, Discord and others show a large picture instead of a bare title.
 *
 * Runs as a Vercel Node.js function (GET handler). Layout → SVG with satori, SVG →
 * PNG with @resvg/resvg-js (native). @vercel/og wraps the same two but its Edge build
 * is rejected by Vercel outside Next.js and its Node build is missing hb.wasm, so the
 * libraries are used directly. Reads only public data with the
 * publishable key (RLS: published, public trails only), like api/og.ts. Colors are
 * copied from docs/styles/tokens.css because the image renderer can't read CSS
 * variables. Fonts: Inter (OFL, api/fonts/OFL.txt) from @fontsource/inter.
 */
/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WIDTH = 1200
const HEIGHT = 630
const MAX_STOPS_SHOWN = 3

/** From docs/styles/tokens.css. */
const C = {
  paper: '#F7F6F2',
  surface: '#FFFFFF',
  ink: '#1B1916',
  ink2: '#57534C',
  muted: '#736E66',
  line: '#E7E4DD',
  crumb: '#E8552D',
  crumbStrong: '#C2410C',
  crumbTint: '#FDEDE6',
}

type Trail = {
  title: string
  neighborhood: string | null
  estimated_cost: number | string | null
  estimated_duration_minutes: number | null
  sidequest_stops: { place_name: string; stop_order: number }[]
}

/** A minimal element tree for the image renderer (no JSX build step needed). */
type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown } }
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  // border-box everywhere: satori 0.6x otherwise adds padding and borders outside the given sizes.
  props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children, ...extra },
})

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export function stats(trail: Trail): string {
  const stops = trail.sidequest_stops.length
  const cost = trail.estimated_cost === null ? null : Number(trail.estimated_cost)
  return [
    `${stops} ${stops === 1 ? 'stop' : 'stops'}`,
    cost === null || Number.isNaN(cost) ? null : cost <= 0 ? 'Free' : `~$${Math.round(cost)}`,
    trail.estimated_duration_minutes ? `${Math.round(trail.estimated_duration_minutes / 30) / 2} hr` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
}

/** A five-point star (the bundled Inter subset has no ★ glyph). */
function star(size: number): Node {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${C.crumbStrong}" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`
  return el('img', { width: size, height: size }, undefined, {
    src: `data:image/svg+xml;base64,${btoa(svg)}`,
    width: size,
    height: size,
  })
}

function header(logoUrl: string, right: string | null): Node {
  return el('div', { alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
    el('div', { alignItems: 'center', gap: 18 }, [
      el('img', { width: 56, height: 56 }, undefined, { src: logoUrl, width: 56, height: 56 }),
      el('div', { fontSize: 38, fontWeight: 700, color: C.ink, letterSpacing: -0.5 }, 'breadcrumb'),
    ]),
    right ? el('div', { fontSize: 30, color: C.muted }, clip(right, 32)) : el('div', {}),
  ])
}

/** Numbered rings joined by orange dots, like the trail on the app's cards. Empty names draw rings only. */
function trailLine(names: string[], more: number): Node {
  // Share the 1072px content width: each ring + gap is 64px, each dotted link 66px, "+N more" about 150px.
  const nameWidth = Math.min(380, Math.floor((1072 - names.length * 64 - (names.length - 1) * 66 - (more > 0 ? 150 : 0)) / names.length))
  const parts: Node[] = []
  names.forEach((name, i) => {
    if (i > 0) {
      parts.push(
        el(
          'div',
          { alignItems: 'center', gap: 7, margin: '0 14px', height: 52 },
          [0, 1, 2].map(() => el('div', { width: 8, height: 8, borderRadius: 8, backgroundColor: C.crumb })),
        ),
      )
    }
    parts.push(
      el('div', { alignItems: 'center', gap: 12 }, [
        el(
          'div',
          {
            width: 52,
            height: 52,
            borderRadius: 52,
            border: `5px solid ${C.crumb}`,
            backgroundColor: C.surface,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700,
            color: C.ink,
          },
          String(i + 1),
        ),
        ...(name
          ? [
              el(
                'div',
                { display: 'block', fontSize: 28, color: C.ink2, maxWidth: nameWidth, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                name,
              ),
            ]
          : []),
      ]),
    )
  })
  if (more > 0) parts.push(el('div', { fontSize: 28, color: C.muted, marginLeft: 18 }, `+${more} more`))
  return el('div', { alignItems: 'center', flexWrap: 'nowrap' }, parts)
}

function trailCard(trail: Trail, rating: number | null, logoUrl: string): Node {
  const stops = [...trail.sidequest_stops].sort((a, b) => a.stop_order - b.stop_order)
  const shown = stops.slice(0, MAX_STOPS_SHOWN).map((s) => s.place_name)
  return el(
    'div',
    { flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: 64, backgroundColor: C.paper },
    [
      header(logoUrl, trail.neighborhood),
      el('div', { fontSize: 68, fontWeight: 700, color: C.ink, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1060 }, clip(trail.title, 70)),
      shown.length > 0 ? trailLine(shown, stops.length - shown.length) : el('div', {}),
      el(
        'div',
        {
          alignSelf: 'flex-start',
          alignItems: 'center',
          gap: 10,
          fontSize: 32,
          fontWeight: 700,
          color: C.crumbStrong,
          backgroundColor: C.crumbTint,
          padding: '12px 26px',
          borderRadius: 999,
        },
        [
          rating === null ? stats(trail) : `${stats(trail)}  ·`,
          ...(rating === null ? [] : [star(30), rating.toFixed(1)]),
        ],
      ),
    ],
  )
}

function defaultCard(logoUrl: string): Node {
  return el(
    'div',
    { flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: 64, backgroundColor: C.paper },
    [
      header(logoUrl, 'Boston'),
      el('div', { flexDirection: 'column', gap: 20 }, [
        el('div', { fontSize: 76, fontWeight: 700, color: C.ink, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }, "You've lived here. Have you explored it?"),
        el('div', { fontSize: 32, color: C.ink2, maxWidth: 1072 }, 'Student-made trails around Boston, by T, bus, bike or on foot.'),
      ]),
      trailLine(['', '', '', ''], 0),
    ],
  )
}

async function loadFonts() {
  // Literal new URL(…, import.meta.url) paths let Vercel include the font files in the function.
  const [regular, bold] = await Promise.all([
    readFile(new URL('./fonts/inter-latin-400-normal.woff', import.meta.url)),
    readFile(new URL('./fonts/inter-latin-700-normal.woff', import.meta.url)),
  ])
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
  ]
}

async function fetchTrail(id: string): Promise<{ trail: Trail; rating: number | null } | null> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) return null
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const select = 'title,neighborhood,estimated_cost,estimated_duration_minutes,sidequest_stops(place_name,stop_order)'
  const [trailRes, ratingRes] = await Promise.all([
    fetch(`${base}/rest/v1/sidequests?id=eq.${id}&select=${encodeURIComponent(select)}`, { headers }),
    fetch(`${base}/rest/v1/sidequest_rating_stats?sidequest_id=eq.${id}&select=avg_overall,rating_count`, { headers }),
  ])
  if (!trailRes.ok) return null
  const [trail] = (await trailRes.json()) as Trail[]
  if (!trail) return null
  const [stats] = ratingRes.ok ? ((await ratingRes.json()) as { avg_overall: number | string | null; rating_count: number | null }[]) : []
  const rating = stats?.rating_count && stats.avg_overall !== null ? Number(stats.avg_overall) : null
  return { trail, rating: rating !== null && Number.isFinite(rating) ? rating : null }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const logoUrl = `${url.origin}/favicon.svg`

  let found: Awaited<ReturnType<typeof fetchTrail>> = null
  if (UUID.test(id)) {
    // One retry: a brief network blip shouldn't turn a real trail into the default card.
    for (let attempt = 0; attempt < 2 && !found; attempt++) {
      try {
        found = await fetchTrail(id)
        if (!found) break // the trail is missing or not public: no point retrying
      } catch {
        found = null
      }
    }
  }

  const card = found ? trailCard(found.trail, found.rating, logoUrl) : defaultCard(logoUrl)
  // satori expects a React element; this plain tree has the same shape.
  const svg = await satori(card as unknown as Parameters<typeof satori>[0], { width: WIDTH, height: HEIGHT, fonts: await loadFonts() })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng()
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      // Trail cards: an hour on Vercel's CDN. The plain default card: a day. A trail link that fell back
      // (missing, private or a failed lookup): five minutes, so a real trail recovers quickly.
      'cache-control': `public, max-age=0, s-maxage=${found ? 3600 : id ? 300 : 86400}, stale-while-revalidate=86400`,
    },
  })
}
