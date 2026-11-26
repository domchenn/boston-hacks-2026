/**
 * Contract tests: the schemas accept the web app's current shapes and reject
 * malformed data; list query parameters parse from strings and reject bad input.
 */
import { describe, expect, it } from 'vitest'
import { FeedTrail, SaveTrailBody, TrailDetail, TrailIdParams, TrailList, TrailListQuery } from '../src/index.js'
import { feedTrail, trailDetail } from './fixtures.js'

describe('response schemas', () => {
  it('accept a feed card and a list of them', () => {
    expect(FeedTrail.parse(feedTrail)).toEqual(feedTrail)
    expect(TrailList.parse({ trails: [feedTrail] }).trails).toHaveLength(1)
  })

  it('accept a full trail detail', () => {
    expect(TrailDetail.parse(trailDetail)).toEqual(trailDetail)
  })

  it.each([
    ['an unknown category', { ...feedTrail, category: 'nightlife' }],
    ['an unknown T line', { ...feedTrail, primaryLine: 'purple' }],
    ['a rating above 5', { ...feedTrail, rating: { average: 6, count: 1 } }],
    ['a negative cost', { ...feedTrail, estimatedCost: -1 }],
    ['a non-uuid id', { ...feedTrail, id: '42' }],
    ['a missing places list', { ...feedTrail, places: undefined }],
  ])('reject %s', (_label, value) => {
    expect(FeedTrail.safeParse(value).success).toBe(false)
  })

  it('rejects a detail with an unknown visibility or travel mode', () => {
    expect(TrailDetail.safeParse({ ...trailDetail, visibility: 'secret' }).success).toBe(false)
    const badStop = { ...trailDetail.stops[0], travelModeToStop: 'ferry' }
    expect(TrailDetail.safeParse({ ...trailDetail, stops: [badStop] }).success).toBe(false)
  })
})

describe('TrailListQuery', () => {
  it('is empty when no filters are given', () => {
    expect(TrailListQuery.parse({})).toEqual({})
  })

  it('coerces query-string values', () => {
    expect(
      TrailListQuery.parse({ lateNight: 'true', minCost: '0', maxCost: '20', maxMinutes: '90', category: 'outdoors' }),
    ).toEqual({ lateNight: true, minCost: 0, maxCost: 20, maxMinutes: 90, category: 'outdoors' })
  })

  it.each([
    ['an unknown key', { colour: 'red' }],
    ['a non-boolean flag', { lateNight: 'yes' }],
    ['a negative cost', { maxCost: '-5' }],
    ['min above max', { minCost: '30', maxCost: '10' }],
    ['a fractional duration', { maxMinutes: '1.5' }],
    ['an unknown category', { category: 'nightlife' }],
    ['a non-uuid community', { communityId: 'bu' }],
    ['an empty neighborhood', { neighborhood: '   ' }],
  ])('rejects %s', (_label, value) => {
    expect(TrailListQuery.safeParse(value).success).toBe(false)
  })
})

describe('TrailIdParams', () => {
  it('requires a uuid', () => {
    expect(TrailIdParams.safeParse({ id: trailDetail.id }).success).toBe(true)
    expect(TrailIdParams.safeParse({ id: 'abc' }).success).toBe(false)
  })
})

describe('SaveTrailBody', () => {
  const base = { title: 'Walk', status: 'draft', stops: [] }
  it('accepts the web payload and keeps absent keys absent', () => {
    const parsed = SaveTrailBody.parse({
      ...base,
      category: 'outdoors',
      visibility: 'friends',
      stops: [{ place_name: 'A', latitude: 42.3, longitude: -71.1, crumb: '' }],
    })
    expect(parsed).not.toHaveProperty('community_id')
    expect(parsed.visibility).toBe('friends')
  })

  it.each([
    ['an unknown key', { ...base, owner: 'me' }],
    ['a bad status', { ...base, status: 'archived' }],
    ['a bad travel mode', { ...base, stops: [{ place_name: 'A', travel_mode_to_stop: 'ferry' }] }],
    ['an out-of-range latitude', { ...base, stops: [{ place_name: 'A', latitude: 120 }] }],
    ['a non-uuid community', { ...base, community_id: 'bu' }],
    ['a too-long title', { ...base, title: 'x'.repeat(121) }],
  ])('rejects %s', (_label, value) => {
    expect(SaveTrailBody.safeParse(value).success).toBe(false)
  })
})

