/**
 * The Map tab's stack (see TabStack): the map fills the screen, so no header.
 */
import { TabStack } from '@/components/TabStack'

export default function MapLayout() {
  return <TabStack title="Map" header={false} />
}
