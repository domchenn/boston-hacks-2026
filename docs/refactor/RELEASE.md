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

## Later releases

Turning the API on in production is its own release: deploy the API to a production Cloud Run service in the production Google Cloud project, verify it, then set `VITE_API_URL` on the production Vercel project and redeploy the website. Database changes, if any, go first, after a fresh backup (see RECOVERY.md).
