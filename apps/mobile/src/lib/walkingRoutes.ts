/**
 * Real walking routes between a trail's stops, from Apple (modules/apple-directions):
 * for each stop reached on foot, the line from the previous stop and its time. Bus, T
 * and bike legs, and stops without coordinates, get nothing: we never draw straight
 * lines or invent times (PRD §5.5). Routes are cached while the app runs and fetched one
 * at a time (Apple limits how fast apps may ask). Only stop coordinates go to Apple.
 */
import { useEffect, useState } from 'react'
import type { TrailStop } from '@breadcrumb/contracts'
import { AppleDirections, type WalkingRoute } from '../../modules/apple-directions'

export type { WalkingRoute }

const cache = new Map<string, Promise<WalkingRoute | null>>()

function routeBetween(from: TrailStop, to: TrailStop): Promise<WalkingRoute | null> {
  const key = `${from.latitude},${from.longitude}>${to.latitude},${to.longitude}`
  let route = cache.get(key)
  if (!route) {
    route = AppleDirections!.walkingRoute(from.latitude!, from.longitude!, to.latitude!, to.longitude!).catch(() => {
      cache.delete(key) // a failure (e.g. offline) is retried next time
      return null
    })
    cache.set(key, route)
  }
  return route
}

/** Walking routes keyed by the id of the stop they arrive at. Fills in as Apple answers. */
export function useWalkingRoutes(stops: TrailStop[]): Record<string, WalkingRoute> {
  const [routes, setRoutes] = useState<{ key: string; value: Record<string, WalkingRoute> }>({ key: '', value: {} })
  const key = stops.map((s) => `${s.id}:${s.latitude},${s.longitude}:${s.travelModeToStop}`).join('|')

  useEffect(() => {
    if (!AppleDirections) return
    let cancelled = false
    ;(async () => {
      const found: Record<string, WalkingRoute> = {}
      for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1]!
        const to = stops[i]!
        const walkable =
          to.travelModeToStop === 'walk' &&
          from.latitude !== null && from.longitude !== null && to.latitude !== null && to.longitude !== null
        if (!walkable) continue
        const route = await routeBetween(from, to)
        if (cancelled) return
        if (route && route.coordinates.length > 1) {
          found[to.id] = route
          setRoutes({ key, value: { ...found } })
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // `key` captures everything about the stops that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return routes.key === key ? routes.value : {}
}

/** 240 s → "4 min walk"; rounds up so it's never shorter than Apple says. */
export function walkMinutes(route: WalkingRoute): string {
  return `${Math.max(1, Math.ceil(route.seconds / 60))} min walk`
}
