/**
 * JavaScript side of the local apple-directions module (ios/AppleDirectionsModule.swift).
 * null on platforms without it (Android, web, or a build made before the module existed),
 * so callers simply draw no route.
 */
import { requireOptionalNativeModule } from 'expo'

export type WalkingRoute = {
  seconds: number
  meters: number
  coordinates: { latitude: number; longitude: number }[]
}

type AppleDirectionsNative = {
  walkingRoute(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): Promise<WalkingRoute | null>
}

export const AppleDirections = requireOptionalNativeModule<AppleDirectionsNative>('AppleDirections')
