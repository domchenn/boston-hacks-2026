# M03 — staging environment

Status: set up and verified 2026-11-25, with the limits below. Staging has its own database, users, photos and keys. It holds only demo content from migrations and test data.

| Piece | Staging | Production |
|---|---|---|
| Supabase | `breadcrumb-staging`, ref `amedzumavcsjcaueldzs`, us-east-2, Free | `breadcrumb`, ref `gekcvmzpahocsxnvsdyy`, us-east-2, Free |
| Organization | breadcrumb | breadcrumb (moved from giaqinoDev's Org on 2026-11-25) |
| Website | Vercel project breadcrumb-staging, https://breadcrumb-staging-seven.vercel.app | Vercel project breadcrumb, breadcrumb.boston |
| Deploys | Manual (`git.deploymentEnabled: false`) | Manual |
| Supabase GitHub integration | Not connected | Disconnected for the transfer; Deploy to production was off |
| Maps key | Separate browser key | Own key |
| API | Cloud Run `breadcrumb-api`, project `breadcrumb-staging-515905`, `us-east5`: https://breadcrumb-api-778707046180.us-east5.run.app | Not deployed yet (project `project-647004cf-4bb8-4512-9bb`, which also owns the Maps keys) |

## Evidence

| Check | Result |
|---|---|
| Migrations | Owner ran a dry run, then applied all 21 with the target named explicitly; 21 of 21 match |
| Schema | App schema dump and storage schema dump (including 4 storage policies) are identical to production; 51 app policies; RLS on all 14 public tables |
| Isolation | Deployed staging code contains only the staging Supabase URL, no `sb_secret_` key and a Maps key that differs from production's. breadcrumb.boston still uses only production. |
| Logged-out access | Reads only public published trails; cannot create a trail; sees no reports |
| Photos | 3 uploaded photos load from the staging project |
| Links | Direct page loads return 200; shared-link previews use the staging address |
| Owner-reported | Login and session, trail creation with photo, save/start/crumb/finish, draft hidden from logged-out and second users, maps |

## Working with staging

- `npm run db:push` targets the linked project, which is **production**. For staging, the human database owner runs `npx supabase db push --remote=amedzumavcsjcaueldzs --dry-run`, checks the target and list, then runs it without `--dry-run`.
- Deploy `develop` by hand in the breadcrumb-staging Vercel project (Root Directory `apps/web`), and test on https://breadcrumb-staging-seven.vercel.app. Vercel's per-deployment addresses (`…-dom-s-team3.vercel.app`) need a Vercel login and are rejected by the Maps key by design. Variable changes need a new build.
- Use only made-up test accounts and data. Never copy production data or keys here.
- Free projects pause after about a week of low activity.

## Staging API (Cloud Run) — 2026-11-26

Deployed by hand from `develop` at `2f2defe`. Setup (owner ran steps 1–3; the deploy was run with the owner's approval):

- Enabled `run.googleapis.com` and `artifactregistry.googleapis.com`; Docker registry `breadcrumb` in `us-east5`.
- Service identity `breadcrumb-api@breadcrumb-staging-515905.iam.gserviceaccount.com` with **no roles** (the API needs no Google Cloud permissions), instead of the default compute account.
- Service `breadcrumb-api`: public endpoint (the API's own guard handles sign-in), 1 CPU, 512 MiB, **0–2 instances**, concurrency 80, 30 s timeout. Settings: `APP_ENV=staging`, staging `SUPABASE_URL` and publishable key, `CORS_ORIGINS` = staging site + localhost. No secrets.

Verified live: `/health` 200 (~0.15–0.3 s), `/v1/meta` reports staging, `/v1/trails` returned the same 12 trails as staging Supabase directly and is contract-valid, detail correct, 404/400/401 cases, forged token 401, CORS allows only the staging site and localhost, request IDs present, JSON logs in Cloud Logging. The publishable key appears only in Cloud Run's deployment audit record (it stores service settings), never in application logs.

To redeploy from an up-to-date `develop` (replace nothing; the tag is the commit):

```sh
TAG=$(git rev-parse --short HEAD)
IMG=us-east5-docker.pkg.dev/breadcrumb-staging-515905/breadcrumb/api:$TAG
docker buildx build --platform linux/amd64 --provenance=false --sbom=false -f apps/api/Dockerfile -t "$IMG" --push .
gcloud run deploy breadcrumb-api --project breadcrumb-staging-515905 --region us-east5 --image "$IMG"
```

Settings and limits carry over between deploys. Build with `--platform linux/amd64`, because Cloud Run doesn't run Apple Silicon (arm64) images. `--provenance=false --sbom=false` stores one image per deploy, so the tag points at exactly the digest Cloud Run runs. (Docker's default adds an image index and an attestation, and Cloud Run then runs an untagged child manifest that cleanup rules could otherwise target.)

**Registry cleanup policy** (repository `breadcrumb`, active since 2026-11-26): keep the 5 most recent `api` images and delete anything else older than 14 days. The live image is always the newest, so it is never removed, and the 4 before it remain for rollback. Change it with `gcloud artifacts repositories set-cleanup-policies breadcrumb --location=us-east5 --project=breadcrumb-staging-515905 --policy=<file>.json`. An unused third Google Cloud project, `breadcrumb-515501` (under "No organization"), has no Maps APIs or keys; the owner may shut it down.

## Production organization transfer — 2026-11-25

Both developers agreed to move production into the breadcrumb organization. Before the move, the owner made a new encrypted backup (`breadcrumb-backup-3`: 51 tables, 6 of 6 photos matching, image checksum stored beside it) and disconnected the Supabase GitHub integration. The owner, an Owner of both organizations, then transferred the project. Afterward, the project ref, region, health, migrations (21 of 21), public row counts, photo access, sign-in providers, website bundle and publishable key all matched a snapshot taken before the move. The Vercel project connection remained. Members of the old organization only regain access through the new one. Gio later joined the breadcrumb organization and was made an Owner, so both developers are Owners. A full Google sign-in after the move is pending the owner's test.

## Not covered

Google sign-in is not configured. Signup emails and redirect URLs were not independently verified; test users were created already confirmed. Vercel's production branch setting for staging was not independently verified. Realtime was not tested.
