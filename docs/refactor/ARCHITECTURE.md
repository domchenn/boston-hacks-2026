# Architecture

Status: target proposal; verify actual implementation against checklist.

## Current baseline
Vite/React browser → Supabase JS / RPC → PostgreSQL with RLS; Supabase Auth and Storage; Google Maps/MBTA; Vercel-hosted web and OG function. Check actual deployment settings before changes.

M00 inventory and verification limits: [BASELINE.md](BASELINE.md). No API service, mobile client, workspace or Next.js app exists yet. Existing Storage media is public; target private uploads require new design/tests.

## Target
```mermaid
flowchart TD
  WEB[Next.js web / Vercel] --> API
  MOBILE[Expo iOS and Android] --> API
  WEB --> AUTH[Supabase Auth]
  MOBILE --> AUTH
  AUTH -. verified JWT .-> API
  subgraph Railway[Railway / Docker]
    API[NestJS + Fastify / REST OpenAPI]
    API --> DOMAIN[Trails / Outings / Social / Media / Discovery / Moderation / AI]
  end
  DOMAIN --> DB[Supabase PostgreSQL + PostGIS]
  DOMAIN --> STORAGE[Supabase Storage]
  WEB -. authorized upload .-> STORAGE
  MOBILE -. authorized upload .-> STORAGE
  DOMAIN --> MAP[Google Maps / MBTA]
  DOMAIN -. future AI .-> AI[AI SDK / OpenRouter]
  DOMAIN --> NOTIFY[Resend / Expo Push]
  DOMAIN -. later .-> QUEUE[Redis / BullMQ workers]
  API -. errors and logs .-> OBS[Sentry / Pino]
  WEB -. analytics .-> ANALYTICS[PostHog]
  MOBILE -. analytics .-> ANALYTICS
```
Cloudflare DNS and applicable edge protection. Existing user-scoped SQL/RPC paths remain until authorization equivalence is verified. Drizzle is a proposed restricted query layer; Supabase CLI owns migrations. Avoid bypassing RLS. Published trails, individual/group outings and original crew are distinct concepts; design new schema additively.

## Deployment
```mermaid
flowchart TD
  F[Feature branch] --> PR[PR checks and review]
  PR --> D[develop]
  D --> S[Isolated staging web API DB storage]
  S --> QA[Staging testing and approval]
  QA --> R[Release PR to main]
  R --> P[Production web API DB storage]
  S --> EAS[Expo internal build]
  P --> STORE[Human-approved app store release]
```
Use isolated credentials/data, approved migration order and immutable backend image promotion where feasible. Mobile clients require compatible API versions. Staging URL proposed: staging.breadcrumb.boston; not verified live.

## Repository target
```
apps/web/       # Vite initially, Next.js when ready
apps/api/       # NestJS, Dockerfile
apps/mobile/    # Expo
packages/       # database, types, validation, api-client, config, utils as needed
supabase/       # existing migrations, tests, seed and config
.github/        # CI/CD
infrastructure/ # compose and deployment notes as needed
docs/
```
