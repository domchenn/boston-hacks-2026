# API Documentation

## Overview

The Breadcrumb API (`apps/api`, NestJS on Fastify) is a REST API for the Breadcrumb clients: trails, progress, ratings, profiles, friends and photos. Request and response schemas live in `packages/contracts` (`@breadcrumb/contracts`, Zod) and are shared with the web app. The type names in this document are the names of those schemas.

- **Base URL:** `http://localhost:3001` locally (the `PORT` default). Deployed clients get the API URL from `VITE_API_URL`. Every route except `/health` is under `/v1`.
- **Format:** JSON in and out, except photo uploads, which send the raw image as the body. JSON bodies may be at most 1 MB. Timestamps are ISO 8601 strings.
- **Field naming:** most fields are camelCase. Fields that come straight from the `profiles` table stay snake_case (`display_name`, `avatar_url`, `is_private`), as do `SaveTrailBody` fields (the `save_trail()` payload).
- **Terminology:** a *trail* is a `sidequests` row, a *stop* is a `sidequest_stops` row and a *crumb* is a `checklist_items` row.
- **Request IDs:** every response carries an `x-request-id` header. You can send your own (1–64 characters from `A-Z a-z 0-9 . _ -`); otherwise one is generated. Error bodies repeat it as `requestId`.
- **OpenAPI:** the generated spec is at `GET /v1/openapi.json`. Outside production, an interactive docs page is served at `/docs`.

### Authentication

Send a Supabase access token for the same Supabase project the API is configured with:

```
Authorization: Bearer <supabase access token>
```

The token must be signed with ES256 or RS256 and carry `role: authenticated`, `aud: authenticated` and a user id in `sub`. Anonymous (guest) Supabase sessions are accepted. Each route has one of three auth modes:

| Auth | Behavior |
|---|---|
| **Required** (default) | No token or an invalid token → `401`. |
| **Optional** | No token is fine; you get what a signed-out visitor may see. A token that *is* sent must be valid, or the request gets `401`. |
| **None** | The `Authorization` header is ignored. |

The API reads data *as the caller*: it forwards the caller's token to Supabase, so Postgres row-level security (RLS) decides what each request can see or change. Drafts, friends-only, close-friends-only and community-only trails appear only to people allowed to see them. Trails hidden from you behave as if they don't exist: they're omitted from lists, and single reads return `404`.

---

## Endpoints

Path parameters named `id`, `trailId`, `userId`, `crumbId` and `photoId` must be UUIDs, or the request fails with `400`. Query objects are strict: unknown query keys are a `400`, so typos fail loudly. The errors listed under each endpoint are in addition to the common ones described in [Error Handling](#error-handling).

### System

#### `GET /health` — Health check
**Auth:** none. A liveness check that doesn't touch the database.

`200`
```json
{ "status": "ok" }
```

#### `GET /v1/meta` — API info
**Auth:** none. Reports which deployment you've reached.

`200`
```json
{ "name": "breadcrumb-api", "version": "0.1.0", "environment": "staging" }
```
`environment` is one of `local`, `staging`, `production`.

#### `GET /v1/openapi.json` — OpenAPI document
**Auth:** none. Returns the generated OpenAPI 3 spec.

#### `GET /v1/me` — Current user
**Auth:** required. Returns the identity read from the verified token. No database access.

`200`
```json
{ "id": "5f3a…-uuid", "email": "someone@example.com", "aal": "aal1", "isAnonymous": false }
```
`email` and `aal` may be `null`. `aal` is `aal2` when the user signed in with MFA.

---

### Trails

#### `GET /v1/trails` — List trails (Explore feed)
**Auth:** optional. Lists published trails the caller can see, newest first.

| Query | Type | Notes |
|---|---|---|
| `neighborhood` | string | Exact match, 1–80 chars |
| `lateNight` | `true` \| `false` | `true` keeps only trails with at least one stop at a place open late |
| `category` | [`Category`](#enums) | |
| `minCost`, `maxCost` | number ≥ 0 | USD per person; `minCost` must not exceed `maxCost` |
| `maxMinutes` | integer 1–10080 | |
| `communityId` | uuid | Trails limited to that community (non-members get none) |

All query parameters are optional.

`200` → `{ "trails": FeedTrail[] }` ([`FeedTrail`](#feedtrail))

#### `GET /v1/trails/:id` — Get trail detail
**Auth:** optional. Returns everything the trail page shows: stops, crumbs, rating breakdown and reviews.

`200` → [`TrailDetail`](#traildetail)
**Errors:** `404` if there's no such trail or you may not see it.

#### `POST /v1/trails` — Create trail
**Auth:** required. Creates a trail through the database function `save_trail()`, which enforces the rules (a title, a category and 2–8 stops to publish; your own community; remixing only what you can see).

**Body:** `SaveTrailBody`. Unknown keys are rejected.

```json
{
  "title": "Harbor sunset loop",
  "description": "Ferry, chowder, then the sunset.",
  "category": "outdoors",
  "status": "published",
  "estimated_cost": 25,
  "estimated_duration_minutes": 180,
  "neighborhood": "Seaport",
  "visibility": "public",
  "community_id": null,
  "stops": [
    { "place_name": "Long Wharf", "latitude": 42.36, "longitude": -71.05, "crumb": "Spot the ferry" },
    { "place_name": "Fan Pier Park", "travel_mode_to_stop": "walk", "estimated_cost": 0 }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string ≤ 120 | yes | |
| `status` | `draft` \| `published` | yes | |
| `stops` | `SaveTrailStop[]` (≤ 50) | yes | In order. `save_trail()` allows at most 8 and replaces all stops on every save |
| `description` | string ≤ 5000 \| null | no | |
| `category` | [`Category`](#enums) \| null | no | |
| `custom_category` | string ≤ 60 \| null | no | Your own category name when `category` is `other` |
| `scheduled_at` | string \| null | no | |
| `estimated_cost` | number ≥ 0 \| null | no | |
| `estimated_duration_minutes` | integer 1–10080 \| null | no | |
| `neighborhood` | string ≤ 80 \| null | no | |
| `community_id` | uuid \| null | no | `null` = everyone; an id = only that community (yours); absent = unchanged |
| `visibility` | [`TrailVisibility`](#enums) | no | Absent = unchanged (new trails default to `public`) |
| `remixed_from` | uuid \| null | no | New trails only: the trail this one was copied from |

`SaveTrailStop` fields (only `place_name` is required):

| Field | Type | Notes |
|---|---|---|
| `place_name` | string ≤ 200 | |
| `experience_id` | uuid \| null | Link to a place-library entry |
| `address` | string ≤ 300 \| null | |
| `latitude` | -90..90 \| null | |
| `longitude` | -180..180 \| null | |
| `travel_mode_to_stop` | [`TravelMode`](#enums) \| null | Ignored for the first stop |
| `estimated_cost` | number ≥ 0 \| null | |
| `crumb` | string ≤ 200 | One optional crumb (a small task) at this stop |

`201`
```json
{ "id": "b1c2…-uuid" }
```
**Errors:**
- `422`: a `save_trail()` rule failed (e.g. "Add at least 2 stops before publishing"), or something the trail points to no longer exists.
- `403`: not your trail, not your community, or a remix of a trail you can't see.
- `400`: a value `save_trail()` refuses.

The message from `save_trail()` is passed through.

#### `PUT /v1/trails/:id` — Replace trail
**Auth:** required. Same body, rules and errors as `POST /v1/trails`, but it replaces an existing trail you own. Returns `200` with `{ "id": "…" }`.

#### `GET /v1/trails/:id/stop-library` — Stops' place-library links
**Auth:** optional. Used by Edit and Remix to show each stop's linked place and that place's neighborhood.

`200`
```json
{ "stops": [{ "stopId": "…", "experienceId": "…", "neighborhood": "Back Bay" }] }
```
`experienceId` and `neighborhood` may be `null`.

#### `POST /v1/trails/:id/unpublish` — Unpublish trail
**Auth:** required. Sets the trail back to draft, so only its creator sees it. Stops and crumbs are kept.

`200`
```json
{ "id": "…", "status": "draft" }
```
**Errors:** `404` if it isn't your trail or no longer exists.

#### `DELETE /v1/trails/:id` — Delete trail
**Auth:** required. Permanently deletes the trail, along with its stops, crumbs, everyone's progress and its ratings.

`200`
```json
{ "id": "…", "deleted": true }
```
**Errors:** `404` if it isn't your trail or no longer exists.

---

### Photos

#### `GET /v1/trails/:trailId/photos` — List trail photos
**Auth:** optional. Lists a trail's photos, newest first.

`200` → `{ "photos": TrailPhoto[] }` ([`TrailPhoto`](#trailphoto))

#### `POST /v1/trails/:trailId/photos` — Upload photo
**Auth:** required. The request body is the image itself, sent with an `image/*` `Content-Type` (for example `image/jpeg`). It must be at most 5 MB. JPEG, PNG, WebP and AVIF can be decoded; HEIC can't and is refused. The API re-encodes every upload as a JPEG of at most 1600 px with **all metadata removed, including GPS**, and builds the photo's URL itself.

| Query | Type | Required | Notes |
|---|---|---|---|
| `caption` | string ≤ 300 | no | Blank = none |
| `stopId` | uuid | no | Must be a stop on this trail |

`201` → `{ "photo": TrailPhoto }`

**Errors:**
- `403`: you haven't saved, started or finished this trail. This check runs before the image is examined.
- `415`: the body isn't a decodable JPEG, PNG, WebP or AVIF image, or isn't an `image/*` type at all.
- `413`: over 5 MB.
- `400`: empty body.
- `422`: the stop isn't on this trail.
- `404`: the trail is no longer available.

#### `DELETE /v1/photos/:photoId` — Delete photo
**Auth:** required. Deletes one of your own photos and its stored file.

`200`
```json
{ "id": "…", "deleted": true }
```
**Errors:** `404` if it isn't your photo or no longer exists.

---

### Progress (saving, starting, finishing)

All routes in this section require sign-in and act on the **caller's own** progress. Each one answers with the caller's resulting [`TrailProgress`](#enums):

```json
{ "status": "in_progress" }
```

`status` is a [`UserSidequestStatus`](#enums), or `null` when you have no progress on the trail. If an action isn't allowed from your current status, it does nothing and returns `200` with your unchanged status. It is not an error. The allowed moves:

| Current status | save | unsave | start | finish | abort |
|---|---|---|---|---|---|
| none | `saved` | – | `in_progress` | `completed` | – |
| `saved` | – | none, or `aborted` if it was started | `in_progress` | `completed` | `aborted` |
| `signed_up` | – | – | `in_progress` | `completed` | `aborted` |
| `in_progress` | `saved` | – | – | `completed` | `aborted` |
| `completed` | – | – | – | – | – |
| `aborted` | `saved` | – | `in_progress` | `completed` | – |

A finished trail never changes status. A trail that's hidden from you, missing or malformed returns `404` ("This trail isn't available anymore").

| Method + Route | Name | Description |
|---|---|---|
| `PUT /v1/me/saved-trails/:trailId` | Save trail | Applies the **save** column above |
| `DELETE /v1/me/saved-trails/:trailId` | Unsave trail | Applies **unsave**. A started trail becomes `aborted`, which keeps its history and ticked crumbs |
| `GET /v1/me/trails/:trailId/progress` | Get progress | Your current status on the trail |
| `POST /v1/me/trails/:trailId/:action` | Start / finish / abort | `action` is `start`, `finish` or `abort`; anything else is a `400` |

#### `GET /v1/me/trails/:trailId/crumbs` — Ticked crumbs
**Auth:** required. Returns the ids of the crumbs you've ticked on this trail.

`200`
```json
{ "crumbIds": ["…", "…"] }
```

#### `PUT /v1/me/crumbs/:crumbId` — Tick crumb
#### `DELETE /v1/me/crumbs/:crumbId` — Untick crumb
**Auth:** required. Ticking is idempotent and only works while the trail is `in_progress`. Unticking always works. Pausing a trail keeps earlier ticks.

`200`
```json
{ "done": true }
```
(`false` after a `DELETE`.)

**Errors:** `403` from `PUT` if the trail isn't in progress.

---

### Ratings

#### `GET /v1/me/trails/:trailId/rating` — Get my rating
#### `PUT /v1/me/trails/:trailId/rating` — Rate trail (create or edit)
#### `DELETE /v1/me/trails/:trailId/rating` — Delete my rating
**Auth:** required. Each user has at most one rating per trail, so a second `PUT` edits the first. All three routes return `200` with your rating after the call, or `null` if there is none:

```json
{
  "rating": {
    "id": "…",
    "price": 4,
    "time": 5,
    "enjoyment": 5,
    "memorability": 4,
    "review": "Great at golden hour.",
    "createdAt": "2026-11-20T18:04:11.000Z"
  }
}
```

**Body (`PUT`, `RatingBody`):**

```json
{ "price": 4, "time": 5, "enjoyment": 5, "memorability": 4, "review": "Great at golden hour." }
```

The four scores are required integers from 1 to 5. `review` is optional, a string of at most 2000 characters or `null`; a blank review is stored as none.

**Errors (`PUT`):**
- `422`: you haven't finished the trail.
- `403`: you made this trail.
- `404`: the trail is no longer available.

A `DELETE` when you have no rating succeeds and returns `{ "rating": null }`.

---

### Profiles

#### `GET /v1/profiles/:handle` — Get profile
**Auth:** optional. `handle` is a user id (UUID) or a username (3–30 characters from `a-z`, `0-9`, `_`).

`200`
```json
{
  "id": "…",
  "username": "gio",
  "display_name": "Gio",
  "avatar_url": null,
  "bio": null,
  "is_private": false,
  "community": { "name": "Boston University", "slug": "bu" }
}
```
`community` is `null` if they haven't joined one.

**Errors:** `404` if no profile matches.

#### `GET /v1/profiles/:id/stats` — Profile stats
**Auth:** optional.

`200`
```json
{ "questgiverRating": { "average": 4.3, "count": 12 }, "madeCount": 5, "finishedCount": null }
```
- `questgiverRating`: the average overall rating across their trails, or `null` until someone rates one.
- `madeCount`: trails they made that you can see, excluding archived ones. Your own count includes drafts.
- `finishedCount`: only filled in for your own profile, because progress is private. For anyone else it's `null`.

#### `GET /v1/profiles/:id/made-trails` — Trails a person made
**Auth:** optional. Their non-archived trails that you can see, newest first. Your own list includes drafts.

`200` → `{ "trails": ProfileTrail[] }` ([`ProfileTrail`](#profiletrail))

#### `GET /v1/me/trails?status=` — My progress lists
**Auth:** required. Your trails with the given progress status. `status` is required and is one of `completed`, `saved` or `signed_up`. Completed trails are ordered by most recently finished; the others by most recently updated.

`200` → `{ "trails": ProfileTrail[] }`

#### `GET /v1/me/saved-trails` — Saved page
**Auth:** required. Your saved and in-progress trails, most recently updated first. Old `signed_up` rows appear as `saved`.

`200` → `{ "trails": SavedTrail[] }` ([`SavedTrail`](#savedtrail))

#### `GET /v1/me/profile` — Get my profile fields
#### `PUT /v1/me/profile` — Update my profile fields
**Auth:** required. Your username and display name, as edited on the onboarding page. Both routes return `200`:

```json
{ "username": "gio", "displayName": "Gio" }
```

Either field may be `null` in a `GET` response.

**Body (`PUT`):**
```json
{ "username": "gio", "displayName": "Gio" }
```
Both fields are required. `username` must be 3–30 characters from `a-z`, `0-9`, `_`. `displayName` is a string of at most 80 characters; a blank one is stored as `null`.

**Errors:**
- `409`: the username is taken (`PUT` only).
- `422`: the database refused a value (`PUT` only).
- `404`: your profile row is missing.

---

### Explore & communities

#### `GET /v1/trending` — Trending trails
**Auth:** required. The busiest trails by recent activity. Only per-trail totals are returned, never who was active. Trails with no recent activity are left out.

| Query | Type | Default |
|---|---|---|
| `days` | integer 1–90 | `14` |
| `limit` | integer 0–100 | `30` |

`200`
```json
{ "trails": [{ "trailId": "…", "score": 17, "people": 6 }] }
```
`people` is the number of different people active on the trail. Combine the ids with `GET /v1/trail-cards` to display them.

#### `GET /v1/neighborhoods` — Neighborhood filter list
**Auth:** optional. Neighborhoods that have at least one published trail you can see, sorted A to Z.

`200`
```json
{ "neighborhoods": ["Back Bay", "Seaport"] }
```

#### `GET /v1/me/finished-trails` — Finished trails (for badges)
**Auth:** required. Your completed trails with their T line and neighborhood. The web computes badges from these. A finished trail that has since been hidden from you still counts, with `line` and `neighborhood` set to `null`.

`200`
```json
{ "trails": [{ "completedAt": "2026-11-01T20:15:00.000Z", "line": "rl", "neighborhood": "Cambridge" }] }
```

#### `GET /v1/communities` — List communities
**Auth:** optional. All communities, sorted by name. Communities without a slug are left out.

`200`
```json
{ "communities": [{ "id": "…", "name": "Boston University", "slug": "bu" }] }
```

#### `PUT /v1/me/community` — Join or leave a community
**Auth:** required. A user belongs to at most one community.

**Body:**
```json
{ "communityId": "…" }
```
Send an id to join that community, or `null` to leave.

`200` → the same shape, showing the stored value.

**Errors:**
- `422`: no such community.
- `404`: your profile row is missing.

---

### Friends

Friends are people who follow each other. Follows are public. Only you can read your close-friends list. A private account's trails are visible only to its friends. Lists of people use the [`Person`](#person) shape.

| Method + Route | Auth | Name | Response `200` |
|---|---|---|---|
| `GET /v1/profiles/:id/follow-counts` | optional | Follow counts | `{ "followers": 10, "following": 4 }` |
| `GET /v1/profiles/:id/followers` | optional | Followers (newest first, max 500) | `{ "people": Person[] }` |
| `GET /v1/profiles/:id/following` | optional | Following (newest first, max 500) | `{ "people": Person[] }` |
| `GET /v1/me/following-ids` | required | Ids of people you follow | `{ "ids": ["…"] }` |
| `PUT /v1/me/following/:userId` | required | Follow (repeating it is fine) | `{ "following": true }` |
| `DELETE /v1/me/following/:userId` | required | Unfollow | `{ "following": false }` |
| `GET /v1/me/relationships/:userId` | required | How you're connected | `{ "following": true, "followsYou": true }` (both true = friends) |
| `GET /v1/me/friends` | required | Your friends (A to Z) | `{ "people": Person[] }` |
| `GET /v1/me/close-friends` | required | Your close-friend ids | `{ "ids": ["…"] }` |
| `PUT /v1/me/close-friends/:userId` | required | Add close friend (repeating it is fine) | `{ "closeFriend": true }` |
| `DELETE /v1/me/close-friends/:userId` | required | Remove close friend | `{ "closeFriend": false }` |
| `PUT /v1/me/privacy` | required | Make your account private or public | `{ "isPrivate": true }` |

**Body (`PUT /v1/me/privacy`):** `{ "isPrivate": true }`. The field is a required boolean.

**Errors:**
- `422`: following yourself.
- `403`: adding a close friend who isn't a friend (a mutual follow).
- `404`: the person is no longer on Breadcrumb (follow and close-friend writes), or your profile row is missing (privacy).

#### `GET /v1/trail-cards?ids=` — Trail cards by id
**Auth:** optional. `ids` is required: a comma-separated list of 1–100 trail UUIDs. Trails hidden from you are left out of the response.

`200` → `{ "trails": TrailCard[] }` ([`TrailCard`](#trailcard))

#### `GET /v1/me/friends-activity` — Friends' activity
**Auth:** required. What the people you follow made or finished, newest first. The response includes a card for every trail referenced in `items`. Items for trails hidden from you are dropped.

| Query | Type | Default |
|---|---|---|
| `limit` | integer 1–100 | `30` |

`200`
```json
{
  "items": [{ "person": { "id": "…", "username": "ana", "display_name": "Ana", "avatar_url": null }, "kind": "finished", "trailId": "…", "at": "2026-11-25T21:00:00.000Z" }],
  "trails": [ "TrailCard…" ]
}
```
`kind` is `made` or `finished`.

#### `GET /v1/me/friends-also-saved` — Friends who saved the same trails
**Auth:** required. Friends who saved trails you also saved, newest first.

`200`
```json
{ "saves": [{ "trailId": "…", "friend": { "id": "…", "username": "ana", "display_name": "Ana", "avatar_url": null } }] }
```

#### `GET /v1/people?q=` — Search people
**Auth:** required. Matches `q` against usernames and display names, ignoring a leading `@`. Results are ordered by username, never include you, and only include people who have a username. A query with fewer than 2 usable characters returns no one.

| Query | Type | Required | Default |
|---|---|---|---|
| `q` | string ≤ 100 | yes | |
| `limit` | integer 1–20 | no | `8` |

`200` → `{ "people": Person[] }`

#### `GET /v1/me/suggested-people` — People to follow
**Auth:** required. Suggestions in priority order: people who follow you, then people who made published trails, then recent members. It excludes you and anyone you already follow, and every suggestion has a username.

| Query | Type | Default |
|---|---|---|
| `limit` | integer 1–20 | `6` |

`200` → `{ "people": Person[] }`

---

## Data Models

### Enums

| Name | Values |
|---|---|
| `Category` | `food_drink`, `outdoors`, `arts_culture`, `shopping`, `attractions`, `affordable`, `other` |
| `TrailVisibility` | `public`, `friends`, `close_friends` |
| `SidequestStatus` (trail) | `draft`, `published`, `archived` |
| `UserSidequestStatus` (progress) | `saved`, `signed_up`, `in_progress`, `completed`, `aborted` |
| `TransitLine` | `rl`, `gl`, `bl`, `ol`, `sl`, `cr` |
| `TravelMode` | `walk`, `bike`, `bus`, `train` |
| `ChecklistItemType` (crumb) | `see`, `do` |

### Person
`TrailCreator` in the contracts. It's used for trail creators, reviewers, photo uploaders and every list of people.
```json
{ "id": "…", "username": "ana", "display_name": "Ana", "avatar_url": null }
```
All fields except `id` may be `null`.

### Trail summary fields
`FeedTrail` and `TrailDetail` share these fields:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `title` | string | |
| `description` | string \| null | |
| `category` | `Category` \| null | |
| `customCategory` | string \| null | Set when `category` is `other` |
| `neighborhood` | string \| null | |
| `coverImageUrl` | string \| null | |
| `estimatedCost` | number \| null | USD per person |
| `estimatedMinutes` | integer \| null | |
| `scheduledAt` | timestamp \| null | `null` = an anytime trail |
| `primaryLine` | `TransitLine` \| null | |
| `isCurated` | boolean | |
| `createdAt` | timestamp | |
| `creator` | `Person` \| null | |
| `stopCount`, `crumbCount` | integer | |
| `firstStopName`, `lastStopName` | string \| null | |

### FeedTrail
The summary fields plus:
```json
{
  "rating": { "average": 4.5, "count": 8 },
  "places": [{ "name": "Long Wharf", "latitude": 42.36, "longitude": -71.05, "openLate": false }]
}
```
- `rating.average` is the average of the four scores (1–5), or `null` if the trail is unrated.
- `places` lists every stop in order. `openLate` is `false` for places typed in by hand.

### TrailDetail
The summary fields plus:

| Field | Type | Notes |
|---|---|---|
| `status` | `SidequestStatus` | |
| `visibility` | `TrailVisibility` | |
| `communityId` | uuid \| null | |
| `remixedFrom` | `{ id, title, creator }` \| null | Only set if you can still see the source trail |
| `stops` | `TrailStop[]` | In order |
| `betweenStopCrumbs` | `TrailCrumb[]` | Crumbs not tied to a stop |
| `rating` | `{ average, count, price, time, enjoyment, memorability }` | Each score is 1–5 or `null` |
| `reviews` | `TrailReview[]` | |

**TrailStop:** `id`, `order`, `placeName`, `address`, `latitude`, `longitude`, `description`, `plannedActivity`, `travelModeToStop` (`TravelMode`, `null` for the first stop), `estimatedCost`, `notes`, `crumbs: TrailCrumb[]`. Every field except `id`, `order`, `placeName` and `crumbs` may be `null`.

**TrailCrumb:**
```json
{ "id": "…", "label": "Spot the ferry", "type": "see", "order": 0, "stopId": "…" }
```
`stopId` is `null` for crumbs between stops.

**TrailReview:** `id`, `priceRating`, `timeRating`, `enjoymentRating`, `memorabilityRating`, `overall` (the average of the four), `text` (may be `null`), `createdAt` and `reviewer` (`Person`, may be `null`).

### ProfileTrail
A trail as listed on a profile tab or in `GET /v1/me/trails`:
```json
{
  "id": "…", "title": "Harbor sunset loop", "category": "outdoors", "customCategory": null,
  "scheduledAt": null, "estimatedCost": 25, "durationMinutes": 180, "neighborhood": "Seaport",
  "trailStatus": "published", "completedAt": null, "myRating": null
}
```
- `trailStatus` is a `SidequestStatus`. `draft` only appears on your own made trails.
- `myRating` is your overall rating, filled in on finished trails you rated.

### SavedTrail
```json
{
  "id": "…", "title": "Harbor sunset loop", "category": "outdoors", "customCategory": null,
  "neighborhood": "Seaport", "estimatedCost": 25, "estimatedMinutes": 180, "stopCount": 4,
  "firstStopName": "Long Wharf", "lastStopName": "Fan Pier Park",
  "rating": { "average": 4.5, "count": 8 }, "creator": { "username": "ana" },
  "status": "saved", "updatedAt": "2026-11-24T15:30:00.000Z"
}
```
`status` is `saved` or `in_progress`.

### TrailCard
A compact trail card used by trail cards and friends' activity. It has `id`, `title`, `category`, `customCategory`, `neighborhood`, `estimatedCost`, `estimatedMinutes`, `scheduledAt`, `stopCount`, `firstStopName`, `lastStopName`, `rating: { average, count }` and `creator: { username }` (may be `null`). It's the same as `SavedTrail` without `status`/`updatedAt`, plus `scheduledAt`.

### TrailPhoto
```json
{
  "id": "…",
  "url": "https://<project>.supabase.co/storage/v1/object/public/trail-photos/…/….jpg",
  "caption": "Golden hour",
  "createdAt": "2026-11-25T22:10:00.000Z",
  "stopId": null,
  "uploader": { "id": "…", "username": "ana", "display_name": "Ana", "avatar_url": null }
}
```

---

## Error Handling

Every error, including unknown routes and malformed JSON, returns the same JSON shape (`ApiErrorBody`):

```json
{
  "error": "bad_request",
  "message": "minCost: Too small: expected number to be >=0",
  "requestId": "3f6c1a7e-…"
}
```

- `error` is a machine-readable code derived from the status.
- `message` is safe to show to users.
- `requestId` matches the `x-request-id` response header. Quote it when reporting a problem.

Validation failures list each problem as `field: problem`, joined with `; `. The wording of each problem comes from Zod; the example above is illustrative.

| Status | `error` | When |
|---|---|---|
| `400` | `bad_request` | Invalid path, query or body (wrong type, out of range, unknown key, non-UUID id); malformed JSON |
| `401` | `unauthorized` | Missing token on a sign-in-required route; malformed `Authorization` header; invalid, expired or wrong-project token, even on optional routes. Also sends `WWW-Authenticate: Bearer` |
| `403` | `forbidden` | A database rule refused the action (see each endpoint) |
| `404` | `not_found` | No such resource, or RLS hides it from you; unknown route |
| `409` | `conflict` | Username taken |
| `413` | `payload_too_large` | JSON body over 1 MB, or photo over 5 MB |
| `415` | `unsupported_media_type` | Unsupported body type (e.g. a non-image photo upload) |
| `422` | `unprocessable_entity` | A business rule failed (see each endpoint) |
| `500` | `internal_error` | Unexpected failure. The message is always `"Something went wrong."`; details are only logged on the server |
| `503` | `service_unavailable` | The API couldn't fetch Supabase's signing keys to check your token. Retry later; it doesn't mean the token is invalid |

401 messages are deliberately generic. The exact reason a token was rejected is logged on the server at debug level only.
