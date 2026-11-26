/**
 * The four rating questions, in one place so the Rate page's stars and the Trail
 * detail page's review bars use the same words and order. `key` matches the
 * fields of RatingInput / TrailRatingBreakdown (sidequest_ratings.*_rating).
 */

export type RatingKey = 'enjoyment' | 'memorability' | 'price' | 'time'

export const RATING_QUESTIONS: { key: RatingKey; label: string }[] = [
  { key: 'enjoyment', label: 'Fun' },
  { key: 'memorability', label: 'Memorable' },
  { key: 'price', label: 'Worth the money' },
  { key: 'time', label: 'Worth the time' },
]
