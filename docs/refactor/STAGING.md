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

## Production organization transfer — 2026-11-25

Both developers agreed to move production into the breadcrumb organization. Before the move, the owner made a new encrypted backup (`breadcrumb-backup-3`: 51 tables, 6 of 6 photos matching, image checksum stored beside it) and disconnected the Supabase GitHub integration. The owner, an Owner of both organizations, then transferred the project. Afterward, the project ref, region, health, migrations (21 of 21), public row counts, photo access, sign-in providers, website bundle and publishable key all matched a snapshot taken before the move. The Vercel project connection remained. Members of the old organization only regain access through the new one. Gio later joined the breadcrumb organization and was made an Owner, so both developers are Owners. A full Google sign-in after the move is pending the owner's test.

## Not covered

Google sign-in is not configured. Signup emails and redirect URLs were not independently verified; test users were created already confirmed. Vercel's production branch setting for staging was not independently verified. Realtime was not tested.
