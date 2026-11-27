/**
 * The Saved tab's stack (see TabStack): Saved draws its own "Your trails" header.
 */
import { TabStack } from '@/components/TabStack'

export default function SavedLayout() {
  return <TabStack title="Saved" header={false} />
}
