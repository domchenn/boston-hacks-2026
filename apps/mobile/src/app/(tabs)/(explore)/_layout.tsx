/**
 * The Explore tab's stack (see TabStack): Explore draws its own header (the logo).
 */
import { TabStack } from '@/components/TabStack'

export default function ExploreLayout() {
  return <TabStack title="Explore" header={false} />
}
