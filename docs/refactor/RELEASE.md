# Production releases

How `develop` reaches production (`main` → breadcrumb.boston). Releases are manual and owner-run: merging to `main` deploys nothing by itself.

## Release 1: the refactor without the API (2026-11-26)

**What ships:** the npm workspace layout (`apps/web`, `apps/api`, `packages/contracts`), the large link-preview images (`apps/web/api/og-image.ts`), and the API code, docs and CI. **The API stays off in production:** `VITE_API_URL` is not set in the production Vercel project, so the website keeps talking to Supabase directly, exactly as today. Built with production settings, the bundle contains no API code at all (Vite drops the unused client).

**Not needed:** no database changes (production already has all 21 migrations; `supabase/` only changes a README line), no backup step (M01 requires one before production database changes), and no production API deployment.

### Steps (owner)

1. **Merge the release PR** (`develop` → `main`) with **"Create a merge commit"**, not squash, so `main` and `develop` keep a shared history.
2. **Point the live Vercel project at the new layout:** Vercel → `breadcrumb` (production) → Settings → Build and Deployment → **Root Directory = `apps/web`**, with "Include files outside the root directory" **on**. Save. Do **not** add `VITE_API_URL`.
3. **Deploy:** Deployments → Create Deployment → branch `main` → Production.
4. **Check breadcrumb.boston** (signed out and signed in): the landing page, Explore and the map, a trail page, sign-in (email and Google), saving a trail, making a trail, and the profile. Text a trail link you haven't shared before (expect the large preview card).

### Rollback

- **Website:** Vercel → `breadcrumb` → Deployments → the previous production deployment → **Promote** (or "Instant Rollback"). It reuses the earlier build, so it works whatever the Root Directory is. If you later need to *rebuild* the old `main` layout, set Root Directory back to `./`.
- **Code:** revert the release merge on `main` with a PR. No data or schema changed, so nothing else needs undoing.

### Afterwards

Agents verify the live bundle (production Supabase only, no API address), `/api/og` and `/api/og-image`, and record the result here and in the migration checklist.

### Result (2026-11-26)

Released: owner merged #123 (merge commit), set the live project's Root Directory to `apps/web` and deployed `main`. The live site serves `index-BQO7Nml0.js`, byte-identical to a local production build of develop: production Supabase only, Maps key present, no API address or client. Owner checked the landing page, Explore and map, trail pages, email and Google sign-in, saving, making a trail, the profile and a shared-link preview card. One finding: trails whose stops were typed in by hand have no coordinates, so their detail map shows the stop list with a Google Maps link instead (by design). Two public trails are affected; re-picking those stops from place search fixes them. Geocoding typed addresses on save is a possible later improvement.

## Release 2: progress, ratings and friends code, still without the API (2026-11-26)

**What ships:**
- The API code, contracts and tests for M14 (trail progress, crumbs, ratings) and M15 (trending, badges, communities, follows, friends, activity, finding people).
- The web adapters that use them when `VITE_API_URL` is set.

**The API stays off in production** (no `VITE_API_URL`), so the website keeps using Supabase directly.

**What people notice on production:**
- **Finished trails:** on the Active trail page, crumbs and stop rings are read-only once the trail is finished. That matches the crumb rule below.
- **Shared links:** some apps glue the share message onto the link (`/trails/<id>%20Come%20on%20…`). Such links now open the trail instead of "Trail not found" (#129).
- **Preview cards:** those same links get the trail's own link-preview card.

**Database (done before the code, 2026-11-26):** migration `20261126214442_restrict_crumb_ticks_to_trails_in_progress` (#125). New crumb ticks now need the trail in progress. Existing ticks are kept, and unticking always works.
- **Backup first:** the owner made a fresh encrypted backup, `~/Breadcrumb Backups/breadcrumb-backup-4.sparseimage`. It holds a read-only export taken at 2026-11-27T00:06Z, with the image checksum saved beside it.
  - What it covers: database, Auth and migration history (21 versions), plus 6 of 6 photos matching production size and checksum. The photo inventory was unchanged during the export, and all 12 files are listed in the manifest.
  - The owner reopened it with the saved password.
  - Not restore-drilled; it used the same method as backup-2, which was.
- **Applying it:** the owner ran a dry run (it listed only this migration) and then pushed it.
  - Afterwards production listed all 22 migrations, matching the repo and staging, and breadcrumb.boston responded normally.
  - Staging had already run it since #125.

**Not needed:** no Vercel setting changes (Root Directory is `apps/web` since release 1), and no production API deployment.

### Steps (owner)

1. **Merge the release PR** (`develop` → `main`) with **"Create a merge commit"**, not squash.
2. **Deploy:** Vercel → `breadcrumb` → Deployments → Create Deployment → branch `main` → Production. Do **not** add `VITE_API_URL`.
3. **Check breadcrumb.boston:**
   - The landing page, Explore, a trail page, sign-in, and saving a trail.
   - Start a trail, tick and untick a crumb, refresh (the ticks stay), stop it and open it again (the ticks are still there), then finish it (crumbs read-only).
   - Rate the finished trail.
   - Share a trail with "Invite friends" and open the link signed out.

### Rollback

- **Website:** promote the previous production deployment in Vercel, as in release 1.
- **Database:** only needed if the crumb rule itself is the problem. Restore the previous `private.can_complete_item` (any progress row except aborted) with a new migration. The function change touches no data, so restoring the backup isn't needed for it.

### Result (2026-11-26)

**Released:** the owner merged #132 (merge commit `4a156a8`, which includes #130 and #131) and deployed `main`.

**The owner checked breadcrumb.boston** and reported everything working.

**Agent checks of the live site:**
- **Bundle:** `index-CfjJnU-E.js` uses the production Supabase project only. It has no staging project, no API address and no `/v1/` routes.
- **Shared links:** a link with the share message stuck to the id, fetched as a link-preview bot, returns the trail's own title and the clean `/trails/<id>` URL. `/api/og-image` answers 200.
- **Branches:** `main` and `develop` are identical after the release.

## Later releases

Turning the API on in production is its own release: deploy the API to a production Cloud Run service in the production Google Cloud project, verify it, then set `VITE_API_URL` on the production Vercel project and redeploy the website. Database changes, if any, go first, after a fresh backup (see RECOVERY.md).
