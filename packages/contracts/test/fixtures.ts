/**
 * Realistic sample responses in the web app's current shapes, used to check that
 * the contract accepts what the app already handles.
 */
import type { FeedTrail, TrailDetail } from '../src/index.js'

const creator = { id: 'b2ead000-0000-4000-8000-000000000001', username: 'breadcrumb', display_name: 'Breadcrumb', avatar_url: null }

export const feedTrail: FeedTrail = {
  id: '5eed0000-0000-4000-8000-000000000001',
  title: 'Sunday Café Hop',
  description: 'A slow Sunday through Beacon Hill and Back Bay.',
  category: 'food_drink',
  customCategory: null,
  neighborhood: 'Beacon Hill',
  coverImageUrl: null,
  estimatedCost: 25,
  estimatedMinutes: 150,
  scheduledAt: null,
  primaryLine: 'gl',
  isCurated: true,
  createdAt: '2026-11-21T12:00:02.123456+00:00',
  creator,
  stopCount: 2,
  crumbCount: 3,
  firstStopName: 'Tatte Bakery',
  lastStopName: 'Trident Booksellers',
  rating: { average: 4.5, count: 2 },
  places: [
    { name: 'Tatte Bakery', latitude: 42.3588, longitude: -71.0707, openLate: false },
    { name: 'Trident Booksellers', latitude: 42.3486, longitude: -71.0868, openLate: true },
  ],
}

const { places: _places, rating: _rating, ...summary } = feedTrail
void _places
void _rating

export const trailDetail: TrailDetail = {
  ...summary,
  status: 'published',
  visibility: 'public',
  communityId: null,
  remixedFrom: null,
  stops: [
    {
      id: '5eed0000-0000-4000-8000-0000000000a1',
      order: 0,
      placeName: 'Tatte Bakery',
      address: '70 Charles St, Boston, MA',
      latitude: 42.3588,
      longitude: -71.0707,
      description: null,
      plannedActivity: 'Breakfast',
      travelModeToStop: null,
      estimatedCost: 15,
      notes: null,
      crumbs: [{ id: '5eed0000-0000-4000-8000-0000000000c1', label: 'Try a shakshuka', type: 'do', order: 0, stopId: '5eed0000-0000-4000-8000-0000000000a1' }],
    },
  ],
  betweenStopCrumbs: [{ id: '5eed0000-0000-4000-8000-0000000000c2', label: 'Public Garden swans', type: 'see', order: 1, stopId: null }],
  rating: { average: 4.5, count: 2, price: 4, time: 5, enjoyment: 4.5, memorability: 4.5 },
  reviews: [
    {
      id: '5eed0000-0000-4000-8000-0000000000d1',
      priceRating: 4,
      timeRating: 5,
      enjoymentRating: 4,
      memorabilityRating: 5,
      overall: 4.5,
      text: 'Lovely morning.',
      createdAt: '2026-11-22T09:00:00+00:00',
      reviewer: creator,
    },
  ],
}
