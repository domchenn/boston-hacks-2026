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

## Release 3: the API goes live in production

**What ships:** the website talks to the production API (`VITE_API_URL`) instead of Supabase directly. With it come:
- M14–M16 (everything goes through the API);
- private photos with signed links;
- self-serve account deletion;
- the university removal.

**Database changes**, all in one push after a fresh backup:
- `drop_profile_university` deletes data: the university values;
- `stop_public_photo_listing`;
- `let_admins_remove_photo_files`;
- `add_private_photo_storage`;
- `add_self_serve_account_deletion`;
- `let_moderators_move_older_photos`.

**Order matters:**
1. The website goes out first, while the API is still off. Its code no longer reads `profiles.university`, so the column can then be dropped.
2. Then the database changes.
3. Then the API.
4. Then the switch.
5. The older photos move last.

### One-time setup (owner, before the release)

Production Google Cloud project `project-647004cf-4bb8-4512-9bb`, region `us-east5` (close to Supabase's us-east-2). It mirrors staging (STAGING.md). Run in a terminal signed in to gcloud as the owner:

```sh
P=project-647004cf-4bb8-4512-9bb
R=us-east5
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$P"
gcloud artifacts repositories create breadcrumb --repository-format=docker --location="$R" --project="$P"
cat > /tmp/cleanup.json <<'JSON'
[{"name":"keep-5-recent","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":5}},
 {"name":"delete-older-than-14d","action":{"type":"Delete"},"condition":{"tagState":"any","olderThan":"14d"}}]
JSON
gcloud artifacts repositories set-cleanup-policies breadcrumb --location="$R" --project="$P" --policy=/tmp/cleanup.json
gcloud iam service-accounts create breadcrumb-api --display-name="Breadcrumb API runtime (no roles)" --project="$P"
gcloud iam service-accounts create github-deployer --display-name="GitHub Actions production deployer" --project="$P"
```

**First deploy by hand.** It creates the service with its settings; later deploys keep them. Use the production publishable key (`sb_publishable_…`, the same one the live website uses). It's not a secret.

```sh
cd ~/hackathons/boston-hacks-2026 && git checkout main && git pull
TAG=$(git rev-parse --short HEAD)
IMG=$R-docker.pkg.dev/$P/breadcrumb/api:$TAG
gcloud auth configure-docker $R-docker.pkg.dev
docker buildx build --platform linux/amd64 --provenance=false --sbom=false -f apps/api/Dockerfile -t "$IMG" --push .
gcloud run deploy breadcrumb-api --project "$P" --region "$R" --image "$IMG" \
  --service-account "breadcrumb-api@$P.iam.gserviceaccount.com" --allow-unauthenticated \
  --cpu 1 --memory 512Mi --min-instances 0 --max-instances 2 --concurrency 80 --timeout 30 \
  --set-env-vars "APP_ENV=production,SUPABASE_URL=https://gekcvmzpahocsxnvsdyy.supabase.co,SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE,CORS_ORIGINS=https://breadcrumb.boston"
```

The deploy prints the service URL (`https://breadcrumb-api-….us-east5.run.app`). That's the production API URL.

**The one-click deploy (`deploy-production-api.yml`).** Same trust setup as staging, but only `main` may deploy:

```sh
PN=$(gcloud projects describe "$P" --format='value(projectNumber)')
gcloud iam workload-identity-pools create github --location=global --project="$P" --display-name=GitHub
gcloud iam workload-identity-pools providers create-oidc breadcrumb --location=global --workload-identity-pool=github --project="$P" \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id == '1466641451' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "github-deployer@$P.iam.gserviceaccount.com" --project="$P" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github/attribute.repository_id/1466641451"
gcloud run services add-iam-policy-binding breadcrumb-api --region "$R" --project "$P" \
  --member="serviceAccount:github-deployer@$P.iam.gserviceaccount.com" --role=roles/run.developer
gcloud artifacts repositories add-iam-policy-binding breadcrumb --location="$R" --project="$P" \
  --member="serviceAccount:github-deployer@$P.iam.gserviceaccount.com" --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding "breadcrumb-api@$P.iam.gserviceaccount.com" --project="$P" \
  --member="serviceAccount:github-deployer@$P.iam.gserviceaccount.com" --role=roles/iam.serviceAccountUser
echo "GCP_PROD_WIF_PROVIDER=projects/$PN/locations/global/workloadIdentityPools/github/providers/breadcrumb"
echo "GCP_PROD_DEPLOY_SA=github-deployer@$P.iam.gserviceaccount.com"
```

In GitHub → Settings:
- **Environments:** add `production`, with deployment branches limited to `main`.
- **Variables:** add `GCP_PROD_WIF_PROVIDER` and `GCP_PROD_DEPLOY_SA` (printed above), and `PROD_API_URL` (the service URL).

None of these are secrets.

### Steps (owner)

1. **Merge the release PR** (`develop` → `main`) with "Create a merge commit".
2. **Deploy the website with the API still off:** Vercel → `breadcrumb` → Create Deployment → `main` → Production. Don't add `VITE_API_URL` yet. Check that the site loads, a profile opens and a trail opens.
3. **Fresh backup:** `breadcrumb-backup-5`, the same steps as backup-4 (RECOVERY.md). It's needed because the university values are deleted.
4. **Database:**
   - run `npx supabase db push --remote=gekcvmzpahocsxnvsdyy --dry-run` from the repo; it should list exactly the six migrations above;
   - then run it without `--dry-run`;
   - then regenerate types with `npm run db:types` (the linked project is production) and open a PR with the result.
5. **API:** do the one-time setup and first deploy if they aren't done. Otherwise run **Actions → Deploy production API** on `main` and type `deploy`. Check:
   - `curl $PROD_API_URL/v1/meta` says `production`;
   - `curl $PROD_API_URL/v1/trails` lists the live trails.
6. **Switch the website to the API:**
   - Vercel → `breadcrumb` → Settings → Environment Variables → add `VITE_API_URL` = the production API URL (Production);
   - redeploy `main` (variables only apply to new builds);
   - check on breadcrumb.boston: Explore, a trail, sign-in, save, start / tick / finish, rate, a profile, follow, make a trail, add and delete a photo, Settings (Delete account shows), and a shared-link preview.
7. **Move the older photos into private storage.** You must be a moderator in production (`profiles.is_admin = true`, set in the SQL editor, like staging). On breadcrumb.boston, signed in, open the browser console and run:
   ```js
   const t = JSON.parse(localStorage.getItem('sb-gekcvmzpahocsxnvsdyy-auth-token')).access_token
   await (await fetch('PROD_API_URL/v1/admin/photos/move-older', { method: 'POST', headers: { authorization: `Bearer ${t}` } })).json()
   ```
   Replace `PROD_API_URL` with the real URL. Expect `{ moved: 6, skipped: [] }` (production has 6 older photos), then check their trails still show them. It's safe to run again.

### Rollback

- **Before step 7:** remove `VITE_API_URL` and redeploy `main`. The website goes back to talking to Supabase directly, and the new database rules are compatible with that. The one exception: photos added through the API in the meantime don't show in that mode, because they're private.
- **After step 7:** the moved photos only show through the API. So prefer fixing forward, or roll the API back to the previous Cloud Run revision (Cloud Run → `breadcrumb-api` → Revisions → route traffic to the earlier one).
- **Website:** promote the previous production deployment in Vercel.
- **Database:** none of these migrations should need undoing. If one does, write a new migration; restore backup-5 only for data loss.

### Result (2026-11-27)

**Released:** owner merged #145 (merge commit `8c1a19b`).
- **Website, API still off:** deployed `main`. Checked live: production Supabase only, the new code (the friends-only "Trail not found" wording, no University field), photos and previews working.
- **Backup-5:** encrypted, 2026-11-27T04:55Z. 6 of 6 photos match production checksums; 12 files in the manifest; it holds the 9 university values before they were dropped.
- **Database:** the six migrations applied after a dry run, 28 of 28. Afterwards:
  - the website's profile query works and the university column is gone;
  - older photo links still opened;
  - anonymous listing of the photo bucket returns nothing.

  Types regenerated from production (#146).
- **API:** first deploy by hand of `8c1a19b` to Cloud Run `breadcrumb-api` in `project-647004cf-4bb8-4512-9bb`, at https://breadcrumb-api-wze57f4q3a-ul.a.run.app.
  - It runs as the no-role `breadcrumb-api` account: 1 CPU, 512 MiB, 0–2 instances, concurrency 80, 30 s timeout.
  - Settings: `APP_ENV=production`, the production Supabase URL and publishable key, `CORS_ORIGINS=https://breadcrumb.boston`.
  - Checked: `/health` 200 (about 0.2 s), `/v1/meta` production, the same 14 published trails as Supabase directly, `/v1/me` 401 signed out, and CORS allows only breadcrumb.boston.
- **Deploy button:** Workload Identity pool `github` / provider `breadcrumb` (repository 1466641451, `refs/heads/main` only).
  - `github-deployer` has run.developer on the service, artifactregistry.writer on the registry and serviceAccountUser on the runtime account.
  - GitHub environment `production` (main only), plus variables `GCP_PROD_WIF_PROVIDER`, `GCP_PROD_DEPLOY_SA` and `PROD_API_URL`.
  - The **Deploy production API** button hasn't been run yet.
- **Switch:** `VITE_API_URL` set (Production, Config), and `main` redeployed. The live bundle `index-BuO0DgGm.js` contains the production API address and no staging address, and the privacy page shows self-serve deletion.
  - Checked signed out through the API: trails, a trail's photos (signed links that open), neighborhoods, a profile and its stats / made trails / follow counts / followers, Trending refused signed out, shared-link previews, and no API errors in the logs.
  - The owner clicked through signed in: save, start, tick, finish, photo add/delete and follow.
- **Older photos:** the owner was made a moderator (`dom`), then ran the move. All 6 production photos are now in the private bucket with signed links, all open as cleaned JPEGs, and no public-link photos remain. A second run moved nothing more.

## Later releases

Releases after the API is live deploy the API with **Deploy production API** before the website, so the website never calls missing endpoints. Database changes go first, after a fresh backup (see RECOVERY.md).
