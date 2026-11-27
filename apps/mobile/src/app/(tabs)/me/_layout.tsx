/**
 * The You tab's stack (see TabStack): You draws its own header (avatar and name); Settings opens in this stack.
 */
import { TabStack } from '@/components/TabStack'

export default function YouLayout() {
  return <TabStack title="You" header={false} />
}
