/**
 * Map tab: a placeholder until the trail map is built (after the essentials). Kept as a
 * real tab now so the app's layout matches the style guide from the start.
 */
import { StateView } from '@/components/StateView'

export default function MapScreen() {
  return <StateView kind="message" title="Map is coming" body="Soon you’ll see every trail on a map of Boston." />
}
