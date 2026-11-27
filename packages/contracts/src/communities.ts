/**
 * Communities contract (M15a): the list (GET /v1/communities, sign-in optional) and
 * joining one or none (PUT /v1/me/community, sign-in required), which sets the
 * caller's profiles.community_id. A user belongs to at most one community.
 */
import { z } from 'zod'

export const Community = z.object({ id: z.uuid(), name: z.string(), slug: z.string() })
export type Community = z.infer<typeof Community>

/** By name. Communities without a slug are left out, as on the web. */
export const CommunityList = z.object({ communities: z.array(Community) })
export type CommunityList = z.infer<typeof CommunityList>

/** PUT /v1/me/community body and response: null = no community. */
export const MyCommunity = z.object({ communityId: z.uuid().nullable() }).strict()
export type MyCommunity = z.infer<typeof MyCommunity>
